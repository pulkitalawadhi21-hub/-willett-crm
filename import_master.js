const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://willett-crm-production.up.railway.app';
const CSV_PATH = 'C:\\Users\\pulki\\Downloads\\master_final_2 revised 2026.csv';

const INDUSTRY_MAP = {
  'Appliances / White Goods': 'home_appliances',
  'EV / Charging': 'ev_automotive',
  'EV / Charging ': 'ev_automotive',
  'Solar / Renewable': 'solar',
  'Lighting': 'lighting',
  'Lighting + Appliances/White goods': 'home_appliances',
  'Electronics / EMS': 'electronics_ems',
  'Electronics / EMS(capacitor)': 'electronics_ems',
  'Industrial / OEM': 'industrial_oem',
  'Cable / Wiring Harness': 'cable_wiring',
  'Harness': 'cable_wiring',
  'Pumps': 'pumps',
  'Pumps / Motors': 'pumps',
  'Pumps / Motors ': 'pumps',
  'Transformer / Power': 'transformer_power',
  'Switchgear': 'switchgear',
  'Railway': 'railway',
  'Medical Devices': 'medical',
  'Trader / Distributor': 'trader',
  'Auto / EV': 'ev_automotive',
  'Motor': 'motors',
  'motor': 'motors',
  'Motors': 'motors',
  'Motors ': 'motors',
  'Capacitors / Components': 'capacitors',
  'Ac spare parts': 'home_appliances',
  'Tools ': 'industrial_oem',
  'Tools': 'industrial_oem',
  'Other': 'other',
  'Other ': 'other',
};

function api(path_, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE + path_);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function parseCSV(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // simple CSV split (handles commas inside quotes)
    const cols = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    const name = cols[0];
    if (!name) continue;
    rows.push({
      name,
      state: cols[1] || '',
      segment: cols[2] || '',
      subtype: cols[3] || '',
      total: parseInt((cols[4] || '0').replace(/[^\d]/g, '')) || 0,
      source: cols[5] || '',
      notes: cols[6] || ''
    });
  }
  return rows;
}

async function run() {
  const rows = parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // clear all existing
  console.log('Clearing existing data...');
  await api('/api/admin/clear-all', {});
  console.log('Cleared.');

  let ok = 0, fail = 0;
  for (const r of rows) {
    const industry = INDUSTRY_MAP[r.segment] || INDUSTRY_MAP[r.segment.trim()] || 'other';
    const size = r.total > 10000000 ? 'big' : 'small'; // >1 Cr = big
    const notes = `[${r.source}] ${r.segment}${r.subtype ? ' · ' + r.subtype : ''} | Total: ₹${r.total.toLocaleString('en-IN')}${r.notes ? ' | ' + r.notes : ''}`;
    try {
      await api('/api/customers', {
        name: r.name, state: r.state, industry,
        size_category: size, notes,
        payment_rating: null, appliance_types: []
      });
      ok++;
      process.stdout.write(`\r  ✓ ${ok}/${rows.length}`);
    } catch(e) { fail++; console.log(`\n  ✗ ${r.name}: ${e.message}`); }
  }
  console.log(`\n\nDone — ${ok} imported, ${fail} failed`);
}

run();
