"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  FileText,
  Loader2,
  Sliders,
  Tv,
  Eye,
  RefreshCw,
  AlertCircle,
  Sparkles,
  BookOpen,
  Sun,
  Moon,
  Layers,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

export interface TilawatDuaItem {
  id: string;
  title: string;
  description?: string | null;
  pdfUrl: string;
  fileName: string;
  fileSize?: number | null;
  pageCount?: number | null;
  date: string | Date;
  isActive?: boolean;
  isDailyDefault?: boolean;
  targetAudience?: string;
  targetMarhala?: string | null;
}

interface TilawatDuaViewerProps {
  dua: TilawatDuaItem | null;
  initialProjectorMode?: boolean;
  onCloseProjector?: () => void;
  className?: string;
  showDetailsHeader?: boolean;
}

type ColorFilterMode = "original" | "cream" | "theater-dark" | "high-contrast";

export function TilawatDuaViewer({
  dua,
  initialProjectorMode = false,
  onCloseProjector,
  className = "",
  showDetailsHeader = true,
}: TilawatDuaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [autoFitMode, setAutoFitMode] = useState<"page" | "width" | "custom">("page");
  const [rotation, setRotation] = useState<number>(0);
  const [colorMode, setColorMode] = useState<ColorFilterMode>("original");
  const [loading, setLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(initialProjectorMode);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [useNativeViewer, setUseNativeViewer] = useState<boolean>(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);

  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const renderTaskRef = useRef<any>(null);

  const pdfUrl = dua?.pdfUrl || "";

  // ── Auto-hide controls in projector mode on idle mouse ──
  const triggerActivity = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isProjectorMode) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [isProjectorMode]);

  useEffect(() => {
    if (!isProjectorMode) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    } else {
      triggerActivity();
    }
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [isProjectorMode, triggerActivity]);

  // ── Fullscreen synchronization with Projector Mode ──
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsProjectorMode(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsProjectorMode(false);
          if (onCloseProjector) onCloseProjector();
        }
      }
    } catch {
      // Fallback: toggle CSS-based fullscreen projector
      setIsProjectorMode((prev) => !prev);
    }
  }, [onCloseProjector]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsProjectorMode(isFs);
      if (!isFs && onCloseProjector) {
        onCloseProjector();
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onCloseProjector]);

  // ── Load PDF via PDF.js ──
  useEffect(() => {
    if (!pdfUrl) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setRenderError(null);
    setCurrentPage(1);

    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        }

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.warn("[TilawatDuaViewer] PDF.js load notice, falling back to native viewer:", err);
        if (!isCancelled) {
          setUseNativeViewer(true);
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // ── Calculate dynamic scale based on viewport & container ──
  const calculateAutoFitScale = useCallback(
    (page: any, mode: "page" | "width") => {
      if (!containerRef.current) return 1.0;
      const viewport = page.getViewport({ scale: 1.0, rotation });

      const measuredWidth =
        containerRef.current.clientWidth ||
        (typeof window !== "undefined" ? window.innerWidth * (isProjectorMode ? 1.0 : 0.85) : 800);
      const measuredHeight =
        containerRef.current.clientHeight && containerRef.current.clientHeight > 200
          ? containerRef.current.clientHeight
          : (typeof window !== "undefined" ? window.innerHeight * (isProjectorMode ? 1.0 : 0.72) : 600);

      const containerWidth = Math.max(280, measuredWidth - (isProjectorMode ? 16 : 48));
      const containerHeight = Math.max(280, measuredHeight - (isProjectorMode ? 80 : 120));

      if (containerWidth <= 0 || containerHeight <= 0) return 1.0;

      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;

      if (mode === "page") {
        // Fits entire page on screen without scrolling (perfect for projectors)
        return Math.min(scaleX, scaleY, 2.5);
      } else {
        // Fit width fills projector width
        return Math.min(scaleX, 3.0);
      }
    },
    [isProjectorMode, rotation]
  );

  // ── Render Page on Canvas with High-DPI support ──
  const renderPage = useCallback(
    async (pageNumber: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNumber);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        let effectiveScale = scale;
        if (autoFitMode === "page") {
          effectiveScale = calculateAutoFitScale(page, "page");
        } else if (autoFitMode === "width") {
          effectiveScale = calculateAutoFitScale(page, "width");
        }

        // Support Retina / High-DPI screens and Projectors (devicePixelRatio up to 2.5x)
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: effectiveScale, rotation });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("[TilawatDuaViewer] Page render error:", err);
        }
      }
    },
    [pdfDoc, scale, autoFitMode, rotation, calculateAutoFitScale]
  );

  // Re-render when page, scale, or layout changes
  useEffect(() => {
    if (pdfDoc && !useNativeViewer) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, autoFitMode, rotation, isProjectorMode, useNativeViewer, renderPage]);

  // Window resize handler for auto-fit recalculation
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && autoFitMode !== "custom" && !useNativeViewer) {
        renderPage(currentPage);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pdfDoc, autoFitMode, currentPage, useNativeViewer, renderPage]);

  // ── Keyboard Navigation (Arrows, Space, PageUp/Down, Fullscreen) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      triggerActivity();

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          if (currentPage < totalPages) setCurrentPage((p) => p + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          if (currentPage > 1) setCurrentPage((p) => p - 1);
          break;
        case "Home":
          e.preventDefault();
          setCurrentPage(1);
          break;
        case "End":
          e.preventDefault();
          setCurrentPage(totalPages);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "+":
        case "=":
          e.preventDefault();
          setAutoFitMode("custom");
          setScale((s) => Math.min(s + 0.2, 3.5));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setAutoFitMode("custom");
          setScale((s) => Math.max(s - 0.2, 0.4));
          break;
        case "0":
          e.preventDefault();
          setAutoFitMode("page");
          break;
        case "Escape":
          if (isProjectorMode && !document.fullscreenElement) {
            setIsProjectorMode(false);
            if (onCloseProjector) onCloseProjector();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, isProjectorMode, toggleFullscreen, onCloseProjector, triggerActivity]);

  // ── Touch swipe navigation for mobile & smartboard touchscreens ──
  const touchStartXRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    triggerActivity();
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (diffX < -50 && currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
    } else if (diffX > 50 && currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  // ── Color Filter CSS Classes for Projector Visibility ──
  const getColorFilterStyle = () => {
    switch (colorMode) {
      case "cream":
        // Classic manuscript parchment paper look
        return {
          filter: "sepia(0.35) contrast(1.15) brightness(0.97)",
          background: "#fbf6ec",
        };
      case "theater-dark":
        // Inverted OLED dark room mode
        return {
          filter: "invert(0.93) hue-rotate(180deg) contrast(1.2)",
          background: "#080c14",
        };
      case "high-contrast":
        // Ultra crisp high-contrast for washed-out hall projectors
        return {
          filter: "contrast(1.5) saturate(1.2) brightness(1.05)",
          background: "#ffffff",
        };
      default:
        return { background: "#ffffff" };
    }
  };

  if (!dua) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">No Tilawat Dua Available</h3>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          Daily Tilawat Dua has not been published yet for this schedule. Please check back shortly or ask the administration.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerActivity}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative select-none transition-all duration-300 ${
        isProjectorMode
          ? "fixed inset-0 z-[9999] bg-slate-950 text-white w-screen h-screen overflow-hidden flex flex-col justify-between"
          : `flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden ${className}`
      }`}
      style={{
        backgroundColor: isProjectorMode
          ? colorMode === "theater-dark"
            ? "#030712"
            : colorMode === "cream"
              ? "#1a1610"
              : "#020617"
          : undefined,
      }}
    >
      {/* ── Top Header / Projector Banner ── */}
      <AnimatePresence>
        {(controlsVisible || !isProjectorMode) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b ${
              isProjectorMode
                ? "bg-slate-950/80 backdrop-blur-md border-slate-800/80 z-50 text-white"
                : "bg-slate-900/90 backdrop-blur-md border-slate-800 text-slate-100"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm sm:text-base tracking-wide truncate">{dua.title}</h2>
                  {dua.isDailyDefault && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] px-2 py-0.5 font-medium shrink-0">
                      Daily Tilawat
                    </Badge>
                  )}
                  {isProjectorMode && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 font-mono shrink-0">
                      PROJECTOR MODE
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {new Date(dua.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {dua.targetAudience && ` • ${dua.targetAudience.replace(/_/g, " ")}`}
                </p>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Color Mode Switcher */}
              <div className="hidden sm:flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setColorMode("original")}
                  title="Original Color"
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    colorMode === "original" ? "bg-amber-600 text-white shadow" : "text-slate-300 hover:text-white"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode("cream")}
                  title="Cream Manuscript Tone"
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    colorMode === "cream" ? "bg-amber-100 text-amber-950 shadow" : "text-slate-300 hover:text-white"
                  }`}
                >
                  Parchment
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode("high-contrast")}
                  title="High Contrast for Projector"
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    colorMode === "high-contrast" ? "bg-white text-slate-950 shadow" : "text-slate-300 hover:text-white"
                  }`}
                >
                  High Contrast
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode("theater-dark")}
                  title="Dark Theater Mode"
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    colorMode === "theater-dark" ? "bg-slate-950 text-amber-400 border border-amber-500/40 shadow" : "text-slate-300 hover:text-white"
                  }`}
                >
                  OLED Dark
                </button>
              </div>

              {/* View Native Switcher */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseNativeViewer((v) => !v)}
                title={useNativeViewer ? "Switch to Canvas HD" : "Switch to Native Viewer"}
                className="hidden md:inline-flex text-xs text-slate-300 hover:text-white hover:bg-slate-800/80"
              >
                <Layers className="w-4 h-4 mr-1.5" />
                {useNativeViewer ? "Canvas HD" : "Native Embed"}
              </Button>

              {/* Download */}
              <a href={pdfUrl} download={dua.fileName || "tilawat-dua.pdf"} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-xs text-slate-300 hover:text-white hover:bg-slate-800/80">
                  <Download className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </a>

              {/* Dedicated Projector Button */}
              <Button
                onClick={toggleFullscreen}
                className={`${
                  isProjectorMode
                    ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/30"
                } text-xs px-3.5 py-1.5 rounded-xl transition-all duration-200 active:scale-95`}
              >
                {isProjectorMode ? (
                  <>
                    <Minimize2 className="w-4 h-4 mr-1.5" />
                    Exit Projector
                  </>
                ) : (
                  <>
                    <Tv className="w-4 h-4 mr-1.5" />
                    Projector View
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Canvas / Viewing Area ── */}
      <div
        className={`relative flex-1 flex items-center justify-center overflow-auto p-2 sm:p-4 transition-all duration-300 ${
          isProjectorMode ? "h-full w-full" : "min-h-[500px] max-h-[82vh]"
        }`}
        style={{
          backgroundColor:
            colorMode === "theater-dark" ? "#030712" : colorMode === "cream" ? "#221c14" : "#0f172a",
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
            <p className="text-sm font-medium tracking-wide">Rendering Tilawat Dua in High Definition…</p>
          </div>
        ) : useNativeViewer ? (
          <div className="w-full h-full min-h-[600px] flex items-center justify-center">
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full h-full min-h-[600px] rounded-lg border-0 bg-white"
              title="Tilawat Dua Native PDF"
            />
          </div>
        ) : (
          <div className="relative flex items-center justify-center transition-all duration-200 max-w-full max-h-full m-auto">
            {/* Canvas with smooth shadow and rounded corners */}
            <div
              className="relative shadow-2xl rounded-lg overflow-hidden transition-all duration-200 m-auto flex items-center justify-center"
              style={getColorFilterStyle()}
            >
              <canvas ref={canvasRef} className="block max-w-full h-auto cursor-grab active:cursor-grabbing mx-auto my-auto" />
            </div>

            {/* Subtle Screen Page Indicator Overlay in Projector Mode */}
            {isProjectorMode && !controlsVisible && (
              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-amber-300 px-3 py-1 rounded-full text-xs font-mono opacity-60 pointer-events-none">
                Page {currentPage} / {totalPages}
              </div>
            )}
          </div>
        )}

        {/* Big On-Screen Next/Previous Clickable Edges for Projector / Touch */}
        {totalPages > 1 && !useNativeViewer && (
          <>
            {currentPage > 1 && (
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-20 sm:w-16 sm:h-28 rounded-2xl bg-black/30 hover:bg-black/60 text-white/70 hover:text-white flex items-center justify-center transition opacity-0 hover:opacity-100 focus:opacity-100 backdrop-blur-sm z-30"
              >
                <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
              </button>
            )}
            {currentPage < totalPages && (
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next Page"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-20 sm:w-16 sm:h-28 rounded-2xl bg-black/30 hover:bg-black/60 text-white/70 hover:text-white flex items-center justify-center transition opacity-0 hover:opacity-100 focus:opacity-100 backdrop-blur-sm z-30"
              >
                <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Floating Translucent Presentation Toolbar (Auto-Hides on Projector) ── */}
      <AnimatePresence>
        {(controlsVisible || !isProjectorMode) && !useNativeViewer && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center justify-between gap-2 px-4 py-2.5 border-t ${
              isProjectorMode
                ? "bg-slate-950/85 backdrop-blur-xl border-slate-800/90 text-white z-50 shadow-2xl"
                : "bg-slate-900/95 backdrop-blur-md border-slate-800 text-slate-200"
            }`}
          >
            {/* Page Navigation Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 px-2.5 sm:px-3 text-xs bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs font-mono font-medium text-slate-200">
                <span className="text-amber-400 font-bold">{currentPage}</span>
                <span className="text-slate-500">/</span>
                <span>{totalPages}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 sm:px-3 text-xs bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl disabled:opacity-30 disabled:pointer-events-none"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4 sm:ml-1" />
              </Button>
            </div>

            {/* Scale / Fit Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Fit Modes */}
              <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setAutoFitMode("page");
                    setScale(1.0);
                  }}
                  className={`px-2 py-0.5 text-xs rounded-lg transition font-medium ${
                    autoFitMode === "page" ? "bg-amber-600 text-white shadow" : "text-slate-300 hover:text-white"
                  }`}
                  title="Fit whole page to screen (ideal for projector)"
                >
                  Fit Page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoFitMode("width");
                    setScale(1.0);
                  }}
                  className={`px-2 py-0.5 text-xs rounded-lg transition font-medium ${
                    autoFitMode === "width" ? "bg-amber-600 text-white shadow" : "text-slate-300 hover:text-white"
                  }`}
                  title="Fit width (large text view)"
                >
                  Fit Width
                </button>
              </div>

              {/* Zoom Buttons */}
              <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setAutoFitMode("custom");
                    setScale((s) => Math.max(0.4, s - 0.2));
                  }}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-slate-300 min-w-[36px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAutoFitMode("custom");
                    setScale((s) => Math.min(3.5, s + 0.2));
                  }}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Rotate Button */}
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="hidden sm:flex p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition"
                title="Rotate 90° Clockwise"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {/* Projector Mode Launch / Exit Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 px-2.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl transition"
                title="Toggle Fullscreen Projector (F)"
              >
                {isProjectorMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span className="hidden md:inline ml-1.5">{isProjectorMode ? "Exit Fullscreen" : "Fullscreen"}</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default TilawatDuaViewer;
