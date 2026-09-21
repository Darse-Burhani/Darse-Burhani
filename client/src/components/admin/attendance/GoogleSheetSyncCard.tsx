import React, { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Loader2,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getSheetSyncStatus,
  testSheetConnection,
  saveSheetConfig,
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
  const [modalOpen, setModalOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [lastSyncResult, setLastSyncResult] = useState<SheetSyncResult | null>(null);

  // Form states for configuration modal
  const [sheetUrlOrId, setSheetUrlOrId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [serviceAccountPrivateKey, setServiceAccountPrivateKey] = useState("");
  const [useJsonMode, setUseJsonMode] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncHourUtc, setSyncHourUtc] = useState("15");

  // Testing connection states
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSheetSyncStatus();
      setStatus(data);
      if (data.spreadsheetId) setSheetUrlOrId(data.spreadsheetId);
      setAutoSyncEnabled(data.enabled);
      setSyncHourUtc(String(data.syncHourUtc || "15"));
    } catch (err) {
      console.error("Failed to load Google Sheet sync status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async (dateParam?: string) => {
    if (!status?.configured) {
      setModalOpen(true);
      return;
    }
    try {
      setSyncing(true);
      const res = await syncAttendanceSheet(dateParam);
      setLastSyncResult(res.data);
      toast.success(res.message || "Attendance pushed to Google Sheet successfully!");
      if (onSyncComplete) onSyncComplete(res.data);
      fetchStatus();
    } catch (err) {
      toast.error((err as Error).message || "Failed to push to Google Sheet");
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestSuccess(null);
    setTestError(null);
    try {
      const payload = useJsonMode
        ? { spreadsheetId: sheetUrlOrId, serviceAccountJson }
        : { spreadsheetId: sheetUrlOrId, serviceAccountEmail, serviceAccountPrivateKey };

      const res = await testSheetConnection(payload);
      setTestSuccess(`Connected to "${res.title}" (${res.sheetNames.length} tabs found)`);
      toast.success(`Connected to "${res.title}" successfully!`);
    } catch (err) {
      const msg = (err as Error).message || "Connection failed";
      setTestError(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = useJsonMode
        ? {
            spreadsheetId: sheetUrlOrId,
            serviceAccountJson,
            enabled: autoSyncEnabled,
            syncHourUtc: parseInt(syncHourUtc, 10),
          }
        : {
            spreadsheetId: sheetUrlOrId,
            serviceAccountEmail,
            serviceAccountPrivateKey,
            enabled: autoSyncEnabled,
            syncHourUtc: parseInt(syncHourUtc, 10),
          };

      const res = await saveSheetConfig(payload);
      toast.success("Google Sheet configuration saved & activated!");
      setStatus(res.data);
      setModalOpen(false);
      fetchStatus();
    } catch (err) {
      toast.error((err as Error).message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 p-5 text-white shadow-xl transition-all ${
          status?.configured
            ? "border-emerald-500/30 hover:border-emerald-500/50"
            : "border-amber-500/30 hover:border-amber-500/50"
        } ${className}`}
      >
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Left info side */}
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                status?.configured
                  ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/20 text-amber-300"
              } shadow-inner`}
            >
              <FileSpreadsheet className="h-6 w-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">Daily Google Sheet Sync</h3>
                {loading ? (
                  <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                  </span>
                ) : status?.configured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected & Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 shadow-sm">
                    <AlertCircle className="h-3 w-3" /> Setup Required
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-300">
                {status?.configured
                  ? "Attendance registers, scans, and verified leaves push automatically into dedicated daily date tabs and a cumulative Summary sheet."
                  : "Connect your Google Spreadsheet to automatically sync daily Talabat and Faculty attendance rosters with live leave bifurcations."}
              </p>

              {status?.configured && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  {status.spreadsheetId && (
                    <span className="font-mono text-[11px] text-emerald-200/80">
                      ID: {status.maskedSpreadsheetId || status.spreadsheetId.slice(0, 8) + "..."}
                    </span>
                  )}
                  {status.serviceAccountEmail && (
                    <span className="text-[11px] text-slate-400">
                      Service: <span className="font-mono text-slate-300">{status.serviceAccountEmail}</span>
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    Auto-push: <b className="text-slate-200">{status.enabled ? "Active (Daily 8:30 PM IST)" : "Paused"}</b>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            {status?.configured && status.url && (
              <a
                href={status.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition-all hover:border-emerald-500/40 hover:bg-slate-700 hover:text-white shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                <span>Open Google Sheet</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => handleSync()}
              disabled={syncing || loading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-md transition-all ${
                status?.configured
                  ? "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95"
                  : "bg-amber-600 text-white hover:bg-amber-500 active:scale-95"
              }`}
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Syncing to Sheet...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{status?.configured ? "Sync Today to Sheet" : "Connect Sheet"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
              title="Configure Google Sheet credentials and auto-sync schedule"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sync Summary pill if recently synced */}
        {lastSyncResult && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Synced <b>{lastSyncResult.rowsSynced}</b> records to tab <b>'{lastSyncResult.tabTitle}'</b>
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-emerald-300/80">
              <span>Talabat: {lastSyncResult.stats.studentPresent}P / {lastSyncResult.stats.studentLate}L / {lastSyncResult.stats.studentAbsent}A ({lastSyncResult.stats.studentRate}%)</span>
              <span>Faculty: {lastSyncResult.stats.teacherPresent}P / {lastSyncResult.stats.teacherLate}L / {lastSyncResult.stats.teacherAbsent}A</span>
            </div>
          </div>
        )}
      </div>

      {/* Configuration & Connection Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Connect Daily Google Sheet</h2>
                  <p className="text-xs text-slate-400">
                    Configure direct automated synchronization for daily attendance logs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick Setup Guide Drawer */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <button
                type="button"
                onClick={() => setGuideOpen(!guideOpen)}
                className="flex w-full items-center justify-between text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                <span className="flex items-center gap-1.5">
                  <Info className="h-4 w-4" /> 4-Step Google Sheet Connection Guide
                </span>
                {guideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {guideOpen && (
                <div className="mt-3 space-y-2.5 border-t border-slate-800/80 pt-3 text-xs text-slate-300 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      1
                    </span>
                    <p>
                      Create a new Google Sheet at{" "}
                      <a
                        href="https://sheets.new"
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-emerald-400"
                      >
                        sheets.new
                      </a>{" "}
                      (e.g., named <i>"Darse Burhani — Attendance Log"</i>).
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      2
                    </span>
                    <p>
                      In Google Cloud Console, create a <b>Service Account</b> with the <b>Google Sheets API</b> enabled, and download the JSON key.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      3
                    </span>
                    <p>
                      Open your Google Sheet, click <b>Share</b>, and invite your Service Account Email as an <b>Editor</b>.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      4
                    </span>
                    <p>Paste the Google Sheet URL and Service Account JSON below, then click <b>Test Connection</b>.</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
              {/* Spreadsheet ID / URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-200">
                  Google Sheet URL or Spreadsheet ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/1AbC...xyz/edit or 1AbC...xyz"
                  value={sheetUrlOrId}
                  onChange={(e) => setSheetUrlOrId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  You can paste the entire browser link to your Google Sheet — we automatically extract the ID.
                </p>
              </div>

              {/* Credential Format Toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-200">
                    Service Account Credentials <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setUseJsonMode(true)}
                      className={`rounded-md px-2 py-1 font-medium transition-all ${
                        useJsonMode ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      JSON Key (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseJsonMode(false)}
                      className={`rounded-md px-2 py-1 font-medium transition-all ${
                        !useJsonMode ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      Email + Private Key
                    </button>
                  </div>
                </div>

                {useJsonMode ? (
                  <div className="mt-1.5">
                    <textarea
                      rows={5}
                      placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..." }'
                      value={serviceAccountJson}
                      onChange={(e) => setServiceAccountJson(e.target.value)}
                      className="w-full font-mono text-[11px] rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Paste the raw contents of your downloaded Google Cloud Service Account JSON key file.
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-3">
                    <div>
                      <input
                        type="email"
                        placeholder="service-account@project.iam.gserviceaccount.com"
                        value={serviceAccountEmail}
                        onChange={(e) => setServiceAccountEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <textarea
                        rows={4}
                        placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                        value={serviceAccountPrivateKey}
                        onChange={(e) => setServiceAccountPrivateKey(e.target.value)}
                        className="w-full font-mono text-[11px] rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic Push Setting */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                <div>
                  <p className="text-xs font-semibold text-white">Daily Automated Sync</p>
                  <p className="text-[11px] text-slate-400">
                    Automatically pushes attendance at the end of school day (20:30 IST / 15:00 UTC)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              {/* Test Connection Feedback */}
              {testSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{testSuccess}</span>
                </div>
              )}
              {testError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Connection Failed</p>
                    <p className="text-[11px] text-rose-300/90 mt-0.5">{testError}</p>
                    <p className="text-[10px] text-rose-400 mt-1">
                      Tip: Ensure you have clicked "Share" on your Google Sheet and given "Editor" access to your Service Account email.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !sheetUrlOrId}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save & Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
