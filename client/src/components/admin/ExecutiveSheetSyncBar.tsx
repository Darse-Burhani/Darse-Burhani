"use client";

import React, { useState } from "react";
import { FileSpreadsheet, RefreshCw, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { syncAttendanceSheet, SheetSyncStatusData } from "@/lib/api";

interface ExecutiveSheetSyncBarProps {
  sheetStatus?: SheetSyncStatusData | null;
  onSynced?: () => void;
}

export function ExecutiveSheetSyncBar({ sheetStatus, onSynced }: ExecutiveSheetSyncBarProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncStr, setLastSyncStr] = useState<string>(() => {
    if (sheetStatus?.lastSyncedAt) {
      try {
        return new Date(sheetStatus.lastSyncedAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }) + " IST";
      } catch {
        return "Recently";
      }
    }
    return "Ready to sync";
  });

  const handleSyncNow = async () => {
    setSyncing(true);
    toast.loading("Synchronizing latest biometric attendance with Google Sheets...");
    try {
      const res = await syncAttendanceSheet();
      const nowStr = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " IST";
      setLastSyncStr(nowStr);
      toast.success(res?.message || "Google Sheets attendance synced successfully!");
      if (onSynced) onSynced();
    } catch (err: any) {
      console.error("[ExecutiveSheetSyncBar] Sync error:", err);
      toast.error(err?.message || "Failed to sync attendance with Google Sheets.");
    } finally {
      setSyncing(false);
    }
  };

  const spreadsheetId = sheetStatus?.spreadsheetId || "1AR1lqoCbQ4NoLDvpSZbuDnBT6Zud3I5oGQ2c0aHM2yQ";
  const sheetUrl =
    sheetStatus?.url || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return (
    <div className="p-1 rounded-2xl bg-amber-950/5 ring-1 ring-amber-900/15 shadow-sm">
      <div className="rounded-[calc(1rem-2px)] p-4 sm:p-5 bg-white border border-amber-200/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left: Google Sheets Branding & Status */}
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md border border-amber-400/40 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1c1813 100%)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
              <FileSpreadsheet className="w-5 h-5 text-amber-300 relative z-10" strokeWidth={2} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                  Google Sheets Attendance Telemetry
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-300/80 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                Executive KPI Cards, E-Learning Rosters &amp; MinMoe Scans · Last Synced:{" "}
                <strong className="text-gray-900 font-bold">{lastSyncStr}</strong>
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0 flex-wrap">
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 hover:text-gray-900 transition-all shadow-xs active:scale-95"
            >
              <span>Open Spreadsheet</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            </a>

            <Button
              size="sm"
              onClick={handleSyncNow}
              disabled={syncing}
              className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-stone-950 font-black text-xs rounded-xl px-4 py-2 flex items-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-stone-950" : ""}`} strokeWidth={2.5} />
              <span>{syncing ? "Syncing..." : "Sync Sheet Now"}</span>
            </Button>

            <Link
              href="/admin/google-sheets"
              className="text-xs text-amber-700 hover:text-amber-800 hover:underline font-bold px-2"
            >
              Configure &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
