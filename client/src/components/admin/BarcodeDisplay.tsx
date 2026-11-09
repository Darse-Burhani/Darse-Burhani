"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeDisplayProps {
  value: string;
  genre?: string;
  category?: string;
  showGenre?: boolean;
  width?: number;
  height?: number;
  showText?: boolean;
  className?: string;
  scale?: "sm" | "md" | "lg";
}

const scaleConfig = {
  sm: { barWidth: 1, barHeight: 20, textSize: "text-[7px]", svgClass: "max-w-[120px]" },
  md: { barWidth: 1.5, barHeight: 30, textSize: "text-[9px]", svgClass: "max-w-[180px]" },
  lg: { barWidth: 2, barHeight: 40, textSize: "text-[11px]", svgClass: "max-w-[240px]" },
};

/**
 * Renders a scannable CODE128 barcode using JsBarcode.
 * Displays both the unique barcode code and genre / category name.
 */
export default function BarcodeDisplay({
  value,
  genre,
  category,
  showGenre = false,
  width,
  height,
  showText = true,
  className = "",
  scale = "md",
}: BarcodeDisplayProps) {
  const effectiveGenre = genre || category || "";
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);
  const cfg = scaleConfig[scale];
  const barWidth = width ?? cfg.barWidth;
  const barHeight = height ?? cfg.barHeight;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!svgRef.current || !value) return;
      setError(false);
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        if (!cancelled && svgRef.current) {
          JsBarcode(svgRef.current, value, {
            format: "CODE128",
            width: barWidth,
            height: barHeight,
            displayValue: false,
            margin: 0,
            background: "#ffffff",
          });
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [value, barWidth, barHeight]);

  if (error || !value) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 rounded font-mono text-gray-500 p-1 ${className}`}>
        {effectiveGenre && (
          <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded mb-0.5">
            {effectiveGenre}
          </span>
        )}
        <span className={cfg.textSize}>{value || "—"}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {showGenre && effectiveGenre && (
        <span className="text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-2xs mb-0.5">
          {effectiveGenre}
        </span>
      )}
      <svg
        ref={svgRef}
        className={`w-full ${cfg.svgClass}`}
        style={{ maxHeight: barHeight + 4 }}
      />
      {showText && (
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap justify-center">
          <span className={`${cfg.textSize} font-mono font-bold tracking-wider text-slate-900`}>
            {value}
          </span>
          {effectiveGenre && !showGenre && (
            <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider">
              {effectiveGenre}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
