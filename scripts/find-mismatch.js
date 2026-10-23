const fs = require('fs');
const code = fs.readFileSync('server/src/lib/timetable-master-sync.ts', 'utf8');

const match = code.match(/export const RAW_SLOTS: Array<\[string, number, number, string, string\]> = \[([\s\S]*?)\];/);
const rawSlotsStr = '[' + match[1] + ']';
const currentSlots = eval(rawSlotsStr);

const counts = {};
for (const s of currentSlots) {
  counts[s[4]] = (counts[s[4]] || 0) + 1;
}

console.log('Counts in RAW_SLOTS in code:');
console.log(JSON.stringify(counts, null, 2));
