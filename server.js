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
    payment_rating||'average', notes||null, JSON.stringify(dev_months||{})
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/customers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, city, state, contact_person, phone, email, website, industry, appliance_types, size_category, payment_rating, notes, dev_months } = req.body;
  db.prepare(`UPDATE customers SET name=?,city=?,state=?,contact_person=?,phone=?,email=?,website=?,industry=?,appliance_types=?,size_category=?,payment_rating=?,notes=?,dev_months=? WHERE id=?`)
    .run(name, city||null, state||null, contact_person||null, phone||null, email||null, website||null,
      industry||null, JSON.stringify(appliance_types||[]), size_category||'both',
      payment_rating||'average', notes||null, JSON.stringify(dev_months||{}), id);
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
