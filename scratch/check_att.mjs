import { PrismaClient } from '../node_modules/@prisma/client/index.js';
const p = new PrismaClient();

function getISTDetails(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false });
  const parts = formatter.formatToParts(date);
  const get=(t)=>parts.find(x=>x.type===t)?.value||"00";
  const y=parseInt(get("year"),10); const m=parseInt(get("month"),10)-1; const d=parseInt(get("day"),10);
  return { year:y, month:m, day:d, calendarDayUTC:new Date(Date.UTC(y,m,d,0,0,0)-5.5*60*60*1000) };
}
const todayUTC = getISTDetails(new Date()).calendarDayUTC;
console.log('today IST date UTC key:', todayUTC.toISOString());

const arCount = await p.attendanceRecord.count({ where:{ date: todayUTC }});
console.log('attendanceRecord today:', arCount);
const trCount = await p.teacherAttendanceRecord.count({ where:{ date: todayUTC }});
console.log('teacherAttendanceRecord today:', trCount);

// sample 5
const ars = await p.attendanceRecord.findMany({ where:{date:todayUTC}, take:5, include:{student:{include:{user:true}}}});
console.log(JSON.stringify(ars,null,2));
const trs = await p.teacherAttendanceRecord.findMany({ where:{date:todayUTC}, take:5, include:{teacher:{include:{user:true}}}});
console.log(JSON.stringify(trs,null,2));

import fs from 'fs';
const log = fs.readFileSync('server/logs/attendance/2026-09-12.jsonl','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const matched = log.filter(x=>x.outcome==='MATCHED');
console.log('log total', log.length, 'matched', matched.length, 'system/tooearly', log.filter(x=>x.outcome!=='MATCHED').length);
console.log('matched breakdown by hour IST:', matched.slice(0,5).map(m=>m.checkInIST));
console.log('tooEarly/system sample', log.filter(x=>x.outcome!=='MATCHED').slice(0,3).map(m=>m.message?.slice(0,120)));

await p.$disconnect();
