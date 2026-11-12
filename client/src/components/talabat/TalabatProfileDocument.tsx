import React, { useState } from "react";
import { FileCheck2, Printer, GraduationCap, Sparkles, User, Award, CheckCircle2 } from "lucide-react";

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

  const handlePrint = () => {
    window.print();
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
    <div className="talabat-profile-root w-full flex flex-col items-center">
      {/* ── Top Bar (Print Controls - Hidden on Print) ── */}
      <div className="no-print mb-6 flex flex-col sm:flex-row items-center justify-between w-full max-w-[210mm] gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        {/* Status Indicator & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setLayoutMode("a4-single")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "a4-single"
                  ? "bg-slate-900 text-amber-300 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📄</span>
              <span>A4 Profile Sheet (1 Page)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("dossier")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                layoutMode === "dossier"
                  ? "bg-slate-900 text-amber-300 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📑</span>
              <span>Full Dossier</span>
            </button>
          </div>

          <span className="hidden lg:inline-flex text-[11px] text-slate-500 font-medium">
            {layoutMode === "a4-single"
              ? "• Formatted strictly for 1-Sheet A4 Printing & PDF Download"
              : "• Complete Academic & Faculty Evaluation"}
          </span>
        </div>

        {/* Print Button */}
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
        </div>
      </div>

      {/* ── Document Container ── */}
      <div className="printable-document flex flex-col gap-8 w-full max-w-[210mm]">
        {layoutMode === "a4-single" ? (
          /* ════════════════════════════════════════════════════════════
             A4 SINGLE-SHEET INDIVIDUAL TALABAT PROFILE (RABEA)
             Strictly formatted to fit onto exactly 1 A4 Page
          ════════════════════════════════════════════════════════════ */
          <div className="doc-page doc-page-single bg-white text-slate-900 border-2 border-slate-900 shadow-xl rounded-none p-5 sm:p-6 min-h-[282mm] max-h-[285mm] flex flex-col justify-between box-border overflow-hidden">
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
                    <h1 className="text-lg font-black tracking-wider text-[#1c1c1c] font-serif uppercase leading-tight">
                      DARSE BURHANI
                    </h1>
                    <h2 className="text-xs font-extrabold text-emerald-950 tracking-wide mt-0.5">
                      DARAJEH RABEA (GRADE 4) • STUDENT TALABAT PROFILE
                    </h2>
                    <div className="text-[10px] font-medium text-slate-600">
                      Academic Year 1447 H • Official Individual Record Sheet
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="font-alkanz text-xs font-bold text-[#1c1c1c] dir-rtl leading-snug" dir="rtl">
                    الحمد لله على ما أنعم والشكر له على ما ألهم
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-amber-300">
                      DARSE BURHANI
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Student Identity & Passport Photo Hero Row */}
              <div className="flex items-stretch gap-3.5 p-2.5 bg-slate-50 border border-slate-300 rounded-lg mb-2.5">
                {/* Photo */}
                <div className="w-22 h-26 bg-white border-2 border-slate-400 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
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
                    <h3 className="text-base font-black text-slate-900 font-serif leading-tight">
                      {data.name || "Student Full Name"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-700">
                      <span className="inline-flex items-center gap-1 font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 text-[10.5px]">
                        ITS: {data.itsNo || "—"}
                      </span>
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-[10.5px]">
                        Standard: {data.standard || data.grade || "Darajah 4 (Rabea)"}
                      </span>
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-[10.5px]">
                        Section: {data.section || "A"}
                      </span>
                      <span className="font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 text-[10.5px]">
                        Status: {data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-slate-200 text-[10.5px] text-slate-600">
                    <div><span className="font-bold text-slate-800">Admission Year:</span> {data.admissionYear || "1444 H"}</div>
                    <div><span className="font-bold text-slate-800">Current Year:</span> {data.currentYear || data.year || "1447 H"}</div>
                    <div><span className="font-bold text-slate-800">Age:</span> {data.age ? `${data.age} Years` : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Complete Demographic & Information Table */}
              <div className="mb-2.5 border border-slate-300 rounded-lg overflow-hidden bg-white text-[11px]">
                <div className="bg-[#1c1c1c] text-white px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider flex items-center justify-between">
                  <span>Student Demographic &amp; Institutional Profile</span>
                  <span className="text-amber-300 text-[9.5px] lowercase font-normal">official student dossier</span>
                </div>
                <div className="grid grid-cols-2 text-[10.5px] divide-y divide-x divide-slate-200">
                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Student Name:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.name || "—"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Student ITS:</span>
                    <span className="font-mono font-bold text-slate-900 text-right">{data.itsNo || "—"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Father Name:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.fatherName || "—"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Father's Occupation:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.fatherOccupation || "—"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Mother Name:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.motherName || "—"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Mother's Occupation:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.motherOccupation || "Homemaker"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Student's Standard:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.standard || data.grade || "Darajah 4 (Rabea)"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Class Section:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.section || "A"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Student Status:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.studentStatus || (data.hifzYear ? "Hafiz" : "Sanah")}</span>
                  </div>
                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Admission Year:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.admissionYear || "1444 H"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Current Year:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.currentYear || data.year || "1447 H"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Student Age:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.age ? `${data.age} Years` : "—"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Watan:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.vatan || data.watan || "—"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Resident City:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.jamaat || data.residentCity || "—"}</span>
                  </div>

                  <div className="p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Mobile Number:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.mobileNumber || "—"}</span>
                  </div>
                  <div className="p-1.5 flex justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-600">Email ID:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.email || "—"}</span>
                  </div>

                  <div className="col-span-2 p-1.5 flex justify-between bg-slate-50/30">
                    <span className="font-bold text-slate-600">External Schooling Status:</span>
                    <span className="font-semibold text-slate-900 text-right">{data.externalSchooling || "Regular Darse Burhani"}</span>
                  </div>

                  <div className="col-span-2 p-1.5 flex justify-between">
                    <span className="font-bold text-slate-600 shrink-0 mr-2">Address:</span>
                    <span className="font-medium text-slate-900 text-right leading-tight">{data.address || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Special Prompts Section: Rabea Talabat Reflections & Passions */}
              <div className="border-2 border-amber-400 bg-amber-50/30 rounded-lg p-2.5 mb-2.5">
                <div className="flex items-center justify-between border-b border-amber-300/70 pb-1 mb-2">
                  <span className="font-black text-[11px] text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    ★ Talabat Personal Reflections &amp; Passions (Darajah Rabea)
                  </span>
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                    Student Reflection Prompts
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="bg-white p-2 rounded border border-amber-200 shadow-xs">
                    <div className="font-bold text-emerald-950 text-[10.5px] mb-0.5">
                      1. I am really Good at ...
                    </div>
                    <div className="text-slate-900 italic pl-2 border-l-2 border-emerald-600 leading-snug font-serif">
                      {isFilled(data.reallyGoodAt) ? data.reallyGoodAt : "— Not filled yet —"}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded border border-amber-200 shadow-xs">
                    <div className="font-bold text-indigo-950 text-[10.5px] mb-0.5">
                      2. I love to study about ... because ...
                    </div>
                    <div className="text-slate-900 italic pl-2 border-l-2 border-indigo-600 leading-snug font-serif">
                      {isFilled(data.loveToStudy) ? data.loveToStudy : "— Not filled yet —"}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded border border-amber-200 shadow-xs">
                    <div className="font-bold text-purple-950 text-[10.5px] mb-0.5">
                      3. I really love to ..... For Fun
                    </div>
                    <div className="text-slate-900 italic pl-2 border-l-2 border-purple-600 leading-snug font-serif">
                      {isFilled(data.loveForFun) ? data.loveForFun : "— Not filled yet —"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer & Official Signatures */}
            <div className="pt-2 border-t-2 border-slate-900">
              <div className="grid grid-cols-3 gap-6 pt-5 pb-1.5 text-center text-[10.5px]">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[10px]">Student's Signature</span>
                  <span className="text-[8.5px] text-slate-400">(Talib / Taliba)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[10px]">Parent / Guardian Signature</span>
                  <span className="text-[8.5px] text-slate-400">(Father / Mother)</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700 block text-[10px]">Darajah Masul Signature &amp; Seal</span>
                  <span className="text-[8.5px] text-slate-400">(Darse Burhani Administration)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9.5px] text-slate-500 pt-1 border-t border-slate-200 mt-1">
                <span>Darse Burhani Official Institutional Record • Darajah Rabea (Grade 4) • 1447 H</span>
                <span className="font-alkanz dir-rtl text-[11px] text-slate-800" dir="rtl">
                  الحمد لله على ما أنعم والشكر له على ما ألهم
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════
             DOCUMENT VIEW: EDITED SECTIONS ONLY (FULL DOSSIER)
          ════════════════════════════════════════════════════════════ */
          <div className="doc-page bg-white text-slate-900 border border-slate-300 shadow-xl rounded-sm p-6 sm:p-9 min-h-[297mm] flex flex-col justify-between box-border">
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
                  <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
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
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : data.status === "REVIEWED"
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
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
                <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl my-8">
                  <GraduationCap className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-800 text-base">No Profile Information Edited Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                    This student has not yet entered or submitted details for the 1447 H Yearly Profile.
                    Once edited by the student or faculty, the submitted fields will appear here.
                  </p>
                </div>
              )}

              {/* ── 1. PERSONAL DETAILS (Only if edited) ── */}
              {hasPersonalDetails && (
                <div className="mb-4">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-slate-900">
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
                          <div className="flex-1 p-1.5 font-bold text-slate-900">{data.name}</div>
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
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-slate-900">
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
                            <span className="font-semibold text-slate-600 text-[11px]">Father Name:</span>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{data.fatherName || "—"}</span>
                          </div>
                          <div className="col-span-12 sm:col-span-5 flex flex-col justify-center p-2.5">
                            <span className="font-semibold text-slate-600 text-[11px]">Father Occupation:</span>
                            <span className="font-medium text-slate-900 text-xs">{data.fatherOccupation || "—"}</span>
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
                            <span className="font-semibold text-slate-600 text-[11px]">Mother Name:</span>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{data.motherName || "—"}</span>
                          </div>
                          <div className="col-span-12 sm:col-span-5 flex flex-col justify-center p-2">
                            <span className="font-semibold text-slate-600 text-[11px]">Mother Occupation:</span>
                            <span className="font-medium text-slate-900 text-xs">{data.motherOccupation || "Homemaker"}</span>
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
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-slate-900">
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
                              <span className="font-semibold mr-1.5 text-slate-600">{idx + 1}.</span>
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
                          <div className="p-2 bg-slate-50/50 flex items-center justify-between">
                            <span className="font-alkanz font-bold text-xs text-[#1c1c1c] dir-rtl" dir="rtl">
                              الامتحانات الأخرى:
                            </span>
                            <span className="font-bold text-xs text-slate-900">{data.otherExams}</span>
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
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-slate-900">
                    SELF – ASSESSMENT
                  </div>
                  <div className="border-x border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 text-xs">
                    {/* Strengths */}
                    {editedStrengths.length > 0 && (
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50 text-emerald-900">
                          My Strengths
                        </div>
                        <div className="p-2.5 flex flex-col gap-1.5">
                          {editedStrengths.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                              <span className="font-bold text-emerald-700">{idx + 1}.</span>
                              <span className="text-slate-900">{item}</span>
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
                              <span className="text-slate-900">{item}</span>
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
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-slate-900">
                    About Myself (Hobbies, Interests &amp; Skills)
                  </div>
                  <div className="border-x border-b border-slate-800 p-3 text-xs leading-relaxed text-slate-900 font-medium">
                    {data.aboutMyself}
                  </div>
                </div>
              )}

              {/* ── 5B. TALABAT REFLECTIONS & PASSIONS (Darajah Rabea Prompts) ── */}
              {(isFilled(data.reallyGoodAt) || isFilled(data.loveToStudy) || isFilled(data.loveForFun)) && (
                <div className="mb-4">
                  <div className="bg-[#fef3c7] border border-slate-800 text-center py-1 font-bold text-xs uppercase tracking-wider text-amber-950">
                    Personal Reflections &amp; Passions (Darajah Rabea)
                  </div>
                  <div className="border-x border-b border-slate-800 p-3 text-xs space-y-2 bg-amber-50/20">
                    {isFilled(data.reallyGoodAt) && (
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">1. I am really Good at ...</span>
                        <p className="text-slate-900 italic pl-2 border-l-2 border-emerald-600 mt-0.5">{data.reallyGoodAt}</p>
                      </div>
                    )}
                    {isFilled(data.loveToStudy) && (
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">2. I love to study about ... because ...</span>
                        <p className="text-slate-900 italic pl-2 border-l-2 border-indigo-600 mt-0.5">{data.loveToStudy}</p>
                      </div>
                    )}
                    {isFilled(data.loveForFun) && (
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">3. I really love to ..... For Fun</span>
                        <p className="text-slate-900 italic pl-2 border-l-2 border-purple-600 mt-0.5">{data.loveForFun}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 6. ADMINISTRATION & FACULTY EVALUATION (Only if reviewed/edited) ── */}
              {hasFacultyEvaluation && (
                <div className="mb-4 mt-6">
                  <div className="bg-[#ddebf7] border border-slate-800 text-center py-1.5 font-bold text-xs uppercase tracking-wider text-slate-900">
                    ADMINISTRATION &amp; DARSE BURHANI MASUL COLLECTIVE EVALUATION
                  </div>

                  {/* 4 Ratings Table (Only if ratings assigned) */}
                  {hasRatings && (
                    <div className="border-x border-b border-slate-800 grid grid-cols-4 divide-x divide-slate-800 text-center">
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-slate-900">Behaviour</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-emerald-800">
                          {data.behaviourRating ? `${data.behaviourRating} / 5` : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-slate-900">Communication</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-emerald-800">
                          {data.communicationRating ? `${data.communicationRating} / 5` : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-slate-900">Dedication</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-emerald-800">
                          {data.dedicationRating ? `${data.dedicationRating} / 5` : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="border-b border-slate-800 p-1 font-extrabold text-xs text-slate-900">Discipline</div>
                        <div className="p-1 font-bold text-[10px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                        <div className="p-1.5 font-extrabold text-base text-emerald-800">
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
                              <span className="text-[9px] text-slate-500 font-sans mt-0.5">{cat.labelEn}</span>
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
            <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
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
            height: 278mm !important;
            max-height: 278mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
