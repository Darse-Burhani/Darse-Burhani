import { createHash, randomBytes, createCipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function encKey() {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-biometric-secret';
  return createHash('sha256').update(secret).digest();
}

function encryptPassword(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: Buffer.concat([enc, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

async function main() {
  const correctPassword = 'DARSEBURHANI5253';
  const { enc, iv } = encryptPassword(correctPassword);

  // Update 192.168.0.4
  await prisma.biometricDevice.updateMany({
    where: { host: '192.168.0.4' },
    data: {
      passwordEnc: enc,
      passwordIv: iv,
      enabled: true,
      status: 'ONLINE',
      lastError: null,
    }
  });
  console.log('✅ Device 1 (192.168.0.4) updated with active credentials.');

  // Update or Create 192.168.0.5
  const existing = await prisma.biometricDevice.findFirst({ where: { host: '192.168.0.5' } });
  let dev2;
  if (existing) {
    dev2 = await prisma.biometricDevice.update({
      where: { id: existing.id },
      data: {
        name: 'Secondary Terminal (192.168.0.5)',
        port: 80,
        username: 'admin',
        passwordEnc: enc,
        passwordIv: iv,
        enabled: true,
        pollIntervalSeconds: 15,
        status: 'ONLINE',
      }
    });
  } else {
    dev2 = await prisma.biometricDevice.create({
      data: {
        name: 'Secondary Terminal (192.168.0.5)',
        type: 'HIKVISION',
        host: '192.168.0.5',
        port: 80,
        username: 'admin',
        passwordEnc: enc,
        passwordIv: iv,
        enabled: true,
        status: 'ONLINE',
        pollIntervalSeconds: 15,
      }
    });
  }
  console.log('✅ Device 2 (192.168.0.5) successfully registered in DB with ID:', dev2.id);

  const allDevs = await prisma.biometricDevice.findMany();
  console.log('\nConfigured Biometric Devices in DB:');
  for (const d of allDevs) {
    console.log(`- [${d.status}] ${d.name} (${d.host}:${d.port}) — Enabled: ${d.enabled}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
