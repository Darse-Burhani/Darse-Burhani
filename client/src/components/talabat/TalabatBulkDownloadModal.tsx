"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  FileText,
  Users,
  Check,
  StopCircle,
} from "lucide-react";
import {
  TalabatProfileDocument,
  TalabatProfileData,
} from "@/components/talabat/TalabatProfileDocument";

export interface BulkStudentTarget {
  studentId: string;
  name: string;
  its?: string;
  idNo?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: BulkStudentTarget[];
  onClearSelection?: () => void;
}

export function TalabatBulkDownloadModal({
  isOpen,
  onClose,
  selectedStudents,
  onClearSelection,
}: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStudentName, setCurrentStudentName] = useState("");
  const [currentStage, setCurrentStage] = useState<string>("");
  const [currentProfile, setCurrentProfile] = useState<TalabatProfileData | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const stagingRef = useRef<HTMLDivElement>(null);
  const cancelRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setIsRunning(false);
      setCurrentIndex(0);
      setCurrentStudentName("");
      setCurrentStage("");
      setCurrentProfile(null);
      setProcessedCount(0);
      setFailedCount(0);
      setIsFinished(false);
      setErrorDetails(null);
      cancelRequestedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalStudents = selectedStudents.length;
  const progressPct =
    totalStudents > 0
      ? Math.round(((processedCount + failedCount) / totalStudents) * 100)
      : 0;

  const handleCancel = () => {
    cancelRequestedRef.current = true;
    setCurrentStage("Cancelling process...");
  };

  const startBatchDownload = async () => {
    if (selectedStudents.length === 0 || isRunning) return;

    setIsRunning(true);
    setIsFinished(false);
    setErrorDetails(null);
    setProcessedCount(0);
    setFailedCount(0);
    cancelRequestedRef.current = false;

    try {
      setCurrentStage("Initializing high-resolution PDF engine...");
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
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
      let totalPagesAdded = 0;

      for (let i = 0; i < selectedStudents.length; i++) {
        if (cancelRequestedRef.current) {
          break;
        }

        const student = selectedStudents[i];
        setCurrentIndex(i);
        setCurrentStudentName(student.name);
        setCurrentStage(`Fetching profile for ${student.name}...`);

        try {
          // 1. Fetch student 1447 profile
          const res = await fetch(`/api/talabat-profile/view/${student.studentId}`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} fetching profile`);
          }
          const resData = await res.json();
          if (!resData.success || !resData.profile) {
            throw new Error(resData.error || "Profile data missing");
          }

          const info = resData.studentInfo || {};
          const pData: TalabatProfileData = {
            ...resData.profile,
            name: resData.profile.name || info.name || student.name,
            itsNo: resData.profile.itsNo || info.its || student.its,
            studentPhotoUrl: resData.profile.studentPhotoUrl || info.avatarUrl,
            motherName: resData.profile.motherName || info.motherName,
            fatherName: resData.profile.fatherName || info.fatherName,
            fatherOccupation: resData.profile.fatherOccupation || info.fatherOccupation,
            standard: resData.profile.standard || info.standard || info.grade,
            grade: resData.profile.grade || info.grade,
            section: resData.profile.section || info.section,
            studentStatus: resData.profile.studentStatus || info.studentStatus,
            admissionYear: resData.profile.admissionYear || info.admissionYear,
            currentYear: resData.profile.currentYear || info.currentYear,
            age: resData.profile.age || info.age,
            watan: resData.profile.vatan || resData.profile.watan || info.watan,
            residentCity: resData.profile.jamaat || resData.profile.residentCity || info.residentCity,
            address: resData.profile.address || info.address,
            mobileNumber: resData.profile.mobileNumber || info.mobileNumber,
            email: resData.profile.email || info.email,
            externalSchooling: resData.profile.externalSchooling || info.externalSchooling,
            reallyGoodAt: resData.profile.reallyGoodAt || info.reallyGoodAt,
            loveToStudy: resData.profile.loveToStudy || info.loveToStudy,
            loveForFun: resData.profile.loveForFun || info.loveForFun,
            knowingMyself: resData.knowingMyself || resData.profile?.knowingMyself || null,
          };

          // 2. Mount student in hidden staging container
          setCurrentProfile(pData);
          setCurrentStage(`Rendering A4 layout for ${student.name}...`);

          // Allow React to commit and paint the DOM
          await new Promise((resolve) => setTimeout(resolve, 150));

          if (!stagingRef.current) {
            throw new Error("Staging container not available");
          }

          // 3. Locate pages inside staging
          const pageEls = Array.from(
            stagingRef.current.querySelectorAll<HTMLElement>(".doc-page")
          );
          const targets = pageEls.length > 0 ? pageEls : [stagingRef.current];

          // 4. Preload and decode images
          await Promise.all(
            targets.flatMap((el) =>
              Array.from(el.querySelectorAll("img")).map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise<void>((r) => {
                      img.addEventListener("load", () => r(), { once: true });
                      img.addEventListener("error", () => r(), { once: true });
                      setTimeout(r, 2500);
                    })
              )
            )
          );

          // 5. Render canvas for each page
          for (let pIdx = 0; pIdx < targets.length; pIdx++) {
            if (cancelRequestedRef.current) break;
            setCurrentStage(`Capturing Page ${pIdx + 1} of 2 for ${student.name}...`);

            const targetEl = targets[pIdx];
            const canvas = await html2canvas(targetEl, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#ffffff",
              logging: false,
              imageTimeout: 6000,
              onclone: (clonedDoc) => {
                clonedDoc.documentElement.classList.remove("dark");
                clonedDoc.documentElement.setAttribute("data-theme", "light");
                clonedDoc.body.classList.remove("dark");
                clonedDoc.body.style.background = "#ffffff";
              },
            });

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

            if (totalPagesAdded > 0) {
              pdf.addPage("a4", "p");
            }
            pdf.addImage(
              canvas.toDataURL("image/jpeg", 0.94),
              "JPEG",
              posX,
              posY,
              imgW,
              imgH,
              undefined,
              "FAST"
            );
            totalPagesAdded++;
          }

          setProcessedCount((prev) => prev + 1);
        } catch (studentErr: any) {
          console.error(`Failed to process student ${student.name}:`, studentErr);
          setFailedCount((prev) => prev + 1);
        }
      }

      // Cleanup current staging profile
      setCurrentProfile(null);

      if (cancelRequestedRef.current) {
        setCurrentStage("Bulk export was cancelled.");
        setIsRunning(false);
        return;
      }

      if (totalPagesAdded === 0) {
        throw new Error("No pages could be rendered. Please check network and profile availability.");
      }

      // 6. Save combined PDF
      setCurrentStage("Compressing and downloading PDF file...");
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename =
        selectedStudents.length === 1
          ? `${(selectedStudents[0].name || "talabat-profile").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-1447H-profile.pdf`
          : `Talabat_Profiles_Batch_${selectedStudents.length}_Students_${timestamp}.pdf`;

      pdf.save(filename);
      setIsFinished(true);
      setCurrentStage(`Successfully generated ${totalPagesAdded} pages for ${processedCount} students!`);

      if (onClearSelection) {
        onClearSelection();
      }
    } catch (err: any) {
      console.error("Bulk PDF export error:", err);
      setErrorDetails(err.message || "An unexpected error occurred during batch export.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      {/* ── Offscreen Staging Container for High-Resolution PDF Capture ── */}
      <div
        ref={stagingRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-99999px",
          top: 0,
          width: "210mm",
          minHeight: "297mm",
          background: "#ffffff",
          zIndex: -9999,
          pointerEvents: "none",
        }}
      >
        {currentProfile && (
          <div className="printable-document">
            <TalabatProfileDocument
              data={currentProfile}
              showPrintButton={false}
              initialLayout="a4-single"
            />
          </div>
        )}
      </div>

      {/* ── Bulk Download Modal ── */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-[#1c1c1c] to-slate-900 text-white p-5 flex items-center justify-between border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">
                  Bulk Download Talabat Profiles
                </h3>
                <div className="text-xs text-amber-300 font-medium">
                  Yearly Profile – توجيه الطالب (1447 H)
                </div>
              </div>
            </div>
            {!isRunning && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-5">
            {/* Batch Info Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Selected Cohort</div>
                  <div className="text-sm font-bold text-slate-900">
                    {totalStudents} {totalStudents === 1 ? "Student" : "Students"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 font-medium">Expected Output</div>
                <div className="text-sm font-bold text-amber-600">
                  {totalStudents * 2} Pages (A4 Standard)
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorDetails && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold">Export Error: </span>
                  {errorDetails}
                </div>
              </div>
            )}

            {/* Progress Display */}
            {isRunning && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Processing: {currentStudentName || "Starting..."}</span>
                  </span>
                  <span className="text-amber-600 font-bold">{progressPct}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="text-xs text-slate-500 italic truncate">
                  {currentStage}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Student {Math.min(currentIndex + 1, totalStudents)} of {totalStudents}</span>
                  <span>{processedCount} succeeded{failedCount > 0 ? ` • ${failedCount} skipped` : ""}</span>
                </div>
              </div>
            )}

            {/* Finished State */}
            {isFinished && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-emerald-950">
                    PDF Download Complete!
                  </div>
                  <div className="text-emerald-700 mt-0.5">
                    {processedCount} student {processedCount === 1 ? "profile" : "profiles"} ({processedCount * 2} pages) compiled into an official A4 batch document.
                  </div>
                </div>
              </div>
            )}

            {/* Student Preview List (first 5) */}
            {!isRunning && !isFinished && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  Students included in this batch:
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                  {selectedStudents.slice(0, 8).map((s, idx) => (
                    <div
                      key={s.studentId}
                      className="px-3 py-2 text-xs flex items-center justify-between text-slate-700"
                    >
                      <span className="font-medium truncate max-w-[240px]">
                        {idx + 1}. {s.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {s.its || s.idNo || ""}
                      </span>
                    </div>
                  ))}
                  {selectedStudents.length > 8 && (
                    <div className="px-3 py-2 text-xs text-slate-400 text-center font-medium">
                      + {selectedStudents.length - 8} more students
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              {isRunning ? (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <StopCircle className="w-4 h-4 text-rose-600" />
                  <span>Cancel Export</span>
                </button>
              ) : isFinished ? (
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Done</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startBatchDownload}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Combined Batch PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

