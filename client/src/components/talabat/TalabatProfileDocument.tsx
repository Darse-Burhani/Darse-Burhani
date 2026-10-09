import React from "react";
import { Printer, CheckCircle2, Award, Star } from "lucide-react";

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
}

export function TalabatProfileDocument({ data, showPrintButton = true }: Props) {
  const handlePrint = () => {
    window.print();
  };

  const strengths = Array.isArray(data.strengths) && data.strengths.length > 0 ? data.strengths : ["", "", ""];
  const weaknesses = Array.isArray(data.weaknesses) && data.weaknesses.length > 0 ? data.weaknesses : ["", "", ""];

  // Helper to detect if text is predominantly Arabic/Lisan al-Dawat
  const isArabicText = (text?: string | null) => {
    if (!text) return false;
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    return arabicRegex.test(text);
  };

  return (
    <div className="talabat-profile-root w-full flex flex-col items-center">
      {showPrintButton && (
        <div className="no-print mb-6 flex items-center justify-end w-full max-w-[210mm] gap-3">
          <button
            onClick={handlePrint}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-md font-medium text-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print / Export Official PDF
          </button>
        </div>
      )}

      {/* ── Document Container ── */}
      <div className="printable-document flex flex-col gap-10 w-full max-w-[210mm]">
        {/* ════════════════════════════════════════════════════════════
            PAGE 1
        ════════════════════════════════════════════════════════════ */}
        <div className="doc-page bg-white text-slate-900 border border-slate-300 shadow-xl rounded-sm p-8 sm:p-10 min-h-[297mm] flex flex-col justify-between relative box-border">
          <div>
            {/* ── Top Header ── */}
            <div className="flex items-start justify-between border-b pb-4 mb-5 relative">
              {/* Top Left: Logo / Emblem */}
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

              {/* Center: Institution & Profile Title */}
              <div className="text-center flex-1 px-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-[#b31b1b] font-serif uppercase">
                  Darse Burhani
                </h1>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#961212] tracking-wider mt-1">
                  TALABAT PROFILE – {data.year || "1447 H"}
                </h2>
              </div>

              {/* Top Right: Further Education Banner & Page Number */}
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="block text-xs font-bold text-[#b31b1b]">Further</span>
                    <span className="block text-xs font-bold text-[#b31b1b]">Education:</span>
                  </div>
                  <span className="text-base font-bold text-[#b31b1b] font-alkanz dir-rtl" dir="rtl">
                    توجيه الطالب
                  </span>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded px-2 py-0.5">
                  1
                </div>
              </div>
            </div>

            {/* ── Section 1: PERSONAL DETAILS ── */}
            <div className="mb-5">
              <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                PERSONAL DETAILS
              </div>
              <div className="border-x border-b border-slate-800 flex flex-row">
                {/* Photo Cell */}
                <div className="w-28 sm:w-32 min-h-[120px] p-2 border-r border-slate-800 flex items-center justify-center bg-slate-50 shrink-0">
                  {data.studentPhotoUrl ? (
                    <img
                      src={data.studentPhotoUrl}
                      alt={data.name || "Student"}
                      className="w-full h-28 object-cover rounded shadow-sm border border-slate-200"
                    />
                  ) : (
                    <div className="w-full h-28 bg-slate-200 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-1">
                      <span>Student</span>
                      <span>Photo</span>
                    </div>
                  )}
                </div>

                {/* Info Fields Grid */}
                <div className="flex-1 grid grid-cols-12 text-xs divide-y divide-slate-800">
                  {/* Name (Full Width) */}
                  <div className="col-span-12 flex items-center">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Name:</div>
                    <div className="flex-1 p-1.5 font-bold text-slate-900">{data.name || "—"}</div>
                  </div>

                  {/* ITS & ID No */}
                  <div className="col-span-12 sm:col-span-6 flex items-center border-r-0 sm:border-r border-slate-800">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">ITS No.:</div>
                    <div className="flex-1 p-1.5 font-bold">{data.itsNo || "—"}</div>
                  </div>
                  <div className="col-span-12 sm:col-span-6 flex items-center">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">ID No.:</div>
                    <div className="flex-1 p-1.5 font-bold">{data.idNo || "—"}</div>
                  </div>

                  {/* Jamaat & Vatan */}
                  <div className="col-span-12 sm:col-span-6 flex items-center border-r-0 sm:border-r border-slate-800">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Jamaat:</div>
                    <div className="flex-1 p-1.5">{data.jamaat || "—"}</div>
                  </div>
                  <div className="col-span-12 sm:col-span-6 flex items-center">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Vatan:</div>
                    <div className="flex-1 p-1.5">{data.vatan || "—"}</div>
                  </div>

                  {/* Nationality & DOB (Age) */}
                  <div className="col-span-12 sm:col-span-6 flex items-center border-r-0 sm:border-r border-slate-800">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">Nationality:</div>
                    <div className="flex-1 p-1.5">{data.nationality || "Indian"}</div>
                  </div>
                  <div className="col-span-12 sm:col-span-6 flex items-center">
                    <div className="w-24 sm:w-28 font-semibold p-1.5 bg-slate-50 border-r border-slate-800">DOB (Age):</div>
                    <div className="flex-1 p-1.5 font-bold">
                      {data.age ? `${data.dob ? data.dob + " (" : ""}${data.age}${data.dob ? ")" : " Years"}` : data.dob || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 2: FAMILY DETAILS ── */}
            <div className="mb-5">
              <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                FAMILY DETAILS
              </div>
              <div className="border-x border-b border-slate-800 flex flex-col divide-y divide-slate-800">
                {/* Father Row */}
                <div className="flex flex-row items-center">
                  <div className="w-28 sm:w-32 h-24 p-1.5 border-r border-slate-800 flex items-center justify-center bg-slate-50 shrink-0">
                    {data.fatherPhotoUrl ? (
                      <img
                        src={data.fatherPhotoUrl}
                        alt="Father"
                        className="w-full h-full object-cover rounded shadow-sm border border-slate-200"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-1">
                        <span>Father</span>
                        <span>Photo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-12 text-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="col-span-12 sm:col-span-7 flex flex-col justify-center p-2">
                      <span className="font-semibold text-slate-600 text-[11px]">Father Name:</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{data.fatherName || "—"}</span>
                    </div>
                    <div className="col-span-12 sm:col-span-5 flex flex-col justify-center p-2">
                      <span className="font-semibold text-slate-600 text-[11px]">Father Occupation:</span>
                      <span className="font-semibold text-slate-900 text-xs">{data.fatherOccupation || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Mother Row */}
                <div className="flex flex-row items-center">
                  <div className="w-28 sm:w-32 h-24 p-1.5 border-r border-slate-800 flex items-center justify-center bg-slate-50 shrink-0">
                    {data.motherPhotoUrl ? (
                      <img
                        src={data.motherPhotoUrl}
                        alt="Mother"
                        className="w-full h-full object-cover rounded shadow-sm border border-slate-200"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center text-slate-400 text-[10px] text-center p-1">
                        <span>Mother</span>
                        <span>Photo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-12 text-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                    <div className="col-span-12 sm:col-span-7 flex flex-col justify-center p-2">
                      <span className="font-semibold text-slate-600 text-[11px]">Mother Name:</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{data.motherName || "—"}</span>
                    </div>
                    <div className="col-span-12 sm:col-span-5 flex flex-col justify-center p-2">
                      <span className="font-semibold text-slate-600 text-[11px]">Mother Occupation:</span>
                      <span className="font-semibold text-slate-900 text-xs">{data.motherOccupation || "Homemaker"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 3: ACADEMICS DETAILS ── */}
            <div className="mb-5">
              <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                ACADEMICS DETAILS
              </div>
              <div className="border-x border-b border-slate-800 grid grid-cols-12 text-xs divide-x divide-slate-800">
                {/* 1. Exam Results Table (Col 1-3) */}
                <div className="col-span-3 flex flex-col">
                  <div className="border-b border-slate-800 p-1 text-center font-bold font-alkanz dir-rtl bg-slate-50 text-xs" dir="rtl">
                    نتائج الامتحان السنوي
                  </div>
                  <div className="grid grid-cols-2 text-center divide-x divide-slate-800 divide-y divide-slate-800 flex-1">
                    <div className="p-1 font-medium bg-slate-50">1444 H</div>
                    <div className="p-1 font-bold">{data.result1444 || "—"}</div>
                    <div className="p-1 font-medium bg-slate-50">1445 H</div>
                    <div className="p-1 font-bold">{data.result1445 || "—"}</div>
                    <div className="p-1 font-medium bg-slate-50">1446 H</div>
                    <div className="p-1 font-bold">{data.result1446 || "—"}</div>
                    <div className="p-1 font-medium bg-slate-50">1447 H</div>
                    <div className="p-1 font-bold">{data.result1447 || "—"}</div>
                  </div>
                </div>

                {/* 2. Hifz Results Table (Col 4-5) */}
                <div className="col-span-2 flex flex-col">
                  <div className="border-b border-slate-800 p-1 text-center font-bold font-alkanz dir-rtl bg-slate-50 text-xs" dir="rtl">
                    نتائج الحفظ
                  </div>
                  <div className="grid grid-cols-2 text-center divide-x divide-slate-800 divide-y divide-slate-800 flex-1">
                    <div className="p-1 font-medium bg-slate-50 flex items-center justify-center">Hifz</div>
                    <div className="p-1 font-bold flex items-center justify-center">{data.hifzYear || "—"}</div>
                    <div className="p-1 font-medium bg-slate-50 flex items-center justify-center">Tabaqa</div>
                    <div className="p-1 font-bold font-alkanz flex items-center justify-center text-xs" dir="rtl">
                      {data.hifzTabaqa || "—"}
                    </div>
                  </div>
                </div>

                {/* 3. Courses (Col 6-8) */}
                <div className="col-span-3 flex flex-col">
                  <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50">Courses</div>
                  <div className="flex flex-col divide-y divide-slate-800 flex-1">
                    <div className="flex items-center px-1.5 py-1 text-[11px]">
                      <span className="font-semibold mr-1">1.</span>
                      <span className="font-medium truncate">{data.course1 || "—"}</span>
                    </div>
                    <div className="flex items-center px-1.5 py-1 text-[11px]">
                      <span className="font-semibold mr-1">2.</span>
                      <span className="font-medium truncate">{data.course2 || "—"}</span>
                    </div>
                    <div className="flex items-center px-1.5 py-1 text-[11px]">
                      <span className="font-semibold mr-1">3.</span>
                      <span className="font-medium truncate">{data.course3 || "—"}</span>
                    </div>
                    <div className="flex items-center px-1.5 py-1 text-[11px]">
                      <span className="font-semibold mr-1">4.</span>
                      <span className="font-medium truncate">{data.course4 || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Activities & Other Exams (Col 9-12) */}
                <div className="col-span-4 flex flex-col justify-between">
                  <div className="border-b border-slate-800 p-1 text-center font-bold font-alkanz dir-rtl bg-slate-50 text-[11px]" dir="rtl">
                    الاشتراك في البرامج العلمية والثقافية
                  </div>
                  <div className="p-2 text-[11px] leading-relaxed font-alkanz text-right flex-1" dir="rtl">
                    {data.activities || "—"}
                  </div>
                  <div className="border-t border-slate-800 grid grid-cols-12 text-center divide-x divide-slate-800 bg-slate-50">
                    <div className="col-span-6 p-1 font-alkanz font-bold text-[10px] sm:text-xs" dir="rtl">
                      الامتحانات الأخرى
                    </div>
                    <div className="col-span-6 p-1 font-bold text-[10px] sm:text-xs bg-white">
                      {data.otherExams || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 4: SELF - ASSESSMENT ── */}
            <div>
              <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                SELF – ASSESSMENT
              </div>
              <div className="border-x border-b border-slate-800 grid grid-cols-2 divide-x divide-slate-800 text-xs">
                {/* Strengths */}
                <div className="flex flex-col">
                  <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50">My Strengths</div>
                  <div className="p-2 flex flex-col gap-1.5 min-h-[90px]">
                    {strengths.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="font-bold text-slate-700">{idx + 1}.</span>
                        <span className="text-slate-900">{item || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weaknesses */}
                <div className="flex flex-col">
                  <div className="border-b border-slate-800 p-1 text-center font-bold bg-slate-50">My Weaknesses</div>
                  <div className="p-2 flex flex-col gap-1.5 min-h-[90px]">
                    {weaknesses.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-900">{item || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            PAGE 2 (EXACT REPLICA OF INSTITUTIONAL EVALUATION)
        ════════════════════════════════════════════════════════════ */}
        <div className="doc-page bg-white text-slate-900 border border-slate-300 shadow-xl rounded-sm p-8 sm:p-10 min-h-[297mm] flex flex-col justify-between relative box-border">
          <div>
            {/* ── Top Header ── */}
            <div className="flex items-start justify-between border-b pb-4 mb-5 relative">
              {/* Top Left: Logo / Emblem */}
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

              {/* Center: Institution & Profile Title */}
              <div className="text-center flex-1 px-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-[#b31b1b] font-serif uppercase">
                  Darse Burhani
                </h1>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#961212] tracking-wider mt-1">
                  TALABAT PROFILE – {data.year || "1447 H"}
                </h2>
              </div>

              {/* Top Right: Page Number */}
              <div className="text-right flex flex-col items-end justify-start">
                <div className="text-xs font-semibold text-slate-600 border border-slate-300 rounded px-2 py-0.5">
                  2
                </div>
              </div>
            </div>

            {/* ── Section 5: ABOUT MYSELF ── */}
            <div className="mb-5">
              <div className="bg-[#ddebf7] border border-slate-800 text-center py-1 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                About Myself
              </div>
              <div className="border-x border-b border-slate-800 p-3 min-h-[60px] text-xs leading-relaxed text-slate-900 font-medium">
                {data.aboutMyself || "Hobbies - Reading Books, Learning new things. Interest - Computers, Dawat ni akhbar. Skills - Good in computers, can adapt to work with everyone."}
              </div>
            </div>

            {/* ── Section 6: DARAJAH MASUL & DARSE BURHANI MASUL COLLECTIVE REMARKS ── */}
            <div className="mb-4">
              <div className="bg-[#ddebf7] border border-slate-800 text-center py-1.5 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                DARAJAH MASUL &amp; DARSE BURHANI MASUL COLLECTIVE REMARKS
              </div>

              {/* 4 Ratings Table */}
              <div className="border-x border-b border-slate-800 grid grid-cols-4 divide-x divide-slate-800 text-center">
                {/* 1. Behaviour */}
                <div className="flex flex-col">
                  <div className="border-b border-slate-800 p-1 font-bold text-xs bg-slate-50">Skills/Traits</div>
                  <div className="border-b border-slate-800 p-1 font-extrabold text-xs sm:text-sm text-slate-900">Behaviour</div>
                  <div className="p-1 text-[9px] text-slate-600 border-b border-slate-800 min-h-[32px] flex items-center justify-center leading-tight">
                    [Cooperates with faculty and peers, maintains a positive attitude]
                  </div>
                  <div className="p-1 font-bold text-[11px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                  <div className="p-1.5 font-extrabold text-base sm:text-lg text-emerald-800 flex items-center justify-center">
                    {data.behaviourRating || 5}
                  </div>
                </div>

                {/* 2. Communication */}
                <div className="flex flex-col">
                  <div className="border-b border-slate-800 p-1 font-bold text-xs bg-slate-50">Skills/Traits</div>
                  <div className="border-b border-slate-800 p-1 font-extrabold text-xs sm:text-sm text-slate-900">Communication</div>
                  <div className="p-1 text-[9px] text-slate-600 border-b border-slate-800 min-h-[32px] flex items-center justify-center leading-tight">
                    [Conveys ideas effectively, fosters clear and polite conversations]
                  </div>
                  <div className="p-1 font-bold text-[11px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                  <div className="p-1.5 font-extrabold text-base sm:text-lg text-emerald-800 flex items-center justify-center">
                    {data.communicationRating || 4}
                  </div>
                </div>

                {/* 3. Dedication */}
                <div className="flex flex-col">
                  <div className="border-b border-slate-800 p-1 font-bold text-xs bg-slate-50">Skills/Traits</div>
                  <div className="border-b border-slate-800 p-1 font-extrabold text-xs sm:text-sm text-slate-900">Dedication</div>
                  <div className="p-1 text-[9px] text-slate-600 border-b border-slate-800 min-h-[32px] flex items-center justify-center leading-tight">
                    [Demonstrates strong commitment to tasks, classes, or assigned work]
                  </div>
                  <div className="p-1 font-bold text-[11px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                  <div className="p-1.5 font-extrabold text-base sm:text-lg text-emerald-800 flex items-center justify-center">
                    {data.dedicationRating || 5}
                  </div>
                </div>

                {/* 4. Discipline */}
                <div className="flex flex-col">
                  <div className="border-b border-slate-800 p-1 font-bold text-xs bg-slate-50">Skills/Traits</div>
                  <div className="border-b border-slate-800 p-1 font-extrabold text-xs sm:text-sm text-slate-900">Discipline</div>
                  <div className="p-1 text-[9px] text-slate-600 border-b border-slate-800 min-h-[32px] flex items-center justify-center leading-tight">
                    [Follows and practices rules and punctuality in all activities]
                  </div>
                  <div className="p-1 font-bold text-[11px] bg-slate-50 border-b border-slate-800">Rating (1-5)</div>
                  <div className="p-1.5 font-extrabold text-base sm:text-lg text-emerald-800 flex items-center justify-center">
                    {data.disciplineRating || 5}
                  </div>
                </div>
              </div>

              {/* ── 10 Granular Category Rows Table ── */}
              <div className="border-x border-b border-slate-800 mt-[-1px]">
                <div className="bg-slate-50 border-b border-slate-800 p-1 text-center font-alkanz font-bold text-xs text-slate-800" dir="rtl">
                  ملاحظات عامة:
                </div>

                <div className="divide-y divide-slate-800 text-xs">
                  {/* 1. المسؤول عن الدرجة */}
                  <div className="grid grid-cols-12 min-h-[44px]">
                    <div
                      className={`col-span-10 p-2.5 leading-relaxed text-right border-r border-slate-800 flex items-center justify-end ${
                        isArabicText(data.remarksMasool || data.masoolRemarks) ? "font-alkanz text-[13px] dir-rtl" : "text-xs"
                      }`}
                      dir={isArabicText(data.remarksMasool || data.masoolRemarks) ? "rtl" : "ltr"}
                    >
                      {data.remarksMasool || data.masoolRemarks || "طالب ما بهتر معاشرة ني خوبي چھے، برامج علمية ما ساهمة فعالة كيدي چھے، بعض برامج ما leading كيدي چھے، ناهنا طلبة ني مدد كرواني عادة چھے، حلقة ما attentive رھے چھے، اخلاقي جانب گھني بهتر چھے."}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        المسؤول عن الدرجة
                      </span>
                    </div>
                  </div>

                  {/* 2. عن التحفيظ */}
                  <div className="grid grid-cols-12 min-h-[38px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksTahfeez) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-center text-center text-xs"
                      }`}
                      dir={isArabicText(data.remarksTahfeez) ? "rtl" : "ltr"}
                    >
                      {data.remarksTahfeez || "He has good character and makes sincere efforts for Tahfeez-ul-Qur'an. He is consistent in Hifz and serves with enthusiasm."}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        عن التحفيظ
                      </span>
                    </div>
                  </div>

                  {/* 3. عن التعليم */}
                  <div className="grid grid-cols-12 min-h-[50px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed text-right border-r border-slate-800 flex items-center justify-end ${
                        isArabicText(data.remarksTaleem) ? "font-alkanz text-[13px] dir-rtl" : "text-xs"
                      }`}
                      dir={isArabicText(data.remarksTaleem) ? "rtl" : "ltr"}
                    >
                      {data.remarksTaleem || "طالب علم نو تعليمي مستوى ممتاز چھے، حلقة ما برابر دهيان سي پرھے چھے، سوالو كرے چھے انے توجيه مطابق ذمة داري سي عمل كرے چھے، تمام برامج علمية ما ساهمة فعالة كيدي چھے، معرض علمي، روضة الأدب الفاطمي انے مسابقة حفظ القصائد الشريفة ما يوتانا حزب ني بهتر قيادة كيدي چھے. أ تمام خوبيو نے اهنو حسن الخلق انے حسن المعاشرة مزين كرے چھے."}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        عن التعليم
                      </span>
                    </div>
                  </div>

                  {/* 4. عن التأديب والرياضة والمنازل البرهانية */}
                  <div className="grid grid-cols-12 min-h-[36px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksTadeeb) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-center text-center text-xs"
                      }`}
                      dir={isArabicText(data.remarksTadeeb) ? "rtl" : "ltr"}
                    >
                      {data.remarksTadeeb || "focused person in every aspects and always follow norms."}
                    </div>
                    <div className="col-span-2 p-1.5 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-[10px] font-bold text-[#b31b1b] leading-tight dir-rtl" dir="rtl">
                        عن التأديب والرياضة والمنازل البرهانية
                      </span>
                    </div>
                  </div>

                  {/* 5. عن التنظيم */}
                  <div className="grid grid-cols-12 min-h-[36px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed text-right border-r border-slate-800 flex items-center justify-end ${
                        isArabicText(data.remarksTanzeem) ? "font-alkanz text-[13px] dir-rtl" : "text-xs"
                      }`}
                      dir={isArabicText(data.remarksTanzeem) ? "rtl" : "ltr"}
                    >
                      {data.remarksTanzeem || "تلاوة الدعاء ، حلقة انے تمام برامج ما مواظبة سي حاضر تھائي چھے آداب الكلام بهتر چھے ."}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        عن التنظيم
                      </span>
                    </div>
                  </div>

                  {/* 6. عن خيمة الرياضة */}
                  <div className="grid grid-cols-12 min-h-[36px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksSports) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-center text-center text-xs"
                      }`}
                      dir={isArabicText(data.remarksSports) ? "rtl" : "ltr"}
                    >
                      {data.remarksSports || "The student has not participated in any sports activities during this academic year."}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        عن خيمة الرياضة
                      </span>
                    </div>
                  </div>

                  {/* 7. المكتبة */}
                  <div className="grid grid-cols-12 min-h-[36px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksMaktabat) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-center text-center text-xs"
                      }`}
                      dir={isArabicText(data.remarksMaktabat) ? "rtl" : "ltr"}
                    >
                      {data.remarksMaktabat || "The student had issued 9 books from the Maktabat and demonstrated consistent library usage throughout the year."}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        المكتبة
                      </span>
                    </div>
                  </div>

                  {/* 8. عن الفن والمهارة */}
                  <div className="grid grid-cols-12 min-h-[36px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksSkills) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-end text-right text-xs"
                      }`}
                      dir={isArabicText(data.remarksSkills) ? "rtl" : "ltr"}
                    >
                      {data.remarksSkills || "IT Skills, Coding Skills"}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        عن الفن والمهارة
                      </span>
                    </div>
                  </div>

                  {/* 9. عن الامتحانات الأخرى */}
                  <div className="grid grid-cols-12 min-h-[36px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksOtherExams) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-end text-right text-xs"
                      }`}
                      dir={isArabicText(data.remarksOtherExams) ? "rtl" : "ltr"}
                    >
                      {data.remarksOtherExams || "10th done From MP BOARD Board 12th not done"}
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">
                        عن الامتحانات الأخرى
                      </span>
                    </div>
                  </div>

                  {/* 10. Recommended Further Studies (Counselling) */}
                  <div className="grid grid-cols-12 min-h-[44px]">
                    <div
                      className={`col-span-10 p-2 leading-relaxed border-r border-slate-800 flex items-center ${
                        isArabicText(data.remarksCounselling) ? "justify-end text-right font-alkanz text-[13px] dir-rtl" : "justify-center text-center text-xs"
                      }`}
                      dir={isArabicText(data.remarksCounselling) ? "rtl" : "ltr"}
                    >
                      {data.remarksCounselling || "A note regarding the student's career counselling is provided below along with the counselor's remarks."}
                    </div>
                    <div className="col-span-2 p-1.5 flex items-center justify-center text-center bg-slate-50/50">
                      <span className="text-[10px] font-bold text-[#b31b1b] leading-tight text-center">
                        Recommended Further Studies (Counselling)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 7: SIBLING DETAILS & COUNSELLING NOTES BOX ── */}
            <div className="border border-slate-800 rounded-sm p-3 bg-white mt-4 min-h-[80px]">
              <div className="text-[11px] font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                {data.counsellingNotes || "Elder Sister (Married)\nYounger Brother\nAbba - Software Engineering\n18 yrs, Ratlam"}
              </div>
            </div>
          </div>
        </div>
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
            margin: 10mm;
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
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: 0 !important;
            min-height: 275mm !important;
            padding: 16mm 10mm !important;
          }
          .doc-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
