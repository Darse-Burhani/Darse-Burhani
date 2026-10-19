import React, { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  Clipboard,
  Check,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Key,
  ShieldCheck,
  Zap,
  Info,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import {
  getSheetSyncStatus,
  saveSheetConfig,
  testSheetConnection,
  SheetSyncStatusData,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface GoogleSheetPasteConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: (status: SheetSyncStatusData) => void;
  syncNowAction?: {
    label: string;
    onSync: () => Promise<void>;
  };
}

export function GoogleSheetPasteConfigModal({
  open,
  onOpenChange,
  onConfigSaved,
  syncNowAction,
}: GoogleSheetPasteConfigModalProps) {
  const [sheetUrlOrId, setSheetUrlOrId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [status, setStatus] = useState<SheetSyncStatusData | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Extracted preview info
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const [detectedProjectId, setDetectedProjectId] = useState<string | null>(null);

  // Load existing status when opened
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getSheetSyncStatus();
      setStatus(s);
      if (s?.spreadsheetId && !sheetUrlOrId) {
        setSheetUrlOrId(s.spreadsheetId);
      }
      if (s?.fullServiceAccountEmail) {
        setDetectedEmail(s.fullServiceAccountEmail);
      }
      if (s?.projectId) {
        setDetectedProjectId(s.projectId);
      }
    } catch (err) {
      console.error("Failed to load sheet sync status:", err);
    } finally {
      setLoading(false);
    }
  }, [sheetUrlOrId]);

  useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open, loadStatus]);

  // Extract clean ID from input
  const extractCleanId = (input: string): string => {
    const trimmed = (input || "").trim();
    if (!trimmed) return "";
    const match = trimmed.match(/\/spreadsheets\/(?:d|u\/\d+\/d)\/([a-zA-Z0-9-_]+)/i);
    if (match && match[1]) return match[1];
    const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/i);
    if (pubMatch && pubMatch[1]) return pubMatch[1];
    const clean = trimmed.split(/[?#&]/)[0].trim();
    if (clean.includes("/")) {
      const parts = clean.split("/").filter(Boolean);
      const dIdx = parts.indexOf("d");
      if (dIdx !== -1 && parts[dIdx + 1]) return parts[dIdx + 1].trim();
      return parts[parts.length - 1].trim();
    }
    return clean.replace(/['"`[\]]/g, "").trim();
  };

  const cleanSpreadsheetId = extractCleanId(sheetUrlOrId);

  // Auto-parse Service Account JSON whenever it changes
  useEffect(() => {
    const raw = serviceAccountJson.trim();
    if (!raw) return;
    try {
      // Check if user accidentally pasted sheet link into JSON box
      if (raw.includes("docs.google.com/spreadsheets") && !sheetUrlOrId) {
        setSheetUrlOrId(raw);
        setServiceAccountJson("");
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed.client_email) setDetectedEmail(parsed.client_email);
      if (parsed.project_id) setDetectedProjectId(parsed.project_id);
    } catch {
      // Not yet valid JSON
    }
  }, [serviceAccountJson, sheetUrlOrId]);

  // Auto-detect if user pasted JSON into the sheet URL box
  const handleSheetUrlChange = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.startsWith("{") && trimmed.includes("client_email")) {
      setServiceAccountJson(trimmed);
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.client_email) setDetectedEmail(parsed.client_email);
        if (parsed.project_id) setDetectedProjectId(parsed.project_id);
      } catch {}
      toast({
        title: "Detected Service Account JSON",
        description: "Moved pasted credentials to the Service Account JSON field.",
        variant: "default",
      });
      return;
    }
    setSheetUrlOrId(val);
  };

  // Clipboard Paste Helpers
  const handlePasteSheetUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleSheetUrlChange(text);
        toast({
          title: "Pasted Spreadsheet Link",
          description: "Spreadsheet URL / ID updated from clipboard.",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Clipboard Access",
        description: "Please press Ctrl+V to paste the link into the box.",
        variant: "default",
      });
    }
  };

  const handlePasteJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setServiceAccountJson(text);
        try {
          const parsed = JSON.parse(text.trim());
          if (parsed.client_email) setDetectedEmail(parsed.client_email);
          if (parsed.project_id) setDetectedProjectId(parsed.project_id);
        } catch {}
        toast({
          title: "Pasted JSON Key",
          description: "Service Account credentials updated from clipboard.",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Clipboard Access",
        description: "Please press Ctrl+V to paste the JSON into the box.",
        variant: "default",
      });
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast({
      title: "Service Account Email Copied",
      description: "Now open your Google Sheet, click 'Share', and paste this email as Editor.",
      variant: "success",
    });
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // Test Connection
  const handleTest = async () => {
    if (!cleanSpreadsheetId) {
      toast({
        title: "Missing Spreadsheet ID",
        description: "Please paste your Google Sheet link or ID first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setTesting(true);
      const res = await testSheetConnection({
        spreadsheetId: cleanSpreadsheetId,
        serviceAccountJson: serviceAccountJson.trim() || undefined,
      });
      toast({
        title: "Connection Successful! 🎉",
        description: `Connected to spreadsheet "${res.title}". Found ${res.sheetNames.length} tabs.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err?.message || "Failed to reach Google Sheets API.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  // Save Configuration
  const handleSave = async (andSync = false) => {
    if (!cleanSpreadsheetId) {
      toast({
        title: "Validation Error",
        description: "Please paste a valid Google Spreadsheet URL or ID.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const res = await saveSheetConfig({
        spreadsheetId: cleanSpreadsheetId,
        serviceAccountJson: serviceAccountJson.trim() || undefined,
        enabled: true,
        testNow: true,
      });

      setStatus(res.data);
      if (onConfigSaved) onConfigSaved(res.data);

      if (res.testFailed) {
        toast({
          title: "Saved with Warning",
          description: res.error || "Configuration was saved, but Google Sheets API test failed. Check permissions.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Configuration Saved! 🚀",
          description: res.message || "Google Sheets sync configuration active.",
          variant: "success",
        });

        if (andSync && syncNowAction) {
          setSyncingNow(true);
          try {
            await syncNowAction.onSync();
            onOpenChange(false);
          } finally {
            setSyncingNow(false);
          }
        } else {
          onOpenChange(false);
        }
      }
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message || "Could not save sheet configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const activeEmail = detectedEmail || status?.fullServiceAccountEmail;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl bg-slate-950 text-white border border-emerald-900/40 p-6 sm:p-7 rounded-[28px] shadow-2xl">
        <ModalHeader className="pb-3 border-b border-emerald-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-900/50">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <ModalTitle className="text-xl font-black text-white flex items-center gap-2">
                <span>Google Sheets Configuration</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Paste &amp; Connect
                </span>
              </ModalTitle>
              <ModalDescription className="text-xs text-slate-300">
                Paste your Google Spreadsheet link and Service Account JSON key for seamless cloud syncing.
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <div className="space-y-5 pt-4">
          {/* Step 1: Google Spreadsheet Link / ID */}
          <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <span>Step 1: Paste Google Spreadsheet URL or ID</span>
                <span className="text-amber-400">*</span>
              </label>
              <button
                type="button"
                onClick={handlePasteSheetUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste Link</span>
              </button>
            </div>

            <input
              type="text"
              value={sheetUrlOrId}
              onChange={(e) => handleSheetUrlChange(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/1AbCxyz.../edit#gid=0"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />

            {cleanSpreadsheetId ? (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Detected ID:</span>
                  <code className="text-emerald-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">
                    {cleanSpreadsheetId.slice(0, 14)}...{cleanSpreadsheetId.slice(-6)}
                  </code>
                </span>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${cleanSpreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-semibold"
                >
                  <ExternalLink className="w-3 h-3" /> Open in Docs
                </a>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Copy the URL directly from your browser's address bar when viewing your Google Sheet.
              </p>
            )}
          </div>

          {/* Step 2: Google Service Account JSON Key */}
          <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <span>Step 2: Paste Service Account JSON Key</span>
                <span className="text-slate-400 text-[10px] lowercase font-normal">(required for write access)</span>
              </label>
              <button
                type="button"
                onClick={handlePasteJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                title="Paste JSON from clipboard"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Paste JSON</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              placeholder='{ "type": "service_account", "client_email": "darse-burhani-sync@project.iam.gserviceaccount.com", "private_key": "-----BEGIN PRIVATE KEY-----..." }'
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono resize-y"
            />

            {/* Email Sharing Instruction */}
            {activeEmail ? (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    Crucial: Share Sheet as Editor with this Email:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(activeEmail)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[11px] hover:bg-amber-300 transition-all cursor-pointer"
                  >
                    {copiedEmail ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEmail ? "Copied!" : "Copy Email"}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] bg-slate-950/80 px-2.5 py-1 rounded border border-amber-500/20 break-all select-all text-amber-300">
                  {activeEmail}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Obtain your JSON key from <strong>Google Cloud Console &rarr; IAM &amp; Admin &rarr; Service Accounts &rarr; Keys &rarr; Add Key (JSON)</strong>. Enable the <strong>Google Sheets API</strong> in API Library.
                </span>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !cleanSpreadsheetId}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", testing && "animate-spin text-emerald-400")} />
              <span>{testing ? "Testing..." : "Test Connection"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving || !cleanSpreadsheetId}
                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Config"}
              </button>

              {syncNowAction && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || syncingNow || !cleanSpreadsheetId}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-emerald-950 text-xs font-black shadow-lg shadow-emerald-900/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className={cn("w-3.5 h-3.5", syncingNow && "animate-spin")} />
                  <span>{syncingNow ? "Syncing..." : syncNowAction.label}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
