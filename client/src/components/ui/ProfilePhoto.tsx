"use client";

import { useState } from "react";
import { User, ZoomIn, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfilePhotoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  onError?: () => void;
  draggable?: boolean;
  previewable?: boolean;
  subtitle?: string;
}

/**
 * ProfilePhoto — quick-loading, full portrait image inside any frame
 * with seamless blurred-background fill and interactive full-resolution lightbox viewer.
 */
export function ProfilePhoto({
  src,
  alt = "Profile photo",
  className,
  imgClassName,
  loading = "eager",
  decoding = "async",
  onError,
  draggable = false,
  previewable = true,
  subtitle,
}: ProfilePhotoProps) {
  const [hasError, setHasError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isValidSrc = Boolean(src && typeof src === "string" && src.trim() !== "" && src !== "null" && src !== "undefined");

  if (!isValidSrc || hasError) {
    return (
      <div className={cn("relative overflow-hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900 to-teal-950 text-white select-none", className)}>
        <User className="w-1/2 h-1/2 opacity-75" />
      </div>
    );
  }

  const cleanSrc = src!.trim();

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden w-full h-full group",
          previewable && "cursor-pointer",
          className
        )}
        onClick={() => {
          if (previewable) setPreviewOpen(true);
        }}
        title={previewable ? "Click to view full photo" : alt}
      >
        {/* Blurred background fill for seamless borderless display */}
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 pointer-events-none"
          style={{
            backgroundImage: `url("${cleanSrc}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(12px) brightness(0.85)",
          }}
        />

        {/* Foreground full image — zero cropping */}
        <img
          src={cleanSrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          draggable={draggable}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
          className={cn(
            "relative z-10 w-full h-full object-contain object-center transition-transform duration-300",
            previewable && "group-hover:scale-105",
            imgClassName
          )}
        />

        {/* Subtle hover icon indicating viewable */}
        {previewable && (
          <div className="absolute inset-0 z-20 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="p-1.5 rounded-full bg-white/20 backdrop-blur-md text-white shadow-lg">
              <ZoomIn className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {/* ── High-Resolution Lightbox Viewer ── */}
      {previewable && previewOpen && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] bg-slate-950 rounded-3xl overflow-hidden border border-white/20 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">{alt}</h3>
                {subtitle && <p className="text-xs text-emerald-300 font-medium">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={cleanSrc}
                  download="profile-photo.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Open full image in new tab"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Crisp High-Res Display */}
            <div className="relative flex-1 min-h-[350px] max-h-[75vh] flex items-center justify-center p-6 bg-slate-950/60 overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: `url("${cleanSrc}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(30px)",
                }}
              />
              <img
                src={cleanSrc}
                alt={alt}
                className="relative z-10 max-w-full max-h-[70vh] rounded-2xl shadow-2xl object-contain object-center border border-white/10"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
