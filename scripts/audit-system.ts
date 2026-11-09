import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const prisma = new PrismaClient();

export async function runSystemAudit() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🏛️  DARSE BURHANI — COMPLETE SYSTEM MANAGEMENT & ASSIGNMENT AUDIT');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // 1. CLASSES & CLASS TEACHERS
  const classes = await prisma.class.findMany({
    include: {
      teacher: { include: { user: true } },
      enrollments: { where: { isActive: true }, include: { student: { include: { user: true } } } },
    },
    orderBy: { grade: 'asc' },
  });

  console.log(`📚 1. CLASSES & ENROLLMENTS (${classes.length} Classes configured):`);
  let totalEnrolled = 0;
  for (const c of classes) {
    totalEnrolled += c.enrollments.length;
    const teacherName = c.teacher ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}` : '❌ NO TEACHER ASSIGNED';
    console.log(`   Grade ${c.grade} (${c.name || 'General'}): ${c.enrollments.length} active students | Class Teacher: ${teacherName}`);
  }

  // 2. STUDENTS ASSIGNMENTS
  const allStudents = await prisma.studentProfile.findMany({
    include: {
      user: true,
      classEnrollments: { where: { isActive: true }, include: { class: true } },
      parentLinks: { include: { parent: { include: { user: true } } } },
    },
  });

  const unassignedStudents = allStudents.filter(s => s.classEnrollments.length === 0);
  const unlinkedStudents = allStudents.filter(s => s.parentLinks.length === 0);

  console.log(`\n🎓 2. STUDENTS AUDIT (${allStudents.length} Total Students):`);
  console.log(`   ✅ Enrolled in active classes: ${allStudents.length - unassignedStudents.length}`);
  if (unassignedStudents.length > 0) {
    console.log(`   ⚠️ Unassigned students (no class): ${unassignedStudents.length}`);
    for (const s of unassignedStudents) {
      console.log(`      - ${s.user.firstName} ${s.user.lastName} (ITS: ${s.its}, Grade: ${s.grade || 'NONE'})`);
    }
  } else {
    console.log(`   ✨ ALL STUDENTS ARE PROPERLY ASSIGNED TO CLASSES!`);
  }

  console.log(`   👨‍👩‍👧 Linked to Parents: ${allStudents.length - unlinkedStudents.length}`);
  if (unlinkedStudents.length > 0) {
    console.log(`   ⚠️ Students without linked Parent: ${unlinkedStudents.length}`);
    for (const s of unlinkedStudents.slice(0, 5)) {
      console.log(`      - ${s.user.firstName} ${s.user.lastName} (ITS: ${s.its})`);
    }
    if (unlinkedStudents.length > 5) console.log(`      ...and ${unlinkedStudents.length - 5} more`);
  }

  // 3. TEACHERS & TIMETABLE / TAKHTEET ASSIGNMENTS
  const allTeachers = await prisma.teacherProfile.findMany({
    include: {
      user: true,
      classes: true,
      timetableSlots: true,
      takhteetPlans: true,
    },
  });

  console.log(`\n👨‍🏫 3. FACULTY & TIMETABLE AUDIT (${allTeachers.length} Total Faculty):`);
  let teachersWithSlots = 0;
  let teachersWithTakhteet = 0;
  for (const t of allTeachers) {
    const slotCount = t.timetableSlots.length;
    const takhteetCount = t.takhteetPlans.length;
    if (slotCount > 0) teachersWithSlots++;
    if (takhteetCount > 0) teachersWithTakhteet++;
  }
  console.log(`   📅 Faculty with active Timetable slots: ${teachersWithSlots}/${allTeachers.length}`);
  console.log(`   📖 Faculty with Takhteet syllabus plans: ${teachersWithTakhteet}/${allTeachers.length}`);

  // Total timetable slots
  const totalSlots = await prisma.timetableSlot.count();
  const totalTakhteet = await prisma.takhteetPlan.count();
  console.log(`   🔢 Total Timetable Slots in Master Schedule: ${totalSlots}`);
  console.log(`   🔢 Total Takhteet Plans Assigned: ${totalTakhteet}`);

  // 4. PARENTS & STUDENT LINKS
  const allParents = await prisma.parentProfile.findMany({
    include: {
      user: true,
      studentLinks: { include: { student: { include: { user: true } } } },
    },
  });

  const unlinkedParents = allParents.filter(p => p.studentLinks.length === 0);
  console.log(`\n👨‍👩‍👧 4. PARENTS AUDIT (${allParents.length} Total Parents in DB):`);
  console.log(`   ✅ Parents linked to students: ${allParents.length - unlinkedParents.length}`);
  if (unlinkedParents.length > 0) {
    console.log(`   ⚠️ Unlinked Parents: ${unlinkedParents.length}`);
    for (const p of unlinkedParents.slice(0, 5)) {
      console.log(`      - ${p.user.firstName} ${p.user.lastName} (${p.user.email})`);
    }
  }

  // 5. BIOMETRIC DEVICES & SCAN WINDOWS
  const devices = await prisma.biometricDevice.findMany();
  const scanWindows = await prisma.biometricScanWindow.findMany();
  console.log(`\n📟 5. BIOMETRIC HARDWARE & SCHEDULE WINDOWS:`);
  console.log(`   Hardware Devices (${devices.length}):`);
  for (const d of devices) {
    console.log(`      - ${d.name} (${d.host}:${d.port}) | Status: ${d.isActive ? 'ACTIVE' : 'INACTIVE'}`);
  }
  console.log(`   Scan Windows (${scanWindows.length}):`);
  for (const w of scanWindows) {
    console.log(`      - ${w.name}: Talabat (${w.startTime} - ${w.endTime}, Late: ${w.lateEndTime}) | Faculty (${w.facultyStartTime || 'N/A'} - ${w.facultyEndTime || 'N/A'}, Late: ${w.facultyLateEndTime || 'N/A'})`);
  }

  // 6. SYSTEM ROLES & PASSWORDS SUMMARY
  const userCountsByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: { id: true },
  });
  console.log(`\n🔐 6. USER CREDENTIALS & ROLES SUMMARY:`);
  for (const r of userCountsByRole) {
    console.log(`   ${r.role}: ${r._count.id} users`);
  }

  // Check how many users have default or plain passwords
  const usersWithPlain = await prisma.user.count({
    where: { plainPassword: { not: null } }
  });
  console.log(`   Plaintext passwords tracked for Instant Admin View: ${usersWithPlain}`);

  // 7. TODAY'S ATTENDANCE HEALTH
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const stuRegCount = await prisma.attendanceRegistry.count({ where: { date: todayUTC } });
  const teaRecCount = await prisma.teacherAttendanceRecord.count({ where: { date: todayUTC } });
  console.log(`\n📅 7. TODAY'S ATTENDANCE STATUS (${todayUTC.toISOString().slice(0, 10)}):`);
  console.log(`   Talabat (Students) Recorded Today: ${stuRegCount}`);
  console.log(`   Faculty (Teachers) Recorded Today: ${teaRecCount}`);
}

if (require.main === module || !module.parent) {
  runSystemAudit()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

