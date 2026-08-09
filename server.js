const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

// ── CUSTOMERS ──
app.get('/api/customers', (req, res) => {
  const { industry, appliance, size, payment, month, q } = req.query;
  let rows = db.prepare('SELECT * FROM customers ORDER BY name').all();

  if (industry) rows = rows.filter(c => c.industry === industry);
  if (size && size !== 'all') rows = rows.filter(c => c.size_category === size || c.size_category === 'both');
  if (payment) rows = rows.filter(c => c.payment_rating === payment);
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter(c => c.name.toLowerCase().includes(s) || (c.city||'').toLowerCase().includes(s) || (c.contact_person||'').toLowerCase().includes(s));
  }
  if (appliance) {
    rows = rows.filter(c => {
      try { return JSON.parse(c.appliance_types || '[]').includes(appliance); } catch { return false; }
    });
  }
  if (month) {
    rows = rows.filter(c => {
      try {
        const dm = JSON.parse(c.dev_months || '{}');
        return Object.values(dm).includes(month);
      } catch { return false; }
    });
  }

  rows = rows.map(c => {
    const last = db.prepare('SELECT date,type FROM activities WHERE customer_id=? ORDER BY date DESC LIMIT 1').get(c.id);
    const actCount = db.prepare('SELECT COUNT(*) as n FROM activities WHERE customer_id=?').get(c.id).n;
    return {
      ...c,
      appliance_types: JSON.parse(c.appliance_types || '[]'),
      dev_months: JSON.parse(c.dev_months || '{}'),
      last_contact: last ? last.date : null,
      last_contact_type: last ? last.type : null,
      activity_count: actCount
    };
  });

  res.json(rows);
});

app.get('/api/customers/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(parseInt(req.params.id));
  if (!c) return res.status(404).json({ error: 'Not found' });
  const activities = db.prepare('SELECT * FROM activities WHERE customer_id=? ORDER BY date DESC').all(c.id);
  const last = activities[0];
  res.json({
    ...c,
    appliance_types: JSON.parse(c.appliance_types || '[]'),
    dev_months: JSON.parse(c.dev_months || '{}'),
    last_contact: last ? last.date : null,
    last_contact_type: last ? last.type : null,
    activities
  });
});

app.post('/api/customers', (req, res) => {
  const { name, city, state, contact_person, phone, email, website, industry, appliance_types, size_category, payment_rating, notes, dev_months } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(`INSERT INTO customers (name,city,state,contact_person,phone,email,website,industry,appliance_types,size_category,payment_rating,notes,dev_months)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    name, city||null, state||null, contact_person||null, phone||null, email||null, website||null,
    industry||null, JSON.stringify(appliance_types||[]), size_category||'both',
    payment_rating||null, notes||null, JSON.stringify(dev_months||{})
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/customers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, city, state, contact_person, phone, email, website, industry, appliance_types, size_category, payment_rating, notes, dev_months } = req.body;
  db.prepare(`UPDATE customers SET name=?,city=?,state=?,contact_person=?,phone=?,email=?,website=?,industry=?,appliance_types=?,size_category=?,payment_rating=?,notes=?,dev_months=? WHERE id=?`)
    .run(name, city||null, state||null, contact_person||null, phone||null, email||null, website||null,
      industry||null, JSON.stringify(appliance_types||[]), size_category||'both',
      payment_rating||null, notes||null, JSON.stringify(dev_months||{}), id);
  res.json({ ok: true });
});

app.delete('/api/customers/:id', (req, res) => {
  db.prepare('DELETE FROM activities WHERE customer_id=?').run(parseInt(req.params.id));
  db.prepare('DELETE FROM customers WHERE id=?').run(parseInt(req.params.id));
  res.json({ ok: true });
});

// ── ACTIVITIES ──
app.get('/api/customers/:id/activities', (req, res) => {
  res.json(db.prepare('SELECT * FROM activities WHERE customer_id=? ORDER BY date DESC').all(parseInt(req.params.id)));
});

app.post('/api/customers/:id/activities', (req, res) => {
  const { type, date, notes, next_follow_up } = req.body;
  if (!type || !date) return res.status(400).json({ error: 'Type and date required' });
  const r = db.prepare('INSERT INTO activities (customer_id,type,date,notes,next_follow_up) VALUES (?,?,?,?,?)')
    .run(parseInt(req.params.id), type, date, notes||null, next_follow_up||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/activities/:id', (req, res) => {
  const { type, date, notes, next_follow_up } = req.body;
  db.prepare('UPDATE activities SET type=?,date=?,notes=?,next_follow_up=? WHERE id=?')
    .run(type, date, notes||null, next_follow_up||null, parseInt(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/activities/:id', (req, res) => {
  db.prepare('DELETE FROM activities WHERE id=?').run(parseInt(req.params.id));
  res.json({ ok: true });
});

// clear all customers (for re-import)
app.post('/api/admin/clear-all', (req, res) => {
  db.prepare('DELETE FROM activities').run();
  db.prepare('DELETE FROM customers').run();
  res.json({ ok: true });
});

// one-time fix: clear payment_rating for Senju prospects
app.post('/api/admin/clear-prospect-payment', (req, res) => {
  const r = db.prepare("UPDATE customers SET payment_rating=NULL WHERE notes LIKE '[Senju prospect]%'").run();
  res.json({ updated: r.changes });
});

// ── COMPETITOR ANALYSIS ──
app.get('/api/competitor/senju', (req, res) => {
  const rows = db.prepare("SELECT * FROM customers WHERE notes LIKE '[Senju prospect]%'").all();

  function parseNotes(notes) {
    const jan = notes.match(/Jan: ₹([\d,]+)/);
    const feb = notes.match(/Feb: ₹([\d,]+)/);
    const tot = notes.match(/Total: ₹([\d,]+)/);
    const seg = notes.match(/\[Senju prospect\] ([^|]+) \|/);
    return {
      jan: jan ? parseInt(jan[1].replace(/,/g, '')) : 0,
      feb: feb ? parseInt(feb[1].replace(/,/g, '')) : 0,
      total: tot ? parseInt(tot[1].replace(/,/g, '')) : 0,
      segment: seg ? seg[1].trim() : 'Other'
    };
  }

  let totalJan = 0, totalFeb = 0, totalRev = 0;
  const byIndustry = {};
  const customers = [];

  for (const c of rows) {
    const p = parseNotes(c.notes || '');
    totalJan += p.jan;
    totalFeb += p.feb;
    totalRev += p.total;

    if (!byIndustry[c.industry]) byIndustry[c.industry] = { jan: 0, feb: 0, total: 0, count: 0 };
    byIndustry[c.industry].jan += p.jan;
    byIndustry[c.industry].feb += p.feb;
    byIndustry[c.industry].total += p.total;
    byIndustry[c.industry].count++;

    customers.push({ id: c.id, name: c.name, state: c.state, industry: c.industry, jan: p.jan, feb: p.feb, total: p.total });
  }

  const months = 2;
  const annualProjection = Math.round((totalRev / months) * 12);
  const industryList = Object.entries(byIndustry)
    .map(([k, v]) => ({ industry: k, ...v, pct: Math.round(v.total / totalRev * 100) }))
    .sort((a, b) => b.total - a.total);

  const top10 = customers.sort((a, b) => b.total - a.total).slice(0, 10);

  // key insights
  const topInd = industryList[0];
  const topCust = top10[0];
  const bothMonths = rows.filter(c => c.notes && !c.notes.includes('Jan Only') && !c.notes.includes('Feb Only')).length;
  const janOnly = rows.filter(c => c.notes && c.notes.includes('Jan Only')).length;
  const febOnly = rows.filter(c => c.notes && c.notes.includes('Feb Only')).length;
  const insights = [
    `Senju served ${rows.length} customers in Jan–Feb 2024 totalling ₹${(totalRev/1e7).toFixed(2)} Cr`,
    `Annualised run rate: ₹${(annualProjection/1e7).toFixed(2)} Cr/year`,
    `Largest segment: ${topInd?.industry || '—'} at ${topInd?.pct || 0}% (₹${((topInd?.total||0)/1e7).toFixed(2)} Cr)`,
    `Biggest customer: ${topCust?.name || '—'} at ₹${((topCust?.total||0)/1e7).toFixed(2)} Cr for the period`,
    `${bothMonths} customers bought both months, ${janOnly} Jan only, ${febOnly} Feb only`,
    `Feb revenue ${totalFeb > totalJan ? 'grew' : 'dropped'} ${Math.abs(Math.round((totalFeb - totalJan)/totalJan*100))}% vs Jan (${totalFeb > totalJan ? 'positive trend' : 'declining trend'})`
  ];

  res.json({ totalJan, totalFeb, totalRev, months, annualProjection, industryList, top10, insights, customerCount: rows.length });
});

// ── UKB COMPETITOR ANALYSIS ──
app.get('/api/competitor/ukb', (req, res) => {
  const rows = db.prepare("SELECT * FROM customers WHERE notes LIKE '[UKB competitor]%'").all();

  function parseUKB(notes) {
    const total5m = notes.match(/5M: ₹([\d.]+) Cr/);
    const annual  = notes.match(/Annual: ₹([\d.]+) Cr/);
    const status  = notes.match(/Willett: (\w+)/);
    const priority= notes.match(/Priority: (\w+)/);
    const cat     = notes.match(/\[UKB competitor\] ([^|]+) \|/);
    const notePart= notes.match(/Priority: \w+ \| (.+)$/s);
    return {
      total5m: total5m ? parseFloat(total5m[1]) : 0,
      annual:  annual  ? parseFloat(annual[1])  : 0,
      status:  status  ? status[1]  : '—',
      priority:priority ? priority[1]: '—',
      category:cat     ? cat[1].trim(): '—',
      strategic: notePart ? notePart[1].trim() : ''
    };
  }

  let grandTotal5m = 0, grandAnnual = 0;
  const byIndustry = {};
  const byStatus = { Active: 0, Target: 0, Note: 0 };
  const byPriority = { HIGH: 0, MEDIUM: 0, LOW: 0, Info: 0 };
  const customers = [];

  for (const c of rows) {
    const p = parseUKB(c.notes || '');
    grandTotal5m += p.total5m;
    grandAnnual  += p.annual;
    if (!byIndustry[c.industry]) byIndustry[c.industry] = { total5m: 0, annual: 0, count: 0 };
    byIndustry[c.industry].total5m += p.total5m;
    byIndustry[c.industry].annual  += p.annual;
    byIndustry[c.industry].count++;
    if (byStatus[p.status] !== undefined) byStatus[p.status]++;
    if (byPriority[p.priority] !== undefined) byPriority[p.priority]++;
    customers.push({ id: c.id, name: c.name, state: c.state, industry: c.industry, ...p });
  }

  const industryList = Object.entries(byIndustry)
    .map(([k, v]) => ({ industry: k, ...v, pct: grandTotal5m ? Math.round(v.total5m / grandTotal5m * 100) : 0 }))
    .sort((a, b) => b.total5m - a.total5m);

  const sorted = [...customers].sort((a, b) => b.total5m - a.total5m);

  const insights = [
    `UKB served ${rows.length} customers over 5 months — total ₹${grandTotal5m.toFixed(2)} Cr`,
    `Annualised UKB revenue from these customers: ₹${grandAnnual.toFixed(2)} Cr/year`,
    `${byStatus.Active} are already active Willett accounts — track closely to protect share`,
    `${byPriority.HIGH} HIGH priority targets — focus sales effort here first`,
    `Appliance OEM is dominant: ${industryList[0] ? industryList[0].pct + '% of UKB revenue' : '—'}`,
    `Top opportunity: ${sorted[0]?.name || '—'} at ₹${sorted[0]?.total5m.toFixed(2) || 0} Cr / 5 months`
  ];

  res.json({ grandTotal5m, grandAnnual, months: 5, industryList, customers: sorted, byStatus, byPriority, insights, customerCount: rows.length });
});

// ── DASHBOARD STATS ──
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM customers').get().n;
  const byIndustry = db.prepare('SELECT industry, COUNT(*) as n FROM customers GROUP BY industry').all();
  const byPayment = db.prepare('SELECT payment_rating, COUNT(*) as n FROM customers GROUP BY payment_rating').all();
  const followUps = db.prepare(`SELECT a.*, c.name as customer_name FROM activities a LEFT JOIN customers c ON a.customer_id=c.id WHERE a.next_follow_up >= date('now') ORDER BY a.next_follow_up LIMIT 10`).all();
  res.json({ total, byIndustry, byPayment, followUps });
});

// ── EXHIBITION TRACKER ──

app.get('/api/exhibition', (req, res) => {
  const { assigned_to, status, q } = req.query;
  let query = 'SELECT * FROM exhibition_contacts WHERE 1=1';
  const params = [];
  
  if (assigned_to) {
    query += ' AND assigned_to = ?';
    params.push(assigned_to);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  let rows = db.prepare(query + ' ORDER BY id DESC').all(params);
  
  if (q) {
    const search = q.toLowerCase();
    rows = rows.filter(r => 
      (r.name || '').toLowerCase().includes(search) || 
      (r.company || '').toLowerCase().includes(search) || 
      (r.phone || '').toLowerCase().includes(search) || 
      (r.notes || '').toLowerCase().includes(search)
    );
  }
  res.json(rows);
});

app.post('/api/exhibition', (req, res) => {
  const { name, company, phone, email, notes, assigned_to, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  const r = db.prepare(`
    INSERT INTO exhibition_contacts (name, company, phone, email, notes, assigned_to, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    company || null,
    phone || null,
    email || null,
    notes || null,
    assigned_to || 'Unassigned',
    status || 'Pending'
  );
  res.json({ id: r.lastInsertRowid });
});

app.post('/api/exhibition/bulk', (req, res) => {
  const { contacts } = req.body;
  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Contacts array required' });
  }
  
  const insert = db.prepare(`
    INSERT INTO exhibition_contacts (name, company, phone, email, notes, assigned_to, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((list) => {
    for (const c of list) {
      if (!c.name) continue;
      insert.run(
        c.name,
        c.company || null,
        c.phone || null,
        c.email || null,
        c.notes || null,
        c.assigned_to || 'Unassigned',
        c.status || 'Pending'
      );
    }
  });
  
  insertMany(contacts);
  res.json({ ok: true });
});

app.put('/api/exhibition/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, company, phone, email, notes, assigned_to, status } = req.body;
  
  const existing = db.prepare('SELECT * FROM exhibition_contacts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  
  db.prepare(`
    UPDATE exhibition_contacts 
    SET name = ?, company = ?, phone = ?, email = ?, notes = ?, assigned_to = ?, status = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : existing.name,
    company !== undefined ? company : existing.company,
    phone !== undefined ? phone : existing.phone,
    email !== undefined ? email : existing.email,
    notes !== undefined ? notes : existing.notes,
    assigned_to !== undefined ? assigned_to : existing.assigned_to,
    status !== undefined ? status : existing.status,
    id
  );
  res.json({ ok: true });
});

app.delete('/api/exhibition/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('DELETE FROM exhibition_contacts WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/exhibition/split', (req, res) => {
  const unassigned = db.prepare("SELECT id FROM exhibition_contacts WHERE assigned_to = 'Unassigned'").all();
  if (unassigned.length === 0) {
    return res.json({ count: 0 });
  }
  
  const update = db.prepare("UPDATE exhibition_contacts SET assigned_to = ? WHERE id = ?");
  const runSplit = db.transaction((list) => {
    list.forEach((contact, idx) => {
      const assignee = idx % 2 === 0 ? 'Pulkit' : 'Garv';
      update.run(assignee, contact.id);
    });
  });
  
  runSplit(unassigned);
  res.json({ count: unassigned.length });
});

app.get('/api/exhibition/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM exhibition_contacts').get().n;
  const completed = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE status = 'Completed'").get().n;
  const pending = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE status = 'Pending'").get().n;
  
  const pulkitTotal = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Pulkit'").get().n;
  const pulkitCompleted = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Pulkit' AND status = 'Completed'").get().n;
  const pulkitPending = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Pulkit' AND status = 'Pending'").get().n;
  
  const brotherTotal = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Garv'").get().n;
  const brotherCompleted = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Garv' AND status = 'Completed'").get().n;
  const brotherPending = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Garv' AND status = 'Pending'").get().n;
  
  const unassigned = db.prepare("SELECT COUNT(*) as n FROM exhibition_contacts WHERE assigned_to = 'Unassigned'").get().n;
  
  res.json({
    total, completed, pending,
    pulkit: { total: pulkitTotal, completed: pulkitCompleted, pending: pulkitPending },
    garv: { total: brotherTotal, completed: brotherCompleted, pending: brotherPending },
    unassigned
  });
});

app.get('/api/exhibition/whatsapp-query', (req, res) => {
  const messageBody = (req.query.body || '').trim();
  const sender = (req.query.sender || '').trim();
  
  const cleanMsg = messageBody.replace(/^\//, '').trim();
  const parts = cleanMsg.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const subCmd = parts.length > 1 ? parts[1].toLowerCase() : '';
  
  const pulkitPhone = (process.env.PULKIT_PHONE || '').trim();
  const brotherPhone = (process.env.BROTHER_PHONE || '').trim();

  if (subCmd === 'met' || subCmd === 'done') {
    const idStr = parts[2];
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return res.send("⚠️ Please provide a valid numeric ID. E.g., `exhibition met 5`.");
    }
    const contact = db.prepare('SELECT * FROM exhibition_contacts WHERE id = ?').get(id);
    if (!contact) {
      return res.send(`❌ Exhibition contact with ID #${id} not found.`);
    }
    db.prepare("UPDATE exhibition_contacts SET status = 'Completed' WHERE id = ?").run(id);
    return res.send(`✅ Contact #${id} (${contact.name}${contact.company ? ' @ ' + contact.company : ''}) marked as Met! 🎉`);
  }

  let identifiedUser = null;
  if (sender && pulkitPhone && sender === pulkitPhone) {
    identifiedUser = 'Pulkit';
  } else if (sender && brotherPhone && sender === brotherPhone) {
    identifiedUser = 'Garv';
  }

  let listUser = null;
  let showAll = false;
  let showUnassigned = false;

  if (subCmd === 'pulkit' || subCmd === 'p') {
    listUser = 'Pulkit';
  } else if (subCmd === 'brother' || subCmd === 'b' || subCmd === 'garv' || subCmd === 'g') {
    listUser = 'Garv';
  } else if (subCmd === 'all' || subCmd === 'a') {
    showAll = true;
  } else if (subCmd === 'unassigned' || subCmd === 'u') {
    showUnassigned = true;
  } else if (!subCmd) {
    if (identifiedUser) {
      listUser = identifiedUser;
    } else {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(case when status='Completed' then 1 else 0 end) as completed,
          SUM(case when assigned_to='Pulkit' AND status='Pending' then 1 else 0 end) as pulkit_pending,
          SUM(case when assigned_to='Garv' AND status='Pending' then 1 else 0 end) as garv_pending,
          SUM(case when assigned_to='Unassigned' then 1 else 0 end) as unassigned
        FROM exhibition_contacts
      `).get();
      
      const totalCount = stats.total || 0;
      const completedCount = stats.completed || 0;
      const pulkitPending = stats.pulkit_pending || 0;
      const garvPending = stats.garv_pending || 0;
      const unassignedCount = stats.unassigned || 0;
      
      let reply = `📊 *Exhibition Lead Tracker*\n`;
      reply += `Total Leads: ${totalCount}\n`;
      reply += `Completed: ${completedCount} / ${totalCount} (${totalCount ? Math.round(completedCount/totalCount*100) : 0}%)\n\n`;
      reply += `📋 *Pending List Counts:*\n`;
      reply += `- Pulkit's List: ${pulkitPending} pending\n`;
      reply += `- Garv's List: ${garvPending} pending\n`;
      reply += `- Unassigned: ${unassignedCount}\n\n`;
      reply += `💡 *Commands:*\n`;
      reply += `- \`exhibition pulkit\`\n`;
      reply += `- \`exhibition garv\`\n`;
      reply += `- \`exhibition unassigned\`\n`;
      reply += `- \`exhibition all\`\n`;
      reply += `- \`exhibition met <id>\` : Mark as met\n\n`;
      reply += `🔍 For Summer target lists, write: \`summerappliance\`\n\n`;
      reply += `🌐 Manage: https://willett-crm-production.up.railway.app/exhibition.html`;
      
      return res.send(reply);
    }
  }

  let rows = [];
  let title = '';
  if (listUser) {
    rows = db.prepare("SELECT * FROM exhibition_contacts WHERE assigned_to = ? AND status = 'Pending' ORDER BY id ASC").all(listUser);
    title = `📋 *${listUser}'s Pending Leads* (${rows.length})`;
  } else if (showUnassigned) {
    rows = db.prepare("SELECT * FROM exhibition_contacts WHERE assigned_to = 'Unassigned' ORDER BY id ASC").all();
    title = `📋 *Unassigned Leads* (${rows.length})`;
  } else if (showAll) {
    rows = db.prepare("SELECT * FROM exhibition_contacts WHERE status = 'Pending' ORDER BY id ASC").all();
    title = `📋 *All Pending Leads* (${rows.length})`;
  }

  if (rows.length === 0) {
    return res.send(`${title}\nNo pending leads! 🎉`);
  }

  let reply = `${title}:\n\n`;
  rows.forEach((r) => {
    reply += `*#${r.id}* ${r.name}`;
    if (r.company) reply += ` (${r.company})`;
    reply += `\n`;
    if (r.phone) reply += `   📞 ${r.phone}\n`;
    if (r.notes) reply += `   📝 ${r.notes}\n`;
    reply += `\n`;
  });
  
  reply += `👉 Reply: \`exhibition met <id>\` to mark met.`;
  return res.send(reply);
});

// ── SUMMER TARGETS API ──

app.get('/api/summer-targets', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM summer_targets ORDER BY id ASC').all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/summer-targets/save', (req, res) => {
  const { section, customer_key, name, volume, note, star, ref_status, off_status } = req.body;
  if (!section || !customer_key || !name) {
    return res.status(400).json({ error: 'Section, customer_key, and name are required' });
  }
  try {
    db.prepare(`
      INSERT INTO summer_targets (section, customer_key, name, volume, note, star, ref_status, off_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(section, customer_key) 
      DO UPDATE SET 
        name = excluded.name, 
        volume = excluded.volume, 
        note = excluded.note, 
        star = excluded.star, 
        ref_status = excluded.ref_status, 
        off_status = excluded.off_status
    `).run(
      section,
      customer_key,
      name,
      volume !== undefined ? volume : null,
      note !== undefined ? note : null,
      star !== undefined ? star : 0,
      ref_status || 'none',
      off_status || 'none'
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/summer-targets/delete', (req, res) => {
  const { section, customer_key } = req.body;
  if (!section || !customer_key) {
    return res.status(400).json({ error: 'Section and customer_key are required' });
  }
  try {
    db.prepare('DELETE FROM summer_targets WHERE section = ? AND customer_key = ?').run(section, customer_key);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/summer-target/whatsapp-query', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM summer_targets').all();
    
    const sections = {};
    rows.forEach(r => {
      if (!sections[r.section]) sections[r.section] = [];
      sections[r.section].push(r);
    });
    
    const formatSec = (secKey, title) => {
      const list = sections[secKey] || [];
      if (list.length === 0) return '';
      let text = `*${title}*:\n`;
      list.forEach(item => {
        const starTag = item.star ? '★ ' : '';
        text += ` - ${starTag}${item.name}`;
        if (item.volume) text += ` (${item.volume})`;
        if (item.note) text += ` - _${item.note}_`;
        text += `\n`;
      });
      return text + `\n`;
    };
    
    let reply = `☀️ *Summer Target & Appliance Targets* 📊\n\n`;
    
    const acOems = formatSec('ac_oem', '1️⃣ AC OEM Targets');
    if (acOems) reply += acOems;
    
    const fridgeTgts = formatSec('fridge_tgt', '2️⃣ Fridge Targets');
    if (fridgeTgts) reply += fridgeTgts;
    
    const invs = sections['inv'] || [];
    const stabs = sections['stab'] || [];
    if (invs.length || stabs.length) {
      reply += `*3️⃣ Inverter / Stabiliser Targets*:\n`;
      invs.forEach(item => {
        reply += ` - ${item.name} (${item.volume || 'Inverter'}) ${item.note ? '- _' + item.note + '_' : ''}\n`;
      });
      stabs.forEach(item => {
        reply += ` - ${item.name} (${item.volume || 'Stabiliser'}) ${item.note ? '- _' + item.note + '_' : ''}\n`;
      });
      reply += `\n`;
    }
    
    const fanTgts = formatSec('fan_tgt', '4️⃣ Fan Targets');
    if (fanTgts) reply += fanTgts;
    
    const coolerTgts = formatSec('cooler_tgt', '5️⃣ Cooler Targets');
    if (coolerTgts) reply += coolerTgts;
    
    const fanConf = sections['fan_conf'] || [];
    const coolerConf = sections['cooler_conf'] || [];
    if (fanConf.length || coolerConf.length) {
      reply += `📈 *Confirmed Year-Round Base*:\n`;
      if (fanConf.length) {
        reply += ` - Fans: ` + fanConf.map(f => `${f.name} (${f.volume})`).join(', ') + `\n`;
      }
      if (coolerConf.length) {
        reply += ` - Coolers: ` + coolerConf.map(c => `${c.name} (${c.volume})`).join(', ') + `\n`;
      }
      reply += `\n`;
    }
    
    reply += `🌐 Manage: https://willett-crm-production.up.railway.app/summer.html`;
    return res.send(reply);
  } catch (e) {
    return res.send(`⚠️ Error querying summer targets: ${e.message}`);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Willett CRM running on port ${PORT}`));
