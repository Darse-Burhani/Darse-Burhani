import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import prisma from "../lib/prisma.js";
import { generateTalabatHtml } from "./generate_single_test_pdf.js";

const requestedList = [
  { requestedName: "Abdeali bhai Aliasgar bhai Calcuttawala", its: "30382757" },
  { requestedName: "Abdeali bhai Shabbir bhai Cutlarywala", its: "30912623" },
  { requestedName: "Abduttaiyeb bhai Huseni bhai Matcheswala", its: "30905330" },
  { requestedName: "Abizer bhai Siraj bhai Ranapurwala", its: "40900768" },
  { requestedName: "Alaqmar bhai Safdar bhai Susnerwala", its: "30927457" },
  { requestedName: "Aliakbar bhai Mustafa bhai Mukati", its: "40444624" },
  { requestedName: "Aliasgar bhai Ahmed bhai Miyajiwala", its: "30805355" },
  { requestedName: "Aliasgar bhai Husain bhai Kanchwala", its: "30803674" },
  { requestedName: "Aliasgar bhai Mulla Huzaifa bhai Shakir", its: "30900826" },
  { requestedName: "Aziz bhai Murtaza bhai Pakka", its: "40904164" },
  { requestedName: "Behlul bhai Mustansir bhai Rangoonwala", its: "40911463" },
  { requestedName: "Burhanuddin bhai Shabbirhusain bhai Telwala", its: "40904510" },
  { requestedName: "Haider bhai Mohammed bhai Bhanpurawala", its: "40903321" },
  { requestedName: "Hashim bhai Husain bhai Lohawala", its: "30704883" },
  { requestedName: "Hatim bhai Mohammadhussain bhai Fozi", its: "30496465" },
  { requestedName: "Husain bhai Mulla Aliasgar bhai Sadriwala", its: "30905290" },
  { requestedName: "Husain bhai Murtaza bhai Zhabuawala", its: "40902618" },
  { requestedName: "Huzaifa bhai Hatimali bhai Tinwala", its: "30926116" },
  { requestedName: "Ibrahim bhai Mulla Abdulqadir bhai Kagalwala", its: "50445960" },
  { requestedName: "Mehlam bhai Shaikh Yusuf bhai Ezzy", its: "60481495" },
  { requestedName: "Mufaddal bhai Mustafa bhai Bharmal", its: "30917401" },
  { requestedName: "Murtaza bhai Shakir bhai Mukati", its: "30923390" },
  { requestedName: "Mustafa bhai Murtaza bhai Kathawala", its: "50499945" },
  { requestedName: "Shabbir bhai Murtaza bhai Padrawala", its: "40910614" },
  { requestedName: "Shabbir bhai Qadirali bhai Badri", its: "30921778" },
  { requestedName: "Shabbir bhai Qutbuddin bhai Cyclewala", its: "30907730" },
  { requestedName: "Taha bhai Hakimuddin bhai Rampurawala", its: "30424721" },
  { requestedName: "Taha bhai Saifuddin bhai Bharkundiwala", its: "30921791" },
  { requestedName: "Taikhum bhai Huzaifa bhai Khandlaiwala", its: "30927995" },
  { requestedName: "Zoherali bhai Fakhruddin bhai Mullakhanbhiwala", its: "60412841" },
];

async function main() {
  const outputDir = path.resolve("d:/Darse-Burhani/talabat_30_profiles_pdf");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const edgeExe = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (!fs.existsSync(edgeExe)) {
    throw new Error(`Edge executable not found at ${edgeExe}`);
  }

  console.log(`Starting bulk PDF generation for ${requestedList.length} students...`);
  console.log(`Target directory: ${outputDir}`);

  let successCount = 0;

  for (let i = 0; i < requestedList.length; i++) {
    const item = requestedList[i];
    console.log(`[${i + 1}/${requestedList.length}] Processing: ${item.requestedName} (ITS: ${item.its})...`);

    // Fetch student profile from DB
    const student = await prisma.studentProfile.findFirst({
      where: {
        its: item.its,
      },
      include: {
        user: true,
        talabatProfile1447: true,
      },
    });

    if (!student) {
      console.warn(`  ⚠️ Could not find student in database for ITS: ${item.its}`);
      continue;
    }

    const km = await prisma.systemSetting.findUnique({
      where: { key: `knowing_myself_${student.id}` },
    });

    const pData = {
      name: `${student.user.firstName} ${student.user.lastName}`,
      itsNo: student.its || student.user.its,
      idNo: student.studentId || student.id,
      studentPhotoUrl: student.talabatProfile1447?.studentPhotoUrl || student.user.avatarUrl,
      motherName: student.talabatProfile1447?.motherName || student.motherName,
      fatherName: student.talabatProfile1447?.fatherName || student.fatherName,
      fatherOccupation: student.talabatProfile1447?.fatherOccupation || student.fatherOccupation,
      standard: student.grade ? `Darajah ${student.grade}` : "Darajah 4 (Rabea)",
      grade: student.grade || "4",
      section: student.section || "A",
      studentStatus: student.status ? String(student.status) : "Sanah",
      admissionYear: student.admissionYear || "1444 H",
      currentYear: student.currentYear || "1447 H",
      age: student.age || 20,
      watan: student.watan,
      residentCity: student.residentCity || student.jamaat,
      address: student.address,
      mobileNumber: student.mobileNumber,
      email: student.user.email,
      externalSchooling: student.externalSchooling,
      reallyGoodAt: student.reallyGoodAt,
      loveToStudy: student.loveToStudy,
      loveForFun: student.loveForFun,
      knowingMyself: km?.value || null,
      strengths: student.talabatProfile1447?.strengths || (km?.value as any)?.selectedStrengths || [],
      weaknesses: student.talabatProfile1447?.weaknesses || (km?.value as any)?.selectedWeaknesses || [],
    };

    const html = generateTalabatHtml(pData);
    const sanitizedName = item.requestedName.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
    const tmpHtml = path.resolve(`d:/Darse-Burhani/temp_profile_${item.its}.html`);
    const outPdf = path.resolve(outputDir, `${String(i + 1).padStart(2, "0")}_${item.its}_${sanitizedName}.pdf`);

    fs.writeFileSync(tmpHtml, html, "utf-8");

    try {
      execFileSync(edgeExe, [
        "--headless=new",
        "--no-pdf-header-footer",
        `--print-to-pdf=${outPdf}`,
        `file:///${tmpHtml.replace(/\\/g, "/")}`,
      ]);

      const size = fs.statSync(outPdf).size;
      console.log(`  ✓ Generated: ${path.basename(outPdf)} (${Math.round(size / 1024)} KB)`);
      successCount++;
    } catch (err: any) {
      console.error(`  ❌ Failed to generate PDF for ${item.requestedName}:`, err?.message || err);
    } finally {
      if (fs.existsSync(tmpHtml)) {
        fs.unlinkSync(tmpHtml);
      }
    }
  }

  console.log(`\n🎉 Completed! Generated ${successCount}/${requestedList.length} PDFs in: ${outputDir}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
