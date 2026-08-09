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
  CREATE TABLE IF NOT EXISTS exhibition_contacts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    assigned_to TEXT DEFAULT 'Unassigned',
    status TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS summer_targets (
    id INTEGER PRIMARY KEY,
    section TEXT NOT NULL,
    customer_key TEXT NOT NULL,
    name TEXT NOT NULL,
    volume TEXT,
    note TEXT,
    star INTEGER DEFAULT 0,
    ref_status TEXT DEFAULT 'none',
    off_status TEXT DEFAULT 'none',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(section, customer_key)
  );
`);

const summerCount = db.prepare('SELECT COUNT(*) as n FROM summer_targets').get().n;
if (summerCount === 0) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO summer_targets (section, customer_key, name, volume, note, star, ref_status, off_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const seeds = [];
  
  const defaultBrands = [
    { key:'amber',     name:'Amber',      segment:'AC',              star:1,  note:'Large OEM — #1 priority. Push for sample.' },
    { key:'pg',        name:'PG',         segment:'AC / Cooler',     star:1,  ref:'yes', note:'Reference available — follow up urgently.' },
    { key:'whirlpool', name:'Whirlpool',  segment:'Fridge / WM',     star:0,  note:'Cold — identify purchase contact.' },
    { key:'bluestar',  name:'Blue Star',  segment:'AC / Fridge',     star:0,  note:'Cold — identify purchase contact.' },
    { key:'carrier',   name:'Carrier',    segment:'AC',              star:0,  note:'Cold — Manesar plant.' },
    { key:'godrej',    name:'Godrej',     segment:'Fridge / AC',     star:0,  note:'Cold — find plant contact.' },
    { key:'symphony',  name:'Symphony',   segment:'Cooler / AC',     star:0,  note:'Cold — large cooler OEM.' },
    { key:'hitachi',   name:'Hitachi',    segment:'AC',              star:0,  note:'Cold — identify contact.' },
    { key:'orient',    name:'Orient',     segment:'Fan',             star:1,  note:'Fan #1 target — ₹1L/month potential.' },
    { key:'eapro',     name:'Eapro',      segment:'Inverter / Solar',star:1,  ref:'yes', note:'Ex-employee contact — warm lead. Act fast.' },
    { key:'frigoglass',name:'Frigoglass', segment:'Fridge',          star:1,  note:'Higher ticket size — priority entry.' },
    { key:'rockwell',  name:'Rockwell',   segment:'Fridge',          star:1,  note:'Higher ticket size — priority entry.' },
  ];
  defaultBrands.forEach(b => {
    seeds.push(['brands', b.key, b.name, b.segment, b.note, b.star, b.ref || 'none', 'none']);
  });
  
  const defaultEtabs = {
    fan_conf: [
      { key:'dye',  name:'DYE',                      monthly:'1,00,000', note:'' },
      { key:'ard',  name:'ARD',                      monthly:'20,000',   note:'' },
      { key:'kww',  name:'KWW',                      monthly:'20,000',   note:'' },
      { key:'kkg',  name:'KKG (Hyd/Noida/Haridwar)', monthly:'20,000',   note:'' },
      { key:'usk',  name:'USK',                      monthly:'15,000',   note:'' },
      { key:'sae',  name:'SAE',                      monthly:'15,000',   note:'' },
      { key:'dng',  name:'DNG',                      monthly:'15,000',   note:'' },
      { key:'pmb',  name:'PMB',                      monthly:'10,000',   note:'' },
    ],
    fan_tgt: [
      { key:'orient_t', name:'Orient',        monthly:'1,00,000', note:'Top priority', star:1 },
      { key:'shristhi', name:'Shristhi',      monthly:'50,000',   note:'' },
      { key:'bhagwati', name:'Bhagwati',      monthly:'40,000',   note:'' },
      { key:'sania',    name:'Sania',         monthly:'20,000',   note:'Very low rates' },
      { key:'wonder',   name:'Wonder',        monthly:'15,000',   note:'' },
      { key:'modi',     name:'Modi Fan (CCA)',monthly:'15,000',   note:'' },
      { key:'toofan',   name:'Toofan',        monthly:'5,000',    note:'Cord entry' },
    ],
    cooler_conf: [
      { key:'snd',     name:'SND',     monthly:'20,000', note:'' },
      { key:'bni',     name:'BNI',     monthly:'10,000', note:'' },
      { key:'rocksun', name:'Rocksun', monthly:'10,000', note:'' },
      { key:'yet',     name:'YET',     monthly:'10,000', note:'' },
      { key:'avion',   name:'Avion',   monthly:'10,000', note:'' },
      { key:'clarion', name:'Clarion', monthly:'5,000',  note:'' },
      { key:'poswal',  name:'Poswal',  monthly:'5,000',  note:'' },
      { key:'blu',     name:'BLU',     monthly:'5,000',  note:'' },
      { key:'vikram',  name:'Vikram',  monthly:'4,000',  note:'' },
    ],
    cooler_tgt: [
      { key:'summercool', name:'Summercool',         monthly:'20,000', note:'' },
      { key:'epack_c',    name:'Epack',              monthly:'20,000', note:'' },
      { key:'pg_c',       name:'PG',                 monthly:'20,000', note:'' },
      { key:'mppl',       name:'MPPL',               monthly:'15,000', note:'' },
      { key:'aroking',    name:'Aroking',            monthly:'15,000', note:'Low pricing, slow entry' },
      { key:'ekkaa',      name:'Ekkaa',              monthly:'15,000', note:'' },
      { key:'mr',         name:'MR',                 monthly:'15,000', note:'' },
      { key:'aeromax',    name:'Aeromax',            monthly:'10,000', note:'' },
      { key:'wybor_c',    name:'Wybor',              monthly:'10,000', note:'' },
      { key:'speedo',     name:'Speedo',             monthly:'10,000', note:'' },
      { key:'novamax',    name:'Novamax',            monthly:'10,000', note:'' },
      { key:'raj',        name:'Raj',                monthly:'10,000', note:'Slow payment' },
      { key:'supreme',    name:'Supreme Industries', monthly:'10,000', note:'' },
      { key:'vijay',      name:'Vijay Cooler',       monthly:'5,000',  note:'' },
      { key:'skyzen',     name:'Skyzen',             monthly:'5,000',  note:'' },
    ],
    ac_oem: [
      { key:'amber_ac', name:'Amber', monthly:'', note:'Large OEM — #1 priority', star:1 },
      { key:'pg_ac',    name:'PG',    monthly:'', note:'Reference available — should convert', star:1 },
      { key:'wybor_ac', name:'Wybor', monthly:'', note:'' },
      { key:'epack_ac', name:'Epack', monthly:'', note:'' },
    ],
    ac_brand: [
      { key:'bluestar_ac',  name:'Blue Star',  monthly:'', note:'' },
      { key:'carrier_ac',   name:'Carrier',    monthly:'', note:'Manesar plant' },
      { key:'daikin',       name:'Daikin',     monthly:'', note:'' },
      { key:'godrej_ac',    name:'Godrej',     monthly:'', note:'' },
      { key:'haier',        name:'Haier',      monthly:'', note:'' },
      { key:'hitachi_ac',   name:'Hitachi',    monthly:'', note:'' },
      { key:'lg',           name:'LG',         monthly:'', note:'' },
      { key:'micromax_ac',  name:'Micromax',   monthly:'', note:'' },
      { key:'napoleon',     name:'Napoleon',   monthly:'', note:'' },
      { key:'voltas',       name:'Voltas',     monthly:'', note:'' },
      { key:'whirlpool_ac', name:'Whirlpool',  monthly:'', note:'' },
    ],
    fridge_tgt: [
      { key:'rockwell_f',   name:'Rockwell',   monthly:'6,00,000',  note:'Higher ticket size — priority', star:1 },
      { key:'frigoglass_f', name:'Frigoglass', monthly:'6,00,000',  note:'Higher ticket size — priority', star:1 },
      { key:'westan',     name:'Westan',     monthly:'15,000', note:'' },
      { key:'bluestar_f', name:'Blue Star',  monthly:'15,000', note:'' },
    ],
    water_tgt:  [
      { key:'veeline', name:'Veeline', monthly:'', note:'' },
    ],
    cmotor_tgt: [
      { key:'cm_acko',     name:'ACKO MOTOR',              monthly:'2,000', note:'Yet to follow up' },
      { key:'cm_aei',      name:'AEI MOTOR',               monthly:'',      note:'Faridabad' },
      { key:'cm_akvo',     name:'AKVO MOTORS',             monthly:'2,000', note:'Ghaziabad · Meet via Chugh Ji' },
      { key:'cm_amco',     name:'AMCO',                    monthly:'2,000', note:'Faridabad · No response' },
      { key:'cm_aparna',   name:'APARNA',                  monthly:'1,00,000', note:'Delhi · Rahul ref' },
      { key:'cm_ashoka',   name:'ASHOKA WINDING',          monthly:'',      note:'Faridabad' },
      { key:'cm_avon',     name:'AVON MOTOR',              monthly:'1,00,000', note:'Faridabad · Meet' },
      { key:'cm_banwari',  name:'BANWARI',                 monthly:'1,00,000', note:'Barhi · Meet' },
      { key:'cm_condor',   name:'CONDOR',                  monthly:'4,000', note:'Faridabad · Advance only' },
      { key:'cm_devji',    name:'DEV JI SITTU',            monthly:'3,000', note:'Mundka' },
      { key:'cm_feltron',  name:'FELTRON',                 monthly:'500',   note:'Noida' },
      { key:'cm_geo',      name:'GEO MOTOR',               monthly:'',      note:'Bawana' },
      { key:'cm_impeiral', name:'IMPEIRAL MOTOR',          monthly:'500',   note:'Faridabad' },
      { key:'cm_indo',     name:'INDO',                    monthly:'',      note:'Kundli' },
      { key:'cm_indoma',   name:'INDOMA',                  monthly:'',      note:'Noida' },
      { key:'cm_ivoomi',   name:'IVOOMI',                  monthly:'',      note:'Faridabad · ⚠ Payment concern' },
      { key:'cm_jc',       name:'JC MOTOR',                monthly:'1,000', note:'Manesar · Thin OD follow up' },
      { key:'cm_koncept',  name:'KONCEPT MOTOR',           monthly:'',      note:'Greater Noida' },
      { key:'cm_lucky',    name:'LUCKY (for CG)',          monthly:'2,000', note:'Bhatinda · Contact July' },
      { key:'cm_manchanda',name:'MANCHANDA',               monthly:'1,500', note:'Bawana' },
      { key:'cm_manesar',  name:'MANESAR MOTOR AUTOMOTIVE',monthly:'',      note:'Manesar' },
      { key:'cm_marathon', name:'MARATHON MOTOR',          monthly:'10,000',note:'Faridabad · Large account' },
      { key:'cm_merut',    name:'MERUT MOTOR',             monthly:'3,000', note:'Meerut · No response' },
      { key:'cm_nahata',   name:'NAHATA MOTORS',           monthly:'2,000', note:'Faridabad · Price mismatch' },
      { key:'cm_nirosha',  name:'NIROSHA MOTORS',          monthly:'3,000', note:'Faridabad · Yet to contact' },
      { key:'cm_opteva',   name:'OPTEVA MOTOR',            monthly:'3,000', note:'Mundka · ⚠ Thin OD issue' },
      { key:'cm_pankaj',   name:'PANKAJ MOTOR',            monthly:'1,000', note:'Bawana' },
      { key:'cm_picl',     name:'PICL',                    monthly:'15,000',note:'Faridabad · Single core only' },
      { key:'cm_rk',       name:'RK MOTORS',               monthly:'',      note:'Yet to follow up' },
      { key:'cm_sandy',    name:'SANDY',                   monthly:'500',   note:'Rajkot · Follow up' },
      { key:'cm_speedo',   name:'SPEEDO',                  monthly:'1,500', note:'Bawana' },
      { key:'cm_surya',    name:'SURYA KIRAN',             monthly:'1,500', note:'Noida · Yet to contact' },
      { key:'cm_swastik',  name:'SWASTIK MOTORS',          monthly:'2,000', note:'Faridabad' },
      { key:'cm_tulika',   name:'TULIKA MOTOR',            monthly:'1,000', note:'Manesar' },
      { key:'cm_united',   name:'UNITED MOTOR',            monthly:'1,000', note:'Faridabad' },
      { key:'cm_vaibhav',  name:'VAIBHAV MOTOR',           monthly:'1,000', note:'⚠ Slow payment — AVOID · Price mismatch' },
      { key:'cm_victor',   name:'VICTOR',                  monthly:'500',   note:'Faridabad · Thin OD' },
      { key:'cm_zeenat',   name:'ZEENAT MOTOR',            monthly:'2,000', note:'Bawana · Meet via Chugh Ji' },
    ]
  };
  
  Object.keys(defaultEtabs).forEach(section => {
    defaultEtabs[section].forEach(row => {
      seeds.push([section, row.key, row.name, row.monthly || '', row.note || '', row.star || 0, 'none', 'none']);
    });
  });
  
  const defaultInverters = [
    { key:'eastman',   name:'Eastman',   addr:'Delhi', note:'' },
    { key:'millenium', name:'Millenium', addr:'Parwanoo', note:'Slow + mixed payment' },
  ];
  defaultInverters.forEach(inv => {
    seeds.push(['inv', inv.key, inv.name, inv.addr, inv.note || '', 0, 'none', 'none']);
  });
  
  const defaultStabs = [
    { key:'manjeet',   name:'Manjeet',            addr:'Bahadurgarh' },
    { key:'helios',    name:'Helios',              addr:'' },
    { key:'kundi',     name:'Kundi',               addr:'' },
    { key:'keeline',   name:'Keeline',             addr:'Hyderabad' },
    { key:'capri',     name:'Capri',               addr:'Delhi' },
    { key:'tecnia',    name:'Tecnia',              addr:'Karnataka' },
    { key:'donut',     name:'Donut',               addr:'' },
    { key:'dheeraj',   name:'Dheeraj Ji',          addr:'Bhalswa, Delhi' },
    { key:'bluebird',  name:'Bluebird Stabiliser', addr:'' },
  ];
  defaultStabs.forEach(stab => {
    seeds.push(['stab', stab.key, stab.name, stab.addr, '', 0, 'none', 'none']);
  });
  
  const seedTransaction = db.transaction((list) => {
    for (const s of list) {
      insert.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]);
    }
  });
  seedTransaction(seeds);
}

// Migrate "Brother" assignments to "Garv"
db.exec(`
  UPDATE exhibition_contacts SET assigned_to = 'Garv' WHERE assigned_to = 'Brother';
`);

// Add new columns if they do not exist
const tableInfo = db.pragma("table_info(exhibition_contacts)");
const hasActionTag = tableInfo.some(col => col.name === 'action_tag');
const hasScheduleWeek = tableInfo.some(col => col.name === 'schedule_week');

if (!hasActionTag) {
  db.exec("ALTER TABLE exhibition_contacts ADD COLUMN action_tag TEXT DEFAULT 'None'");
}
if (!hasScheduleWeek) {
  db.exec("ALTER TABLE exhibition_contacts ADD COLUMN schedule_week TEXT DEFAULT ''");
}

module.exports = db;
