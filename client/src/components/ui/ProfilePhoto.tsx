"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ProfilePhotoProps {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  onError?: () => void;
  draggable?: boolean;
}

/**
 * ProfilePhoto — shows the full portrait image inside any frame
 * WITHOUT cropping and WITHOUT black/white letterbox bars.
 *
 * Blurred-background fill technique:
 *   - A blurred, scaled-up copy of the same image fills the container background.
 *   - The real image sits on top with object-contain (full photo always visible).
 *   - The blur hides the seams and gives a professional, natural fill.
 */
export function ProfilePhoto({
  src,
  alt = "Profile photo",
  className,
  imgClassName,
  loading = "lazy",
  decoding = "async",
  onError,
  draggable = false,
}: ProfilePhotoProps) {
  return (
    <div className={cn("relative overflow-hidden w-full h-full", className)}>
      {/* Blurred background fill */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-110"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(10px) brightness(0.85)",
        }}
      />
      {/* Foreground image — full, no crop */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        onError={onError}
        className={cn(
          "relative z-10 w-full h-full object-contain object-center",
          imgClassName,
        )}
      />
    </div>
  );
}
