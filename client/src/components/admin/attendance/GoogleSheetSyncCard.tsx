import React, { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  getSheetSyncStatus,
  syncAttendanceSheet,
  SheetSyncStatusData,
  SheetSyncResult,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";

interface GoogleSheetSyncCardProps {
  onSyncComplete?: (result: SheetSyncResult) => void;
  className?: string;
}

export function GoogleSheetSyncCard({ onSyncComplete, className = "" }: GoogleSheetSyncCardProps) {
  const [status, setStatus] = useState<SheetSyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SheetSyncResult | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSheetSyncStatus();
      setStatus(data);
    } catch (err) {
      console.error("Failed to load Google Sheet sync status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncAttendanceSheet();
      setLastSyncResult(res.data);
      toast.success(res.message || "Attendance synced to Google Sheet successfully!");
      if (onSyncComplete) onSyncComplete(res.data);
      fetchStatus();
    } catch (err) {
      toast.error((err as Error).message || "Failed to push to Google Sheet");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[#06241a] via-[#093527] to-[#041d14] p-5 sm:p-6 text-white shadow-xl shadow-emerald-950/25 ${className}`}
    >
      {/* Decorative radial glows */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left side info */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-inner">
            <FileSpreadsheet className="h-6 w-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white font-display">
                Google Sheet Live Sync
              </h3>
              {loading ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-300">
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" /> Connecting...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-200 shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected &amp; Synced Properly
                </span>
              )}
            </div>

            <p className="mt-1 text-xs sm:text-sm text-emerald-100/80 max-w-2xl font-medium leading-relaxed">
              Daily attendance registers for <strong>Talabat</strong> and <strong>Faculty</strong> are automatically synchronized to Google Sheets with real-time leave and medical records.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-emerald-200/90 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Auto-Push Schedule: <strong className="text-white">Active (Daily 8:30 PM IST)</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Coverage: <strong className="text-white">Talabat + Faculty Registers</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0 shrink-0">
          {status?.url && (
            <a
              href={status.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/20 hover:border-emerald-400/50 active:scale-95 shadow-xs backdrop-blur-sm"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-300" />
              <span>Open Google Sheet</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-95 disabled:opacity-50 border border-emerald-400/40"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing Data...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Sync Today Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Summary banner if recently synced */}
      {lastSyncResult && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/60 p-3.5 text-xs text-emerald-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Synced <strong>{lastSyncResult.rowsSynced}</strong> records to tab <strong>'{lastSyncResult.tabTitle}'</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-emerald-300">
            <span>Talabat: {lastSyncResult.stats.studentPresent} Present / {lastSyncResult.stats.studentAbsent} Absent ({lastSyncResult.stats.studentRate}%)</span>
            <span>Faculty: {lastSyncResult.stats.teacherPresent} Present / {lastSyncResult.stats.teacherAbsent} Absent</span>
          </div>
        </div>
      )}
    </div>
  );
}
