import React, { useState, useRef } from "react";
import { FileCheck2, Printer, GraduationCap, Sparkles, User, Award, CheckCircle2 } from "lucide-react";
import { Twemoji } from "react-twemoji"
import classNames from "classnames"
// html2canvas and jsPDF are large. They are imported lazily inside the
// download handler so opening the document stays fast.

export interface TalabatProfileData {
  id?: string;
  year?: string;
  status?: string;
  studentPhotoUrl?: string | null;
  name?: string | null;
  itsNo?: string | null;
  idNo?: string | null;
  jamaat?: string | null;
  vatan?: string | null;
  nationality?: string | null;
  dob?: string | null;
  age?: number | string | null;

  fatherPhotoUrl?: string | null;
  fatherName?: string | null;
  fatherOccupation?: string | null;
  motherPhotoUrl?: string | null;
  motherName?: string | null;
  motherOccupation?: string | null;

  result1444?: string | null;
  result1445?: string | null;
  result1446?: string | null;
  result1447?: string | null;

  hifzYear?: string | null;
  hifzTabaqa?: string | null;

  course1?: string | null;
  course2?: string | null;
  course3?: string | null;
  course4?: string | null;

  activities?: string | null;
  otherExams?: string | null;

  strengths?: string[];
  weaknesses?: string[];

  aboutMyself?: string | null;

  // Rabea Special Passion & Reflection Prompts
  reallyGoodAt?: string | null;
  loveToStudy?: string | null;
  loveForFun?: string | null;

  // Student Profile Demographics for Single-Page A4 Sheet
  standard?: string | null;
  grade?: string | null;
  section?: string | null;
  studentStatus?: string | null;
  admissionYear?: string | null;
  currentYear?: string | null;
  watan?: string | null;
  residentCity?: string | null;
  address?: string | null;
  mobileNumber?: string | null;
  email?: string | null;
  externalSchooling?: string | null;

  behaviourRating?: number | null;
  communicationRating?: number | null;
  dedicationRating?: number | null;
  disciplineRating?: number | null;

  // 10 Granular Remarks Categories
  masoolRemarks?: string | null;
  remarksMasool?: string | null;      // المسؤول عن الدرجة
  remarksTahfeez?: string | null;     // عن التحفيظ
  remarksTaleem?: string | null;      // عن التعليم
  remarksTadeeb?: string | null;      // عن التأديب والرياضة والمنازل البرهانية
  remarksTanzeem?: string | null;     // عن التنظيم
  remarksSports?: string | null;      // عن خيمة الرياضة
  remarksMaktabat?: string | null;    // المكتبة
  remarksSkills?: string | null;      // عن الفن والمهارة
  remarksOtherExams?: string | null;  // عن الامتحانات الأخرى
  remarksCounselling?: string | null; // Recommended Further Studies (Counselling)
  counsellingNotes?: string | null;   // Sibling / Career notes
  knowingMyself?: any;                // Knowing Myself Assessment (Page 2)
}

interface Props {
  data: TalabatProfileData;
  showPrintButton?: boolean;
  initialLayout?: "a4-single" | "dossier";
}

export function TalabatProfileDocument({
  data,
  showPrintButton = true,
  initialLayout = "a4-single",
}: Props) {
  const [layoutMode, setLayoutMode] = useState<"a4-single" | "dossier">(initialLayout);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const container = document.querySelector<HTMLElement>(".printable-document");
    if (!container) return;
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      // Loaded on demand so the page itself never waits on them
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Capture each page separately so multi-page documents keep all content
      const pageEls = Array.from(container.querySelectorAll<HTMLElement>(".doc-page"));
      const targets = pageEls.length > 0 ? pageEls : [container];

      // Make sure every photo is decoded before capture, otherwise photos can
      // land blank in the PDF.
      await Promise.all([
        document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve(),
        ...targets.flatMap((el) =>
          Array.from(el.querySelectorAll("img")).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener("load", () => resolve(), { once: true });
                  img.addEventListener("error", () => resolve(), { once: true });
                  setTimeout(resolve, 4000);
                }),
          ),
        ),
      ]);

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageW = 210;
      const pageH = 297;
      const marginMm = 4;
      const printableW = pageW - marginMm * 2; // 202 mm
      const printableH = pageH - marginMm * 2; // 289 mm

      for (let i = 0; i < targets.length; i++) {
        const targetEl = targets[i];
        const canvas = await html2canvas(targetEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 8000,
          onclone: (clonedDoc) => {
            clonedDoc.documentElement.classList.remove("dark");
            clonedDoc.documentElement.setAttribute("data-theme", "light");
            clonedDoc.body.classList.remove("dark");
            clonedDoc.body.style.background = "#ffffff";
            const arabicEls = clonedDoc.querySelectorAll(".arabic-calligraphy, [dir='rtl']");
            arabicEls.forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.letterSpacing = "0px";
              htmlEl.style.wordSpacing = "normal";
              htmlEl.style.direction = "rtl";
              htmlEl.style.fontFamily = "'Al-Kanz', 'AL-KANZ', 'Al Kanz', 'alkanz', 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif";
            });
          },
        });

        // Fit proportionally inside A4 printable boundaries with zero cutting
        const imgRatio = canvas.width / canvas.height;
        const pageRatio = printableW / printableH;

        let imgW: number;
        let imgH: number;

        if (imgRatio > pageRatio) {
          imgW = printableW;
          imgH = printableW / imgRatio;
        } else {
          imgH = printableH;
          imgW = printableH * imgRatio;
        }

        const posX = marginMm + (printableW - imgW) / 2;
        const posY = marginMm + (printableH - imgH) / 2;

        if (i > 0) pdf.addPage("a4", "p");
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.96),
          "JPEG",
          posX,
          posY,
          imgW,
          imgH,
          undefined,
          "FAST"
        );
      }

      const safeName = (data.name || "talabat-profile")
        .toString()
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      pdf.save(`${safeName || "talabat-profile"}-profile.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try printing instead.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Helper to detect if a value is non-empty
  const isFilled = (val?: string | number | null): boolean => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    return str.length > 0 && str !== "—" && str !== "-" && str !== "null" && str !== "undefined";
  };

  const normalizeImgSrc = (url?: string | null): string => {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
      return trimmed;
    }
    return "/" + trimmed;
  };

// Helper to get profile image with proper fallback
const getProfileImgSrc = (url?: string | null): string => {
    const src = normalizeImgSrc(url);
    // If it's a relative path, prepend the base URL
    if (src && !src.startsWith("http") && !src.startsWith("data:")) {
      return "/uploads" + src;
    }
    return src;
  };

  // Helper to detect if text is predominantly Arabic/Lisan al-Dawat
  const isArabicText = (text?: string | null) => {
    if (!text) return false;
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    return arabicRegex.test(text);
  };

  // Filter actual strengths & weaknesses
  const editedStrengths = (data.strengths || []).map((s) => String(s || "").trim()).filter((s) => isFilled(s));
  const editedWeaknesses = (data.weaknesses || []).map((w) => String(w || "").trim()).filter((w) => isFilled(w));

  // Academic Results filtering
  const editedResults = [
    { year: "1444 H", val: data.result1444 },
    { year: "1445 H", val: data.result1445 },
    { year: "1446 H", val: data.result1446 },
    { year: "1447 H", val: data.result1447 },
  ].filter((r) => isFilled(r.val));

  // Courses filtering
  const editedCourses = [data.course1, data.course2, data.course3, data.course4]
    .map((c) => String(c || "").trim())
    .filter((c) => isFilled(c));

  // Category remarks list
  const remarkCategories = [
    {
      key: "remarksMasool",
      labelEn: "Class Masul Remarks",
      labelAr: "المسؤول عن الفصل",
      value: data.remarksMasool || data.masoolRemarks,
    },
    {
      key: "remarksTahfeez",
      labelEn: "Tahfeez-ul-Qur'an",
      labelAr: "عن التحفيظ",
      value: data.remarksTahfeez,
    },
    {
      key: "remarksTaleem",
      labelEn: "Academic Progress & Ta'leem",
      labelAr: "عن التعليم",
      value: data.remarksTaleem,
    },
    {
      key: "remarksTadeeb",
      labelEn: "Ta'deeb & Manazil al-Burhaniyah",
      labelAr: "عن التأديب والرياضة والمنازل البرهانية",
      value: data.remarksTadeeb,
    },
    {
      key: "remarksTanzeem",
      labelEn: "Tanzeem & Punctuality",
      labelAr: "عن التنظيم",
      value: data.remarksTanzeem,
    },
    {
      key: "remarksSports",
      labelEn: "Sports & Athletics",
      labelAr: "عن خيمة الرياضة",
      value: data.remarksSports,
    },
    {
      key: "remarksMaktabat",
      labelEn: "Maktabat & Library Utilization",
      labelAr: "المكتبة",
      value: data.remarksMaktabat,
    },
    {
      key: "remarksSkills",
      labelEn: "Art, IT & Special Skills",
      labelAr: "عن الفن والمهارة",
      value: data.remarksSkills,
    },
    {
      key: "remarksOtherExams",
      labelEn: "External Board Exams",
      labelAr: "عن الامتحانات الأخرى",
      value: data.remarksOtherExams,
    },
    {
      key: "remarksCounselling",
      labelEn: "Recommended Further Studies",
      labelAr: "توجيه الطالب (Counselling)",
      value: data.remarksCounselling,
    },
  ];

  const editedRemarks = remarkCategories.filter((cat) => isFilled(cat.value));

  // Determine section presence in "edited" mode
  const hasPersonalDetails =
    isFilled(data.name) ||
    isFilled(data.itsNo) ||
    isFilled(data.idNo) ||
    isFilled(data.jamaat) ||
    isFilled(data.vatan) ||
    isFilled(data.nationality) ||
    isFilled(data.dob) ||
    isFilled(data.age) ||
    isFilled(data.studentPhotoUrl);

  const hasFatherDetails = isFilled(data.fatherName) || isFilled(data.fatherOccupation) || isFilled(data.fatherPhotoUrl);
  const hasMotherDetails = isFilled(data.motherName) || isFilled(data.motherOccupation) || isFilled(data.motherPhotoUrl);
  const hasFamilyDetails = hasFatherDetails || hasMotherDetails;

  const hasHifz = isFilled(data.hifzYear) || isFilled(data.hifzTabaqa);
  const hasActivities = isFilled(data.activities);
  const hasOtherExams = isFilled(data.otherExams);
  const hasAcademicsDetails = editedResults.length > 0 || hasHifz || editedCourses.length > 0 || hasActivities || hasOtherExams;

  const hasSelfAssessment = editedStrengths.length > 0 || editedWeaknesses.length > 0;
  const hasAboutMyself = isFilled(data.aboutMyself);

  const hasRatings =
    data.behaviourRating != null ||
    data.communicationRating != null ||
    data.dedicationRating != null ||
    data.disciplineRating != null;

  const hasCounsellingNotes = isFilled(data.counsellingNotes);
  const hasFacultyEvaluation = hasRatings || editedRemarks.length > 0 || hasCounsellingNotes;

  const hasAnyEditedData =
    hasPersonalDetails ||
    hasFamilyDetails ||
    hasAcademicsDetails ||
    hasSelfAssessment ||
    hasAboutMyself ||
    hasFacultyEvaluation;

  return (
    <div className="talabat-profile-root w-full flex flex-col items-center bg-[var(--bg-canvas)]">
      {/* ── Top Bar (Print Controls - Hidden on Print) ── */}
      <div className="no-print mb-6 flex flex-col sm:flex-row items-center justify-between w-full max-w-[210mm] gap-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-lg">
        {/* Status Indicator & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--gold-lighter)] p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setLayoutMode("a4-single")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "a4-single"
                  ? "text-[var(--text-inverted)] text-[var(--gold-400)] shadow-xs"
                  : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] font-medium"
              }`}
            >
              <span>📄</span>
              <span>A4 Profile &amp; Assessment (2 Pages)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("dossier")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "dossier"
                  ? "text-[var(--text-inverted)] text-[var(--gold-400)] shadow-xs"
                  : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] font-medium"
              }`}
            >
              <span>📑</span>
              <span>Full Dossier</span>
            </button>
          </div>

          <span className="hidden lg:inline-flex text-[11px] text-[var(--text-muted)] font-medium">
            {layoutMode === "a4-single"
              ? "• Page 1: Profile & Demographics | Page 2: Knowing Myself Assessment (A4 PDF)"
              : "• Complete Academic & Faculty Evaluation"}
          </span>
        </div>

        {/* Print & Download Buttons */}
        <div className="flex items-center gap-3">
          {showPrintButton && (
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm font-semibold text-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Export PDF
            </button>
          )}
          {(
            <button
              onClick={handleDownloadPDF}
              type="button"
              disabled={generatingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-70 disabled:cursor-wait text-white rounded-lg shadow-sm font-semibold text-xs transition-all cursor-pointer"
            >
              {generatingPdf ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Generating PDF…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h6a3 3 0 003-3v-1M14 5l7-7a3 3 0 00-5.972-5.972L18 10M18 10l1.046 5.953A2.998 2.998 0 0115.933 18h-5.933a2.998 2.998 0 01-2.825-2.137L2 21" /></svg>
                  Download PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Document Container ── */}
      <div className="printable-document flex flex-col gap-8 w-full max-w-[210mm]">
        {layoutMode === "a4-single" ? (
          <>
            {/* ════════════════════════════════════════════════════════════
               A4 PAGE 1: STUDENT TALABAT PROFILE (DARAJEH RABEA)
               Demographics, Family, Contact, Academics & 3 Quick Prompts
            ════════════════════════════════════════════════════════════ */}
            <div className="doc-page doc-page-single bg-white text-slate-900 font-sans border-2 border-slate-900 shadow-xl rounded-none p-4 sm:p-5 h-[282mm] max-h-[282mm] flex flex-col justify-between box-border overflow-hidden">
              <div>
                {/* Institutional Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2 relative">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/logo.png"
                      alt="Darse Burhani Logo"
                      className="w-11 h-11 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div>
                      <h1 className="text-lg font-black tracking-wider text-slate-950 font-serif uppercase leading-tight">
                        DARSE BURHANI
                      </h1>
                      <h2 className="text-[11px] font-extrabold text-amber-900 tracking-wide mt-0.5">
                        DARAJEH RABEA (GRADE 4) • STUDENT TALABAT PROFILE
                      </h2>
                      <div className="text-[9.5px] font-medium text-slate-500">
                        Academic Year 1447 H • Official Individual Record Sheet (Page 1 of 2)
                      </div>
                    </div>
                  </div>

                <div className="text-right flex flex-col items-end">
                  <div
                    dir="rtl"
                    className="arabic-calligraphy text-xs font-bold text-slate-800 leading-snug"
                  >
                    الحمد لله على ما أنعم والشكر له على ما ألهم
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap justify-end">
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-2xs">
                      Darajah 4 (Rabea)
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                      Status: {data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                      Year: {data.currentYear || data.year || "1447 H"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Student Identity & Passport Photo Hero Row */}
              <div className="flex items-stretch gap-3 p-2 bg-slate-50/80 border border-slate-300 rounded-lg mb-2 shadow-2xs">
                {/* Photo */}
                <div className="w-[26mm] h-[34mm] bg-white border-2 border-slate-300 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                  {isFilled(data.studentPhotoUrl) ? (
                    <img
                      src={normalizeImgSrc(data.studentPhotoUrl)}
                      alt={data.name || "Student"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <GraduationCap className="w-6 h-6 mx-auto mb-0.5 text-slate-400" />
                      <span className="text-[8px] font-bold uppercase block">Photo</span>
                    </div>
                  )}
                </div>

                {/* Main Name & Key Identifiers */}
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-lg font-black text-slate-950 font-serif leading-tight">
                      {data.name || "Student Full Name"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px]">
                      <span className="inline-flex items-center gap-1 font-bold bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300 text-[10.5px]">
                        ITS: {data.itsNo || "—"}
                      </span>
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-[10.5px] text-slate-800">
                        Standard: {data.standard || data.grade || "Darajah 4 (Rabea)"}
                      </span>
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-[10.5px] text-slate-800">
                        Section: {data.section || "A"}
                      </span>
                      <span className="font-semibold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 text-[10.5px]">
                        Status: {data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-1 pt-1 border-t border-slate-200 text-[10.5px] text-slate-700 font-medium">
                    <div><span className="font-bold text-slate-900">Admission Year:</span> {data.admissionYear || "1444 H"}</div>
                    <div><span className="font-bold text-slate-900">Current Year:</span> {data.currentYear || data.year || "1447 H"}</div>
                    <div><span className="font-bold text-slate-900">Student Age:</span> {data.age ? `${data.age} Years` : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Section: Complete Demographic & Institutional Profile */}
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white mb-2 shadow-2xs">
                <div className="bg-slate-900 text-white px-3 py-1 flex items-center justify-between">
                  <span className="font-bold text-[10px] uppercase tracking-wider">
                    Student Demographic &amp; Institutional Profile
                  </span>
                  <span className="text-[9px] text-amber-300 font-mono">official student dossier</span>
                </div>
                <div className="grid grid-cols-2 text-[10px] divide-y divide-x divide-slate-200">
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Student Name:</span>
                    <span className="font-bold text-slate-950 truncate text-right">{data.name || "—"}</span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Student ITS:</span>
                    <span className="font-mono font-bold text-slate-950 text-right">{data.itsNo || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Father Name:</span>
                    <span className="font-bold text-slate-950 flex items-center justify-end gap-1.5 truncate">
                      {isFilled(data.fatherPhotoUrl) && (
                        <img
                          src={getProfileImgSrc(data.fatherPhotoUrl)}
                          alt="Father"
                          className="w-4 h-4 rounded-full object-cover border border-slate-400 shrink-0"
                          onError={(e: any) => { e.target.style.display = "none"; }}
                        />
                      )}
                      <span className="truncate">{data.fatherName || "—"}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Father's Occupation:</span>
                    <span className="font-medium text-slate-900 truncate text-right">{data.fatherOccupation || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Mother Name:</span>
                    <span className="font-bold text-slate-950 flex items-center justify-end gap-1.5 truncate">
                      {isFilled(data.motherPhotoUrl) && (
                        <img
                          src={getProfileImgSrc(data.motherPhotoUrl)}
                          alt="Mother"
                          className="w-4 h-4 rounded-full object-cover border border-slate-400 shrink-0"
                          onError={(e: any) => { e.target.style.display = "none"; }}
                        />
                      )}
                      <span className="truncate">{data.motherName || "—"}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Mother's Occupation:</span>
                    <span className="font-medium text-slate-900 truncate text-right">{data.motherOccupation || "Homemaker"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Student's Standard:</span>
                    <span className="font-bold text-slate-950 text-right">{data.standard || data.grade || "Darajah 4 (Rabea)"}</span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Class Section:</span>
                    <span className="font-bold text-slate-950 text-right">{data.section || "A"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Student Status:</span>
                    <span className="font-bold text-slate-950 text-right">{data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}</span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Admission Year:</span>
                    <span className="font-medium text-slate-900 text-right">{data.admissionYear || "1444 H"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Current Year:</span>
                    <span className="font-medium text-slate-900 text-right">{data.currentYear || data.year || "1447 H"}</span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Student Age:</span>
                    <span className="font-medium text-slate-900 text-right">{data.age ? `${data.age} Years` : "—"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Watan:</span>
                    <span className="font-medium text-slate-900 text-right">{data.vatan || data.watan || "—"}</span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Resident City:</span>
                    <span className="font-medium text-slate-900 text-right">{data.jamaat || data.residentCity || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1">
                    <span className="font-bold text-slate-600">Mobile Number:</span>
                    <span className="font-medium text-slate-900 text-right">{data.mobileNumber || "—"}</span>
                  </div>
                  <div className="grid grid-cols-[125px_1fr] items-center px-2.5 py-1 bg-slate-50/70">
                    <span className="font-bold text-slate-600">Email ID:</span>
                    <span className="font-medium text-slate-900 text-right break-all text-[9.5px] leading-tight">{data.email || "—"}</span>
                  </div>

                  <div className="col-span-2 grid grid-cols-[160px_1fr] items-center px-2.5 py-1 bg-amber-50/40">
                    <span className="font-bold text-amber-950">External Schooling Status:</span>
                    <span className="font-bold text-slate-900 text-right">{data.externalSchooling || "Regular Darse Burhani"}</span>
                  </div>

                  <div className="col-span-2 grid grid-cols-[125px_1fr] items-start px-2.5 py-1">
                    <span className="font-bold text-slate-600 shrink-0">Address:</span>
                    <span className="font-medium text-slate-800 text-right leading-tight">{data.address || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Special Prompts: Rabea Talabat Reflections & Passions */}
              <div className="border border-amber-300 bg-amber-50/40 rounded-lg p-2 mb-2 shadow-2xs">
                <div className="flex items-center justify-between border-b border-amber-300/70 pb-0.5 mb-1.5">
                  <span className="font-black text-[10.5px] text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    ★ Talabat Personal Reflections &amp; Passions (Darajah Rabea)
                  </span>
                  <span className="text-[8.5px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                    Student Reflection Prompts
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white p-1.5 px-2 rounded border border-amber-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="font-bold text-amber-950 text-[9.5px] mb-0.5">
                      1. I am really Good at ...
                    </div>
                    <div className="text-slate-900 font-medium pl-1.5 border-l-2 border-amber-500 leading-snug py-0.5">
                      {isFilled(data.reallyGoodAt) ? data.reallyGoodAt : "—"}
                    </div>
                  </div>

                  <div className="bg-white p-1.5 px-2 rounded border border-indigo-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="font-bold text-indigo-950 text-[9.5px] mb-0.5">
                      2. I love to study about ...
                    </div>
                    <div className="text-slate-900 font-medium pl-1.5 border-l-2 border-indigo-500 leading-snug py-0.5">
                      {isFilled(data.loveToStudy) ? data.loveToStudy : "—"}
                    </div>
                  </div>

                  <div className="bg-white p-1.5 px-2 rounded border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="font-bold text-emerald-950 text-[9.5px] mb-0.5">
                      3. I really love to ..... For Fun
                    </div>
                    <div className="text-slate-900 font-medium pl-1.5 border-l-2 border-emerald-500 leading-snug py-0.5">
                      {isFilled(data.loveForFun) ? data.loveForFun : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Strengths, Aspirations & Obstacles Summary */}
              <div className="border border-slate-300 rounded-lg p-2 bg-white mb-2 shadow-2xs">
                <div className="grid grid-cols-12 gap-2 mb-1.5">
                  {/* Greatest Strengths */}
                  <div className="col-span-4 bg-emerald-50/50 border border-emerald-200 rounded-md p-1.5">
                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-0.5 mb-1">
                      <span className="font-black text-[9.5px] text-emerald-950 uppercase tracking-wide">
                        ★ 3 Greatest Strengths
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[9.5px] text-slate-800">
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-emerald-700">1.</span>
                        <span className="font-medium text-slate-900 leading-tight">
                          {data.knowingMyself?.threeStrengths?.[0] || data.reallyGoodAt || "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-emerald-700">2.</span>
                        <span className="font-medium text-slate-900 leading-tight">
                          {data.knowingMyself?.threeStrengths?.[1] || "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-emerald-700">3.</span>
                        <span className="font-medium text-slate-900 leading-tight">
                          {data.knowingMyself?.threeStrengths?.[2] || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Things Enjoyed */}
                  <div className="col-span-4 bg-indigo-50/50 border border-indigo-200 rounded-md p-1.5">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 pb-0.5 mb-1">
                      <span className="font-black text-[9.5px] text-indigo-950 uppercase tracking-wide">
                        ★ 3 Things I Enjoy Most
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[9.5px] text-slate-800">
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-indigo-700">1.</span>
                        <span className="font-medium text-slate-900 leading-tight">
                          {data.knowingMyself?.threeThingsEnjoy?.[0] || data.loveForFun || "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-indigo-700">2.</span>
                        <span className="font-medium text-slate-900 leading-tight">
                          {data.knowingMyself?.threeThingsEnjoy?.[1] || "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-indigo-700">3.</span>
                        <span className="font-medium text-slate-900 leading-tight">
                          {data.knowingMyself?.threeThingsEnjoy?.[2] || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Core Accomplishment & Role Model */}
                  <div className="col-span-4 bg-amber-50/50 border border-amber-200 rounded-md p-1.5 flex flex-col justify-between">
                    <div>
                      <div className="font-black text-[9.5px] text-amber-950 uppercase tracking-wide border-b border-amber-200/80 pb-0.5 mb-1">
                        ★ Aspirations &amp; Mentorship
                      </div>
                      <div className="space-y-0.5 text-[9px]">
                        <div>
                          <span className="font-bold text-slate-700">Accomplishment: </span>
                          <span className="font-medium text-slate-900 leading-tight">
                            {data.knowingMyself?.proudAccomplishment || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-700">To Improve: </span>
                          <span className="font-medium text-slate-900 leading-tight">
                            {data.knowingMyself?.improveBetterAt || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-700">Role Model: </span>
                          <span className="font-medium text-slate-900 leading-tight">
                            {data.knowingMyself?.admirePersonWhy || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Obstacles Identified Strip */}
                <div className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[9.5px] text-slate-900 uppercase tracking-wider shrink-0">
                      Obstacles Identified:
                    </span>
                    {Array.isArray(data.knowingMyself?.selectedObstacles) && data.knowingMyself.selectedObstacles.length > 0 ? (
                      data.knowingMyself.selectedObstacles.map((obs: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white shadow-2xs"
                        >
                          {obs}
                        </span>
                      ))
                    ) : (
                      <span className="text-[9px] italic text-slate-400">None selected</span>
                    )}
                    {data.knowingMyself?.otherObstacle && (
                      <span className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Other: {data.knowingMyself.otherObstacle}
                      </span>
                    )}
                  </div>

                  <span className="text-[8.5px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">
                    {data.knowingMyself?.submittedAt ? "✓ Compulsory Assessment Verified" : "Institutional Record"}
                  </span>
                </div>
              </div>

              {/* Footer & Official Signatures (Page 1) */}
              <div className="pt-2 border-t-2 border-slate-900">
                <div className="grid grid-cols-3 gap-6 pt-2 pb-1 text-center text-[10.5px]">
                  <div className="border-t border-slate-400 pt-1">
                    <span className="font-bold text-slate-800 block text-[10.5px]">Student's Signature</span>
                    <span className="text-[9px] text-slate-500">(Talib / Taliba)</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="font-bold text-slate-800 block text-[10.5px]">Parent / Guardian Signature</span>
                    <span className="text-[9px] text-slate-500">(Father / Mother)</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="font-bold text-slate-800 block text-[10.5px]">Darajah Masul Signature &amp; Seal</span>
                    <span className="text-[9px] text-slate-500">(Darse Burhani Administration)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200 mt-1">
                  <span>Darse Burhani Official Institutional Record • Darajah Rabea (Grade 4) • 1447 H • Page 1 of 2</span>
                  <span
                    dir="rtl"
                    className="arabic-calligraphy text-[10.5px] text-slate-800"
                  >
                    الحمد لله على ما أنعم والشكر له على ما ألهم
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
             A4 PAGE 2: KNOWING MYSELF — MY IDENTITY AND ASPIRATIONS
             The 14 Compulsory Self-Reflection Questions
          ════════════════════════════════════════════════════════════ */}
          <div className="doc-page doc-page-page2 bg-white text-slate-900 font-sans border-2 border-slate-900 shadow-xl rounded-none p-4 sm:p-5 h-[282mm] max-h-[282mm] flex flex-col justify-between box-border overflow-hidden print:mt-0 mt-8">
            <div>
              {/* Institutional Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2 relative">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/logo.png"
                    alt="Darse Burhani Logo"
                    className="w-11 h-11 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div>
                    <h1 className="text-lg font-black tracking-wider text-slate-950 font-serif uppercase leading-tight">
                      DARSE BURHANI
                    </h1>
                    <h2 className="text-[11px] font-extrabold text-amber-900 tracking-wide mt-0.5">
                      KNOWING MYSELF: MY IDENTITY AND ASPIRATIONS
                    </h2>
                    <div className="text-[9.5px] font-medium text-slate-500">
                      Darajeh Rabea (Grade 4) • Student Self-Reflection Questionnaire (Page 2 of 2)
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div
                    dir="rtl"
                    className="arabic-calligraphy text-xs font-bold text-slate-800 leading-snug"
                  >
                    الحمد لله على ما أنعم والشكر له على ما ألهم
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap justify-end">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-white shadow-2xs">
                      Talib: {data.name || "Student"}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                      ITS: {data.itsNo || "—"}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                      1447 H
                    </span>
                  </div>
                </div>
              </div>

              {/* Section Header Banner */}
              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg mb-2 flex items-center justify-between">
                <span className="font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-amber-300">
                  ★ Self-Reflection Questionnaire (14 Compulsory Questions)
                </span>
                <span className="text-[9px] font-semibold text-slate-300">
                  Standard Darse Burhani Taherabad Darajah Rabea Evaluation
                </span>
              </div>

              {/* In-Depth Self-Reflections — All 14 Compulsory Questions Grid (Zero line-clamp) */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {/* Q1 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-emerald-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    1. How do you respond when things get difficult?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-emerald-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.difficultResponse || "—"}
                  </div>
                </div>

                {/* Q2 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-emerald-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    2. What makes you want to give up?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-emerald-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.wantToGiveUp || "—"}
                  </div>
                </div>

                {/* Q3 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-indigo-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    3. What helps you recover after disappointment or failure?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-indigo-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.recoverAfterDisappointment || "—"}
                  </div>
                </div>

                {/* Q4 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-indigo-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    4. Who do you approach when you need support?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-indigo-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.approachForSupport || "—"}
                  </div>
                </div>

                {/* Q5 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-amber-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    5. One obstacle you are willing to actively work on?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-amber-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.obstacleWillingToWorkOn || "—"}
                  </div>
                </div>

                {/* Q6 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-amber-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    6. What kind of behavior hurts you the most?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-amber-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.behaviorHurtsMost || "—"}
                  </div>
                </div>

                {/* Q7 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-emerald-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    7. What do you wish others understood better about you?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-emerald-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.wishOthersUnderstood || "—"}
                  </div>
                </div>

                {/* Q8 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-emerald-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    8. What does it mean to be a successful person?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-emerald-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.successfulPersonMeaning || "—"}
                  </div>
                </div>

                {/* Q9 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-indigo-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    9. What does success look like beyond academic qualifications?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-indigo-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.successBeyondQualifications || "—"}
                  </div>
                </div>

                {/* Q10 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-indigo-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    10. What qualities make someone worthy of genuine respect?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-indigo-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.qualitiesWorthyOfRespect || "—"}
                  </div>
                </div>

                {/* Q11 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-teal-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    11. Why is it important to continue learning throughout life?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-teal-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.continueLearningReason || "—"}
                  </div>
                </div>

                {/* Q12 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-teal-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    12. What does Khidmat mean to you personally?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-teal-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.khidmatMeaning || "—"}
                  </div>
                </div>

                {/* Q13 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-amber-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    13. How can you use your unique skills to benefit others?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-amber-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.useSkillsToBenefitOthers || "—"}
                  </div>
                </div>

                {/* Q14 */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 border-l-[3.5px] border-l-amber-600 flex flex-col justify-start">
                  <div className="font-bold text-slate-950 text-[10.5px] leading-tight">
                    14. What kind of person do you want to be remembered as?
                  </div>
                  <div className="text-slate-900 font-medium text-[10px] leading-snug mt-1 pl-1 border-l border-amber-200 whitespace-pre-wrap break-words">
                    {data.knowingMyself?.rememberedFor || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer & Official Signatures (Page 2) */}
            <div className="pt-2 border-t-2 border-slate-900">
              <div className="grid grid-cols-3 gap-6 pt-2 pb-1 text-center text-[10.5px]">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-800 block text-[10.5px]">Student's Affirmation</span>
                  <span className="text-[9px] text-slate-500">(Talib / Taliba Signature)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-800 block text-[10.5px]">Darajah Counsellor / Masool</span>
                  <span className="text-[9px] text-slate-500">(Review &amp; Mentorship)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-800 block text-[10.5px]">Administration Seal</span>
                  <span className="text-[9px] text-slate-500">(Darse Burhani Official)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200 mt-1">
                <span>Knowing Myself Assessment • Darse Burhani Official Dossier • Darajah Rabea (Grade 4) • Page 2 of 2</span>
                <span
                  dir="rtl"
                  className="arabic-calligraphy text-[10.5px] text-slate-800"
                >
                  الحمد لله على ما أنعم والشكر له على ما ألهم
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
          /* ════════════════════════════════════════════════════════════
             DOCUMENT VIEW: EDITED SECTIONS ONLY (FULL DOSSIER)
          ════════════════════════════════════════════════════════════ */
          <div className="doc-page bg-white text-[var(--text-primary)] font-medium border border-slate-300 shadow-xl rounded-sm p-6 sm:p-9 min-h-[297mm] flex flex-col justify-between box-border">
            <div>
              {/* ── Top Header ── */}
              <div className="flex items-start justify-between border-b pb-4 mb-4 relative">
                {/* Emblem / Logo */}
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.png"
                    alt="Darse Burhani Logo"
                    className="w-16 h-16 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>

                {/* Institution & Title */}
                <div className="text-center flex-1 px-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-[#1c1c1c] font-serif uppercase">
                    Darse Burhani
                  </h1>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#1c1c1c] tracking-wider mt-0.5">
                    TALABAT PROFILE – {data.year || "1447 H"}
                  </h2>
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] font-medium mt-0.5">
                    Academic Year 1447 H • Yearly Profile Submission
                  </div>
                </div>

                {/* Right: Further Education Banner & Status Badge */}
                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="block text-[11px] font-bold text-[#1c1c1c]">Further</span>
                      <span className="block text-[11px] font-bold text-[#1c1c1c]">Education:</span>
                    </div>
                    <span className="text-base font-bold text-[#1c1c1c] font-alkanz dir-rtl" dir="rtl">
                      توجيه الطالب
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        data.status === "SUBMITTED"
                          ? "bg-[var(--gold-light)] text-[var(--gold-800)] border-emerald-300"
                          : data.status === "REVIEWED"
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : "bg-[var(--gold-light)] text-[var(--gold-800)] border-[var(--gold-300)]"
                      }`}
                    >
                      {data.status === "REVIEWED"
                        ? "Reviewed"
                        : data.status === "SUBMITTED"
                        ? "Submitted"
                        : data.status === "DRAFT"
                        ? "Draft"
                        : "Profile"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Empty State: Nothing edited yet ── */}
              {!hasAnyEditedData && (
                <div className="p-12 text-center bg-[var(--gold-light)] border border-dashed border-[var(--border-subtle)] rounded-xl my-8">
                  <GraduationCap className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-800 text-base">No Profile Information Edited Yet</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1 leading-relaxed">
                    This student has not yet entered or submitted details for the 1447 H Yearly Profile.
                    Once edited by the student or faculty, the submitted fields will appear here.
                  </p>
                </div>
              )}

              {/* ── 1. PERSONAL DETAILS (Only if edited) ── */}
              {hasPersonalDetails && (
                <div className="mb-4">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] font-medium">
                    PERSONAL DETAILS
                  </div>
                  <div className="border-x border-b border-slate-800 flex flex-row">
                    {/* Photo Cell (Only if uploaded) */}
                    {isFilled(data.studentPhotoUrl) && (
                      <div className="w-28 sm:w-32 min-h-[110px] p-2 border-r border-slate-800 flex items-center justify-center bg-slate-50 shrink-0">
                        <img
                          src={normalizeImgSrc(data.studentPhotoUrl)}
                          alt={data.name || "Student"}
                          className="w-full h-28 object-cover rounded shadow-xs border border-slate-200"
                        />
                      </div>
                    )}

                    {/* Info Fields Grid */}
                    <div className="flex-1 grid grid-cols-12 text-xs divide-y divide-slate-800">
                      {isFilled(data.name) && (
                        <div className="col-span-12 flex items-center">
                          <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Name:</div>
                          <div className="flex-1 p-1.5 font-bold text-[var(--text-primary)] font-medium">{data.name}</div>
                        </div>
                      )}

                      {(isFilled(data.itsNo) || isFilled(data.idNo)) && (
                        <>
                          {isFilled(data.itsNo) && (
                            <div className={`${isFilled(data.idNo) ? "col-span-12 sm:col-span-6 border-r-0 sm:border-r" : "col-span-12"} flex items-center border-slate-800`}>
                              <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">ITS No.:</div>
                              <div className="flex-1 p-1.5 font-bold font-mono">{data.itsNo}</div>
                            </div>
                          )}
                          {isFilled(data.idNo) && (
                            <div className={`${isFilled(data.itsNo) ? "col-span-12 sm:col-span-6" : "col-span-12"} flex items-center border-slate-800`}>
                              <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">ID No.:</div>
                              <div className="flex-1 p-1.5 font-bold font-mono">{data.idNo}</div>
                            </div>
                          )}
                        </>
                      )}

                      {(isFilled(data.jamaat) || isFilled(data.vatan)) && (
                        <>
                          {isFilled(data.jamaat) && (
                            <div className={`${isFilled(data.vatan) ? "col-span-12 sm:col-span-6 border-r-0 sm:border-r" : "col-span-12"} flex items-center border-slate-800`}>
                              <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Jamaat:</div>
                              <div className="flex-1 p-1.5 font-medium">{data.jamaat}</div>
                            </div>
                          )}
                          {isFilled(data.vatan) && (
                            <div className={`${isFilled(data.jamaat) ? "col-span-12 sm:col-span-6" : "col-span-12"} flex items-center border-slate-800`}>
                              <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Vatan:</div>
                              <div className="flex-1 p-1.5 font-medium">{data.vatan}</div>
                            </div>
                          )}
                        </>
                      )}

                      {(isFilled(data.nationality) || isFilled(data.dob) || isFilled(data.age)) && (
                        <>
                          {isFilled(data.nationality) && (
                            <div className={`${(isFilled(data.dob) || isFilled(data.age)) ? "col-span-12 sm:col-span-6 border-r-0 sm:border-r" : "col-span-12"} flex items-center border-slate-800`}>
                              <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Nationality:</div>
                              <div className="flex-1 p-1.5">{data.nationality}</div>
                            </div>
                          )}
                          {(isFilled(data.dob) || isFilled(data.age)) && (
                            <div className={`${isFilled(data.nationality) ? "col-span-12 sm:col-span-6" : "col-span-12"} flex items-center border-slate-800`}>
                              <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">DOB (Age):</div>
                              <div className="flex-1 p-1.5 font-semibold">
                                {data.dob ? data.dob : ""}
                                {data.age ? `${data.dob ? " (" : ""}${data.age} Yrs${data.dob ? ")" : ""}` : ""}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 2. FAMILY DETAILS (Only if edited) ── */}
              {hasFamilyDetails && (
                <div className="mb-4">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] font-medium">
                    FAMILY DETAILS
                  </div>
                  <div className="border-x border-b border-slate-800 flex flex-col divide-y divide-slate-800">
                    {/* Father Row (Only if entered) */}
                    {hasFatherDetails && (
                      <div className="flex flex-row items-center">
                        {isFilled(data.fatherPhotoUrl) && (
                          <div className="w-20 sm:w-24 h-24 sm:h-28 p-1 border-r border-slate-800 flex items-center justify-center bg-slate-50 shrink-0">
                            <img
                              src={normalizeImgSrc(data.fatherPhotoUrl)}
                              alt="Father"
                              className="w-full h-full object-cover rounded shadow-2xs border border-slate-200"
                            />
                          </div>
                        )}
                        <div className="flex-1 grid grid-cols-12 text-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                          <div className="col-span-12 sm:col-span-7 flex flex-col justify-center p-2.5">
                            <span className="font-semibold text-[var(--text-secondary)] font-medium text-[11px]">Father Name:</span>
                            <span className="font-bold text-[var(--text-primary)] font-medium text-xs sm:text-sm">{data.fatherName || "—"}</span>
                          </div>
                          <div className="col-span-12 sm:col-span-5 flex flex-col justify-center p-2.5">
                            <span className="font-semibold text-[var(--text-secondary)] font-medium text-[11px]">Father Occupation:</span>
                            <span className="font-medium text-[var(--text-primary)] font-medium text-xs">{data.fatherOccupation || "—"}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mother Row (Only if entered) */}
                    {hasMotherDetails && (
                      <div className="flex flex-row items-center">
                        {isFilled(data.motherPhotoUrl) && (
                          <div className="w-20 sm:w-24 h-24 sm:h-28 p-1 border-r border-slate-800 flex items-center justify-center bg-slate-50 shrink-0">
                            <img
                              src={normalizeImgSrc(data.motherPhotoUrl)}
                              alt="Mother"
                              className="w-full h-full object-cover rounded shadow-2xs border border-slate-200"
                            />
                          </div>
                        )}
                        <div className="flex-1 grid grid-cols-12 text-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                          <div className="col-span-12 sm:col-span-7 flex flex-col justify-center p-2">
                            <span className="font-semibold text-[var(--text-secondary)] font-medium text-[11px]">Mother Name:</span>
                            <span className="font-bold text-[var(--text-primary)] font-medium text-xs sm:text-sm">{data.motherName || "—"}</span>
                          </div>
                          <div className="col-span-12 sm:col-span-5 flex flex-col justify-center p-2">
                            <span className="font-semibold text-[var(--text-secondary)] font-medium text-[11px]">Mother Occupation:</span>
                            <span className="font-medium text-[var(--text-primary)] font-medium text-xs">{data.motherOccupation || "Homemaker"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 3. ACADEMICS DETAILS (Only if edited) ── */}
              {hasAcademicsDetails && (
                <div className="mb-4">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] font-medium">
                    ACADEMICS DETAILS
                  </div>
                  <div className="border-x border-b border-slate-800 grid grid-cols-12 text-xs divide-x divide-slate-800">
                    {/* Exam Results (Only if scores entered) */}
                    {editedResults.length > 0 && (
                      <div className="col-span-12 sm:col-span-4 flex flex-col">
                        <div className="border-b border-slate-800 p-1 text-center font-bold font-alkanz dir-rtl bg-slate-50 text-xs" dir="rtl">
                          نتائج الامتحان السنوي
                        </div>
                        <div className="grid grid-cols-2 text-center divide-x divide-slate-800 divide-y divide-slate-800 flex-1">
                          {editedResults.map((r) => (
                            <React.Fragment key={r.year}>
                              <div className="p-1 font-medium bg-slate-50">{r.year}</div>
                              <div className="p-1 font-bold">{r.val}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hifz (Only if entered) */}
                    {hasHifz && (
                      <div className="col-span-12 sm:col-span-3 flex flex-col">
                        <div className="border-b border-slate-800 p-1 text-center font-bold font-alkanz dir-rtl bg-slate-50 text-xs" dir="rtl">
                          نتائج الحفظ
                        </div>
                        <div className="grid grid-cols-2 text-center divide-x divide-slate-800 divide-y divide-slate-800 flex-1">
                          {isFilled(data.hifzYear) && (
                            <>
                              <div className="p-1 font-medium bg-slate-50 flex items-center justify-center">Hifz</div>
                              <div className="p-1 font-bold flex items-center justify-center">{data.hifzYear}</div>
                            </>
                          )}
                          {isFilled(data.hifzTabaqa) && (
                            <>
                              <div className="p-1 font-medium bg-slate-50 flex items-center justify-center">Tabaqa</div>
                              <div className="p-1 font-bold font-alkanz flex items-center justify-center text-xs" dir="rtl">
                                {data.hifzTabaqa}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Courses (Only if entered) */}
                    {editedCourses.length > 0 && (
                      <div className="col-span-12 sm:col-span-5 flex flex-col">
                        <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50">Courses Taken</div>
                        <div className="flex flex-col divide-y divide-slate-800 flex-1">
                          {editedCourses.map((c, idx) => (
                            <div key={idx} className="flex items-center px-2 py-1 text-[11px]">
                              <span className="font-semibold mr-1.5 text-[var(--text-secondary)] font-medium">{idx + 1}.</span>
                              <span className="font-medium">{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Activities & Other Exams (Full width row if present) */}
                    {(hasActivities || hasOtherExams) && (
                      <div className="col-span-12 border-t border-slate-800 flex flex-col divide-y divide-slate-800">
                        {hasActivities && (
                          <div className="p-2 bg-white">
                            <div className="text-[11px] font-bold font-alkanz text-[#1c1c1c] mb-1 dir-rtl" dir="rtl">
                              الاشتراك في البرامج العلمية والثقافية:
                            </div>
                            <div className="text-xs leading-relaxed font-alkanz dir-rtl text-right text-slate-800" dir="rtl">
                              {data.activities}
                            </div>
                          </div>
                        )}
                        {hasOtherExams && (
                          <div className="p-2 bg-[var(--gold-light)]/25 flex items-center justify-between">
                            <span className="font-alkanz font-bold text-xs text-[#1c1c1c] dir-rtl" dir="rtl">
                              الامتحانات الأخرى:
                            </span>
                            <span className="font-bold text-xs text-[var(--text-primary)] font-medium">{data.otherExams}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 4. SELF – ASSESSMENT (Only if edited) ── */}
              {hasSelfAssessment && (
                <div className="mb-4">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] font-medium">
                    SELF – ASSESSMENT
                  </div>
                  <div className="border-x border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 text-xs">
                    {/* Strengths */}
                    {editedStrengths.length > 0 && (
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50 text-[var(--gold-900)]">
                          My Strengths
                        </div>
                        <div className="p-2.5 flex flex-col gap-1.5">
                          {editedStrengths.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                              <span className="font-bold text-emerald-700">{idx + 1}.</span>
                              <span className="text-[var(--text-primary)] font-medium">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {editedWeaknesses.length > 0 && (
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50 text-rose-900">
                          My Weaknesses
                        </div>
                        <div className="p-2.5 flex flex-col gap-1.5">
                          {editedWeaknesses.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                              <span className="text-rose-500 font-bold">•</span>
                              <span className="text-[var(--text-primary)] font-medium">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 5. ABOUT MYSELF (Only if edited) ── */}
              {hasAboutMyself && (
                <div className="mb-4">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] font-medium">
                    About Myself (Hobbies, Interests &amp; Skills)
                  </div>
                  <div className="border-x border-b border-slate-800 p-3 text-xs leading-relaxed text-[var(--text-primary)] font-medium font-medium">
                    {data.aboutMyself}
                  </div>
                </div>
              )}

              {/* ── 6. ADMINISTRATION & FACULTY EVALUATION (Only if reviewed/edited) ── */}
              {hasFacultyEvaluation && (
                <div className="mb-4 mt-6">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1.5 font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] font-medium">
                    ADMINISTRATION &amp; DARSE BURHANI MASUL COLLECTIVE EVALUATION
                  </div>

                  {/* 4 Ratings Table (Only if ratings assigned) */}
                  {hasRatings && (
                    <div className="border-x border-b border-slate-800 grid grid-cols-4 divide-x divide-slate-800 text-center">
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-[var(--text-primary)] font-medium">Behaviour</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-[var(--gold-800)]">
                          {data.behaviourRating ? `${data.behaviourRating} / 5` : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-[var(--text-primary)] font-medium">Communication</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-[var(--gold-800)]">
                          {data.communicationRating ? `${data.communicationRating} / 5` : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-[var(--text-primary)] font-medium">Dedication</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-[var(--gold-800)]">
                          {data.dedicationRating ? `${data.dedicationRating} / 5` : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-[var(--text-primary)] font-medium">Discipline</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-[var(--gold-800)]">
                          {data.disciplineRating ? `${data.disciplineRating} / 5` : "—"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edited Department Remarks (Only categories that have text) */}
                  {editedRemarks.length > 0 && (
                    <div className="border-x border-b border-slate-800 mt-[-1px]">
                      <div className="bg-slate-50 border-b border-slate-800 p-1 text-center font-alkanz font-bold text-xs text-slate-800" dir="rtl">
                        ملاحظات المسؤولين:
                      </div>
                      <div className="divide-y divide-slate-800 text-xs">
                        {editedRemarks.map((cat) => (
                          <div key={cat.key} className="grid grid-cols-12 min-h-[38px]">
                            <div
                              className={`col-span-9 sm:col-span-10 p-2.5 leading-relaxed text-right border-r border-slate-800 flex items-center justify-end ${
                                isArabicText(cat.value) ? "font-alkanz text-[13px] dir-rtl" : "text-xs"
                              }`}
                              dir={isArabicText(cat.value) ? "rtl" : "ltr"}
                            >
                              {cat.value}
                            </div>
                            <div className="col-span-3 sm:col-span-2 p-2 flex flex-col items-center justify-center text-center bg-slate-50/60">
                              <span className="font-alkanz text-xs font-bold text-[#1c1c1c] dir-rtl" dir="rtl">
                                {cat.labelAr}
                              </span>
                              <span className="text-[9px] text-[var(--text-muted)] font-sans mt-0.5">{cat.labelEn}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sibling & Counselling Notes Box (Only if entered) */}
                  {hasCounsellingNotes && (
                    <div className="border border-slate-800 rounded-xs p-3 bg-white mt-3">
                      <div className="text-[10px] font-bold text-[#1c1c1c] uppercase tracking-wider mb-1">
                        Sibling Details &amp; Career Counselling Guidance Notes:
                      </div>
                      <div className="text-xs font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {data.counsellingNotes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Official Document Footer */}
            <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <div>Darse Burhani Official Institutional Document • 1447 H</div>
              <div className="font-alkanz dir-rtl text-xs text-[#1c1c1c]" dir="rtl">
                الحمد لله على ما أنعم والشكر له على ما ألهم
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Print Specific Styles ── */}
      <style>{`
        @font-face {
          font-family: 'Al-Kanz';
          src: local('AL-KANZ'), local('Al-Kanz'), local('Al Kanz'), url('/Al-Kanz.ttf') format('truetype');
          font-weight: 100 900;
          font-display: swap;
        }
        @font-face {
          font-family: 'AL-KANZ';
          src: local('AL-KANZ'), local('Al-Kanz'), local('Al Kanz'), url('/Al-Kanz.ttf') format('truetype');
          font-weight: 100 900;
          font-display: swap;
        }
        .arabic-calligraphy {
          font-family: 'Al-Kanz', 'AL-KANZ', 'Al Kanz', 'alkanz', 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', 'Scheherazade New', 'Segoe UI', Tahoma, Arial, sans-serif !important;
          direction: rtl !important;
          unicode-bidi: embed !important;
          letter-spacing: 0px !important;
          word-spacing: normal !important;
          font-feature-settings: "liga" 1, "calt" 1, "clig" 1, "mset" 1 !important;
          -webkit-font-feature-settings: "liga" 1, "calt" 1, "clig" 1, "mset" 1 !important;
          font-variant-ligatures: contextual common-ligatures !important;
        }
        .font-alkanz {
          font-family: 'Al-Kanz', 'AL-KANZ', 'Al Kanz', 'alkanz', 'Traditional Arabic', 'Amiri', 'Segoe UI', Tahoma, Arial, sans-serif !important;
          direction: rtl !important;
          letter-spacing: 0px !important;
          font-feature-settings: "liga" 1, "calt" 1, "clig" 1, "mset" 1 !important;
          -webkit-font-feature-settings: "liga" 1, "calt" 1, "clig" 1, "mset" 1 !important;
          font-variant-ligatures: contextual common-ligatures !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .talabat-profile-root {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .printable-document {
            gap: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .doc-page {
            border: 1.5px solid #0f172a !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 4mm 5mm !important;
            box-sizing: border-box !important;
            width: 100% !important;
            height: 289mm !important;
            max-height: 289mm !important;
            min-height: 289mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .doc-page-single {
            page-break-after: always !important;
            break-after: page !important;
            page-break-before: auto !important;
            break-before: auto !important;
          }
          .doc-page-page2 {
            page-break-before: always !important;
            break-before: page !important;
            page-break-after: auto !important;
            break-after: auto !important;
            margin-top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
