const https = require('https');

const BASE = 'https://willett-crm-production.up.railway.app';

function request(method, path_, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path_);
    const opts = {
      hostname: url.hostname, path: url.pathname, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // 1. Find all customers, locate Bluestar
  const all = await request('GET', '/api/customers');
  const customers = Array.isArray(all) ? all : (all.customers || all.data || []);

  const bluestar = customers.filter(c => c.name && c.name.toUpperCase().includes('BLUESTAR'));
  console.log(`Found ${bluestar.length} Bluestar customer(s):`);
  bluestar.forEach(c => console.log(`  ID ${c.id}: ${c.name} | types: ${JSON.stringify(c.appliance_types)} | size: ${c.size_category} | notes: ${c.notes?.slice(0,80)}`));

  // 2. Update each Bluestar — set AC, big appliance, remove Refrigerator
  for (const c of bluestar) {
    const updated = await request('PUT', `/api/customers/${c.id}`, {
      ...c,
      appliance_types: ['AC'],
      size_category: 'big'
    });
    console.log(`\nUpdated Bluestar ID ${c.id}:`, updated.name || updated);
  }

  // 3. Add 4 new AC customers
  const newCustomers = [
    {
      name: 'Micromax',
      state: '',
      industry: 'home_appliances',
      size_category: 'big',
      appliance_types: ['AC'],
      payment_rating: null,
      notes: '[Manual Entry] Home Appliances · BA AC | Total: ₹0'
    },
    {
      name: 'Ezentech',
      state: 'Uttar Pradesh',
      industry: 'home_appliances',
      size_category: 'big',
      appliance_types: ['AC'],
      payment_rating: 'bad',
      notes: '[Manual Entry] Home Appliances · BA AC | Total: ₹0 | Noida — Bad payment history'
    },
    {
      name: 'Wybor',
      state: 'Uttar Pradesh',
      industry: 'home_appliances',
      size_category: 'big',
      appliance_types: ['AC'],
      payment_rating: null,
      notes: '[Manual Entry] Home Appliances · BA AC | Total: ₹0 | Noida'
    },
    {
      name: 'Carrier',
      state: 'Haryana',
      industry: 'home_appliances',
      size_category: 'big',
      appliance_types: ['AC'],
      payment_rating: null,
      notes: '[Manual Entry] Home Appliances · BA AC | Total: ₹0 | Manesar'
    }
  ];

  console.log('\nAdding 4 new AC customers...');
  for (const c of newCustomers) {
    const res = await request('POST', '/api/customers', c);
    const badge = c.payment_rating === 'bad' ? ' ⚠ BAD PAYMENT' : '';
    console.log(`  ✓ ${c.name} (${c.state || 'no state'})${badge} — ID ${res.id || '?'}`);
  }

  console.log('\nDone.');
}

run().catch(console.error);
