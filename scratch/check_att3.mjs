import { PrismaClient } from '../node_modules/@prisma/client/index.js';
const p = new PrismaClient();
const d1 = new Date('2026-09-12T00:00:00.000Z');
const d2 = new Date('2026-09-11T18:30:00.000Z');
console.log('count 00:00', await p.attendanceRecord.count({where:{date:d1}}), await p.teacherAttendanceRecord.count({where:{date:d1}}), await p.attendanceRegistry.count({where:{date:d1}}));
console.log('count 18:30', await p.attendanceRecord.count({where:{date:d2}}), await p.teacherAttendanceRecord.count({where:{date:d2}}), await p.attendanceRegistry.count({where:{date:d2}}));
console.log('registry 00:00 sample', (await p.attendanceRegistry.findMany({where:{date:d1}, take:3})).map(r=>r.status));
console.log('registry 18:30 sample', (await p.attendanceRegistry.findMany({where:{date:d2}, take:3})).map(r=>r.status));
await p.$disconnect();
