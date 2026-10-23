const fs = require('fs');
const pdfData = require('../public/parsed_pdf_timetable.json');

// Read server/src/lib/timetable-master-sync.ts
const code = fs.readFileSync('server/src/lib/timetable-master-sync.ts', 'utf8');

// Extract RAW_SLOTS
const match = code.match(/export const RAW_SLOTS: Array<\[string, number, number, string, string\]> = \[([\s\S]*?)\];/);
if (!match) {
  console.error('Could not find RAW_SLOTS');
  process.exit(1);
}

// Evaluate RAW_SLOTS
const rawSlotsStr = '[' + match[1] + ']';
const currentSlots = eval(rawSlotsStr);

console.log(`Current slots in code: ${currentSlots.length}`);
console.log(`PDF slots: ${pdfData.allAssignments.length}`);

const CANONICAL_SUBJECTS = {
  'Dirasat Uloom i...': 'Dirasat Uloom il-Quran',
  'Dirasat Uloom il-Quran': 'Dirasat Uloom il-Quran',
};

const TEACHER_KEY_MAP = {
  'Burhanddin Sir Kundli': 'Burhanddin Sir Kundli',
  'Mulla Aliasgar bhai Husainali bhai Khandwala': 'Mulla Aliasgar bhai Husainali bhai Khandwala',
  'Mulla Husain bhai Mulla Fakhruddin Habib': 'Mulla Husain bhai Mulla Fakhruddin Habib',
  'Mulla Husain bhai Shaikh Asgarali bhai Kanchwala': 'Mulla Husain bhai Shaikh Asgarali bhai Kanchwala',
  'Mulla Juzer bhai Abbas bhai Bundiwala': 'Mulla Juzer bhai Abbas bhai Bundiwala',
  'Mulla Taher bhai Shaikh Muslim bhai Shakir': 'Mulla Taher bhai Shaikh Muslim bhai Shakir',
  'Mustafa Sir Tailor': 'Mustafa Tailor',
  'Mustafa Tailor': 'Mustafa Tailor',
  'Shaikh Juzer bhai Shaikh Taher bhai Presswala': 'Shaikh Juzer bhai Shaikh Taher bhai Presswala',
  'Shaikh Kumail bhai Shaikh Mustafa bhai Raj': 'Shaikh Kumail bhai Shaikh Mustafa bhai Raj',
  'Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali': 'Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali',
  'Shaikh Qutbuddin bhai Zainuddin bhai Ezzy': 'Shaikh Qutbuddin bhai Zainuddin bhai Ezzy',
  'Shaikh Shabbir bhai Mohsinali bhai Shakir': 'Shaikh Shabbir bhai Mohsinali bhai Shakir',
};

// Index PDF slots by key: className-day-period
const pdfMap = new Map();
for (const a of pdfData.allAssignments) {
  const sub = CANONICAL_SUBJECTS[a.subject] || a.subject;
  const t = TEACHER_KEY_MAP[a.teacher] || a.teacher;
  const key = `${a.className.trim()}-${a.dayOfWeek}-${a.period}`;
  pdfMap.set(key, { subject: sub, teacher: t });
}

// Index current slots
const currentMap = new Map();
for (const [cls, day, period, sub, t] of currentSlots) {
  const key = `${cls}-${day}-${period}`;
  currentMap.set(key, { subject: sub, teacher: t });
}

let diffs = 0;
for (const [key, pdfVal] of pdfMap.entries()) {
  const curVal = currentMap.get(key);
  if (!curVal) {
    console.log(`Missing in code: ${key} -> PDF has: ${pdfVal.teacher} (${pdfVal.subject})`);
    diffs++;
  } else if (curVal.teacher !== pdfVal.teacher || curVal.subject !== pdfVal.subject) {
    console.log(`Diff at ${key}: Code has [${curVal.teacher} - ${curVal.subject}] vs PDF has [${pdfVal.teacher} - ${pdfVal.subject}]`);
    diffs++;
  }
}

console.log(`Total differences between code and PDF: ${diffs}`);
