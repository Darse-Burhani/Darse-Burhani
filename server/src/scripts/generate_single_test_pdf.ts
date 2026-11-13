import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import prisma from "../lib/prisma.js";

const logoPath = path.resolve("client/public/logo.png");
const logoBase64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : "";

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return "—";
  const s = String(str).trim();
  if (!s) return "—";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateTalabatHtml(data: any): string {
  const arabicHeader = "الحمد لله على ما أنعم والشكر له على ما ألهم";

  const strengths = Array.isArray(data.strengths) ? data.strengths : [];
  const weaknesses = Array.isArray(data.weaknesses) ? data.weaknesses : [];
  const obstacles = Array.isArray(data.knowingMyself?.selectedObstacles)
    ? data.knowingMyself.selectedObstacles
    : [];

  const km = data.knowingMyself || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(data.name)} - Talabat Profile 1447 H</title>
<style>
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    background: #ffffff;
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    padding: 8mm 9mm;
    margin: 0 auto;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
    border: 1.5px solid #0f172a;
  }
  .page-1 {
    page-break-after: always;
    break-after: page;
  }
  .page-2 {
    page-break-before: always;
    break-before: page;
  }
  .arabic-calligraphy {
    font-family: 'Traditional Arabic', 'Amiri', 'Scheherazade New', 'Segoe UI', Tahoma, sans-serif;
    direction: rtl;
    unicode-bidi: embed;
    letter-spacing: 0px !important;
    word-spacing: normal !important;
  }
  .border-b-thick { border-bottom: 2px solid #0f172a; }
  .border-t-thick { border-top: 2px solid #0f172a; }
  .table-box {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .table-row {
    display: grid;
    grid-template-columns: 125px 1fr;
    align-items: center;
    padding: 3px 8px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 10px;
  }
  .table-row-col2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #e2e8f0;
  }
  .table-cell-left {
    display: grid;
    grid-template-columns: 125px 1fr;
    align-items: center;
    padding: 3px 8px;
    border-right: 1px solid #e2e8f0;
    font-size: 10px;
  }
  .table-cell-right {
    display: grid;
    grid-template-columns: 125px 1fr;
    align-items: center;
    padding: 3px 8px;
    font-size: 10px;
  }
  .table-label {
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.03em;
  }
  .table-val {
    font-weight: 600;
    color: #0f172a;
    word-break: break-word;
  }
  .table-val-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 700;
  }
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.2;
  }
  .badge-dark { background: #0f172a; color: #ffffff; }
  .badge-amber { background: #fef3c7; color: #78350f; border: 1px solid #fde68a; }
  .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
  .badge-indigo { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }

  .q-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3.5px solid #d97706;
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 48px;
  }
  .q-title {
    font-weight: 800;
    color: #020617;
    font-size: 10px;
    line-height: 1.25;
    margin-bottom: 2px;
  }
  .q-ans {
    color: #0f172a;
    font-weight: 500;
    font-size: 9.5px;
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-word;
    border-left: 2px solid #fde68a;
    padding-left: 5px;
    margin-top: 2px;
  }
</style>
</head>
<body>

<!-- ═════════════════════════════════════════════════════════════════
     A4 PAGE 1: STUDENT PROFILE & DEMOGRAPHICS (DARASEH RABEA)
═════════════════════════════════════════════════════════════════ -->
<div class="page page-1">
  <div>
    <!-- Institutional Header -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        ${logoBase64 ? `<img src="${logoBase64}" style="width: 42px; height: 42px; object-fit: contain;">` : ""}
        <div>
          <h1 style="font-size: 17px; font-weight: 900; letter-spacing: 0.05em; color: #020617; font-family: Georgia, serif; text-transform: uppercase; line-height: 1.1;">DARSE BURHANI</h1>
          <h2 style="font-size: 10.5px; font-weight: 800; color: #78350f; margin-top: 1px;">DARAJEH RABEA (GRADE 4) • STUDENT TALABAT PROFILE</h2>
          <div style="font-size: 9px; font-weight: 500; color: #64748b;">Academic Year 1447 H • Official Individual Record Sheet (Page 1 of 2)</div>
        </div>
      </div>
      <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
        <div class="arabic-calligraphy" style="font-size: 12px; font-weight: 700; color: #1e293b;">${arabicHeader}</div>
        <div style="margin-top: 3px; display: flex; align-items: center; gap: 4px;">
          <span class="badge badge-dark">Darajah 4 (Rabea)</span>
          <span class="badge badge-amber">Status: ${escapeHtml(data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah"))}</span>
          <span class="badge badge-emerald">Year: ${escapeHtml(data.currentYear || data.year || "1447 H")}</span>
        </div>
      </div>
    </div>

    <!-- Student Hero Strip -->
    <div style="display: flex; align-items: stretch; gap: 10px; padding: 7px 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 6px;">
      <div style="width: 25mm; height: 32mm; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; shrink-0; text-align: center;">
        ${
          data.studentPhotoUrl
            ? `<img src="${data.studentPhotoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="font-size: 8.5px; color: #94a3b8; font-weight: 600; padding: 4px;">PASSPORT<br>PHOTO<br>BOX</div>`
        }
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 14px; font-weight: 900; color: #020617; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.2;">
            ${escapeHtml(data.name)}
          </h3>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 3px; font-size: 9.5px;">
            <span class="badge badge-dark">ITS: ${escapeHtml(data.itsNo)}</span>
            <span class="badge badge-indigo">Class: Darajah 4 (Grade 4)</span>
            <span class="badge badge-emerald">Section: ${escapeHtml(data.section || "A")}</span>
            <span class="badge badge-amber">${escapeHtml(data.studentStatus || "Sanah (Regular)")}</span>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 9.5px;">
          <div>
            <span style="color: #64748b; font-size: 8.5px; display: block; text-transform: uppercase;">Father / Occupation</span>
            <strong style="color: #0f172a;">${escapeHtml(data.fatherName)}</strong>
            <span style="color: #475569; font-size: 9px; display: block;">${escapeHtml(data.fatherOccupation)}</span>
          </div>
          <div>
            <span style="color: #64748b; font-size: 8.5px; display: block; text-transform: uppercase;">Mother / Occupation</span>
            <strong style="color: #0f172a;">${escapeHtml(data.motherName)}</strong>
            <span style="color: #475569; font-size: 9px; display: block;">${escapeHtml(data.motherOccupation || "Homemaker")}</span>
          </div>
          <div>
            <span style="color: #64748b; font-size: 8.5px; display: block; text-transform: uppercase;">Current Residence</span>
            <strong style="color: #0f172a;">${escapeHtml(data.residentCity || data.jamaat || "—")}</strong>
            <span style="color: #475569; font-size: 9px; display: block;">Vatan: ${escapeHtml(data.watan || data.vatan || "—")}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Institutional Demographics Table -->
    <div class="table-box" style="margin-bottom: 6px;">
      <div style="background: #0f172a; color: #ffffff; padding: 3px 8px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #fde68a;">
          SECTION A: OFFICIAL VERIFIED STUDENT DEMOGRAPHICS &amp; ACADEMICS
        </span>
        <span style="font-size: 8.5px; color: #cbd5e1;">Darse Burhani Taherabad Registration Records</span>
      </div>

      <!-- Row 1 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Full Legal Name</span>
          <span class="table-val" style="text-transform: uppercase;">${escapeHtml(data.name)}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">ITS Number</span>
          <span class="table-val table-val-mono">${escapeHtml(data.itsNo)}</span>
        </div>
      </div>

      <!-- Row 2 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Standard / Grade</span>
          <span class="table-val">${escapeHtml(data.standard || "Darajah 4 (Rabea)")}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">Darajah Section</span>
          <span class="table-val">Section ${escapeHtml(data.section || "A")}</span>
        </div>
      </div>

      <!-- Row 3 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Hifz al-Quran Status</span>
          <span class="table-val">${escapeHtml(data.hifzYear ? `Hafiz al-Quran (${data.hifzYear})` : "Sanah (Under Hifz / Muraja'ah)")}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">Year of Admission</span>
          <span class="table-val">${escapeHtml(data.admissionYear || "1444 H")}</span>
        </div>
      </div>

      <!-- Row 4 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Student Status</span>
          <span class="table-val">${escapeHtml(data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah"))}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">Academic Year</span>
          <span class="table-val">${escapeHtml(data.currentYear || data.year || "1447 H")}</span>
        </div>
      </div>

      <!-- Row 5 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Date of Birth &amp; Age</span>
          <span class="table-val">${escapeHtml(data.dob || "—")} ${data.age ? `(${data.age} Yrs)` : ""}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">Nationality</span>
          <span class="table-val">${escapeHtml(data.nationality || "Indian")}</span>
        </div>
      </div>

      <!-- Row 6 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Mauze / Vatan</span>
          <span class="table-val">${escapeHtml(data.watan || data.vatan || "—")}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">Jamaat / Mauze</span>
          <span class="table-val">${escapeHtml(data.residentCity || data.jamaat || "—")}</span>
        </div>
      </div>

      <!-- Row 7 -->
      <div class="table-row-col2">
        <div class="table-cell-left">
          <span class="table-label">Mobile Number</span>
          <span class="table-val table-val-mono">${escapeHtml(data.mobileNumber || "—")}</span>
        </div>
        <div class="table-cell-right">
          <span class="table-label">Email Address</span>
          <span class="table-val table-val-mono" style="word-break: break-all; font-size: 9.5px;">${escapeHtml(data.email || "—")}</span>
        </div>
      </div>

      <!-- Row 8 (Address) -->
      <div class="table-row" style="grid-template-columns: 125px 1fr;">
        <span class="table-label">Residential Address</span>
        <span class="table-val">${escapeHtml(data.address || "—")}</span>
      </div>

      <!-- Row 9 (External Schooling) -->
      <div class="table-row" style="grid-template-columns: 125px 1fr; border-bottom: none;">
        <span class="table-label">External Schooling</span>
        <span class="table-val">${escapeHtml(data.externalSchooling || "Regular Darse Burhani")}</span>
      </div>
    </div>

    <!-- Student Quick Reflections Strip -->
    <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 6px; padding: 5px 8px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #fef3c7; padding-bottom: 2px; margin-bottom: 4px;">
        <span style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #78350f;">
          ★ Student Personal Reflections &amp; Core Interests
        </span>
        <span style="font-size: 8.5px; color: #92400e;">Darajah Rabea Yearly Review</span>
      </div>
      <div class="grid-3" style="font-size: 9.5px;">
        <div style="background: #ffffff; padding: 4px 6px; border-radius: 4px; border: 1px solid #fde68a;">
          <div style="font-weight: 800; color: #78350f; font-size: 9px; margin-bottom: 1px;">Things I am Really Good At:</div>
          <div style="color: #0f172a; font-weight: 600; padding-left: 4px; border-left: 2px solid #d97706;">
            ${escapeHtml(data.reallyGoodAt || (km.threeStrengths ? km.threeStrengths.join(", ") : "—"))}
          </div>
        </div>
        <div style="background: #ffffff; padding: 4px 6px; border-radius: 4px; border: 1px solid #c7d2fe;">
          <div style="font-weight: 800; color: #3730a3; font-size: 9px; margin-bottom: 1px;">What I Love to Study:</div>
          <div style="color: #0f172a; font-weight: 600; padding-left: 4px; border-left: 2px solid #4f46e5;">
            ${escapeHtml(data.loveToStudy || "—")}
          </div>
        </div>
        <div style="background: #ffffff; padding: 4px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">
          <div style="font-weight: 800; color: #065f46; font-size: 9px; margin-bottom: 1px;">What I Love Doing for Fun:</div>
          <div style="color: #0f172a; font-weight: 600; padding-left: 4px; border-left: 2px solid #059669;">
            ${escapeHtml(data.loveForFun || (km.threeThingsEnjoy ? km.threeThingsEnjoy.join(", ") : "—"))}
          </div>
        </div>
      </div>
    </div>

    <!-- Strengths, Enjoyed & Aspirations Row -->
    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 8px; background: #ffffff; margin-bottom: 6px;">
      <div class="grid-3" style="margin-bottom: 4px;">
        <!-- Strengths -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 5px; padding: 4px 6px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #dcfce7; padding-bottom: 2px; margin-bottom: 2px;">
            <strong style="font-size: 9px; color: #065f46; text-transform: uppercase;">3 Things I Am Good At</strong>
            <span style="font-size: 8px; color: #15803d; font-weight: 700;">Strengths</span>
          </div>
          <div style="font-size: 9px; color: #0f172a;">
            <div>1. <strong>${escapeHtml(km.threeStrengths?.[0] || strengths[0] || "Memory & Fast Recitation")}</strong></div>
            <div>2. <strong>${escapeHtml(km.threeStrengths?.[1] || strengths[1] || "Discipline & Time Management")}</strong></div>
            <div>3. <strong>${escapeHtml(km.threeStrengths?.[2] || strengths[2] || "Team Collaboration & Helping")}</strong></div>
          </div>
        </div>

        <!-- Enjoyed -->
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 5px; padding: 4px 6px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e0e7ff; padding-bottom: 2px; margin-bottom: 2px;">
            <strong style="font-size: 9px; color: #3730a3; text-transform: uppercase;">3 Things I Enjoyed Most</strong>
            <span style="font-size: 8px; color: #4338ca; font-weight: 700;">Engagement</span>
          </div>
          <div style="font-size: 9px; color: #0f172a;">
            <div>1. <strong>${escapeHtml(km.threeThingsEnjoy?.[0] || weaknesses[0] || "Tahfeez Classes & Muraja'ah")}</strong></div>
            <div>2. <strong>${escapeHtml(km.threeThingsEnjoy?.[1] || weaknesses[1] || "Lisan al-Dawat & Arabic Grammer")}</strong></div>
            <div>3. <strong>${escapeHtml(km.threeThingsEnjoy?.[2] || weaknesses[2] || "Physical Sports & Khidmat")}</strong></div>
          </div>
        </div>

        <!-- Aspirations -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 5px; padding: 4px 6px;">
          <div>
            <div style="font-weight: 900; font-size: 9px; color: #78350f; text-transform: uppercase; margin-bottom: 2px;">
              Aspirations &amp; Goals:
            </div>
            <div style="font-size: 8.5px; color: #0f172a; line-height: 1.25;">
              <div><strong>Hifz:</strong> ${escapeHtml(data.hifzYear ? `Completed (${data.hifzYear})` : "In Progress")}</div>
              <div><strong>Service:</strong> ${escapeHtml(km.khidmatMeaning ? km.khidmatMeaning.slice(0, 55) + "..." : "Dedication to Khidmat")}</div>
              <div><strong>Future:</strong> ${escapeHtml(km.rememberedFor ? km.rememberedFor.slice(0, 55) + "..." : "Excellence in Deeni & Dunyawi Fields")}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Obstacles strip -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 6px; display: flex; align-items: center; justify-content: space-between; font-size: 9px;">
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          <strong style="text-transform: uppercase; font-size: 8.5px; color: #0f172a;">Obstacles Identified:</strong>
          ${
            obstacles.length > 0
              ? obstacles.map((obs: string) => `<span class="badge badge-dark" style="font-size: 8.5px;">${escapeHtml(obs)}</span>`).join(" ")
              : `<span style="color: #94a3b8; font-style: italic;">None identified</span>`
          }
          ${km.otherObstacle ? `<span class="badge badge-amber" style="font-size: 8px;">Other: ${escapeHtml(km.otherObstacle)}</span>` : ""}
        </div>
        <span class="badge badge-emerald" style="font-size: 8px;">
          ${km.submittedAt ? "✓ Compulsory Assessment Verified" : "Institutional Record"}
        </span>
      </div>
    </div>
  </div>

  <!-- Signatures & Footer (Page 1) -->
  <div class="border-t-thick" style="padding-top: 6px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center; font-size: 10px; margin-bottom: 4px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 2px;">
        <strong style="display: block; color: #1e293b;">Student's Signature</strong>
        <span style="font-size: 8.5px; color: #64748b;">(Talib / Taliba)</span>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 2px;">
        <strong style="display: block; color: #1e293b;">Parent / Guardian Signature</strong>
        <span style="font-size: 8.5px; color: #64748b;">(Father / Mother)</span>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 2px;">
        <strong style="display: block; color: #1e293b;">Darajah Masul Signature &amp; Seal</strong>
        <span style="font-size: 8.5px; color: #64748b;">(Darse Burhani Administration)</span>
      </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 3px;">
      <span>Darse Burhani Official Institutional Record • Darajah Rabea (Grade 4) • 1447 H • Page 1 of 2</span>
      <span class="arabic-calligraphy" style="font-size: 10px; color: #1e293b;">${arabicHeader}</span>
    </div>
  </div>
</div>

<!-- ═════════════════════════════════════════════════════════════════
     A4 PAGE 2: KNOWING MYSELF — 14 COMPULSORY QUESTIONS
═════════════════════════════════════════════════════════════════ -->
<div class="page page-2">
  <div>
    <!-- Institutional Header -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        ${logoBase64 ? `<img src="${logoBase64}" style="width: 42px; height: 42px; object-fit: contain;">` : ""}
        <div>
          <h1 style="font-size: 17px; font-weight: 900; letter-spacing: 0.05em; color: #020617; font-family: Georgia, serif; text-transform: uppercase; line-height: 1.1;">DARSE BURHANI</h1>
          <h2 style="font-size: 10.5px; font-weight: 800; color: #78350f; margin-top: 1px;">DARAJEH RABEA (GRADE 4) • STUDENT SELF-REFLECTION</h2>
          <div style="font-size: 9px; font-weight: 500; color: #64748b;">Knowing Myself — My Identity and Aspirations (Page 2 of 2)</div>
        </div>
      </div>
      <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
        <div class="arabic-calligraphy" style="font-size: 12px; font-weight: 700; color: #1e293b;">${arabicHeader}</div>
        <div style="margin-top: 3px; display: flex; align-items: center; gap: 4px;">
          <span class="badge badge-dark">${escapeHtml(data.name)}</span>
          <span class="badge badge-amber">ITS: ${escapeHtml(data.itsNo)}</span>
          <span class="badge badge-emerald">1447 H</span>
        </div>
      </div>
    </div>

    <!-- Section Banner -->
    <div style="background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 6px; margin-bottom: 7px; display: flex; align-items: center; justify-content: space-between;">
      <span style="font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #fde68a;">
        ★ Self-Reflection Questionnaire (14 Compulsory Questions)
      </span>
      <span style="font-size: 8.5px; color: #cbd5e1;">Standard Darse Burhani Taherabad Darajah Rabea Evaluation</span>
    </div>

    <!-- 14 Compulsory Questions (2 Columns x 7 Rows) -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 9.5px;">
      <!-- Q1 -->
      <div class="q-card">
        <div class="q-title">1. One thing you are proud of accomplishing:</div>
        <div class="q-ans">${escapeHtml(km.proudAccomplishment)}</div>
      </div>

      <!-- Q2 -->
      <div class="q-card">
        <div class="q-title">2. A person you deeply admire and why:</div>
        <div class="q-ans">${escapeHtml(km.admirePersonWhy)}</div>
      </div>

      <!-- Q3 -->
      <div class="q-card">
        <div class="q-title">3. When something is difficult, you usually:</div>
        <div class="q-ans">${escapeHtml(km.difficultResponse)}</div>
      </div>

      <!-- Q4 -->
      <div class="q-card">
        <div class="q-title">4. Who you approach first when you need support:</div>
        <div class="q-ans">${escapeHtml(km.approachForSupport)}</div>
      </div>

      <!-- Q5 -->
      <div class="q-card">
        <div class="q-title">5. What kind of behavior hurts you the most:</div>
        <div class="q-ans">${escapeHtml(km.behaviorHurtsMost)}</div>
      </div>

      <!-- Q6 -->
      <div class="q-card">
        <div class="q-title">6. What you wish people understood better about you:</div>
        <div class="q-ans">${escapeHtml(km.wishOthersUnderstood)}</div>
      </div>

      <!-- Q7 -->
      <div class="q-card">
        <div class="q-title">7. One thing you want to improve or be better at:</div>
        <div class="q-ans">${escapeHtml(km.improveBetterAt)}</div>
      </div>

      <!-- Q8 -->
      <div class="q-card">
        <div class="q-title">8. What makes you want to give up:</div>
        <div class="q-ans">${escapeHtml(km.wantToGiveUp)}</div>
      </div>

      <!-- Q9 -->
      <div class="q-card">
        <div class="q-title">9. How do you recover after a disappointment:</div>
        <div class="q-ans">${escapeHtml(km.recoverAfterDisappointment)}</div>
      </div>

      <!-- Q10 -->
      <div class="q-card">
        <div class="q-title">10. Why should you continue learning and gaining knowledge:</div>
        <div class="q-ans">${escapeHtml(km.continueLearningReason)}</div>
      </div>

      <!-- Q11 -->
      <div class="q-card">
        <div class="q-title">11. What qualities make someone worthy of respect:</div>
        <div class="q-ans">${escapeHtml(km.qualitiesWorthyOfRespect)}</div>
      </div>

      <!-- Q12 -->
      <div class="q-card">
        <div class="q-title">12. What does it mean to be a successful person:</div>
        <div class="q-ans">${escapeHtml(km.successfulPersonMeaning)}</div>
      </div>

      <!-- Q13 -->
      <div class="q-card">
        <div class="q-title">13. How can you use your unique skills to benefit others:</div>
        <div class="q-ans">${escapeHtml(km.useSkillsToBenefitOthers)}</div>
      </div>

      <!-- Q14 -->
      <div class="q-card">
        <div class="q-title">14. What kind of person do you want to be remembered as:</div>
        <div class="q-ans">${escapeHtml(km.rememberedFor)}</div>
      </div>
    </div>
  </div>

  <!-- Signatures & Footer (Page 2) -->
  <div class="border-t-thick" style="padding-top: 6px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center; font-size: 10px; margin-bottom: 4px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 2px;">
        <strong style="display: block; color: #1e293b;">Student's Affirmation</strong>
        <span style="font-size: 8.5px; color: #64748b;">(Talib / Taliba Signature)</span>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 2px;">
        <strong style="display: block; color: #1e293b;">Darajah Counsellor / Masool</strong>
        <span style="font-size: 8.5px; color: #64748b;">(Review &amp; Mentorship)</span>
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 2px;">
        <strong style="display: block; color: #1e293b;">Administration Seal</strong>
        <span style="font-size: 8.5px; color: #64748b;">(Darse Burhani Official)</span>
      </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 3px;">
      <span>Knowing Myself Assessment • Darse Burhani Official Dossier • Darajah Rabea (Grade 4) • Page 2 of 2</span>
      <span class="arabic-calligraphy" style="font-size: 10px; color: #1e293b;">${arabicHeader}</span>
    </div>
  </div>
</div>

</body>
</html>`;
}

async function main() {
  const alaqmar = await prisma.studentProfile.findFirst({
    where: { user: { firstName: { contains: "Alaqmar" } } },
    include: { user: true, talabatProfile1447: true },
  });

  if (!alaqmar) {
    console.error("Alaqmar not found");
    return;
  }

  const km = await prisma.systemSetting.findUnique({
    where: { key: `knowing_myself_${alaqmar.id}` },
  });

  const pData = {
    name: `${alaqmar.user.firstName} ${alaqmar.user.lastName}`,
    itsNo: alaqmar.its,
    idNo: alaqmar.studentId,
    studentPhotoUrl: alaqmar.talabatProfile1447?.studentPhotoUrl || alaqmar.user.avatarUrl,
    motherName: alaqmar.talabatProfile1447?.motherName || alaqmar.motherName,
    fatherName: alaqmar.talabatProfile1447?.fatherName || alaqmar.fatherName,
    fatherOccupation: alaqmar.talabatProfile1447?.fatherOccupation || alaqmar.fatherOccupation,
    standard: alaqmar.grade || "Darajah 4 (Rabea)",
    grade: alaqmar.grade || "4",
    section: alaqmar.section || "A",
    studentStatus: alaqmar.status ? String(alaqmar.status) : "Sanah",
    admissionYear: alaqmar.admissionYear || "1444 H",
    currentYear: alaqmar.currentYear || "1447 H",
    age: alaqmar.age || 20,
    watan: alaqmar.watan,
    residentCity: alaqmar.residentCity || alaqmar.jamaat,
    address: alaqmar.address,
    mobileNumber: alaqmar.mobileNumber,
    email: alaqmar.user.email,
    externalSchooling: alaqmar.externalSchooling,
    reallyGoodAt: alaqmar.reallyGoodAt,
    loveToStudy: alaqmar.loveToStudy,
    loveForFun: alaqmar.loveForFun,
    knowingMyself: km?.value || null,
  };

  const html = generateTalabatHtml(pData);
  const tmpHtml = path.resolve("d:/Darse-Burhani/temp_test.html");
  const outPdf = path.resolve("d:/Darse-Burhani/alaqmar_test_profile.pdf");

  fs.writeFileSync(tmpHtml, html, "utf-8");

  const edgeExe = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  execFileSync(edgeExe, [
    "--headless=new",
    "--no-pdf-header-footer",
    `--print-to-pdf=${outPdf}`,
    `file:///${tmpHtml.replace(/\\/g, "/")}`,
  ]);

  console.log(`Generated test PDF at: ${outPdf}`);
  console.log(`PDF size: ${fs.statSync(outPdf).size} bytes`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

