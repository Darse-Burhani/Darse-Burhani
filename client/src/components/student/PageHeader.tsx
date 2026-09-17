"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: React.ElementType;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Delay in seconds before the header animates in */
  delay?: number;
}

/** Decorative 8-pointed star outline used on Fatimi headers */
export function FatimiCorner({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
      <circle cx="50" cy="50" r="25" fill="none" stroke="#d4af37" strokeWidth="0.5" />
    </svg>
  );
}

/**
 * Standard Fatimi hero banner used across every student portal page.
 * Keeps the emerald + gold geometric identity while unifying the look
 * of all Talabat Hub pages.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = "",
  delay = 0,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className={`mb-8 ${className}`}
    >
      <div className="fatimi-header-banner">
        {/* Geometric decorations */}
        <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
          <FatimiCorner className="w-full h-full" />
        </div>
        <div className="absolute bottom-0 right-0 w-24 h-24 opacity-10 rotate-45">
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
            <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent shadow-lg shadow-black/20 shrink-0">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1
                className="font-display text-2xl sm:text-3xl font-bold text-white"
                style={{ letterSpacing: "-0.02em" }}
              >
                {title}
              </h1>
              {subtitle && <p className="text-emerald-100 text-sm mt-1">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }}
        />
      </div>
    </motion.div>
  );
}
