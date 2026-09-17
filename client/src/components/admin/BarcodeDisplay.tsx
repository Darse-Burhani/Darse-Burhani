"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeDisplayProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  className?: string;
  scale?: "sm" | "md" | "lg";
}

const scaleConfig = {
  sm: { barWidth: 1, barHeight: 20, textSize: "text-[6px]", svgClass: "max-w-[120px]" },
  md: { barWidth: 1.5, barHeight: 30, textSize: "text-[8px]", svgClass: "max-w-[180px]" },
  lg: { barWidth: 2, barHeight: 40, textSize: "text-[10px]", svgClass: "max-w-[240px]" },
};

/**
 * Renders a scannable CODE128 barcode using JsBarcode.
 * Falls back to showing the text value if JsBarcode fails to load.
 */
export default function BarcodeDisplay({
  value,
  width,
  height,
  showText = true,
  className = "",
  scale = "md",
}: BarcodeDisplayProps) {
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
      <div className={`flex items-center justify-center bg-gray-50 rounded font-mono text-gray-500 ${className}`}>
        <span className={cfg.textSize}>{value || "—"}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <svg
        ref={svgRef}
        className={`w-full ${cfg.svgClass}`}
        style={{ maxHeight: barHeight + 4 }}
      />
      {showText && (
        <span className={`${cfg.textSize} font-mono font-bold tracking-wider text-gray-700`}>
          {value}
        </span>
      )}
    </div>
  );
}
