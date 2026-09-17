"use client";

import { cn } from "@/lib/utils";

/**
 * Reusable page skeleton & loading stats component.
 * Provides consistent loading states across all portal pages, widgets, and stat dashboards.
 *
 * Variants:
 * - "stats"      – stat metrics skeleton with animated shimmers
 * - "card-grid"  – grid of card skeletons (default)
 * - "table"      – table row skeletons
 * - "details"    – detail/detail-view skeleton
 * - "mini-stats" – compact single row stats bar
 */

interface PageSkeletonProps {
  variant?: "card-grid" | "table" | "details" | "stats" | "mini-stats";
  cardCount?: number;
  className?: string;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-emerald-950/40 bg-[length:200%_100%] animate-pulse",
        className,
      )}
    />
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#021e17]/80 border border-gray-100 dark:border-white/10 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-9 w-9 rounded-xl" />
      </div>
      <SkeletonBlock className="h-8 w-20" />
      <div className="flex items-center gap-2 pt-1">
        <SkeletonBlock className="h-3.5 w-12 rounded-full" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
    </div>
  );
}

export default function PageSkeleton({
  variant = "card-grid",
  cardCount = 6,
  className,
}: PageSkeletonProps) {
  if (variant === "mini-stats") {
    return (
      <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3 my-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "stats") {
    return (
      <div className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8", className)}>
        {/* Header Skeleton */}
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>

        {/* 4 Stat Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>

        {/* Content & Chart Skeletons */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#021e17]/80 border border-gray-100 dark:border-white/10 space-y-4">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-44 w-full rounded-xl" />
              <div className="space-y-2">
                <SkeletonBlock className="h-3.5 w-full" />
                <SkeletonBlock className="h-3.5 w-4/5" />
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-[#021e17]/80 border border-gray-100 dark:border-white/10 space-y-3">
              <SkeletonBlock className="h-5 w-40" />
              <SkeletonBlock className="h-32 w-full rounded-xl" />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#021e17]/80 border border-gray-100 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-6 w-44" />
                <SkeletonBlock className="h-8 w-24 rounded-lg" />
              </div>
              <SkeletonBlock className="h-64 w-full rounded-xl" />
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-[#021e17]/80 border border-gray-100 dark:border-white/10 space-y-3">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="h-36 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", className)}>
        <SkeletonBlock className="h-8 w-56 mb-2" />
        <SkeletonBlock className="h-4 w-40 mb-6" />
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#021e17]/80">
          <div className="bg-gray-50 dark:bg-black/20 p-4 border-b border-gray-200 dark:border-white/10">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-4" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {Array.from({ length: cardCount }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <SkeletonBlock className="h-4" />
                  <SkeletonBlock className="h-4" />
                  <SkeletonBlock className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <SkeletonBlock className="h-6 w-16 rounded-full" />
                    <SkeletonBlock className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "details") {
    return (
      <div className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", className)}>
        <SkeletonBlock className="h-8 w-72 mb-2" />
        <SkeletonBlock className="h-4 w-56 mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <SkeletonBlock className="h-48 rounded-2xl" />
            <SkeletonBlock className="h-32 rounded-2xl" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <SkeletonBlock className="h-64 rounded-2xl" />
            <SkeletonBlock className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Default: card-grid variant
  return (
    <div className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", className)}>
      <SkeletonBlock className="h-8 w-56 mb-2" />
      <SkeletonBlock className="h-4 w-40 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 space-y-4 bg-white dark:bg-[#021e17]/80"
          >
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
            <div className="flex gap-2 pt-2">
              <SkeletonBlock className="h-8 w-20 rounded-xl" />
              <SkeletonBlock className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
