import { PrismaClient } from '../node_modules/@prisma/client/index.js';
const p = new PrismaClient();
const ars = await p.attendanceRecord.findMany({ orderBy:{ date:'desc' }, take:10 });
console.log('recent attendanceRecord dates:', ars.map(r=>[r.date.toISOString(), r.status, r.studentId]));
const trs = await p.teacherAttendanceRecord.findMany({ orderBy:{ date:'desc' }, take:10 });
console.log('recent teacher dates:', trs.map(r=>[r.date.toISOString(), r.status, r.teacherId]));
const regs = await p.attendanceRegistry.findMany({ orderBy:{ date:'desc' }, take:10 });
console.log('registry dates:', regs.map(r=>[r.date.toISOString(), r.status]));

// also check all dates distinct
const allDates = await p.$queryRaw`SELECT date, count(*) as cnt FROM "AttendanceRecord" GROUP BY date ORDER BY date DESC LIMIT 10`;
console.log('raw attendanceRecord grouping', allDates);
const allT = await p.$queryRaw`SELECT date, count(*) as cnt FROM "TeacherAttendanceRecord" GROUP BY date ORDER BY date DESC LIMIT 10`;
console.log('raw teacher grouping', allT);

await p.$disconnect();
