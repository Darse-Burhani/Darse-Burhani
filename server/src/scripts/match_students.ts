import prisma from "../lib/prisma.js";

const requestedNames = [
  "Abdeali bhai Aliasgar bhai Calcuttawala",
  "Abdeali bhai Shabbir bhai Cutlarywala",
  "Abduttayyeb bhai Huseini bhai Matcheswala",
  "Abizer bhai Siraj bhai Ranapurwala",
  "Alaqmar bhai Safdar bhai Susnerwala",
  "Aliakbar bhai Mustafa bhai Mukati",
  "Aliasgar bhai Ahmed bhai Miyajiwala",
  "Aliasgar bhai Husain bhai Kanchwala",
  "Aliasgar bhai Mulla Huzaifa bhai Shakir",
  "Aziz bhai Murtaza bhai Pakka",
  "Behlul bhai Mustansir bhai Rangoonwala",
  "Burhanuddin bhai Shabbirhusain bhai Telwala",
  "Haider bhai Mohammed bhai Bhanpurawala",
  "Hashim bhai Husain bhai Lohawala",
  "Hatim bhai Mohammadhussain bhai Fozi",
  "Husain bhai Mulla Aliasgar bhai Sadriwala",
  "Husain bhai Murtaza bhai Zhabuawala",
  "Huzaifa bhai Hatimali bhai Tinwala",
  "Ibrahim bhai Mulla Abdulqadir bhai Kagalwala",
  "Mehlam bhai Shaikh Yusuf bhai Ezzy",
  "Mufaddal bhai Mustafa bhai Bharmal",
  "Murtaza bhai Shakir bhai Mukati",
  "Mustafa bhai Murtaza bhai Kathawala",
  "Shabbir bhai Murtaza bhai Padrawala",
  "Shabbir bhai Qadirali bhai Badri",
  "Shabbir bhai Qutbuddin bhai Cyclewala",
  "Taha bhai Hakimuddin bhai Rampurawala",
  "Taha bhai Saifuddin bhai Bharkundiwala",
  "Taikhum bhai Huzaifa bhai Khandlaiwala",
  "Zoherali bhai Fakhruddin bhai Mullakhanbhiwala",
];

async function main() {
  const allStudents = await prisma.studentProfile.findMany({
    include: {
      user: true,
      talabatProfile1447: true,
    },
  });

  console.log(`Total students in DB: ${allStudents.length}`);

  function norm(str: string) {
    return str
      .toLowerCase()
      .replace(/bhai|mulla|shaikh/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  const matched: any[] = [];
  const unmatched: string[] = [];

  for (const name of requestedNames) {
    const target = norm(name);
    const found = allStudents.find((s) => {
      const fullName = `${s.user.firstName} ${s.user.lastName}`;
      const n1 = norm(fullName);
      const n2 = norm(s.user.firstName);
      return n1.includes(target) || target.includes(n1) || (n2.length > 4 && target.startsWith(n2));
    });

    if (found) {
      matched.push({
        requestedName: name,
        id: found.id,
        dbName: `${found.user.firstName} ${found.user.lastName}`,
        its: found.its,
        grade: found.grade,
        has1447: Boolean(found.talabatProfile1447),
      });
    } else {
      unmatched.push(name);
    }
  }

  console.log(`Matched: ${matched.length}/${requestedNames.length}`);
  if (unmatched.length > 0) {
    console.log("Unmatched names:", unmatched);
  }
  console.log("First 5 matched:", matched.slice(0, 5));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

