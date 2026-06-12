const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'willett-crm.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (e) {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    industry TEXT,
    appliance_types TEXT DEFAULT '[]',
    size_category TEXT DEFAULT 'both',
    payment_rating TEXT,
    notes TEXT,
    dev_months TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (date('now'))
  );
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    next_follow_up TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
`);

module.exports = db;
