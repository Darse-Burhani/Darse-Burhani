import dotenv from "dotenv";
dotenv.config();

import prisma from "../lib/prisma";

interface RosterEntry {
  mumtahinIts: string;
  mumtahinName: string;
  talabat: Array<{ its: string; name: string; darajah: number }>;
}

const ROSTER: RosterEntry[] = [
  {
    mumtahinIts: "30387984",
    mumtahinName: "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali",
    talabat: [
      { its: "50439259", name: "Taha bhai Fakhruddin bhai Bhagat", darajah: 1 },
      { its: "30915961", name: "Shabbir bhai Aliasgar bhai Chakkiwala", darajah: 1 },
      { its: "40910090", name: "Huzaifa bhai Saifuddin bhai Presswala", darajah: 1 },
      { its: "40910318", name: "Husain bhai Hakimuddin bhai Tatariya", darajah: 1 },
      { its: "30150861", name: "Murtaza bhai Abbas bhai Chhatariya", darajah: 1 },
      { its: "40900350", name: "Huzaifa bhai Shoeb bhai Reshamwala", darajah: 2 },
      { its: "30905101", name: "Mufaddal bhai Shaikh Murtaza bhai Tinwala", darajah: 2 },
      { its: "30910256", name: "Burhanuddin bhai Aliasgar bhai Singaporewala", darajah: 2 },
    ],
  },
  {
    mumtahinIts: "30443617",
    mumtahinName: "Mulla Zoeb bhai Shoeb bhai Ezzy",
    talabat: [
      { its: "30922957", name: "Taher bhai Hatim bhai Maccawala", darajah: 2 },
      { its: "30382764", name: "Abbas bhai Hakimuddin bhai Ujjain wala", darajah: 2 },
      { its: "40902076", name: "Abbas bhai Abdeali bhai Nareli", darajah: 2 },
      { its: "40914622", name: "Ali Asgar bhai Burhanuddin bhai Tamatiya", darajah: 2 },
      { its: "40906623", name: "Ammar bhai Taha bhai Haamid", darajah: 2 },
      { its: "40437593", name: "Hatim bhai Husain bhai Lokhan wala", darajah: 2 },
      { its: "30502158", name: "Abdeali bhai Mufaddal bhai Hamed", darajah: 2 },
      { its: "30906226", name: "Fakhruddin bhai Huzaifa bhai Rampurawala", darajah: 2 },
    ],
  },
  {
    mumtahinIts: "30489490",
    mumtahinName: "Mulla Murtaza bhai Shaikh Abbas bhai Hamid",
    talabat: [
      { its: "60481809", name: "Khuzaima bhai Murtaza bhai Shaikh", darajah: 2 },
      { its: "30905644", name: "Abdullah bhai Huzaifa bhai Merchant", darajah: 2 },
      { its: "60471173", name: "Aziz bhai Hashim bhai Kagzi", darajah: 3 },
      { its: "30915929", name: "Murtaza bhai Shabbir bhai Sadriwala", darajah: 3 },
      { its: "50439170", name: "Mohammed bhai Mustafa bhai Sunelwala", darajah: 3 },
      { its: "30482790", name: "Abbas bhai Husain bhai Rao", darajah: 3 },
      { its: "30916862", name: "Mustafa bhai Mufaddal bhai Sodawala", darajah: 3 },
      { its: "30900364", name: "Mohammed bhai Huseini bhai Chikliya", darajah: 3 },
    ],
  },
  {
    mumtahinIts: "30398844",
    mumtahinName: "Mulla Husain bhai Mulla Hakimuddin bhai Jetaji",
    talabat: [
      { its: "50492006", name: "Mansoor bhai Mufaddal bhai Rangoonwala", darajah: 3 },
      { its: "40800053", name: "Adnan bhai Shaikh Huzaifa bhai Jamaali", darajah: 3 },
      { its: "30907738", name: "Taha bhai Hakimuddin bhai Bagwala", darajah: 3 },
      { its: "30801984", name: "Shabbir bhai Husain bhai Ajmerwala", darajah: 3 },
      { its: "40903361", name: "Taher bhai Aliasgar bhai Topiwala", darajah: 3 },
      { its: "30921783", name: "Hatim bhai Juzer bhai Saifee", darajah: 3 },
      { its: "30925754", name: "Mohammed bhai Murtaza bhai Vakil", darajah: 3 },
      { its: "40700520", name: "Abdulqadir bhai Murtaza bhai Jathwala", darajah: 3 },
    ],
  },
  {
    mumtahinIts: "30496517",
    mumtahinName: "Mulla Yusuf bhai Nooruddin bhai Chikli",
    talabat: [
      { its: "30900469", name: "Murtaza bhai Shakirhusain bhai Mashraqi", darajah: 3 },
      { its: "40910404", name: "Ibrahim bhai Mustafa bhai Champeli", darajah: 3 },
      { its: "40901443", name: "Aliasgar bhai Murtaza bhai Gulamaliwala", darajah: 3 },
      { its: "40913927", name: "Abizer bhai Husain bhai Warda", darajah: 3 },
      { its: "40908007", name: "Taha bhai Mulla Idris bhai Jamnagarwala", darajah: 3 },
      { its: "40901693", name: "Mustaali bhai Mustansir bhai Ezzy", darajah: 3 },
      { its: "40903926", name: "Murtaza bhai Shabbir bhai Nagda wala", darajah: 3 },
      { its: "40801149", name: "Hatim bhai Shaikh Shabbir bhai Kagalwala", darajah: 3 },
    ],
  },
  {
    mumtahinIts: "30351321",
    mumtahinName: "Mulla Huzaifa bhai Alimohammed bhai Mehmoodjiwala",
    talabat: [
      { its: "30493854", name: "Murtaza bhai Mustafa bhai Pachmeriwala", darajah: 3 },
      { its: "30498171", name: "Taher bhai Murtaza bhai Suprident", darajah: 3 },
      { its: "30920779", name: "Mustafa bhai Saifuddin bhai Chakkiwala", darajah: 3 },
      { its: "50499945", name: "Mustafa bhai Murtaza bhai Kathawala", darajah: 4 },
      { its: "60481495", name: "Mehlam bhai Shaikh Yusuf bhai Ezzy", darajah: 4 },
      { its: "30927995", name: "Taikhum bhai Huzaifa bhai Khandlaiwala", darajah: 4 },
      { its: "30704883", name: "Hashim bhai Husain bhai Loha wala", darajah: 4 },
      { its: "30805355", name: "Aliasgar bhai Ahmed bhai Miyajiwala", darajah: 4 },
    ],
  },
  {
    mumtahinIts: "30384792",
    mumtahinName: "Mulla Husain bhai Mulla Fakhruddin bhai Habib",
    talabat: [
      { its: "30905290", name: "Husain bhai Mulla Aliasgar bhai Sadriwala", darajah: 4 },
      { its: "30907730", name: "Shabbir bhai Qutbuddin bhai Cyclewala", darajah: 4 },
      { its: "50445960", name: "Ibrahim bhai Mulla Abdulqadir bhai Kagalwala", darajah: 4 },
      { its: "30900826", name: "Aliasgar bhai Mulla Huzaifa bhai Shakir", darajah: 4 },
      { its: "40902618", name: "Husain bhai Murtaza bhai Zhabuawala", darajah: 4 },
      { its: "40903321", name: "Haider bhai Mohammed bhai Bhanpurawala", darajah: 4 },
      { its: "60412841", name: "Zoherali bhai Fakhruddin bhai Mullakhanbhiwala", darajah: 4 },
      { its: "40444624", name: "Aliakbar bhai Mustafa bhai Mukati", darajah: 4 },
    ],
  },
  {
    mumtahinIts: "20433286",
    mumtahinName: "Shaikh Kumail bhai Shaikh Mustafa bhai Raj",
    talabat: [
      { its: "30382757", name: "Abdeali bhai Mulla Aliasgar bhai Calcuttawala", darajah: 4 },
      { its: "30921778", name: "Shabbir bhai Qadirali bhai Badri", darajah: 4 },
      { its: "30917401", name: "Mufaddal bhai Mustafa bhai Bharmal", darajah: 4 },
      { its: "40904164", name: "Aziz bhai Murtaza bhai Pakka", darajah: 4 },
      { its: "40910614", name: "Shabbir bhai Murtaza bhai Padrawala", darajah: 4 },
    ],
  },
  {
    mumtahinIts: "30434547",
    mumtahinName: "Mulla Juzer bhai Abbas bhai Bundiwala",
    talabat: [
      { its: "50439275", name: "Taikhoom bhai Aliasgar bhai Rampurwala", darajah: 1 },
      { its: "40907070", name: "Abdulqadir bhai Hakimuddin bhai Merji", darajah: 1 },
      { its: "40906497", name: "Mustafa bhai Murtaza bhai Ezzy", darajah: 1 },
      { its: "30382782", name: "Mustafa bhai Husain bhai Badri", darajah: 1 },
      { its: "30908943", name: "Husain bhai Mulla Moiz bhai Bhinderwala", darajah: 1 },
      { its: "30920767", name: "Abdulqadir bhai Mulla Mustafa bhai Haamid", darajah: 1 },
      { its: "40903222", name: "Huzaifa bhai Aunali bhai Bandookwala", darajah: 1 },
    ],
  },
  {
    mumtahinIts: "60414938",
    mumtahinName: "Mulla Mustafa bhai Mulla Shabbir bhai Bharmal",
    talabat: [
      { its: "50463511", name: "Burhanuddin bhai Yusuf bhai Maimoon", darajah: 2 },
      { its: "40700104", name: "Husain bhai Ibrahim bhai Kanchwala", darajah: 2 },
      { its: "40908901", name: "Taha bhai Arif bhai Mandaliwala", darajah: 2 },
      { its: "30924279", name: "Juzer bhai Yusuf bhai Bhavriyawala", darajah: 2 },
      { its: "30921790", name: "Mohammed bhai Murtaza bhai Bharkundiwala", darajah: 2 },
      { its: "40907925", name: "Hasan bhai Abdullah bhai Shamsi", darajah: 2 },
    ],
  },
  {
    mumtahinIts: "30496501",
    mumtahinName: "Mulla Abdulqadir bhai Shaikh Abdulhusain bhai Dal wala",
    talabat: [
      { its: "40901672", name: "Burhanuddin bhai Shaikh Huzefa bhai Ezzi", darajah: 2 },
      { its: "60471181", name: "Huzaifa bhai Qutbuddin bhai Sheopur wala", darajah: 2 },
      { its: "30154768", name: "Taha bhai Qutbuddin bhai Nogama wala", darajah: 2 },
      { its: "50162801", name: "Ammar bhai Mulla Fakhruddin bhai Kherodawala", darajah: 2 },
      { its: "30909003", name: "Hatim bhai Hakimuddin bhai Kanorawala", darajah: 2 },
      { its: "40420500", name: "Mufaddal bhai Mulla Zohair bhai Aga", darajah: 3 },
      { its: "30431302", name: "Shabbir bhai Mulla Murtaza bhai Rubywala", darajah: 3 },
    ],
  },
  {
    mumtahinIts: "20359148",
    mumtahinName: "Shaikh Juzer bhai Shaikh Taher bhai Presswala",
    talabat: [
      { its: "30140170", name: "Husain bhai Murtaza bhai Ezzi", darajah: 3 },
      { its: "30502122", name: "Taher bhai Murtaza bhai Burhanpurwala", darajah: 3 },
      { its: "30447347", name: "Qusai bhai Haiderali bhai Bootwala", darajah: 3 },
      { its: "30140581", name: "Mufaddal bhai Qaidjoher bhai Chakkiwala", darajah: 3 },
      { its: "30496465", name: "Hatim bhai Mohammadhussain bhai Fozi", darajah: 4 },
      { its: "40904510", name: "Burhanuddin bhai Shabbirhusain bhai Tel Wala", darajah: 4 },
    ],
  },
  {
    mumtahinIts: "30394078",
    mumtahinName: "Mulla Taher bhai Shaikh Muslim bhai Shakir",
    talabat: [
      { its: "40902907", name: "Abdulhusain bhai Shabbir bhai MKM", darajah: 1 },
      { its: "50161031", name: "Aliasgar bhai Husen bhai Bohari", darajah: 1 },
      { its: "30919168", name: "Aliasgar bhai Yusuf bhai Dawasaz", darajah: 1 },
      { its: "40908781", name: "Huzaifa bhai Mustafa bhai Rampurawala", darajah: 1 },
      { its: "60412831", name: "Murtaza bhai Husain bhai Jalgounwala", darajah: 1 },
      { its: "30928436", name: "Haider bhai Burhanuddin bhai Nathdwarawala", darajah: 1 },
      { its: "60482556", name: "Mufaddal bhai Alihusain bhai Tarawala", darajah: 1 },
    ],
  },
  {
    mumtahinIts: "30705954",
    mumtahinName: "Mulla Shabbir bhai Mustafa bhai Hydrabadwala",
    talabat: [
      { its: "30905462", name: "Taher bhai Juzer bhai Haji", darajah: 2 },
      { its: "30921258", name: "Mustansir bhai Safdar bhai Vilaytiwala", darajah: 2 },
      { its: "30382332", name: "Moiz bhai Husain bhai Maimun", darajah: 2 },
      { its: "30152684", name: "Aliasgar bhai Mulla Muslim bhai Chauhan", darajah: 2 },
      { its: "30908103", name: "Abdullah bhai Mehdi bhai Sairawala", darajah: 2 },
      { its: "50420813", name: "Husain bhai Mustafa bhai Kundaliwala", darajah: 2 },
      { its: "30914508", name: "Husain bhai Murtaza bhai Kanorewala", darajah: 2 },
      { its: "40902559", name: "Aliasgar bhai Qutbuddin bhai Sanjeliwala", darajah: 2 },
    ],
  },
  {
    mumtahinIts: "60444855",
    mumtahinName: "Mulla Husain bhai Zoeb bhai Vasanwala",
    talabat: [
      { its: "30903681", name: "Hasan bhai Murtaza bhai Gohar", darajah: 3 },
      { its: "30913138", name: "Aliasgar bhai Qaidjoher bhai Vajihi", darajah: 3 },
      { its: "30928142", name: "Ibrahim bhai Hatim bhai Songirwala", darajah: 3 },
      { its: "30378989", name: "Taha bhai Mulla Burhanuddin bhai Bohra", darajah: 3 },
      { its: "30918472", name: "Murtaza bhai Zainulabedin bhai Harar wala", darajah: 3 },
      { its: "30152892", name: "Aliasgar bhai Yusuf bhai Kapasanwala", darajah: 3 },
      { its: "30921791", name: "Taha bhai Mulla Saifuddin bhai Bharkundiwala", darajah: 4 },
      { its: "30923390", name: "Murtaza bhai Shakir bhai Mukati", darajah: 4 },
    ],
  },
  {
    mumtahinIts: "50432737",
    mumtahinName: "Mulla Murtaza bhai Mohammadhussain bhai Hamid",
    talabat: [
      { its: "40906756", name: "Taher bhai Shaikh Husain bhai Amalneri", darajah: 1 },
      { its: "40801140", name: "Hamza bhai Haider bhai Patwa", darajah: 1 },
      { its: "40915153", name: "Husain bhai Mulla Murtaza bhai Imani", darajah: 1 },
      { its: "40905961", name: "Hatim bh Abduttayyeb bh Najmi", darajah: 1 },
      { its: "40914615", name: "Murtaza bhai Abdulqadir bhai Bhaila", darajah: 1 },
      { its: "30153230", name: "Abdulhusain bhai Mufaddal bhai Zakir", darajah: 1 },
      { its: "30915778", name: "Haider bhai Murtaza bhai Dhariwala", darajah: 1 },
      { its: "30140998", name: "Abdullah bhai Huzaifa bhai Masaroadwala", darajah: 1 },
      { its: "40904897", name: "Murtaza bhai Mohammed bhai Ezzy", darajah: 1 },
    ],
  },
  {
    mumtahinIts: "60406964",
    mumtahinName: "Mulla Aliasgar bhai Husainali bhai Khandwala",
    talabat: [
      { its: "30921835", name: "Abbas bhai Murtaza bhai Vakil", darajah: 1 },
      { its: "40912070", name: "Taha bhai Mulla Huzaifa bhai Saifee", darajah: 1 },
      { its: "30116072", name: "Burhanuddin bhai Mulla Mustafa bhai Pehelwan", darajah: 1 },
      { its: "30382048", name: "Juzer bhai Taher bhai Hamid", darajah: 1 },
      { its: "30493874", name: "Hakimuddin bhai Saifuddin bhai Amlawadwala", darajah: 1 },
      { its: "40910309", name: "Taha bhai Husain bhai Patrawala", darajah: 1 },
      { its: "30922283", name: "Taher bhai Mulla Mohammed bhai Tinwala", darajah: 2 },
      { its: "40801024", name: "Al Anwar bhai Mohammed bhai Poonawala", darajah: 2 },
    ],
  },
  {
    mumtahinIts: "30472383",
    mumtahinName: "Mulla Husain bhai Mulla Murtaza bhai Wadlawala",
    talabat: [
      { its: "40903154", name: "Taha bhai Zulfaqar bhai Hamid", darajah: 2 },
      { its: "30425106", name: "Husain bhai Firoz bhai Vohra", darajah: 2 },
      { its: "60482530", name: "Shabbir bhai Huseini bhai Cyclewala", darajah: 2 },
      { its: "40903633", name: "Mohammed bhai Shaikh Mufaddal bhai Rampurawala", darajah: 3 },
      { its: "40906391", name: "Abdeali bhai Husain bhai Chanesmawala", darajah: 3 },
      { its: "40908757", name: "Ammar bhai Abbas bhai Ranalawala", darajah: 3 },
      { its: "50170710", name: "Hani bhai Murtaza bhai Sagarwala", darajah: 3 },
      { its: "30926116", name: "Huzaifa bhai Hatimali bhai Tinwala", darajah: 4 },
    ],
  },
  {
    mumtahinIts: "30421631",
    mumtahinName: "Mulla Husain bhai Mulla Murtaza bhai Raj",
    talabat: [
      { its: "40905898", name: "Mohammed bhai Mulla Huzaifa bhai Kheriwala", darajah: 1 },
      { its: "40903412", name: "Moiz bhai Zainulabedeen bhai Ghoriwala", darajah: 2 },
      { its: "40904198", name: "Mohammed bhai Saifuddin bhai Morawala", darajah: 2 },
      { its: "30905330", name: "Abduttayyeb bhai Huseini bhai Matcheswala", darajah: 4 },
      { its: "40900768", name: "Abizer bhai Siraj bhai Ranapurwala", darajah: 4 },
      { its: "30424721", name: "Taha bhai Hakimuddin bhai Rampurawala", darajah: 4 },
      { its: "30927457", name: "Alaqmar bhai Safdar bhai Susnerwala", darajah: 4 },
      { its: "40911463", name: "Behlul bhai Mustansir bhai Rangoonwala", darajah: 4 },
      { its: "30803674", name: "Aliasgar bhai Husain bhai Kanchwala", darajah: 4 },
      { its: "30912623", name: "Abdeali bhai Shabbir bhai Cutlarywala", darajah: 4 },
    ],
  },
];

async function run() {
  const teachers = await prisma.teacherProfile.findMany({
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  const students = await prisma.studentProfile.findMany({
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  const teacherByIts = new Map<string, (typeof teachers)[number]>();
  for (const t of teachers) {
    if (t.its) teacherByIts.set(t.its.trim(), t);
    if (t.employeeId) teacherByIts.set(t.employeeId.trim(), t);
  }

  const studentByIts = new Map<string, (typeof students)[number]>();
  for (const s of students) {
    if (s.its) studentByIts.set(s.its.trim(), s);
    if (s.studentId) studentByIts.set(s.studentId.trim(), s);
  }

  let matchedTeachers = 0;
  let assignedCount = 0;
  const missingTeachers: string[] = [];
  const missingStudents: string[] = [];

  for (const entry of ROSTER) {
    let teacher = teacherByIts.get(entry.mumtahinIts);
    if (!teacher) {
      const needle = entry.mumtahinName.toLowerCase().split(" ").slice(0, 2).join(" ");
      teacher = teachers.find((t) =>
        `${t.user.firstName} ${t.user.lastName}`.toLowerCase().includes(needle)
      );
    }

    if (!teacher) {
      missingTeachers.push(`${entry.mumtahinIts} (${entry.mumtahinName})`);
      continue;
    }
    matchedTeachers++;

    for (const talib of entry.talabat) {
      let student = studentByIts.get(talib.its);
      if (!student) {
        const needle = talib.name.toLowerCase().split(" ").slice(0, 2).join(" ");
        student = students.find((s) =>
          `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(needle)
        );
      }

      if (!student) {
        missingStudents.push(`${talib.its} (${talib.name})`);
        continue;
      }

      await prisma.quranIkhtebaarAssignment.upsert({
        where: {
          teacherId_studentId: { teacherId: teacher.id, studentId: student.id },
        },
        create: {
          teacherId: teacher.id,
          studentId: student.id,
          nizam: "OLD",
          darajah: talib.darajah,
          assignedById: "system-seed",
        },
        update: {
          darajah: talib.darajah,
        },
      });
      assignedCount++;
    }
  }

  console.log(`Matched Mumtahins: ${matchedTeachers}/${ROSTER.length}`);
  console.log(`Assigned Talabat: ${assignedCount}`);
  if (missingTeachers.length) console.log("Missing Teachers:", missingTeachers);
  if (missingStudents.length) console.log("Missing Students:", missingStudents);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
