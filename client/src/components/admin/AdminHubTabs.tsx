"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface HubTabItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: string;
  shortcutNumber?: number;
}

interface AdminHubTabsProps {
  hubTitle: string;
  hubDescription?: string;
  tabs: HubTabItem[];
  className?: string;
}

export function AdminHubTabs({ hubTitle, hubDescription, tabs, className }: AdminHubTabsProps) {
  const pathname = usePathname();
  const router = useRouter();

  let activeIndex = tabs.findIndex((t) => t.href === pathname || `${t.href}/` === pathname);
  if (activeIndex === -1) {
    let maxLen = 0;
    tabs.forEach((t, idx) => {
      if (pathname.startsWith(t.href) && t.href.length > maxLen) {
        maxLen = t.href.length;
        activeIndex = idx;
      }
    });
  }

  // Enable keyboard shortcuts (Alt+1, Alt+2, etc. or [ and ] to switch tabs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input / textarea
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable) {
        return;
      }

      // [ and ] to cycle tabs
      if (e.key === "[" && activeIndex > 0) {
        e.preventDefault();
        router.push(tabs[activeIndex - 1].href);
      } else if (e.key === "]" && activeIndex >= 0 && activeIndex < tabs.length - 1) {
        e.preventDefault();
        router.push(tabs[activeIndex + 1].href);
      }

      // Alt+1, Alt+2, etc. to jump to specific sub-tab
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= tabs.length) {
          e.preventDefault();
          router.push(tabs[num - 1].href);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, tabs, router]);

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/80">
        <div>
          <h2 className="text-xl font-bold font-display text-gray-900 flex items-center gap-2">
            {hubTitle}
          </h2>
          {hubDescription && (
            <p className="text-xs text-gray-500 mt-0.5">{hubDescription}</p>
          )}
        </div>

        {/* Quick Keyboard Hint */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-gray-500">
          <span>Switch tabs:</span>
          <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-600 shadow-2xs">
            [
          </kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-600 shadow-2xs">
            ]
          </kbd>
        </div>
      </div>

      {/* Sub-tab Pill Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar">
        {tabs.map((tab, idx) => {
          const isActive =
            tab.href === pathname ||
            `${tab.href}/` === pathname ||
            (idx === 0 && activeIndex === -1 && pathname.startsWith(tab.href));

          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shadow-2xs",
                isActive
                  ? "btn-fatimi-primary text-white shadow-md ring-1 ring-amber-400/30"
                  : "bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 border-gray-200 hover:border-amber-400"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", isActive ? "text-amber-300" : "text-gray-500 group-hover:text-amber-600")} />
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : tab.badgeColor || "bg-amber-50 text-amber-900 border border-amber-200"
                  )}
                >
                  {tab.badge}
                </span>
              )}

              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              )}

              {/* Number key shortcut badge */}
              <kbd
                className={cn(
                  "hidden lg:inline-block ml-1 px-1.2 py-0.2 rounded text-[9px] font-mono transition-opacity opacity-60 group-hover:opacity-100",
                  isActive ? "bg-white/20 text-amber-200" : "bg-gray-100 text-gray-500"
                )}
                title={`Press Alt+${idx + 1}`}
              >
                ⌥{idx + 1}
              </kbd>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
