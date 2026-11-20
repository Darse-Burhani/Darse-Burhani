import "../env";
import prisma from "../lib/prisma";
import { toConnection, getAcsEvents, getStartOfDayISTFor, isAttendanceEvent } from "../lib/hikvision";
import { logBiometricScan } from "../lib/biometric-scan-log";

/**
 * One-time / on-demand importer that copies punches still sitting on the
 * physical terminals into the permanent Supabase ledger (`biometric_scan_logs`).
 *
 * Usage:
 *   npx tsx server/src/scripts/backfill-scan-ledger.ts            # today
 *   npx tsx server/src/scripts/backfill-scan-ledger.ts 2026-11-20 # a specific IST day
 *
 * This is the only job that needs LAN access. Once the terminals push directly
 * to the cloud (HTTP Listening), it is not required for day-to-day attendance.
 */
async function main() {
  const dateArg = process.argv[2];
  const dayStart = getStartOfDayISTFor(dateArg ? new Date(`${dateArg}T00:00:00+05:30`) : new Date());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const dateLabel = dayStart.toISOString().slice(0, 10);

  console.log(`📥 Backfilling Hikvision punch ledger for ${dateLabel} (${dayStart.toISOString()} → ${dayEnd.toISOString()})`);

  const devices = await prisma.biometricDevice.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  const students = await prisma.studentProfile.findMany({
    select: { id: true, userId: true, its: true, studentId: true, trNo: true, biometricHash: true, user: { select: { firstName: true, lastName: true } } },
  });
  const teachers = await prisma.teacherProfile.findMany({
    select: { id: true, userId: true, its: true, employeeId: true, biometricHash: true, user: { select: { firstName: true, lastName: true } } },
  });

  const studentIndex = new Map<string, (typeof students)[number]>();
  for (const s of students) {
    for (const key of [s.its, s.studentId, s.trNo, s.biometricHash]) {
      const v = String(key ?? "").trim();
      if (!v) continue;
      studentIndex.set(v, s);
      studentIndex.set(v.replace(/^0+/, ""), s);
    }
  }
  const teacherIndex = new Map<string, (typeof teachers)[number]>();
  for (const t of teachers) {
    for (const key of [t.its, t.employeeId, t.biometricHash]) {
      const v = String(key ?? "").trim();
      if (!v) continue;
      teacherIndex.set(v, t);
      teacherIndex.set(v.replace(/^0+/, ""), t);
    }
  }

  let written = 0;
  for (const dev of devices) {
    try {
      const { events } = await getAcsEvents(toConnection(dev), dayStart, dayEnd);
      const scans = events.filter(isAttendanceEvent);
      console.log(`\n[${dev.name}] ${scans.length} attendance event(s)`);
      for (const ev of scans) {
        const raw = String(ev.employeeNoString ?? ev.cardNo ?? ev.name ?? "").trim();
        if (!raw) continue;
        const student = studentIndex.get(raw) || studentIndex.get(raw.replace(/^0+/, ""));
        const teacher = !student ? teacherIndex.get(raw) || teacherIndex.get(raw.replace(/^0+/, "")) : undefined;
        const person = student?.user ?? teacher?.user;
        const verifyMode = ev.currentVerifyMode ?? null;
        const method = verifyMode && /face/i.test(verifyMode) ? "FACIAL" : verifyMode && /finger/i.test(verifyMode) ? "FINGERPRINT" : null;

        await logBiometricScan({
          deviceId: dev.id,
          deviceHost: dev.host,
          deviceName: dev.name,
          rawEmployeeNo: raw,
          employeeNo: raw,
          personName: person ? `${person.firstName} ${person.lastName}`.trim() : ev.name ?? null,
          scannedAt: ev.time ? new Date(ev.time) : new Date(),
          verifyMode,
          method,
          serialNo: ev.serialNo ? String(ev.serialNo) : null,
          source: "POLL",
          outcome: student || teacher ? "BACKFILL" : "UNMATCHED",
          attendance: Boolean(student || teacher),
          matchedType: student ? "STUDENT" : teacher ? "TEACHER" : null,
          studentId: student?.id ?? null,
          teacherId: teacher?.id ?? null,
          userId: student?.userId ?? teacher?.userId ?? null,
          message: "Imported from terminal memory into the Supabase scan ledger",
          rawPayload: ev,
        });
        written++;
      }
    } catch (err: any) {
      console.warn(`[${dev.name}] skipped: ${err?.message || err}`);
    }
  }

  console.log(`\n✅ Ledger backfill complete — ${written} punch(es) stored in Supabase for ${dateLabel}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL", e); process.exit(1); });
