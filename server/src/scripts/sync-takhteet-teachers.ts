import "../env";
import prisma from "../lib/prisma";

async function main() {
  console.log("================================================================================");
  console.log("           SYNC TAKHTEET PLANS TEACHER ASSIGNMENTS FROM TIMETABLE               ");
  console.log("================================================================================");

  // 1. Get all timetable slots that have classId, subject, and teacherId
  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId: { not: null }, classId: { not: null } },
    select: { classId: true, subject: true, teacherId: true, teacherName: true },
  });

  const slotMap = new Map<string, { teacherId: string; teacherName: string }>();
  for (const s of slots) {
    const key = `${s.classId}:${s.subject.trim().toLowerCase()}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, { teacherId: s.teacherId!, teacherName: s.teacherName || "" });
    }
  }

  console.log(`Found ${slotMap.size} distinct (classId, subject) pairs in timetable slots.`);

  // 2. Fetch all takhteet plans
  const plans = await prisma.takhteetPlan.findMany({
    select: { id: true, classId: true, subject: true, teacherId: true },
  });

  console.log(`Scanning ${plans.length} Takhteet plans...`);

  let updatedCount = 0;
  let alreadyCorrect = 0;
  let noSlotMatch = 0;

  // Group updates by new teacherId to perform efficient batched updates
  const updatesByTeacherAndKey = new Map<string, string[]>();

  for (const p of plans) {
    const key = `${p.classId}:${p.subject.trim().toLowerCase()}`;
    const target = slotMap.get(key);

    if (!target) {
      noSlotMatch++;
      continue;
    }

    if (p.teacherId === target.teacherId) {
      alreadyCorrect++;
      continue;
    }

    const groupKey = `${target.teacherId}|||${p.classId}|||${p.subject}`;
    if (!updatesByTeacherAndKey.has(groupKey)) {
      updatesByTeacherAndKey.set(groupKey, []);
    }
    updatesByTeacherAndKey.get(groupKey)!.push(p.id);
  }

  console.log(`Executing batch updates for ${updatesByTeacherAndKey.size} distinct class-subject groups...`);

  for (const [groupKey, ids] of updatesByTeacherAndKey.entries()) {
    const [teacherId, classId, subject] = groupKey.split("|||");
    const res = await prisma.takhteetPlan.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        teacherId,
      },
    });
    updatedCount += res.count;
  }

  console.log(`\nSynchronization Summary:`);
  console.log(`  - Plans updated to match assigned teacher: ${updatedCount}`);
  console.log(`  - Plans already correctly assigned: ${alreadyCorrect}`);
  console.log(`  - Plans with no direct slot: ${noSlotMatch}`);
  console.log(`  - Total plans processed: ${plans.length}`);
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Sync error:", e);
    process.exit(1);
  });
