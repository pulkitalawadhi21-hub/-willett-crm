const https = require('https');
const fs = require('fs');

const BASE = 'https://willett-crm-production.up.railway.app';
const CSV_PATH = 'C:\\Users\\pulki\\Downloads\\master_final_clean_1 NEW.csv';

const INDUSTRY_MAP = {
  'Appliances / White Goods': 'home_appliances',
  'Ac spare parts': 'home_appliances',
  'Lighting + Appliances/White goods': 'home_appliances',
  'EV / Charging': 'ev_automotive',
  'Auto / EV': 'ev_automotive',
  'Harness': 'cable_wiring',
  'Cable / Wiring Harness': 'cable_wiring',
  'Solar / Renewable': 'solar',
  'Lighting': 'lighting',
  'Electronics / EMS': 'electronics_ems',
  'Electronics / EMS(capacitor)': 'electronics_ems',
  'Industrial / OEM': 'industrial_oem',
  'Pumps': 'pumps',
  'Pumps / Motors': 'pumps',
  'Transformer / Power': 'transformer_power',
  'Switchgear': 'switchgear',
  'Railway': 'railway',
  'Medical Devices': 'medical',
  'Trader / Distributor': 'trader',
  'Motor': 'motors',
  'motor': 'motors',
  'Motors': 'motors',
  'Capacitors / Components': 'capacitors',
  'Tools ': 'industrial_oem',
  'Tools': 'industrial_oem',
  'Other': 'other',
};

// Maps keywords in Sub-Type to standard appliance type names
const APPLIANCE_KEYWORDS = [
  { keys: ['MIXIE', 'MIXER'],             name: 'Mixer Grinders' },
  { keys: ['KETTLE'],                      name: 'Kettle' },
  { keys: ['INDUCTION', 'INFRARED'],       name: 'Infrared/Induction Cooktop' },
  { keys: ['CHIMNEY'],                     name: 'Chimney' },
  { keys: ['TOASTER'],                     name: 'Toasters' },
  { keys: ['OTG'],                         name: 'OTG' },
  { keys: ['RICE COOKER'],                 name: 'Rice Cookers' },
  { keys: ['IMMERSION'],                   name: 'Immersion Rods' },
  { keys: ['FAN', 'FAM'],                  name: 'Fans' },
  { keys: ['FRIDGE', 'REFRIGERATOR'],      name: 'Refrigerator' },
  { keys: ['WASHING'],                     name: 'Washing Machine' },
  { keys: ['COOLER'],                      name: 'Coolers' },
  { keys: ['GEYSER', 'WATER HEATER', 'HEATER'], name: 'Geyser / Water Heater' },
  { keys: ['WATER FILTER', 'RO'],          name: 'Water Filter / RO' },
  { keys: [' AC', 'AC/'],                  name: 'AC' },
  { keys: ['TV'],                          name: 'TV' },
  { keys: ['STABILISER', 'STABILIZER'],    name: 'Stabiliser' },
];

function parseSubtype(raw) {
  if (!raw) return { size: 'both', types: [] };
  const s = raw.trim().toUpperCase();

  // Determine size from prefix
  let size = 'both';
  let rest = s;
  if (s.startsWith('BA + SA') || s.startsWith('BA+SA')) { size = 'both'; rest = s.replace(/^BA\s*\+\s*SA\s*/, ''); }
  else if (s.startsWith('BA ') || s === 'BA') { size = 'big'; rest = s.replace(/^BA\s*/, ''); }
  else if (s.startsWith('SA ') || s === 'SA') { size = 'small'; rest = s.replace(/^SA\s*/, ''); }
  else if (['GENERAL APPLIANCES', 'APPLIANCE EMS/OEM'].includes(s)) { size = 'both'; rest = ''; }
  else if (s.includes('SMALL')) { size = 'small'; }
  else if (s.includes('AC') && !s.includes('COOLER') && !s.includes('CHARGER')) { size = 'big'; }

  // Extract appliance types
  const types = [];
  for (const { keys, name } of APPLIANCE_KEYWORDS) {
    if (keys.some(k => rest.includes(k))) {
      if (!types.includes(name)) types.push(name);
    }
  }
  // Handle plain "AC" without prefix collision
  if ((rest === 'AC' || rest.startsWith('AC/') || rest.endsWith('/AC') || rest.includes(' AC') || rest.includes('AC ')) && !types.includes('AC')) {
    types.push('AC');
  }

  return { size, types };
}

function post(path_, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE + path_);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
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
      name, state: cols[1]||'', segment: cols[2]||'',
      subtype: cols[3]||'', total: parseInt((cols[4]||'0').replace(/[^\d]/g,''))||0,
      source: cols[5]||'', notes: cols[6]||''
    });
  }
  return rows;
}

async function run() {
  const rows = parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows`);

  console.log('Clearing existing data...');
  await post('/api/admin/clear-all', {});
  console.log('Cleared.\n');

  let ok = 0, fail = 0;
  for (const r of rows) {
    const industry = INDUSTRY_MAP[r.segment.trim()] || 'other';
    const { size, types } = parseSubtype(r.subtype);
    const notes = `[${r.source}] ${r.segment}${r.subtype ? ' · ' + r.subtype : ''} | Total: ₹${r.total.toLocaleString('en-IN')}${r.notes ? ' | ' + r.notes : ''}`;
    try {
      await post('/api/customers', {
        name: r.name, state: r.state, industry,
        size_category: size, notes,
        payment_rating: null, appliance_types: types
      });
      ok++;
      process.stdout.write(`\r  ✓ ${ok}/${rows.length}`);
    } catch(e) { fail++; console.log(`\n  ✗ ${r.name}: ${e.message}`); }
  }
  console.log(`\n\nDone — ${ok} imported, ${fail} failed`);
}

run();
