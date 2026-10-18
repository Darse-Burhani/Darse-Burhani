import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Users,
  GraduationCap,
  ClipboardCheck,
  Layers,
  Settings,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import {
  getSheetSyncStatus,
  testSheetConnection,
  saveSheetConfig,
  syncAttendanceSheet,
  syncMonthlyAttendanceSheet,
  syncManualAttendanceSheet,
  syncTalabatDirectorySheet,
  syncFacultyDirectorySheet,
  syncAllRecordsSheet,
  SheetSyncStatusData,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function GoogleSheetsAdminPage() {
  const [status, setStatus] = useState<SheetSyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showEmbedPreview, setShowEmbedPreview] = useState(false);

  // Sync Parameters
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [dailyDate, setDailyDate] = useState(todayStr);
  const [manualDate, setManualDate] = useState(todayStr);
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonthStr);

  // Sync State flags
  const [syncingDaily, setSyncingDaily] = useState(false);
  const [syncingMonthly, setSyncingMonthly] = useState(false);
  const [syncingManual, setSyncingManual] = useState(false);
  const [syncingTalabat, setSyncingTalabat] = useState(false);
  const [syncingFaculty, setSyncingFaculty] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Config Drawer / Modal
  const [showConfig, setShowConfig] = useState(false);
  const [configSpreadsheetId, setConfigSpreadsheetId] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSheetSyncStatus();
      setStatus(data);
      if (data.spreadsheetId) {
        setConfigSpreadsheetId(data.spreadsheetId);
      }
    } catch (err: any) {
      console.error("Failed to load Google Sheet status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCopyId = () => {
    if (!status?.spreadsheetId) return;
    navigator.clipboard.writeText(status.spreadsheetId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const res = await testSheetConnection({});
      toast({
        title: "Connection Verified",
        description: `Successfully linked to spreadsheet: "${res.title}". Found ${res.sheetNames.length} tabs.`,
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err?.message || "Could not reach Google Sheets API.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configSpreadsheetId.trim()) {
      toast({ title: "Validation Error", description: "Please enter a valid Google Spreadsheet ID or URL", variant: "destructive" });
      return;
    }
    try {
      setSavingConfig(true);
      const res = await saveSheetConfig({ spreadsheetId: configSpreadsheetId.trim() });
      toast({
        title: "Configuration Saved",
        description: res.message || "Google Sheet target updated successfully.",
        variant: "success",
      });
      setStatus(res.data);
      setShowConfig(false);
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message || "Could not update configuration.",
        variant: "destructive",
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Sync Handlers
  const handleSyncDaily = async () => {
    try {
      setSyncingDaily(true);
      const res = await syncAttendanceSheet(dailyDate);
      toast({
        title: "Daily Attendance Synced",
        description: res.message || `Pushed roster for ${dailyDate} to Google Sheets.`,
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err?.message || "Failed to sync daily attendance.",
        variant: "destructive",
      });
    } finally {
      setSyncingDaily(false);
    }
  };

  const handleSyncMonthly = async () => {
    try {
      setSyncingMonthly(true);
      const res = await syncMonthlyAttendanceSheet(monthlyMonth);
      toast({
        title: "Monthly Register Synced",
        description: res.message || `Pushed monthly attendance register to tab "${res.data?.tabTitle}".`,
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err?.message || "Failed to sync monthly register.",
        variant: "destructive",
      });
    } finally {
      setSyncingMonthly(false);
    }
  };

  const handleSyncManual = async () => {
    try {
      setSyncingManual(true);
      const res = await syncManualAttendanceSheet(manualDate);
      toast({
        title: "Manual Roll-Calls Synced",
        description: res.message || `Pushed manual classroom register for ${manualDate}.`,
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err?.message || "Failed to sync manual roll-calls.",
        variant: "destructive",
      });
    } finally {
      setSyncingManual(false);
    }
  };

  const handleSyncTalabat = async () => {
    try {
      setSyncingTalabat(true);
      const res = await syncTalabatDirectorySheet();
      toast({
        title: "Talabat Directory Synced",
        description: res.message || `Updated Talabat directory tab with ${res.data?.rowsSynced} students.`,
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err?.message || "Failed to sync Talabat directory.",
        variant: "destructive",
      });
    } finally {
      setSyncingTalabat(false);
    }
  };

  const handleSyncFaculty = async () => {
    try {
      setSyncingFaculty(true);
      const res = await syncFacultyDirectorySheet();
      toast({
        title: "Faculty Roster Synced",
        description: res.message || `Updated Faculty roster tab with ${res.data?.rowsSynced} members.`,
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err?.message || "Failed to sync Faculty roster.",
        variant: "destructive",
      });
    } finally {
      setSyncingFaculty(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      const res = await syncAllRecordsSheet({ date: dailyDate, month: monthlyMonth });
      toast({
        title: "All Records Synced to Google Sheets",
        description: res.message || "Daily logs, monthly register, Talabat & faculty directories pushed successfully!",
        variant: "success",
      });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: "Batch Sync Error",
        description: err?.message || "Failed to batch sync records.",
        variant: "destructive",
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const sheetUrl = status?.url || (status?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${status.spreadsheetId}` : null);
  const embedUrl = status?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit?widget=true&headers=false` : null;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Breadcrumb & Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Google Sheets Synchronization"
        hubDescription="Centralized cloud spreadsheet synchronization for Daily Attendance, Monthly Registers, Talabat Directory, and Faculty Rosters."
        tabs={[
          { label: "Google Sheets Center", href: "/admin/google-sheets", icon: FileSpreadsheet, badge: "Central" },
          { label: "Attendance Logs & Registry", href: "/admin/attendance-logs", icon: Layers },
          { label: "Manual Classroom Register", href: "/admin/manual-attendance", icon: ClipboardCheck },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Calendar },
        ]}
      />

      {/* ── UPPER SIDE: Primary Google Sheet Viewer & Status Cockpit ── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-emerald-900/40 bg-white dark:bg-[#062016] p-6 sm:p-8 shadow-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-emerald-900/30">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <FileSpreadsheet className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white font-display">
                  Official Google Spreadsheet
                </h1>
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <RefreshCw className="h-3 w-3 animate-spin text-emerald-600" /> Connecting...
                  </span>
                ) : status?.configured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Sync Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    <AlertCircle className="h-3 w-3" />
                    Setup Required
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/70 max-w-2xl font-medium">
                Live Google Spreadsheet containing institutional attendance sheets, monthly registers, and school directories. All stakeholders can view real-time data directly from the upper panel.
              </p>
            </div>
          </div>

          {/* Upper Side Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md hover:shadow-emerald-600/30 transition-all cursor-pointer"
                title="Open live Google Spreadsheet in a new tab"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Google Sheet</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowEmbedPreview(!showEmbedPreview)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 border border-slate-200 dark:border-emerald-800 text-slate-800 dark:text-white text-xs font-bold transition-all cursor-pointer"
            >
              {showEmbedPreview ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4 text-emerald-600" />}
              <span>{showEmbedPreview ? "Hide Preview" : "View Sheet Here"}</span>
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Test Google API connection"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", testingConnection && "animate-spin text-emerald-500")} />
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              title="Configure Google Spreadsheet ID"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Diagnostic Metadata Strip */}
        <div className="relative z-10 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-emerald-100/60">
          <div className="flex flex-wrap items-center gap-4">
            {status?.spreadsheetId ? (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300">Spreadsheet ID:</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-800 dark:text-slate-200">
                  {status.maskedSpreadsheetId || status.spreadsheetId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 hover:text-emerald-600 cursor-pointer transition-colors"
                  title="Copy Spreadsheet ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">No Spreadsheet ID linked</span>
            )}

            {status?.serviceAccountEmail && (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300">Service Account:</span>
                <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                  {status.serviceAccountEmail}
                </span>
              </div>
            )}
          </div>

          <div>
            {status?.lastSyncedAt ? (
              <span>
                Last pushed:{" "}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {new Date(status.lastSyncedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                </strong>
              </span>
            ) : (
              <span>Not synced in this server session</span>
            )}
          </div>
        </div>

        {/* ── Embedded Live Sheet View ── */}
        {showEmbedPreview && embedUrl && (
          <div className="relative z-10 mt-6 rounded-2xl overflow-hidden border border-slate-300 dark:border-emerald-800 bg-white shadow-inner">
            <div className="p-3 bg-slate-100 dark:bg-emerald-950 flex items-center justify-between border-b border-slate-200 dark:border-emerald-800 text-xs font-bold text-slate-700 dark:text-emerald-200">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Live Embedded View — Darse Burhani Official Spreadsheet
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={sheetUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-bold cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Full Screen
                </a>
              </div>
            </div>
            <iframe
              src={embedUrl}
              className="w-full h-[540px] border-none"
              title="Live Google Sheet"
              loading="lazy"
            />
          </div>
        )}

        {/* Config Form Drawer */}
        {showConfig && (
          <form onSubmit={handleSaveConfig} className="relative z-10 mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Change Google Spreadsheet Configuration
              </h3>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={configSpreadsheetId}
                onChange={(e) => setConfigSpreadsheetId(e.target.value)}
                placeholder="Paste Google Spreadsheet URL or Spreadsheet ID..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? "Saving..." : "Save Spreadsheet ID"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Make sure this spreadsheet is shared with the Google Service Account as <strong>Editor</strong>.
            </p>
          </form>
        )}
      </div>

      {/* ── ALL-IN-ONE BATCH SYNC BANNER ── */}
      <div className="rounded-3xl border border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-[#031d14] dark:via-[#05281b] dark:to-[#031d14] p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              One-Click Full Synchronization
            </h2>
            <p className="text-xs text-slate-600 dark:text-emerald-100/70 font-medium">
              Push all records at once: Daily Attendance ({dailyDate}), Monthly Register ({monthlyMonth}), Talabat Directory, and Faculty Roster.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn("w-4 h-4", syncingAll && "animate-spin")} />
          <span>{syncingAll ? "Syncing All Records..." : "Sync All Records to Sheet"}</span>
        </button>
      </div>

      {/* ── SECTION: Sync Any Records (Individual Panels) ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white font-display">
            Selective Record Synchronization
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose specific records and datasets to push into dedicated tabs on the Google Sheet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* Card 1: Daily Attendance */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c2219] p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Daily Attendance Log
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Tab: YYYY-MM-DD</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50">
                  Biometric &amp; Manual
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synchronizes hardware biometric punches, check-ins/outs, and excused leaves for the selected date.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncDaily}
              disabled={syncingDaily}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncingDaily && "animate-spin")} />
              <span>{syncingDaily ? "Syncing..." : `Sync Daily Log (${dailyDate})`}</span>
            </button>
          </div>

          {/* Card 2: Monthly Attendance Register */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c2219] p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Monthly Register
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Tab: Register - YYYY-MM</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50">
                  Full Grid
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pushes complete monthly summary grid with day-by-day presence, absent totals, and attendance percentages.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Target Month (YYYY-MM)
                </label>
                <input
                  type="month"
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncMonthly}
              disabled={syncingMonthly}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncingMonthly && "animate-spin")} />
              <span>{syncingMonthly ? "Syncing..." : `Sync Monthly (${monthlyMonth})`}</span>
            </button>
          </div>

          {/* Card 3: Manual Roll-Call Attendance */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c2219] p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Manual Roll-Call
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Tab: Manual - YYYY-MM-DD</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50">
                  Classroom
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pushes teacher classroom registers with student statuses, remarks, and teacher justifications.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncManual}
              disabled={syncingManual}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncingManual && "animate-spin")} />
              <span>{syncingManual ? "Syncing..." : `Sync Manual (${manualDate})`}</span>
            </button>
          </div>

          {/* Card 4: Talabat (Student) Directory */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c2219] p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Talabat Directory
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Tab: Talabat Directory</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50">
                  Institutional
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exports all enrolled students with ITS, Student ID, grade, section, parent details, and yearly profile completion status.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSyncTalabat}
              disabled={syncingTalabat}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncingTalabat && "animate-spin")} />
              <span>{syncingTalabat ? "Syncing..." : "Sync Talabat Directory"}</span>
            </button>
          </div>

          {/* Card 5: Faculty & Staff Roster */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c2219] p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Faculty &amp; Staff Roster
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Tab: Faculty Directory</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50">
                  Staff
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exports all teachers and staff with Employee ID, department, designation, and official contacts.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSyncFaculty}
              disabled={syncingFaculty}
              className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncingFaculty && "animate-spin")} />
              <span>{syncingFaculty ? "Syncing..." : "Sync Faculty Roster"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
