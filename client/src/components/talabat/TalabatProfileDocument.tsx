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
      await Promise.all(
        targets.flatMap((el) =>
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
      );

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      const pageH = 297;
      const marginMm = 5;
      const printableW = pageW - marginMm * 2;
      const printableH = pageH - marginMm * 2;

      // A slice boundary can land in the middle of a line and cut it in half.
      // Walk up from the boundary to the nearest blank row so lines stay whole.
      const findSafeCut = (canvas: HTMLCanvasElement, targetY: number, minY: number): number => {
        const ctx = canvas.getContext("2d");
        const bandTop = Math.max(0, minY);
        const bandHeight = targetY - bandTop;
        if (!ctx || bandHeight <= 0) return targetY;
        let data: Uint8ClampedArray;
        try {
          // One read for the whole band instead of one per row
          data = ctx.getImageData(0, bandTop, canvas.width, bandHeight).data;
        } catch {
          return targetY;
        }
        const rowStride = canvas.width * 4;
        const columnStep = 16; // sample every 4th pixel
        for (let offset = bandHeight - 1; offset >= 0; offset--) {
          const rowStart = offset * rowStride;
          let hasInk = false;
          for (let x = 0; x < rowStride; x += columnStep) {
            const p = rowStart + x;
            if (data[p] < 244 || data[p + 1] < 244 || data[p + 2] < 244) {
              hasInk = true;
              break;
            }
          }
          if (!hasInk) return bandTop + offset;
        }
        return targetY;
      };

      let pdfPageWritten = false;

      for (let i = 0; i < targets.length; i++) {
        const canvas = await html2canvas(targets[i], {
          // 2x keeps small print genuinely readable after PDF scaling
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 8000,
          // Force the light theme on the clone: in dark mode the document's
          // CSS variables paint large dark blocks into the PDF.
          onclone: (clonedDoc) => {
            clonedDoc.documentElement.classList.remove("dark");
            clonedDoc.documentElement.setAttribute("data-theme", "light");
            clonedDoc.body.classList.remove("dark");
            clonedDoc.body.style.background = "#ffffff";
          },
        });

        const pxPerMm = canvas.width / printableW;
        const contentHmm = canvas.height / pxPerMm;

        if (contentHmm <= printableH) {
          if (pdfPageWritten) pdf.addPage();
          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            marginMm,
            marginMm,
            printableW,
            contentHmm,
          );
          pdfPageWritten = true;
          continue;
        }

        // Taller than one sheet: keep the text at its natural size and split
        // the capture across several sheets instead of shrinking it down.
        const maxSlicePx = Math.floor(printableH * pxPerMm);
        let consumed = 0;
        while (consumed < canvas.height) {
          const remaining = canvas.height - consumed;
          let slicePx = Math.min(maxSlicePx, remaining);
          if (slicePx < remaining) {
            const safe = findSafeCut(canvas, consumed + slicePx, consumed + Math.floor(maxSlicePx * 0.55));
            // Only accept the nudge if it does not waste most of a sheet.
            if (safe - consumed > slicePx * 0.5) slicePx = safe - consumed;
          }
          if (slicePx <= 0) break;

          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = slicePx;
          const sctx = slice.getContext("2d");
          if (!sctx) break;
          sctx.fillStyle = "#ffffff";
          sctx.fillRect(0, 0, slice.width, slice.height);
          sctx.drawImage(canvas, 0, consumed, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

          if (pdfPageWritten) pdf.addPage();
          pdf.addImage(
            slice.toDataURL("image/jpeg", 0.95),
            "JPEG",
            marginMm,
            marginMm,
            printableW,
            slicePx / pxPerMm,
          );
          pdfPageWritten = true;
          consumed += slicePx;
        }
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
            <div className="doc-page doc-page-single bg-white text-[var(--text-primary)] font-medium border-2 border-slate-900 shadow-xl rounded-none p-5 sm:p-6 min-h-[282mm] flex flex-col justify-between box-border">
            <div>
              {/* Institutional Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5 mb-2.5 relative">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.png"
                    alt="Darse Burhani Logo"
                    className="w-13 h-13 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div>
                    <h1 className="text-xl font-black tracking-wider text-[#1c1c1c] font-serif uppercase leading-tight">
                      DARSE BURHANI
                    </h1>
                    <h2 className="text-[13px] font-extrabold text-[var(--gold-900)] tracking-wide mt-0.5">
                      DARAJEH RABEA (GRADE 4) • STUDENT TALABAT PROFILE
                    </h2>
                    <div className="text-[11px] font-medium text-[var(--text-secondary)] font-medium">
                      Academic Year 1447 H • Official Individual Record Sheet
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="font-alkanz text-sm font-bold text-[#1c1c1c] dir-rtl leading-snug" dir="rtl">
                    الحمد لله على ما أنعم والشكر له على ما ألهم
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full text-[var(--text-inverted)] text-[var(--gold-400)]">
                      DARSE BURHANI
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-light)] text-[var(--gold-900)] border border-emerald-300">
                      {data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Student Identity & Passport Photo Hero Row */}
              <div className="flex items-stretch gap-3.5 p-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg mb-2.5">
                {/* Photo */}
                <div className="w-[32mm] h-[40mm] bg-white border-2 border-slate-400 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                  {isFilled(data.studentPhotoUrl) ? (
                    <img
                      src={normalizeImgSrc(data.studentPhotoUrl)}
                      alt={data.name || "Student"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <GraduationCap className="w-7 h-7 mx-auto mb-0.5 text-slate-400" />
                      <span className="text-[8.5px] font-bold uppercase block">Photo</span>
                    </div>
                  )}
                </div>

                {/* Main Name & Key Identifiers */}
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-primary)] font-medium font-serif leading-tight">
                      {data.name || "Student Full Name"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-700"><span className="inline-flex items-center gap-1 font-bold bg-[var(--gold-100)] text-[var(--gold-900)] px-2 py-0.5 rounded border border-[var(--gold-300)] text-[11.5px]">
                        ITS: {data.itsNo || "—"}</span>
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-[11.5px]">
                        Standard: {data.standard || data.grade || "Darajah 4 (Rabea)"}</span>
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-[11.5px]">
                        Section: {data.section || "A"}
                      </span>
                      <span className="font-semibold bg-[var(--gold-light)] text-[var(--gold-800)] px-2 py-0.5 rounded border border-emerald-300 text-[11.5px]">
                        Status: {data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-slate-200 text-[11.5px] text-[var(--text-secondary)] font-medium">
                    <div><span className="font-bold text-slate-800">Admission Year:</span> {data.admissionYear || "1444 H"}</div>
                    <div><span className="font-bold text-slate-800">Current Year:</span> {data.currentYear || data.year || "1447 H"}</div>
                    <div><span className="font-bold text-slate-800">Age:</span> {data.age ? `${data.age} Years` : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Complete Demographic & Information Table */}
              <div className="mb-2.5 border border-slate-300 rounded-lg overflow-hidden bg-white text-[12px]">
                <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium px-2.5 py-1 font-bold text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span>Student Demographic &amp; Institutional Profile</span>
                  <span className="text-[var(--gold-400)] text-[9.5px] lowercase font-normal">official student dossier</span>
                </div>
                <div className="grid grid-cols-2 text-[11.5px] divide-y divide-x divide-border-subtle">
                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Student Name:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.name || "—"}</span>
                  </div>
                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Student ITS:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] font-medium text-right">{data.itsNo || "—"}</span>
                  </div>

                  <div className="p-2 flex justify-between items-center">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Father Name:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right flex items-center gap-1.5">
                      {isFilled(data.fatherPhotoUrl) && (
                        <img
                          src={getProfileImgSrc(data.fatherPhotoUrl)}
                          alt="Father"
                          className="w-5 h-5 rounded-full object-cover border border-slate-400 shrink-0"
                          onError={(e: any) => { e.target.style.display = "none"; }}
                        />
                      )}
                      <span>{data.fatherName || "—"}</span>
                    </span>
                  </div>
                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Father's Occupation:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.fatherOccupation || "—"}</span>
                  </div>

                  <div className="p-2 flex justify-between items-center bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Mother Name:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right flex items-center gap-1.5">
                      {isFilled(data.motherPhotoUrl) && (
                        <img
                          src={getProfileImgSrc(data.motherPhotoUrl)}
                          alt="Mother"
                          className="w-5 h-5 rounded-full object-cover border border-slate-400 shrink-0"
                          onError={(e: any) => { e.target.style.display = "none"; }}
                        />
                      )}
                      <span>{data.motherName || "—"}</span>
                    </span>
                  </div>
                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Mother's Occupation:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.motherOccupation || "Homemaker"}</span>
                  </div>

                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Student's Standard:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.standard || data.grade || "Darajah 4 (Rabea)"}</span>
                  </div>
                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Class Section:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.section || "A"}</span>
                  </div>

                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Student Status:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}</span>
                  </div>
                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Admission Year:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.admissionYear || "1444 H"}</span>
                  </div>

                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Current Year:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.currentYear || data.year || "1447 H"}</span>
                  </div>
                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Student Age:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.age ? `${data.age} Years` : "—"}</span>
                  </div>

                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Watan:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.vatan || data.watan || "—"}</span>
                  </div>
                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Resident City:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.jamaat || data.residentCity || "—"}</span>
                  </div>

                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Mobile Number:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.mobileNumber || "—"}</span>
                  </div>
                  <div className="p-2 flex justify-between bg-[var(--gold-light)]/25">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">Email ID:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.email || "—"}</span>
                  </div>

                  <div className="col-span-2 p-2 flex justify-between bg-[var(--gold-light)]/30">
                    <span className="font-bold text-[var(--text-secondary)] font-medium">External Schooling Status:</span>
                    <span className="font-semibold text-[var(--text-primary)] font-medium text-right">{data.externalSchooling || "Regular Darse Burhani"}</span>
                  </div>

                  <div className="col-span-2 p-2 flex justify-between">
                    <span className="font-bold text-[var(--text-secondary)] font-medium shrink-0 mr-2">Address:</span>
                    <span className="font-medium text-[var(--text-primary)] font-medium text-right leading-tight">{data.address || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Special Prompts Section: Rabea Talabat Reflections & Passions */}
              <div className="border-2 border-amber-400 bg-[var(--gold-light)]/30 rounded-lg p-2.5 mb-2.5">
                <div className="flex items-center justify-between border-b border-[var(--gold-300)]/70 pb-1 mb-2">
                  <span className="font-black text-[11px] text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    ★ Talabat Personal Reflections &amp; Passions (Darajah Rabea)
                  </span>
                  <span className="text-[9px] font-bold text-[var(--gold-800)] bg-[var(--gold-100)] px-1.5 py-0.5 rounded border border-[var(--gold-300)]">
                    Student Reflection Prompts
                  </span>
                </div>

                <div className="space-y-2 text-[12px]">
                  <div className="bg-white p-2 rounded border border-[var(--border-subtle)] shadow-xs">
                    <div className="font-bold text-[var(--gold-900)] text-[11.5px] mb-0.5">
                      1. I am really Good at ...
                    </div>
                    <div className="text-[var(--text-primary)] font-medium italic pl-2 border-l-2 border-[var(--gold-600)] leading-snug font-serif">
                      {isFilled(data.reallyGoodAt) ? data.reallyGoodAt : "— Not filled yet —"}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded border border-[var(--border-subtle)] shadow-xs">
                    <div className="font-bold text-indigo-950 text-[11.5px] mb-0.5">
                      2. I love to study about ... because ...
                    </div>
                    <div className="text-[var(--text-primary)] font-medium italic pl-2 border-l-2 border-indigo-600 leading-snug font-serif">
                      {isFilled(data.loveToStudy) ? data.loveToStudy : "— Not filled yet —"}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded border border-[var(--border-subtle)] shadow-xs">
                    <div className="font-bold text-[var(--gold-900)] text-[11.5px] mb-0.5">
                      3. I really love to ..... For Fun
                    </div>
                    <div className="text-[var(--text-primary)] font-medium italic pl-2 border-l-2 border-[var(--gold-600)] leading-snug font-serif">
                      {isFilled(data.loveForFun) ? data.loveForFun : "— Not filled yet —"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer & Official Signatures */}
            <div className="pt-2 border-t-2 border-slate-900">
              <div className="grid grid-cols-3 gap-6 pt-5 pb-1.5 text-center text-[11.5px]">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Student's Signature</span>
                  <span className="text-[9.5px] text-slate-400">(Talib / Taliba)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Parent / Guardian Signature</span>
                  <span className="text-[9.5px] text-slate-400">(Father / Mother)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Darajah Masul Signature &amp; Seal</span>
                  <span className="text-[9.5px] text-slate-400">(Darse Burhani Administration)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9.5px] text-[var(--text-muted)] pt-1 border-t border-slate-200 mt-1">
                <span>Darse Burhani Official Institutional Record • Darajah Rabea (Grade 4) • 1447 H</span>
                <span className="font-alkanz dir-rtl text-[11px] text-slate-800" dir="rtl">
                  الحمد لله على ما أنعم والشكر له على ما ألهم
                </span>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
             A4 PAGE 2: KNOWING MYSELF — MY IDENTITY AND ASPIRATIONS
             Self-Reflection Questionnaire, Obstacles & Aspirations
          ════════════════════════════════════════════════════════════ */}
          <div className="doc-page doc-page-page2 bg-white text-[var(--text-primary)] font-medium border-2 border-slate-900 shadow-xl rounded-none p-5 sm:p-6 min-h-[282mm] flex flex-col justify-between box-border print:mt-0 mt-8">
            <div>
              {/* Institutional Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5 mb-2.5 relative">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.png"
                    alt="Darse Burhani Logo"
                    className="w-13 h-13 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div>
                    <h1 className="text-xl font-black tracking-wider text-[#1c1c1c] font-serif uppercase leading-tight">
                      DARSE BURHANI
                    </h1>
                    <h2 className="text-[13px] font-extrabold text-[var(--gold-900)] tracking-wide mt-0.5">
                      KNOWING MYSELF: MY IDENTITY AND ASPIRATIONS
                    </h2>
                    <div className="text-[11px] font-medium text-[var(--text-secondary)] font-medium">
                      Darajeh Rabea (Grade 4) • Student Self-Reflection &amp; Guidance Record (Page 2 of 2)
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="font-alkanz text-sm font-bold text-[#1c1c1c] dir-rtl leading-snug" dir="rtl">
                    الحمد لله على ما أنعم والشكر له على ما ألهم
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full text-[var(--text-inverted)] text-[var(--gold-400)]">
                      {data.name || "Student"}
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-light)] text-[var(--gold-900)] border border-emerald-300">
                      ITS: {data.itsNo || "—"}
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-100)] text-[var(--gold-900)] border border-[var(--gold-300)]">
                      {data.knowingMyself?.dateOfAssessment || "1447 H"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section A: Strengths, Enjoyed Activities & Aspirations */}
              <div className="grid grid-cols-12 gap-2 mb-2">
                {/* Greatest Strengths */}
                <div className="col-span-4 bg-[var(--gold-light)]/25 border border-[var(--border-subtle)] rounded-lg p-2">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)]/80 pb-1 mb-1">
                    <span className="font-black text-[11px] text-[var(--gold-900)] uppercase tracking-wide">
                      ★ 3 Greatest Strengths
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-800">
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-emerald-700">1.</span>
                      <span className="font-medium leading-tight">
                        {data.knowingMyself?.threeStrengths?.[0] || data.reallyGoodAt || "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-emerald-700">2.</span>
                      <span className="font-medium leading-tight">
                        {data.knowingMyself?.threeStrengths?.[1] || "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-emerald-700">3.</span>
                      <span className="font-medium leading-tight">
                        {data.knowingMyself?.threeStrengths?.[2] || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Things Enjoyed */}
                <div className="col-span-4 bg-[var(--gold-light)]/50 border border-indigo-200 rounded-lg p-2">
                  <div className="flex items-center justify-between border-b border-indigo-200/80 pb-1 mb-1">
                    <span className="font-black text-[11px] text-indigo-950 uppercase tracking-wide">
                      ★ 3 Things I Enjoy Most
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-800">
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-indigo-700">1.</span>
                      <span className="font-medium leading-tight">
                        {data.knowingMyself?.threeThingsEnjoy?.[0] || data.loveForFun || "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-indigo-700">2.</span>
                      <span className="font-medium leading-tight">
                        {data.knowingMyself?.threeThingsEnjoy?.[1] || "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="font-bold text-indigo-700">3.</span>
                      <span className="font-medium leading-tight">
                        {data.knowingMyself?.threeThingsEnjoy?.[2] || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Core Accomplishment & Role Model */}
                <div className="col-span-4 bg-[var(--gold-light)]/25 border border-[var(--border-subtle)] rounded-lg p-2 flex flex-col justify-between">
                  <div>
                    <div className="font-black text-[11px] text-amber-950 uppercase tracking-wide border-b border-[var(--border-subtle)]/80 pb-1 mb-1">
                      ★ Aspirations &amp; Mentorship
                    </div>
                    <div className="space-y-1 text-[9.5px]">
                      <div>
                        <span className="font-bold text-slate-700">Proud Accomplishment: </span>
                        <span className="font-medium text-[var(--text-primary)] font-medium leading-tight">
                          {data.knowingMyself?.proudAccomplishment || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Area Want to Improve: </span>
                        <span className="font-medium text-[var(--text-primary)] font-medium leading-tight">
                          {data.knowingMyself?.improveBetterAt || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Person Admired &amp; Why: </span>
                        <span className="font-medium text-[var(--text-primary)] font-medium leading-tight">
                          {data.knowingMyself?.admirePersonWhy || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B: Obstacles Identified */}
              <div className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[11px] text-[var(--text-primary)] font-medium uppercase tracking-wider shrink-0">
                    Obstacles Identified:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Array.isArray(data.knowingMyself?.selectedObstacles) && data.knowingMyself.selectedObstacles.length > 0 ? (
                      data.knowingMyself.selectedObstacles.map((obs: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[var(--text-inverted)] text-[var(--gold-400)] border border-slate-700 shadow-2xs"
                        >
                          {obs}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10.5px] italic text-[var(--text-muted)]">None selected</span>
                    )}
                    {data.knowingMyself?.otherObstacle && (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gold-100)] text-[var(--gold-900)] border border-[var(--gold-300)]">
                        Other: {data.knowingMyself.otherObstacle}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-bold text-[var(--gold-800)] bg-[var(--gold-light)] px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                  {data.knowingMyself?.submittedAt ? "✓ Compulsory Assessment Submitted" : "Darajah 4 Dossier"}
                </span>
              </div>

              {/* Section C: In-Depth Self-Reflections — All 14 Compulsory Questions */}
              <div className="border border-slate-300 rounded-lg p-2 bg-white">
                <div className="border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
                  <span className="font-black text-[11.5px] text-[var(--text-primary)] font-medium uppercase tracking-wider flex items-center gap-1.5">
                    ★ Self-Reflection Questionnaire (14 Compulsory Questions)
                  </span>
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">
                    Standard Darse Burhani Taherabad Darajah Rabea Evaluation
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] leading-snug">
                  {/* Q1 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      1. How do you respond when things get difficult?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.difficultResponse || "—"}
                    </div>
                  </div>

                  {/* Q2 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      2. What makes you want to give up?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.wantToGiveUp || "—"}
                    </div>
                  </div>

                  {/* Q3 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-indigo-600">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      3. What helps you recover after disappointment or failure?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.recoverAfterDisappointment || "—"}
                    </div>
                  </div>

                  {/* Q4 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-indigo-600">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      4. Who do you approach when you need support?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.approachForSupport || "—"}
                    </div>
                  </div>

                  {/* Q5 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-amber-600">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      5. One obstacle you are willing to actively work on?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.obstacleWillingToWorkOn || "—"}
                    </div>
                  </div>

                  {/* Q6 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-amber-600">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      6. What kind of behavior hurts you the most?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.behaviorHurtsMost || "—"}
                    </div>
                  </div>

                  {/* Q7 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      7. What do you wish others understood better about you?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.wishOthersUnderstood || "—"}
                    </div>
                  </div>

                  {/* Q8 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      8. What does it mean to be a successful person?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.successfulPersonMeaning || "—"}
                    </div>
                  </div>

                  {/* Q9 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      9. What does success look like beyond academic qualifications?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.successBeyondQualifications || "—"}
                    </div>
                  </div>

                  {/* Q10 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      10. What qualities make someone worthy of genuine respect?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.qualitiesWorthyOfRespect || "—"}
                    </div>
                  </div>

                  {/* Q11 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-600)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      11. Why is it important to continue learning throughout life?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.continueLearningReason || "—"}
                    </div>
                  </div>

                  {/* Q12 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-700)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      12. What does Khidmat mean to you personally?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.khidmatMeaning || "—"}
                    </div>
                  </div>

                  {/* Q13 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-[var(--gold-700)]">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      13. How can you use your unique skills to benefit others?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.useSkillsToBenefitOthers || "—"}
                    </div>
                  </div>

                  {/* Q14 */}
                  <div className="p-1.5 rounded bg-slate-50/70 border-l-2 border-slate-700">
                    <div className="font-bold text-[var(--text-primary)] font-medium">
                      14. What kind of person do you want to be remembered as?
                    </div>
                    <div className="text-slate-800 italic pl-1 mt-0.5 font-serif">
                      {data.knowingMyself?.rememberedFor || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer & Official Signatures for Page 2 */}
            <div className="pt-2 border-t-2 border-slate-900">
              <div className="grid grid-cols-3 gap-6 pt-5 pb-1.5 text-center text-[11.5px]">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Student's Affirmation</span>
                  <span className="text-[9.5px] text-slate-400">(Talib / Taliba Signature)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Darajah Counsellor / Masool</span>
                  <span className="text-[9.5px] text-slate-400">(Review &amp; Mentorship)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Administration Seal</span>
                  <span className="text-[9.5px] text-slate-400">(Darse Burhani Official)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9.5px] text-[var(--text-muted)] pt-1 border-t border-slate-200 mt-1">
                <span>Knowing Myself Assessment • Darse Burhani Official Dossier • Darajah Rabea (Grade 4) • Page 2 of 2</span>
                <span className="font-alkanz dir-rtl text-[11px] text-slate-800" dir="rtl">
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
          src: url('/Al-Kanz.ttf') format('truetype');
          font-display: swap;
        }
        .font-alkanz {
          font-family: 'Al-Kanz', Arial, sans-serif !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .talabat-profile-root {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .printable-document {
            gap: 0 !important;
            max-width: 100% !important;
          }
          .doc-page {
            border: 1.5px solid #000 !important;
            box-shadow: none !important;
            margin-bottom: 0 !important;
            min-height: auto !important;
            padding: 8mm 8mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .doc-page-single {
            height: auto !important;
            max-height: none !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .doc-page-page2 {
            height: auto !important;
            max-height: none !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            page-break-before: always !important;
            break-before: page !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
