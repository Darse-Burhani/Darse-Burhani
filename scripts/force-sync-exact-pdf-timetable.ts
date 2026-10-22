import { syncMasterTimetableAndClasses } from "../server/src/lib/timetable-master-sync";
import prisma from "../server/src/lib/prisma";

const EXPECTED_FACULTY_PERIODS: Record<string, number> = {
  "Burhanddin Sir Kundli": 28,
  "Mulla Aliasgar bhai Husainali bhai Khandwala": 22,
  "Mulla Husain bhai Mulla Fakhruddin Habib": 21,
  "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala": 24,
  "Mulla Juzer bhai Abbas bhai Bundiwala": 9,
  "Mulla Taher bhai Shaikh Muslim bhai Shakir": 25,
  "Mustafa Tailor": 14,
  "Shaikh Juzer bhai Shaikh Taher bhai Presswala": 22,
  "Shaikh Kumail bhai Shaikh Mustafa bhai Raj": 20,
  "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali": 21,
  "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy": 16,
  "Shaikh Shabbir bhai Mohsinali bhai Shakir": 18,
};

async function main() {
  console.log("=== Running Master Timetable Force Sync from Teacher.pdf ===");
  const res = await syncMasterTimetableAndClasses(true);
  console.log("Sync Result:", res);

  console.log("\n=== Verifying Timetable Slot Counts by Teacher ===");
  const allSlots = await prisma.timetableSlot.findMany({
    include: {
      teacher: {
        include: { user: true },
      },
    },
  });

  console.log(`Total slots in DB: ${allSlots.length}`);
  const counts: Record<string, number> = {};
  for (const s of allSlots) {
    const name = s.teacherName || "Unassigned";
    counts[name] = (counts[name] || 0) + 1;
  }

  let allMatched = true;
  for (const [teacher, expected] of Object.entries(EXPECTED_FACULTY_PERIODS)) {
    const actual = counts[teacher] || 0;
    const ok = actual === expected;
    if (!ok) allMatched = false;
    console.log(`- ${ok ? "✓" : "✗"} ${teacher}: expected ${expected}, got ${actual}`);
  }

  if (allMatched) {
    console.log("\nSUCCESS: All 12 teachers have EXACTLY their assigned periods matching Teacher.pdf!");
  } else {
    console.error("\nWARNING: Some slot counts differed from Teacher.pdf!");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
