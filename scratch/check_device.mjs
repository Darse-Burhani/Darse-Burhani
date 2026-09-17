import { PrismaClient } from '../node_modules/@prisma/client/index.js';
const p = new PrismaClient();
const devices = await p.biometricDevice.findMany();
console.log(JSON.stringify(devices, null, 2));
console.log('---WINDOWS---');
const windows = await p.biometricScanWindow.findMany({orderBy:{startTime:'asc'}});
console.log(JSON.stringify(windows, null, 2));
await p.$disconnect();
