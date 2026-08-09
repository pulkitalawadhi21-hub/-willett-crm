const db = require('./database');

const contacts = [
  { name: 'VARGO', notes: 'BATCHMATE + will win shubham relative, aromist prateek gym with gaurav bhaiya', assigned_to: 'Garv' },
  { name: 'AMKASH', notes: 'MET AT EXHIBITION, WILL WIN REFERENCE', assigned_to: 'Garv' },
  { name: 'ALMONARD', notes: 'FOLLOWUP', assigned_to: 'Garv' },
  { name: 'BESTON', notes: 'MEET AT FACTORY , AVOID CREDIT', assigned_to: 'Garv' },
  { name: 'MECHANIC', notes: 'MEET FROM 12-15AUG', assigned_to: 'Unassigned' },
  { name: 'SKYZEN HYDERABAD', notes: 'GIVE PRICING', assigned_to: 'Unassigned' },
  { name: 'AMIT INDORE', notes: 'WILL START IN SEPTEMBER SEND SAMPLE 14/38 2.5CORE', assigned_to: 'Unassigned' },
  { name: 'PAHLASH BLU SUPRIA INDORE', notes: 'ALREADY WORKIN MEET ONCE', assigned_to: 'Unassigned' },
  { name: 'CAMBREEZE AHEMBDABAD', notes: 'ASK TO COURIER HIS SAMPLE', assigned_to: 'Unassigned' },
  { name: 'SUKHIYA', notes: 'DEVELOP SAMPLES GROOMET CHANGE', assigned_to: 'Unassigned' },
  { name: 'DEOGUN BAHADURGARH', notes: 'MEET ONCE', assigned_to: 'Unassigned' },
  { name: 'AEROMAX JHUNDPUR', notes: 'MEET ONCE', assigned_to: 'Unassigned' },
  { name: 'GOKOOL MUNDKA', notes: 'MET ONCE MEET AGAIN PREPARE SAMPLE IN WHITE PP', assigned_to: 'Unassigned' },
  { name: 'WILLWIN PUMP', notes: 'PREPARE SAMPLE 2CORE GREY', assigned_to: 'Unassigned' },
  { name: 'LUCKY MOTOR BHATINDA', notes: 'MEET WITH SAMPLE TAKING FROM BANSAL', assigned_to: 'Unassigned' },
  { name: 'UJJWAL GHAZIABAD', notes: 'BUYING 2CORE MEET ONCE', assigned_to: 'Unassigned' },
  { name: 'SPEEDO MOTOR', notes: 'MEET WITH SAMPLES', assigned_to: 'Unassigned' },
  { name: 'ELECTROMECH MOTOR', notes: 'NEXT MONTH DISCUSS RATES', assigned_to: 'Unassigned' },
  { name: 'EKKA', notes: 'PICKUP HIS SAMPLES AND DEVELOPMENT COOLER AND INFRA', assigned_to: 'Garv' },
  { name: 'IMPEX', notes: 'KETTLE SAMPLES?? INDUCTION SAMPLES SUMBIT', assigned_to: 'Garv' },
  { name: 'VGS PUMP', notes: 'MEET ONCE', assigned_to: 'Unassigned' },
  { name: 'RENOVO APPLIANCES MOTO', notes: 'MEET ONCE 70-80K MOTOR', assigned_to: 'Unassigned' },
  { name: 'REXONARD MUMBAI', notes: 'GET IN TOUCH', assigned_to: 'Unassigned' },
  { name: 'AROMIST PRATEEK', notes: 'WILL WIN BROTHER MEET ONCE IN LATE AUGUST', assigned_to: 'Unassigned' },
  { name: 'ROHTAK COOLER MANUFACTURER', notes: 'ASK FOR SAMPLE', assigned_to: 'Unassigned' },
  { name: 'LUDHIANA SPARE', notes: 'TAKING FROM KHANNA', assigned_to: 'Unassigned' },
  { name: 'PANKAJ MOTOR', notes: 'CALCULATE RATES AND MEET', assigned_to: 'Unassigned' },
  { name: 'MAIRA COOLER', notes: 'MEET', assigned_to: 'Garv' },
  { name: 'ROTOR INDIA', notes: 'MET HIM ONCE MEET AGAIN', assigned_to: 'Unassigned' },
  { name: 'YETI', notes: '2PIN DISCUSS CLASS 2 LICENSE CONVERT TO INSERT FOR 3PIN', assigned_to: 'Unassigned' },
  { name: 'BANWARI', notes: 'SEND CCA 3PIN SAMPLES', assigned_to: 'Unassigned' },
  { name: 'RD CAPACITOR FAIRIDABAD', notes: 'MET HIM ONCE MEET AGAIN', assigned_to: 'Unassigned' },
  { name: 'WINDSHARE COOLER', notes: 'TAKE REFERENCE FROM ANMOL', assigned_to: 'Unassigned' },
  { name: 'VICTURA', notes: 'SUMBITED CARD', assigned_to: 'Garv' },
  { name: 'DEV MOTOR', notes: 'MET EARLIER ALSO.', assigned_to: 'Unassigned' }
];

console.log(`Starting import of ${contacts.length} exhibition contacts...`);

const insert = db.prepare(`
  INSERT INTO exhibition_contacts (name, notes, assigned_to, status)
  VALUES (?, ?, ?, 'Pending')
`);

const insertMany = db.transaction((list) => {
  for (const c of list) {
    insert.run(c.name, c.notes, c.assigned_to);
  }
});

try {
  insertMany(contacts);
  console.log('Successfully imported all contacts!');
} catch (e) {
  console.error('Import failed:', e);
}
