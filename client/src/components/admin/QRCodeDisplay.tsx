"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  includeMargin?: boolean;
  level?: "L" | "M" | "Q" | "H";
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export default function QRCodeDisplay({
  value,
  size = 120,
  fgColor = "#0f172a",
  bgColor = "#ffffff",
  includeMargin = true,
  level = "M",
  className = "",
  showLabel = false,
  label,
}: QRCodeDisplayProps) {
  const [svgUrl, setSvgUrl] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setSvgUrl("");
      return;
    }

    QRCode.toDataURL(value, {
      width: size * 2,
      margin: includeMargin ? 2 : 0,
      color: {
        dark: fgColor,
        light: bgColor,
      },
      errorCorrectionLevel: level,
    })
      .then((url: string) => {
        if (isMounted) {
          setSvgUrl(url);
          setError(false);
        }
      })
      .catch((err: unknown) => {
        console.error("QR Code generation error:", err);
        if (isMounted) {
          setError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [value, size, fgColor, bgColor, includeMargin, level]);

  if (!value || error) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 font-mono text-xs ${className}`}
        style={{ width: size, height: size }}
      >
        No QR
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <div
        className="p-1 rounded-xl shadow-xs border border-slate-200/80 transition-all hover:shadow-md bg-white flex items-center justify-center overflow-hidden"
        style={{ width: size + 8, height: size + 8 }}
      >
        {svgUrl ? (
          <img
            src={svgUrl}
            alt={`QR Code for ${value}`}
            width={size}
            height={size}
            className="rounded-lg object-contain"
          />
        ) : (
          <div className="w-full h-full animate-pulse bg-slate-100 rounded-lg" />
        )}
      </div>

      {showLabel && (
        <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wider text-center max-w-[140px] truncate">
          {label || value}
        </span>
      )}
    </div>
  );
}
