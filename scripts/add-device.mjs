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

const { enc, iv } = encryptPassword('DARSEBURAHNI5253');

const existing = await prisma.biometricDevice.findFirst({
  where: { host: '192.168.0.4' }
});

let dev;
if (existing) {
  dev = await prisma.biometricDevice.update({
    where: { id: existing.id },
    data: {
      name: 'Main Gate Terminal',
      port: 80,
      username: 'admin',
      passwordEnc: enc,
      passwordIv: iv,
      enabled: true,
      status: 'ONLINE',
      pollIntervalSeconds: 15,
      lastError: null
    }
  });
  console.log('Updated existing device:', dev.id, dev.name);
} else {
  dev = await prisma.biometricDevice.create({
    data: {
      name: 'Main Gate Terminal',
      type: 'HIKVISION',
      host: '192.168.0.4',
      port: 80,
      username: 'admin',
      passwordEnc: enc,
      passwordIv: iv,
      enabled: true,
      status: 'ONLINE',
      pollIntervalSeconds: 15,
      lastError: null
    }
  });
  console.log('Created new device in DB:', dev.id, dev.name);
}

await prisma.$disconnect();
