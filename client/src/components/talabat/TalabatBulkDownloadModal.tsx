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
  Archive,
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

/** Slugify a student name for use in a filename */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Wait for the DOM to paint the staging container fully */
function waitFrames(n = 3): Promise<void> {
  return new Promise((resolve) => {
    let count = 0;
    function raf() {
      if (++count >= n) resolve();
      else requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  });
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
  const [failedNames, setFailedNames] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [mode, setMode] = useState<"individual-zip" | "combined">("individual-zip");

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
      setFailedNames([]);
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
    setCurrentStage("Cancelling...");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  CORE RENDER HELPER: captures all .doc-page elements in the staging area
  //  and builds a 2-page jsPDF for one student.  Returns the jsPDF instance.
  // ─────────────────────────────────────────────────────────────────────────────
  const renderStudentPdf = async (
    html2canvas: any,
    jsPDF: any,
    pData: TalabatProfileData,
    studentName: string
  ): Promise<{ pdf: any; pageCount: number }> => {
    const pageW = 210;
    const pageH = 297;
    const margin = 4; // mm each side
    const printW = pageW - margin * 2;
    const printH = pageH - margin * 2;

    // Mount in staging area
    setCurrentProfile(pData);
    setCurrentStage(`Rendering layout for ${studentName}…`);

    // Let React commit + browser paint (3 animation frames + extra delay)
    await waitFrames(4);
    await new Promise((r) => setTimeout(r, 300));

    if (!stagingRef.current) throw new Error("Staging container not ready");

    // Find the two A4 pages
    const pageEls = Array.from(
      stagingRef.current.querySelectorAll<HTMLElement>(".doc-page")
    );
    const targets = pageEls.length > 0 ? pageEls : [stagingRef.current];

    // Wait for all images
    await Promise.all([
      document.fonts?.ready?.catch(() => {}),
      ...targets.flatMap((el) =>
        Array.from(el.querySelectorAll("img")).map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  img.addEventListener("load", () => r(), { once: true });
                  img.addEventListener("error", () => r(), { once: true });
                  setTimeout(r, 3000);
                })
        )
      ),
    ]);

    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    let pageCount = 0;

    for (let pIdx = 0; pIdx < targets.length; pIdx++) {
      if (cancelRequestedRef.current) break;
      setCurrentStage(`Capturing page ${pIdx + 1}/${targets.length} for ${studentName}…`);

      const el = targets[pIdx];

      // Force exact A4 size on the element before capture
      const origWidth = el.style.width;
      const origHeight = el.style.height;
      el.style.width = "794px"; // 210mm @96dpi ≈ 794px
      el.style.height = "1123px"; // 297mm @96dpi ≈ 1123px
      el.style.overflow = "visible";

      await waitFrames(2);

      const canvas = await html2canvas(el, {
        scale: 2.5, // higher fidelity
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 8000,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc: Document) => {
          clonedDoc.documentElement.classList.remove("dark");
          clonedDoc.documentElement.setAttribute("data-theme", "light");
          clonedDoc.body.style.background = "#ffffff";
          clonedDoc.body.classList.remove("dark");

          // Fix Arabic text rendering
          const arabicEls = clonedDoc.querySelectorAll(
            ".arabic-calligraphy, .font-alkanz, [dir='rtl']"
          );
          arabicEls.forEach((el) => {
            const h = el as HTMLElement;
            h.style.letterSpacing = "0px";
            h.style.wordSpacing = "normal";
            h.style.direction = "rtl";
            h.style.unicodeBidi = "embed";
            h.style.fontFamily =
              "'Al-Kanz', 'AL-KANZ', 'Al Kanz', 'alkanz', 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', 'Scheherazade New', 'Segoe UI', Tahoma, Arial, sans-serif";
          });

          // Remove line-clamp from ALL elements (the main fix for invisible text)
          const allEls = clonedDoc.querySelectorAll("*");
          allEls.forEach((el) => {
            const h = el as HTMLElement;
            if (h.style) {
              h.style.webkitLineClamp = "unset";
              h.style.overflow = "visible";
              // @ts-ignore
              h.style["-webkit-box-orient"] = "unset";
            }
          });
        },
      });

      // Restore original dimensions
      el.style.width = origWidth;
      el.style.height = origHeight;
      el.style.overflow = "";

      // Fit canvas into A4 page (fill the full printable area)
      const canvasAR = canvas.width / canvas.height;
      const pageAR = printW / printH;

      let imgW: number;
      let imgH: number;
      if (canvasAR > pageAR) {
        imgW = printW;
        imgH = printW / canvasAR;
      } else {
        imgH = printH;
        imgW = printH * canvasAR;
      }

      const posX = margin + (printW - imgW) / 2;
      const posY = margin + (printH - imgH) / 2;

      if (pageCount > 0) pdf.addPage("a4", "p");

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        posX,
        posY,
        imgW,
        imgH,
        undefined,
        "FAST"
      );
      pageCount++;
    }

    return { pdf, pageCount };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  DOWNLOAD MODE A: Individual PDFs zipped together via JSZip
  // ─────────────────────────────────────────────────────────────────────────────
  const startIndividualZipDownload = async () => {
    if (selectedStudents.length === 0 || isRunning) return;

    setIsRunning(true);
    setIsFinished(false);
    setErrorDetails(null);
    setProcessedCount(0);
    setFailedCount(0);
    setFailedNames([]);
    cancelRequestedRef.current = false;

    try {
      setCurrentStage("Loading PDF + ZIP engine…");
      const [
        { default: html2canvas },
        { default: jsPDF },
        { default: JSZip },
      ] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
        // @ts-ignore – JSZip doesn't always have perfect typings
        import("jszip"),
      ]);

      const zip = new JSZip();
      let successCount = 0;
      const failed: string[] = [];

      for (let i = 0; i < selectedStudents.length; i++) {
        if (cancelRequestedRef.current) break;

        const student = selectedStudents[i];
        setCurrentIndex(i);
        setCurrentStudentName(student.name);
        setCurrentStage(`Fetching profile for ${student.name}…`);

        try {
          // 1. Fetch profile data
          const res = await fetch(`/api/talabat-profile/view/${student.studentId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const resData = await res.json();
          if (!resData.success || !resData.profile) throw new Error(resData.error || "No profile");

          const info = resData.studentInfo || {};
          const pData: TalabatProfileData = {
            ...resData.profile,
            name: resData.profile.name || info.name || student.name,
            itsNo: resData.profile.itsNo || info.its || student.its,
            idNo: resData.profile.idNo || info.idNo || student.idNo,
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

          // 2. Render PDF
          const { pdf, pageCount } = await renderStudentPdf(
            html2canvas,
            jsPDF,
            pData,
            student.name
          );

          if (cancelRequestedRef.current) break;
          if (pageCount === 0) throw new Error("No pages rendered");

          // 3. Add to ZIP
          const slug = toSlug(pData.name || student.name);
          const filename = `${slug}-talabat-profile-1447H.pdf`;
          const pdfBlob = pdf.output("arraybuffer");
          zip.file(filename, pdfBlob);

          successCount++;
          setProcessedCount(successCount);
        } catch (err: any) {
          console.error(`Failed for ${student.name}:`, err);
          failed.push(student.name);
          setFailedCount((p) => p + 1);
          setFailedNames((p) => [...p, student.name]);
        } finally {
          // Clear staging between students
          setCurrentProfile(null);
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      if (cancelRequestedRef.current) {
        setCurrentStage("Export cancelled.");
        setIsRunning(false);
        return;
      }

      if (successCount === 0) throw new Error("No PDFs were generated.");

      // 4. Generate and download ZIP
      setCurrentStage(`Compressing ${successCount} PDF files into ZIP…`);
      const timestamp = new Date().toISOString().slice(0, 10);
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Talabat_Profiles_${successCount}_Students_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setIsFinished(true);
      setCurrentStage(
        `ZIP downloaded! ${successCount} individual PDFs${failed.length > 0 ? ` (${failed.length} skipped)` : ""}.`
      );

      if (onClearSelection) onClearSelection();
    } catch (err: any) {
      console.error("Bulk ZIP error:", err);
      setErrorDetails(err.message || "Unexpected error during ZIP export.");
    } finally {
      setCurrentProfile(null);
      setIsRunning(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  DOWNLOAD MODE B: All students in a single combined PDF
  // ─────────────────────────────────────────────────────────────────────────────
  const startCombinedDownload = async () => {
    if (selectedStudents.length === 0 || isRunning) return;

    setIsRunning(true);
    setIsFinished(false);
    setErrorDetails(null);
    setProcessedCount(0);
    setFailedCount(0);
    setFailedNames([]);
    cancelRequestedRef.current = false;

    try {
      setCurrentStage("Loading PDF engine…");
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const pageW = 210;
      const pageH = 297;
      const margin = 4;
      const printW = pageW - margin * 2;
      const printH = pageH - margin * 2;

      const combinedPdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      let totalPages = 0;
      let successCount = 0;
      const failed: string[] = [];

      for (let i = 0; i < selectedStudents.length; i++) {
        if (cancelRequestedRef.current) break;

        const student = selectedStudents[i];
        setCurrentIndex(i);
        setCurrentStudentName(student.name);
        setCurrentStage(`Fetching profile for ${student.name}…`);

        try {
          const res = await fetch(`/api/talabat-profile/view/${student.studentId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const resData = await res.json();
          if (!resData.success || !resData.profile) throw new Error(resData.error || "No profile");

          const info = resData.studentInfo || {};
          const pData: TalabatProfileData = {
            ...resData.profile,
            name: resData.profile.name || info.name || student.name,
            itsNo: resData.profile.itsNo || info.its || student.its,
            idNo: resData.profile.idNo || info.idNo || student.idNo,
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

          // Mount in staging
          setCurrentProfile(pData);
          setCurrentStage(`Rendering ${student.name}…`);
          await waitFrames(4);
          await new Promise((r) => setTimeout(r, 300));

          if (!stagingRef.current) throw new Error("Staging not ready");

          const pageEls = Array.from(
            stagingRef.current.querySelectorAll<HTMLElement>(".doc-page")
          );
          const targets = pageEls.length > 0 ? pageEls : [stagingRef.current];

          await Promise.all([
            document.fonts?.ready?.catch(() => {}),
            ...targets.flatMap((el) =>
              Array.from(el.querySelectorAll("img")).map(
                (img) =>
                  img.complete
                    ? Promise.resolve()
                    : new Promise<void>((r) => {
                        img.addEventListener("load", () => r(), { once: true });
                        img.addEventListener("error", () => r(), { once: true });
                        setTimeout(r, 3000);
                      })
              )
            ),
          ]);

          for (let pIdx = 0; pIdx < targets.length; pIdx++) {
            if (cancelRequestedRef.current) break;
            setCurrentStage(`Capturing page ${pIdx + 1}/${targets.length} for ${student.name}…`);

            const el = targets[pIdx];
            const origW = el.style.width;
            const origH = el.style.height;
            el.style.width = "794px";
            el.style.height = "1123px";
            el.style.overflow = "visible";
            await waitFrames(2);

            const canvas = await html2canvas(el, {
              scale: 2.5,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#ffffff",
              logging: false,
              imageTimeout: 8000,
              windowWidth: 794,
              windowHeight: 1123,
              onclone: (clonedDoc: Document) => {
                clonedDoc.documentElement.classList.remove("dark");
                clonedDoc.documentElement.setAttribute("data-theme", "light");
                clonedDoc.body.style.background = "#ffffff";
                clonedDoc.body.classList.remove("dark");
                const arabicEls = clonedDoc.querySelectorAll(
                  ".arabic-calligraphy, .font-alkanz, [dir='rtl']"
                );
                arabicEls.forEach((el) => {
                  const h = el as HTMLElement;
                  h.style.letterSpacing = "0px";
                  h.style.wordSpacing = "normal";
                  h.style.direction = "rtl";
                  h.style.unicodeBidi = "embed";
                  h.style.fontFamily =
                    "'Al-Kanz', 'AL-KANZ', 'Al Kanz', 'alkanz', 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif";
                });
                const allEls = clonedDoc.querySelectorAll("*");
                allEls.forEach((el) => {
                  const h = el as HTMLElement;
                  if (h.style) {
                    h.style.webkitLineClamp = "unset";
                    h.style.overflow = "visible";
                  }
                });
              },
            });

            el.style.width = origW;
            el.style.height = origH;
            el.style.overflow = "";

            const canvasAR = canvas.width / canvas.height;
            const pageAR = printW / printH;
            let imgW: number, imgH: number;
            if (canvasAR > pageAR) {
              imgW = printW;
              imgH = printW / canvasAR;
            } else {
              imgH = printH;
              imgW = printH * canvasAR;
            }

            if (totalPages > 0) combinedPdf.addPage("a4", "p");
            combinedPdf.addImage(
              canvas.toDataURL("image/jpeg", 0.95),
              "JPEG",
              margin + (printW - imgW) / 2,
              margin + (printH - imgH) / 2,
              imgW,
              imgH,
              undefined,
              "FAST"
            );
            totalPages++;
          }

          successCount++;
          setProcessedCount(successCount);
        } catch (err: any) {
          console.error(`Failed for ${student.name}:`, err);
          failed.push(student.name);
          setFailedCount((p) => p + 1);
          setFailedNames((p) => [...p, student.name]);
        } finally {
          setCurrentProfile(null);
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      if (cancelRequestedRef.current) {
        setCurrentStage("Export cancelled.");
        setIsRunning(false);
        return;
      }

      if (totalPages === 0) throw new Error("No pages rendered.");

      setCurrentStage("Downloading combined PDF…");
      const timestamp = new Date().toISOString().slice(0, 10);
      combinedPdf.save(
        `Talabat_Combined_${successCount}_Students_${timestamp}.pdf`
      );

      setIsFinished(true);
      setCurrentStage(
        `Done! ${successCount} profiles, ${totalPages} pages${failed.length > 0 ? ` (${failed.length} skipped)` : ""}.`
      );

      if (onClearSelection) onClearSelection();
    } catch (err: any) {
      console.error("Combined PDF error:", err);
      setErrorDetails(err.message || "Unexpected error.");
    } finally {
      setCurrentProfile(null);
      setIsRunning(false);
    }
  };

  const handleStart = () => {
    if (mode === "individual-zip") {
      startIndividualZipDownload();
    } else {
      startCombinedDownload();
    }
  };

  return (
    <>
      {/* ── Offscreen Staging Area ── */}
      <div
        ref={stagingRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "794px", // exact A4 pixel width at 96dpi
          minHeight: "1123px",
          background: "#ffffff",
          zIndex: -9999,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {currentProfile && (
          <div className="printable-document" style={{ background: "#fff" }}>
            <TalabatProfileDocument
              data={currentProfile}
              showPrintButton={false}
              initialLayout="a4-single"
            />
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-[#1c1c1c] to-slate-900 text-white p-5 flex items-center justify-between border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">
                  Bulk Download — Talabat Profiles
                </h3>
                <div className="text-xs text-amber-300 font-medium">
                  Individual PDFs • ZIP Archive • 1447 H
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

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Summary */}
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
                  {mode === "individual-zip"
                    ? `${totalStudents} PDF files (ZIP)`
                    : `${totalStudents * 2} pages (Combined)`}
                </div>
              </div>
            </div>

            {/* Mode Selector */}
            {!isRunning && !isFinished && (
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1.5">
                <button
                  onClick={() => setMode("individual-zip")}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === "individual-zip"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  Individual ZIPs (Recommended)
                </button>
                <button
                  onClick={() => setMode("combined")}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === "combined"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Single Combined PDF
                </button>
              </div>
            )}

            {/* Error */}
            {errorDetails && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold">Error: </span>
                  {errorDetails}
                </div>
              </div>
            )}

            {/* Running Progress */}
            {isRunning && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span className="truncate max-w-[260px]">{currentStudentName || "Starting…"}</span>
                  </span>
                  <span className="text-amber-600 font-bold shrink-0">{progressPct}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="text-xs text-slate-500 italic truncate">{currentStage}</div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>
                    Student {Math.min(currentIndex + 1, totalStudents)} of {totalStudents}
                  </span>
                  <span>
                    {processedCount} ✓{failedCount > 0 ? ` · ${failedCount} skipped` : ""}
                  </span>
                </div>
              </div>
            )}

            {/* Finished */}
            {isFinished && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-emerald-950">
                    {mode === "individual-zip" ? "ZIP Downloaded!" : "PDF Downloaded!"}
                  </div>
                  <div className="text-emerald-700 mt-0.5">{currentStage}</div>
                  {failedNames.length > 0 && (
                    <div className="mt-1.5 text-rose-600 font-semibold">
                      Skipped: {failedNames.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Student List Preview */}
            {!isRunning && !isFinished && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">
                  Students in this batch ({totalStudents}):
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 text-xs">
                  {selectedStudents.map((s, idx) => (
                    <div
                      key={s.studentId}
                      className="px-3 py-1.5 flex items-center justify-between text-slate-700"
                    >
                      <span className="font-medium truncate max-w-[260px]">
                        {idx + 1}. {s.name}
                      </span>
                      <span className="font-mono text-slate-400 shrink-0 ml-2 text-[10px]">
                        {s.its || s.idNo || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              {isRunning ? (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <StopCircle className="w-4 h-4 text-rose-600" />
                  <span>Cancel</span>
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
                    onClick={handleStart}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {mode === "individual-zip" ? (
                      <>
                        <Archive className="w-4 h-4" />
                        <span>Download as ZIP ({totalStudents} PDFs)</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download Combined PDF</span>
                      </>
                    )}
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
