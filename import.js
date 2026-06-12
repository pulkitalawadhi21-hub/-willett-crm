const https = require('https');

const BASE = 'https://willett-crm-production.up.railway.app';

const INDUSTRY_MAP = {
  'Appliances / White Goods': 'home_appliances',
  'EV / Charging': 'ev_automotive',
  'Solar / Renewable': 'solar',
  'Lighting': 'lighting',
  'Electronics / EMS': 'electronics_ems',
  'Industrial / OEM': 'industrial_oem',
  'Cable / Wiring Harness': 'cable_wiring',
  'Pumps': 'pumps',
  'Transformer / Power': 'transformer_power',
  'Switchgear': 'switchgear',
  'Railway': 'railway',
  'Medical Devices': 'medical',
  'Trader / Distributor': 'trader',
  'Other': 'other'
};

// All 143 rows from senju_customers csv.csv
const customers = [
  ["GLEN APPLIANCES PRIVATE LIMITED","Haryana","Appliances / White Goods",5323961,6040026,11363986,"Both"],
  ["C R I PUMPS PRIVATE LIMITED","Tamil Nadu","Pumps",4226596,5705640,9932236,"Both"],
  ["CALCOM VISION LTD","Uttar Pradesh","Appliances / White Goods",4689308,4503490,9192798,"Both"],
  ["MACUREX SENSORS PVT LTD.","Karnataka","Electronics / EMS",3724294,3004976,6729270,"Both"],
  ["EMKAY ELECTROMECH PVT. LTD.","Uttar Pradesh","Electronics / EMS",3434726,3184701,6619428,"Both"],
  ["ELENTEC INDIA PRIVATE LIMITED","Uttar Pradesh","Electronics / EMS",3008711,3244649,6253360,"Both"],
  ["VASANTHA ADVANCED SYSTEMS PRIVATE LIMITED","Tamil Nadu","Industrial / OEM",2962213,3015018,5977231,"Both"],
  ["TIANYIN WORLDTECH INDIA PRIVATE LIMITED","Uttar Pradesh","Industrial / OEM",3530116,2386615,5916731,"Both"],
  ["CRYSTA ELECTRICALS PRIVATE LIMITED","Uttar Pradesh","Industrial / OEM",2949174,1971055,4920229,"Both"],
  ["G K ENTERPRISES PVT LTD","Tamil Nadu","Other",3240979,1616698,4857677,"Both"],
  ["MATRI SHREE TECHNO INDUSTRIES","Uttar Pradesh","Industrial / OEM",1581768,2427134,4008903,"Both"],
  ["LUNO RENEWABLE LIMITED","Uttarakhand","Other",0,3730907,3730907,"Feb Only"],
  ["ESKO CASTING AND ELECTRONICS PRIVATE LIMITED","Haryana","Industrial / OEM",2020467,1541658,3562126,"Both"],
  ["LAXMI DRUCKEN KOMPONENTS PRIVATE LIMITED","Maharashtra","Other",1837317,1648939,3486256,"Both"],
  ["VINEY CORPORATION LIMITED","Maharashtra","Other",0,3436904,3436904,"Feb Only"],
  ["EAST WEST AUTOMATION TECHNOLOGIES PRIVATE LIMITED","Haryana","Other",2631540,704547,3336087,"Both"],
  ["DEKI ELECTRONICS LIMITED","Uttar Pradesh","Electronics / EMS",1788833,1450567,3239400,"Both"],
  ["TYNOR ORTHOTICS PRIVATE LIMITED","Punjab","Medical Devices",1868831,1325642,3194472,"Both"],
  ["RITIKA SYSTEMS PRIVATE LIMITED","Rajasthan","Industrial / OEM",1724889,1435859,3160749,"Both"],
  ["SOLARMINT ENERGIES PRIVATE LIMITED","Haryana","Solar / Renewable",0,3067033,3067033,"Feb Only"],
  ["DOXCY CABLES PRIVATE LIMITED","Uttar Pradesh","Cable / Wiring Harness",1934624,1071588,3006212,"Both"],
  ["AVNEESH KUMAR","Uttar Pradesh","Trader / Distributor",1593749,1242981,2836731,"Both"],
  ["PAWAN KUMAR","Uttar Pradesh","Other",1015268,1580491,2595759,"Both"],
  ["CJAN ELECTRIC LLP","Rajasthan","Other",1750955,806837,2557792,"Both"],
  ["ALBY APPLIANCES PRIVATE LIMITED","Haryana","Appliances / White Goods",994858,1454940,2449798,"Both"],
  ["NEENJAS ELECTRIC PRIVATE LIMITED","Uttar Pradesh","Other",72181,1954581,2026762,"Both"],
  ["MODERN RAILTECH EQUIPMENT MANUFACTURES PRIVATE LIMITED","West Bengal","Railway",1632324,361670,1993994,"Both"],
  ["ELIN ELECTRONICS LIMITED","Uttar Pradesh","Appliances / White Goods",971798,945494,1917292,"Both"],
  ["ANIL KUMAR","Uttar Pradesh","Trader / Distributor",1735461,88892,1824353,"Both"],
  ["EASTMAN NEW ENERGY PRIVATE LIMITED","Haryana","Solar / Renewable",1488383,258883,1747266,"Both"],
  ["ANKUR TRADERS & ENGINEERS PRIVATE LIMITED","Uttar Pradesh","Other",642584,1076121,1718705,"Both"],
  ["GE VERNOVA T&D INDIA LIMITED","Tamil Nadu","Transformer / Power",1689128,0,1689128,"Jan Only"],
  ["THULIR AUTOMOTIVE PRIVATE LIMITED","Tamil Nadu","Other",426074,1262204,1688278,"Both"],
  ["AMBIKA SHARMA","Haryana","Trader / Distributor",1221120,446278,1667398,"Both"],
  ["GREENFUEL ENERGY SOLUTIONS PRIVATE LIMITED","Haryana","Other",1629705,0,1629705,"Jan Only"],
  ["CHANDRA SHEKHAR SEKSARIA","West Bengal","Trader / Distributor",595987,1010201,1606188,"Both"],
  ["Motherson Sumi Wiring India Limited","Uttar Pradesh","Cable / Wiring Harness",541798,1055624,1597421,"Both"],
  ["KAIZEN SWITCHGEAR PRODUCTS PRIVATE LIMITED","Gujarat","Switchgear",0,1593521,1593521,"Feb Only"],
  ["SURYA ROSHNI LTD","Uttarakhand","Lighting",1104325,410876,1515201,"Both"],
  ["BARODA BUSHINGS & INSULATORS PRIVATE LIMITED","Gujarat","Transformer / Power",547304,901127,1448430,"Both"],
  ["JAISINGH INNOVATIONS LLP","Maharashtra","Other",132726,1260384,1393111,"Both"],
  ["LAMBERT LIGHTING PRODUCT PRIVATE LIMITED","Uttar Pradesh","Lighting",467180,913894,1381074,"Both"],
  ["MEHRU ELECTRICAL AND MECHANICAL ENGINEERS PRIVATE LIMITED","Rajasthan","Other",400259,957405,1357664,"Both"],
  ["SPARSH ELECTRONICS (INDIA) PRIVATE LIMITED","Maharashtra","Other",171557,1176326,1347883,"Both"],
  ["LOOM SOLAR PRIVATE LIMITED","Haryana","Solar / Renewable",180640,1146489,1327130,"Both"],
  ["NARAYAN POWERTECH P LTD","Gujarat","Other",0,1282714,1282714,"Feb Only"],
  ["GOPINATH SOLAR ENERGY PRIVATE LIMITED","Uttar Pradesh","Solar / Renewable",84426,1195814,1280241,"Both"],
  ["ENPAY TRANSFORMER COMPONENTS INDIA PRIVATE LIMITED","Gujarat","Transformer / Power",323437,907280,1230716,"Both"],
  ["VIBRANT FLEXITEK","Uttar Pradesh","Industrial / OEM",722160,378143,1100303,"Both"],
  ["RCRS INNOVATIONS LIMITED","Uttar Pradesh","Industrial / OEM",928497,168626,1097124,"Both"],
  ["FRANKE FABER INDIA PRIVATE LIMITED","Maharashtra","Appliances / White Goods",0,1096075,1096075,"Feb Only"],
  ["UMA POLY SOLUTIONS PRIVATE LIMITED","West Bengal","Other",555511,537711,1093222,"Both"],
  ["YY HARNESS CO","Delhi","Cable / Wiring Harness",877022,146994,1024016,"Both"],
  ["KALPANA DEVI","Uttar Pradesh","EV / Charging",749595,270928,1020523,"Both"],
  ["DIXON TECHNOLOGIES (INDIA) LIMITED","Andhra Pradesh","Electronics / EMS",602046,391058,993104,"Both"],
  ["KAYNES TECHNOLOGY INDIA LIMITED","Tamil Nadu","Electronics / EMS",145832,834128,979961,"Both"],
  ["SINEWAVE (REWA) ELECTRONICS PRIVATE LIMITED","Madhya Pradesh","Other",414299,498198,912497,"Both"],
  ["ESMART ENERGY SOLUTIONS LIMITED","Maharashtra","Other",600076,296489,896565,"Both"],
  ["LIVPURE PRIVATE LIMITED","Haryana","Appliances / White Goods",441818,429328,871145,"Both"],
  ["PRASHANT ABHISHEK","Uttar Pradesh","Trader / Distributor",596522,268250,864772,"Both"],
  ["DEVANG SOLAAR PRIVATE LIMITED","Uttar Pradesh","EV / Charging",409163,429748,838912,"Both"],
  ["KAYNES TECHNOLOGY INDIA LIMITED","Haryana","Electronics / EMS",706293,0,706293,"Jan Only"],
  ["RAJNI DEVI","Uttar Pradesh","EV / Charging",459662,240975,700637,"Both"],
  ["GOLDEN PEAKOCK OVERSEAS LTD","Uttar Pradesh","Trader / Distributor",0,664714,664714,"Feb Only"],
  ["TATA ADVANCED SYSTEMS LIMITED","Karnataka","Electronics / EMS",0,652478,652478,"Feb Only"],
  ["TURBO INDIA INTERCONNECT SOLUTIONS LLP","Karnataka","Cable / Wiring Harness",0,640528,640528,"Feb Only"],
  ["MV Electrosystems Limited","Haryana","Other",198554,431158,629712,"Both"],
  ["EASY PHOTO VOLTECH PRIVATE LIMITED","Uttar Pradesh","Solar / Renewable",618993,0,618993,"Jan Only"],
  ["THE HI-TECH ROBOTIC SYSTEMZ LIMITED","Haryana","Other",0,599715,599715,"Feb Only"],
  ["R H INTERNATIONAL","Uttar Pradesh","Other",0,583068,583068,"Feb Only"],
  ["INTERNATIONAL SWITCHGEARS (P) LTD","Punjab","Switchgear",132750,423718,556468,"Both"],
  ["SPR EMF INNOVATIONS PRIVATE LIMITED","Tamil Nadu","Other",0,549960,549960,"Feb Only"],
  ["MAHENDRA ELECTRICAL WORKS","Maharashtra","Other",0,528076,528076,"Feb Only"],
  ["THERMOSEN TECHNOLOGIES PRIVATE LIMITED","Karnataka","Other",166780,347262,514042,"Both"],
  ["LAXMI HYDRAULICS PVT LTD","Maharashtra","Other",58115,375864,433980,"Both"],
  ["UMA LUMINAIRES PRIVATE LIMITED","Maharashtra","Lighting",367019,61703,428722,"Both"],
  ["MARAICA INDUSTRIES","West Bengal","Trader / Distributor",271430,150834,422263,"Both"],
  ["MANOJ SHARMA","Haryana","Other",157288,256577,413865,"Both"],
  ["CPS ELECTRIC PRIVATE LIMITED","Uttar Pradesh","Other",201604,211988,413592,"Both"],
  ["MAYUR JOITKUMAR JAIN","Goa","Other",403867,0,403867,"Jan Only"],
  ["VELANGI CONNECTIVITY PRIVATE LIMITED","Maharashtra","Cable / Wiring Harness",94789,299002,393791,"Both"],
  ["MANJU SINGHAL","Delhi","Other",0,392126,392126,"Feb Only"],
  ["KUNDAN EDIFICE LIMITED","Maharashtra","Other",366154,0,366154,"Jan Only"],
  ["GOLDEN PEAKOCK OVERSEAS LTD","Uttar Pradesh","Trader / Distributor",268860,96100,364960,"Both"],
  ["JAYSHREE INSTRUMENTS PRIVATE LIMITED","Gujarat","Other",0,360875,360875,"Feb Only"],
  ["OASIS CONNECTIVITY PRIVATE LIMITED","Haryana","Other",0,345032,345032,"Feb Only"],
  ["NARAYAN ENERGY SOLUTIONS PRIVATE LIMITED","Gujarat","Other",118572,212701,331273,"Both"],
  ["NEC SWITCHGEARS & CONTROLS","Punjab","Switchgear",240720,81042,321762,"Both"],
  ["CRYSTAL METAL INDUSTRIES","Rajasthan","Industrial / OEM",134883,185234,320117,"Both"],
  ["EXICOM TELE-SYSTEMS LIMITED","Haryana","EV / Charging",164368,154586,318954,"Both"],
  ["TRIVENI ELECTROPLAST PRIVATE LIMITED","Uttar Pradesh","Other",191872,107189,299060,"Both"],
  ["FURNITURE KRAFT INTERNATIONAL PRIVATE LIMITED","Maharashtra","Other",0,291731,291731,"Feb Only"],
  ["LAXVEN SYSTEMS","Telangana","Other",212726,67705,280431,"Both"],
  ["NEXTHERMAL MANUFACTURING INDIA PRIVATE LIMITED","Karnataka","Other",83997,194806,278803,"Both"],
  ["ROHIT KOHLI","Delhi","Other",261200,0,261200,"Jan Only"],
  ["CHARGEQ TECHNOLOGIES PRIVATE LIMITED","Uttar Pradesh","EV / Charging",0,251905,251905,"Feb Only"],
  ["NEMYSH POWER PRIVATE LIMITED","Haryana","Other",0,246927,246927,"Feb Only"],
  ["FAL ENVIRO SOLUTIONS PRIVATE LIMITED","Uttar Pradesh","Other",0,236444,236444,"Feb Only"],
  ["SAMVARDHANA MOTHERSON INTERNATIONAL LIMITED","Uttar Pradesh","Other",0,225453,225453,"Feb Only"],
  ["SU-KAM POWER SYSTEMS LIMITED","Himachal Pradesh","Other",224905,0,224905,"Jan Only"],
  ["K C FIXTURES","Dadra and Nagar Haveli","Other",222806,0,222806,"Jan Only"],
  ["SURYA ROSHNI LTD","Madhya Pradesh","Lighting",188428,0,188428,"Jan Only"],
  ["EAST WEST AUTOMATION TECHNOLOGIES PRIVATE LIMITED","Haryana","Other",183631,0,183631,"Jan Only"],
  ["TUTELARY ELECTROTECH LLP","Gujarat","Other",0,182471,182471,"Feb Only"],
  ["ELIN APPLIANCES PRIVATE LIMITED","Himachal Pradesh","Appliances / White Goods",92748,73362,166110,"Both"],
  ["SNOAIR INDIA LIMITED","Himachal Pradesh","Appliances / White Goods",160480,0,160480,"Jan Only"],
  ["A K INTERNATIONAL","Delhi","Other",156857,0,156857,"Jan Only"],
  ["ASHISH KUMAR BANSAL HUF","Delhi","Other",153765,0,153765,"Jan Only"],
  ["ECOLED ILLUMINATIONS PRIVATE LIMITED","Telangana","Lighting",0,153009,153009,"Feb Only"],
  ["WH TECHNOLOGY PRIVATE LIMITED","Karnataka","Other",146949,0,146949,"Jan Only"],
  ["RAMAL DHIR","Delhi","Other",0,136639,136639,"Feb Only"],
  ["RAJ KUMAR SUNEJA","Uttarakhand","Other",43365,91785,135150,"Both"],
  ["SHAKTI PUMPS (INDIA) LIMITED","Madhya Pradesh","Pumps",0,129594,129594,"Feb Only"],
  ["AIRBORNICS DEFENCE & SPACE PRIVATE LIMITED","Punjab","Other",127543,0,127543,"Jan Only"],
  ["KUMASS INTERNATIONAL","Uttar Pradesh","Other",0,126850,126850,"Feb Only"],
  ["SAHASRA ELECTRONICS PRIVATE LIMITED","Uttar Pradesh","Other",0,125345,125345,"Feb Only"],
  ["COMFORT GRID TECHNOLOGIES PRIVATE LIMITED","Maharashtra","Other",0,120307,120307,"Feb Only"],
  ["SGS TEKNIKS MANUFACTURING PRIVATE LIMITED","Haryana","Electronics / EMS",118782,0,118782,"Jan Only"],
  ["HYDRA INDUSTRIAL SOLUTIONS","Uttar Pradesh","Other",0,117825,117825,"Feb Only"],
  ["SYRMA SGS TECHNOLOGY LIMITED","Haryana","Electronics / EMS",115832,0,115832,"Jan Only"],
  ["KULDEEP SHARMA","Uttar Pradesh","Other",0,114698,114698,"Feb Only"],
  ["BHARAT ELECTRONICS LIMITED","Karnataka","Electronics / EMS",11045,88439,99484,"Both"],
  ["JPM INDUSTRIES LIMITED","Haryana","Other",0,98683,98683,"Feb Only"],
  ["MOTHERSON SUMI WIRING INDIA LIMITED","Maharashtra","Cable / Wiring Harness",0,97938,97938,"Feb Only"],
  ["Little Nap Designs Private Limited","Haryana","Appliances / White Goods",92311,0,92311,"Jan Only"],
  ["NRIPENDRA KUMAR","Uttar Pradesh","Other",21535,23683,45218,"Both"],
  ["NOVUS HI-TECH ROBOTIC SYSTEMZ PRIVATE LIMITED","Haryana","Other",0,43960,43960,"Feb Only"],
  ["SRI BALAJI ASSEMBLIES & PLASTICS PRIVATE LIMITED","Tamil Nadu","Other",0,43660,43660,"Feb Only"],
  ["STH SENSORS PRIVATE LIMITED","Tamil Nadu","Other",23553,14750,38303,"Both"],
  ["UJJALA EXPORTS","Uttar Pradesh","Other",0,37170,37170,"Feb Only"],
  ["ANEVOLVE PRIVATE LIMITED","Rajasthan","EV / Charging",0,34971,34971,"Feb Only"],
  ["VIVEK BULB INDUSTRIES PRIVATE LIMITED","West Bengal","Other",21570,0,21570,"Jan Only"],
  ["RAVI BRASS (INDIA) PRIVATE LIMITED","Gujarat","Other",21275,0,21275,"Jan Only"],
  ["MEMORY REPRO SYSTEMS PRIVATE LIMITED","Delhi","Other",18054,0,18054,"Jan Only"],
  ["LIGHTANIUM TECHNOLOGIES PRIVATE LIMITED","Gujarat","Lighting",12203,0,12203,"Jan Only"],
  ["PHYSICS MOTORS TECHNOLOGY PRIVATE LIMITED","Karnataka","EV / Charging",0,9835,9835,"Feb Only"],
  ["SU-KAM POWER SYSTEMS LIMITED","Haryana","Other",7080,0,7080,"Jan Only"],
  ["DRONE POWER INTERNATIONAL LIMITED","Haryana","Other",0,6443,6443,"Feb Only"],
  ["BUREAU OF INDIAN STANDARDS","Uttar Pradesh","Other",2182,0,2182,"Jan Only"],
  ["NEETA AGRAWAL","Madhya Pradesh","Other",2100,0,2100,"Jan Only"],
  ["TRUEMATE HOMES INDIA PRIVATE LIMITED","Himachal Pradesh","Other",1569,0,1569,"Jan Only"],
  ["LIGHTANIUM TECHNOLOGIES PRIVATE LIMITED","Uttarakhand","Lighting",1423,0,1423,"Jan Only"],
  ["DUROFLEX LIMITED","Tamil Nadu","Other",0,1349,1349,"Feb Only"],
];

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function fmt(n) { return n ? '₹' + n.toLocaleString('en-IN') : '₹0'; }

async function run() {
  let ok = 0, fail = 0;
  for (const [name, state, seg, jan, feb, total, presence] of customers) {
    const industry = INDUSTRY_MAP[seg] || 'other';
    const size = total > 2000000 ? 'big' : 'small';
    const notes = `[Senju prospect] ${seg} | Jan: ${fmt(jan)} | Feb: ${fmt(feb)} | Total: ${fmt(total)} | ${presence}`;
    try {
      await post('/api/customers', {
        name, state, industry, size_category: size,
        notes, payment_rating: 'average', appliance_types: []
      });
      ok++;
      process.stdout.write(`\r✓ ${ok}/${customers.length} imported`);
    } catch(e) {
      fail++;
      console.log(`\n✗ Failed: ${name} — ${e.message}`);
    }
  }
  console.log(`\n\nDone — ${ok} imported, ${fail} failed`);
}

run();
