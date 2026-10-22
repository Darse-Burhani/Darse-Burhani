const fs = require('fs');
const data = require('../public/parsed_pdf_timetable.json');

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

const slots = [];
const classClashMap = new Map();
const teacherClashMap = new Map();

for (const a of data.allAssignments) {
  const subject = CANONICAL_SUBJECTS[a.subject] || a.subject;
  const teacherKey = TEACHER_KEY_MAP[a.teacher] || a.teacher;
  const className = a.className.trim();
  const day = a.dayOfWeek;
  const period = a.period;

  // Check class clash: (className, day, period)
  const classKey = `${className}-D${day}-P${period}`;
  if (classClashMap.has(classKey)) {
    console.error(`CLASS CLASH: ${classKey} assigned to both ${classClashMap.get(classKey)} and ${teacherKey} (${subject})`);
  } else {
    classClashMap.set(classKey, `${teacherKey} (${subject})`);
  }

  // Check teacher clash: (teacherKey, day, period)
  const teacherKeyCheck = `${teacherKey}-D${day}-P${period}`;
  if (teacherClashMap.has(teacherKeyCheck)) {
    console.error(`TEACHER CLASH: ${teacherKeyCheck} assigned to both ${teacherClashMap.get(teacherKeyCheck)} and ${className} (${subject})`);
  } else {
    teacherClashMap.set(teacherKeyCheck, `${className} (${subject})`);
  }

  slots.push([className, day, period, subject, teacherKey]);
}

console.log(`Total slots parsed: ${slots.length}`);
console.log(`Unique class-time slots: ${classClashMap.size}`);
console.log(`Unique teacher-time slots: ${teacherClashMap.size}`);

// Group by className and sort by day, then period
const byClass = {};
for (const s of slots) {
  if (!byClass[s[0]]) byClass[s[0]] = [];
  byClass[s[0]].push(s);
}

for (const cls of Object.keys(byClass).sort()) {
  byClass[cls].sort((a, b) => a[1] - b[1] || a[2] - b[2]);
  console.log(`Class ${cls}: ${byClass[cls].length} periods`);
}
