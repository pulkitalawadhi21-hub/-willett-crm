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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Willett CRM running on port ${PORT}`));
