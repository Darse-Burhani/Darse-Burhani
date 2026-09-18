"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Upload,
  Send,
  Globe,
  Link2,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  Edit3,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Copy,
  X,
  Save,
  Download,
  Printer,
  Undo2,
  BarChart3,
  Users,
  TrendingUp,
  Trophy,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; color: string; bgColor: string; borderColor: string }> = {
  COMPLETED: { label: "Completed", labelEn: "Completed", color: "text-emerald-800", bgColor: "bg-emerald-50", borderColor: "border-emerald-300" },
  IN_PROGRESS: { label: "In Progress", labelEn: "In Progress", color: "text-blue-800", bgColor: "bg-blue-50", borderColor: "border-blue-300" },
  WEAK: { label: "Weak", labelEn: "Weak", color: "text-amber-800", bgColor: "bg-amber-50", borderColor: "border-amber-300" },
  NOT_STARTED: { label: "Not Started", labelEn: "Not Started", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  NEEDS_REVIEW: { label: "Needs Review", labelEn: "Needs Review", color: "text-red-800", bgColor: "bg-red-50", borderColor: "border-red-300" },
};

const ACHIEVEMENT_BADGES = [
  { id: "first_juz", label: "First Juz", icon: "🎯", description: "First Juz Complete" },
  { id: "five_juz", label: "5 Juz", icon: "📚", description: "5 Juz Complete" },
  { id: "ten_juz", label: "10 Juz", icon: "⭐", description: "10 Juz Complete" },
  { id: "fifteen_juz", label: "15 Juz", icon: "🌟", description: "15 Juz Complete" },
  { id: "twenty_juz", label: "20 Juz", icon: "🏆", description: "20 Juz Complete" },
  { id: "twenty_five_juz", label: "25 Juz", icon: "🔥", description: "25 Juz Complete" },
  { id: "complete_quran", label: "Complete Quran", icon: "👑", description: "Complete Quran" },
  { id: "perfect_score", label: "Perfect Score", icon: "💯", description: "100% Score" },
];

function getStudentBadges(report: any): string[] {
  const badges: string[] = [];
  const completedParts = report.parts.filter((p: any) => p.status === "COMPLETED").length;
  if (completedParts >= 1) badges.push("first_juz");
  if (completedParts >= 5) badges.push("five_juz");
  if (completedParts >= 10) badges.push("ten_juz");
  if (completedParts >= 15) badges.push("fifteen_juz");
  if (completedParts >= 20) badges.push("twenty_juz");
  if (completedParts >= 25) badges.push("twenty_five_juz");
  if (completedParts >= 30) badges.push("complete_quran");
  return badges;
}

function getStudentTag(report: any): Array<{ label: string; color: string }> {
  const tags: Array<{ label: string; color: string }> = [];
  const completedParts = report.parts.filter((p: any) => p.status === "COMPLETED").length;
  const progress = Math.round((completedParts / 30) * 100);
  if (progress >= 80) tags.push({ label: "متفوق", color: "bg-yellow-100 text-yellow-700" });
  else if (progress >= 50) tags.push({ label: "جيد جداً", color: "bg-emerald-100 text-emerald-700" });
  else if (progress >= 25) tags.push({ label: "جيد", color: "bg-blue-100 text-blue-700" });
  return tags;
}

function StatCard({ icon: Icon, label, value, color, bgColor }: { icon: any; label: string; value: string | number; color: string; bgColor: string }) {
  return (
    <div className={`p-4 rounded-2xl ${bgColor} ring-1 ring-black/[0.04]`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          <p className="text-[11px] text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewProgressRing({ progress, size = 80, strokeWidth = 7 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="previewGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#previewGrad)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color: "#047857" }}>{progress}%</span>
      </div>
    </div>
  );
}

export default function AdminHifzPage() {
  const [reports, setReports] = useState<any[]>([]);
  // Ensure reports is always an array
  const safeReports = Array.isArray(reports) ? reports : [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Import
  const [importSheetId, setImportSheetId] = useState("");
  const [importAcademicYear, setImportAcademicYear] = useState("2025-2026");
  const [importSemester, setImportSemester] = useState("1");
  const [importAutoPublish, setImportAutoPublish] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; total: number; reportsCreated: number; studentsCreated: number; published: number; academicYear: string; semester: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Publish & Share
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; emails?: Array<{ email: string; subject: string; html: string; studentName: string }> } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // View & Filter
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft" | "hidden">("all");
  const [filterDarajah, setFilterDarajah] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "progress" | "darajah" | "recent">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selection & Batch
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());

  // Preview - Now inline, not overlay
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editPartForm, setEditPartForm] = useState<any>({});
  const [togglingPart, setTogglingPart] = useState<string | null>(null);

  // Dashboard
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "f") {
          e.preventDefault();
          document.querySelector<HTMLInputElement>("[data-search]")?.focus();
        }
      }
      if (e.key === "Escape") {
        setSelectedReportId(null);
        setEditingPartId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/hifz");
      const data = await res.json();
      if (data.success) {
        setReports(data.data.reports || []);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const darajahs = useMemo(() => {
    const set = new Set(safeReports.map((r: any) => r.studentGrade).filter(Boolean));
    return Array.from(set).sort();
  }, [safeReports]);

  const stats = useMemo(() => {
    const total = safeReports.length;
    const published = safeReports.filter((r) => r.isPublished).length;
    const drafts = safeReports.filter((r) => !r.isPublished && !r.isHidden).length;
    const hidden = safeReports.filter((r) => r.isHidden).length;
    const avgProgress = total > 0 ? Math.round(safeReports.reduce((sum, r) => {
      const completed = r.parts.filter((p: any) => p.status === "COMPLETED").length;
      return sum + (completed / 30) * 100;
    }, 0) / total) : 0;
    const byDarajah: Record<string, { total: number; avgProgress: number }> = {};
    safeReports.forEach((r) => {
      if (!byDarajah[r.studentGrade]) byDarajah[r.studentGrade] = { total: 0, avgProgress: 0 };
      byDarajah[r.studentGrade].total++;
      const completed = r.parts.filter((p: any) => p.status === "COMPLETED").length;
      byDarajah[r.studentGrade].avgProgress += (completed / 30) * 100;
    });
    Object.keys(byDarajah).forEach((d) => {
      byDarajah[d].avgProgress = Math.round(byDarajah[d].avgProgress / byDarajah[d].total);
    });
    return { total, published, drafts, hidden, avgProgress, byDarajah };
  }, [safeReports]);

  const filtered = useMemo(() => {
    let result = [...safeReports];
    if (filterStatus === "published") result = result.filter((r) => r.isPublished);
    else if (filterStatus === "draft") result = result.filter((r) => !r.isPublished && !r.isHidden);
    else if (filterStatus === "hidden") result = result.filter((r) => r.isHidden);
    if (filterDarajah !== "all") result = result.filter((r) => r.studentGrade === filterDarajah);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentGrade?.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.studentName.localeCompare(b.studentName);
      else if (sortBy === "darajah") cmp = (a.studentGrade || "").localeCompare(b.studentGrade || "");
      else if (sortBy === "progress") {
        const aP = a.parts.filter((p: any) => p.status === "COMPLETED").length;
        const bP = b.parts.filter((p: any) => p.status === "COMPLETED").length;
        cmp = aP - bP;
      } else if (sortBy === "recent") cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return result;
  }, [safeReports, filterStatus, filterDarajah, search, sortBy, sortOrder]);

  const selectedReport = useMemo(() => {
    if (!selectedReportId) return null;
    return safeReports.find((r) => r.id === selectedReportId) || null;
  }, [selectedReportId, safeReports]);

  const getPreviewStats = (report: any) => {
    const visibleParts = report.parts.filter((p: any) => !p.isHidden);
    const completed = visibleParts.filter((p: any) => p.status === "COMPLETED").length;
    const inProgress = visibleParts.filter((p: any) => p.status === "IN_PROGRESS").length;
    const weak = visibleParts.filter((p: any) => p.isWeak).length;
    const currentPart = report.parts.find((p: any) => p.status === "IN_PROGRESS" || p.status === "COMPLETED");
    const currentJuz = currentPart?.partNumber || 0;
    const currentSafah = currentPart?.currentPage || 0;
    const totalJadeedPages = report.parts.reduce((sum: number, p: any) => sum + (p.sentencesMemorized || 0), 0);
    const performancePercent = currentPart?.performancePercent || currentPart?.sentencePercentage || Math.round((completed / 30) * 100);
    const progress = visibleParts.length > 0 ? Math.round((completed / 30) * 100) : 0;
    return { completed, inProgress, weak, total: visibleParts.length, progress, currentJuz, currentSafah, totalJadeedPages, performancePercent };
  };

  const handlePublish = async (reportId: string, publish: boolean) => {
    setPublishing(reportId);
    try {
      await fetch("/api/admin/hifz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, isPublished: publish }),
      });
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, isPublished: publish } : r));
    } finally {
      setPublishing(null);
    }
  };

  const handlePublishAll = async () => {
    setPublishingAll(true);
    try {
      const draftIds = safeReports.filter((r) => !r.isPublished && !r.isHidden).map((r) => r.id);
      await Promise.all(draftIds.map((id) =>
        fetch("/api/admin/hifz", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: id, isPublished: true }),
        })
      ));
      setReports((prev) => prev.map((r) => (!r.isPublished && !r.isHidden) ? { ...r, isPublished: true } : r));
    } finally {
      setPublishingAll(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Delete this report?")) return;
    setSaving(reportId);
    try {
      await fetch(`/api/admin/hifz?id=${reportId}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (selectedReportId === reportId) setSelectedReportId(null);
    } finally {
      setSaving(null);
    }
  };

  const handleTogglePart = async (reportId: string, partId: string, isHidden: boolean) => {
    setTogglingPart(partId);
    try {
      const report = safeReports.find((r) => r.id === reportId);
      const part = report?.parts.find((p: any) => p.id === partId);
      if (!part) return;
      await fetch("/api/admin/hifz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, partId, partData: { ...part, isHidden } }),
      });
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, parts: r.parts.map((p: any) => p.id === partId ? { ...p, isHidden } : p) } : r));
    } finally {
      setTogglingPart(null);
    }
  };

  const handleEditPart = (part: any) => {
    setEditingPartId(part.id);
    setEditPartForm({
      status: part.status,
      progress: part.progress,
      reviewCount: part.reviewCount,
      targetReviews: part.targetReviews,
      sentencesMemorized: part.sentencesMemorized,
      firmProgress: part.firmProgress,
      firmTarget: part.firmTarget,
      currentPage: part.currentPage,
      totalPages: part.totalPages,
      notes: part.notes || "",
    });
  };

  const handleSavePart = async (reportId: string, partId: string) => {
    setSaving(`part-${partId}`);
    try {
      await fetch("/api/admin/hifz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, partId, partData: editPartForm }),
      });
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, parts: r.parts.map((p: any) => p.id === partId ? { ...p, ...editPartForm } : p) } : r));
      setEditingPartId(null);
    } finally {
      setSaving(null);
    }
  };

  const handleImportFromSheet = async () => {
    if (!importSheetId) return;
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);
    setImportProgress(0);
    try {
      const res = await fetch("/api/admin/hifz/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: importSheetId,
          academicYear: importAcademicYear,
          semester: importSemester,
          publish: importAutoPublish,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(data.data);
        fetchData();
      } else {
        setImportError(data.error);
      }
    } catch {
      setImportError("Network error");
    } finally {
      setImportLoading(false);
    }
  };

  const handleSendEmails = async () => {
    const reportsToSend = selectedReports.size > 0
      ? safeReports.filter((r) => selectedReports.has(r.id) && r.isPublished)
      : safeReports.filter((r) => r.isPublished);
    if (reportsToSend.length === 0) { alert("No published reports to send"); return; }
    if (!confirm(`Send report cards for ${reportsToSend.length} talabat?`)) return;
    setSendingEmails(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/admin/hifz/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportIds: reportsToSend.map((r) => r.id) }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailResult(data.data);
        setShowShareModal(true);
      } else {
        alert(data.error || "Failed to generate emails");
      }
    } catch {
      alert("Network error");
    } finally {
      setSendingEmails(false);
    }
  };

  const handleBatchPublish = async (publish: boolean) => {
    const ids = Array.from(selectedReports);
    await Promise.all(ids.map((id) =>
      fetch("/api/admin/hifz", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id, isPublished: publish }),
      })
    ));
    setReports((prev) => prev.map((r) => selectedReports.has(r.id) ? { ...r, isPublished: publish } : r));
    setSelectedReports(new Set());
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedReports.size} reports?`)) return;
    const ids = Array.from(selectedReports);
    await Promise.all(ids.map((id) => fetch(`/api/admin/hifz?id=${id}`, { method: "DELETE" })));
    setReports((prev) => prev.filter((r) => !selectedReports.has(r.id)));
    setSelectedReports(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedReports.size === filtered.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(filtered.map((r) => r.id)));
    }
  };

  const printReport = (report: any) => {
    const stats = getPreviewStats(report);
    const html = generatePrintHtml(report, stats);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const generatePrintHtml = (report: any, stats: any) => {
    return `<!DOCTYPE html><html><head><title>Hifz Report - ${report.studentName}</title>
    <style>@font-face{font-family:'Al-Kanz';src:url('/Al-Kanz.ttf') format('truetype');font-display:swap;}*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;background:#f5f5f5}.card{max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.header{background:linear-gradient(135deg,#047857,#065f46);padding:24px;color:white;text-align:center}.header h1{font-family:'Al-Kanz',Arial,sans-serif;font-size:26px;margin-bottom:4px}.header p{font-family:'Al-Kanz',Arial,sans-serif;color:#a7f3d0;font-size:16px}.content{padding:24px}.name{text-align:center;font-size:28px;font-weight:700;margin-bottom:4px}.details{text-align:center;color:#666;font-size:14px;margin-bottom:20px}.progress{text-align:center;margin-bottom:24px}.progress-value{font-size:48px;font-weight:700;color:#047857}.progress-label{font-size:14px;color:#666}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}.stat{padding:16px;border-radius:12px;text-align:center}.stat.juz{background:#ecfdf5;border:1px solid #a7f3d0}.stat.page{background:#eff6ff;border:1px solid #bfdbfe}.stat.mem{background:#fffbeb;border:1px solid #fde68a}.stat.total{background:#fdf4ff;border:1px solid #e9d5ff}.stat-val{font-size:24px;font-weight:700}.stat.juz .stat-val{color:#047857}.stat.page .stat-val{color:#1d4ed8}.stat.mem .stat-val{color:#b45309}.stat.total .stat-val{color:#7c3aed}.stat-lbl{font-size:12px;color:#666;margin-top:4px}.footer{text-align:center;padding:16px;border-top:1px solid #eee;color:#999;font-size:12px}</style></head><body>
    <div class="card"><div class="header"><h1>Hifz Report</h1><p>In the name of Allah, the Most Gracious, the Most Merciful</p></div>
    <div class="content"><div class="name">${report.studentName}</div><div class="details">Grade: ${report.studentGrade}${report.studentSection} • ITS: ${report.studentId || 'N/A'}</div>
    <div class="progress"><div class="progress-value">${stats.performancePercent}%</div><div class="progress-label">Overall Performance</div></div>
    <div class="stats"><div class="stat juz"><div class="stat-val">${stats.currentJuz}</div><div class="stat-lbl">Current Juz</div></div><div class="stat page"><div class="stat-val">${stats.currentSafah}</div><div class="stat-lbl">Current Page</div></div><div class="stat mem"><div class="stat-val">${stats.totalJadeedPages}</div><div class="stat-lbl">Pages Memorized</div></div><div class="stat total"><div class="stat-val">30</div><div class="stat-lbl">Total Juz</div></div></div></div>
    <div class="footer">Darse Burhani • Report generated: ${new Date().toLocaleDateString()}</div></div></body></html>`;
  };

  const copyReportLink = (reportId: string) => {
    const url = `${window.location.origin}/talabat/hifz?report=${reportId}`;
    navigator.clipboard.writeText(url);
  };

  const previewEmail = (html: string) => {
    const newWindow = window.open("", "_blank");
    if (newWindow) { newWindow.document.write(html); newWindow.document.close(); }
  };

  const downloadHtml = (html: string, filename: string) => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openmailto = (email: string, subject: string, body: string) => {
    window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)" }}>
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Undo Toast */}
        {showUndoToast && lastAction && (
          <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white px-5 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <span className="text-base">Action completed</span>
            <Button variant="ghost" size="sm" className="text-white hover:bg-gray-700 h-8" onClick={() => {}}>
              <Undo2 className="w-5 h-5 mr-1" /> Undo
            </Button>
            <button onClick={() => setShowUndoToast(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 p-6 sm:p-8 shadow-xl shadow-emerald-900/20">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-amber-300" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Hifz Reports</h1>
                  <p className="text-sm text-emerald-100/70 mt-1">Manage memorization report cards</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label htmlFor="search-talabat" className="sr-only">Search talabat</label>
                <input
                  type="text"
                  id="search-talabat"
                  name="search-talabat"
                  data-search
                  placeholder="Search hafiz name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 px-4 h-10 rounded-full bg-white/10 border border-white/15 text-white placeholder-emerald-200/60 text-sm outline-none focus:bg-white/15 focus:border-amber-300/50"
                />
                <Button variant="outline" size="sm" onClick={() => setShowDashboard(!showDashboard)} className={`h-10 rounded-full ${showDashboard ? "bg-emerald-50 border-emerald-300" : "bg-white/10 border-white/15 text-white hover:bg-white/20"}`}>
                  <BarChart3 className="w-4 h-4" /> Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={handlePublishAll} disabled={publishingAll} className="h-10 rounded-full bg-white/10 border-white/15 text-white hover:bg-white/20">
                  {publishingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish All
                </Button>
                <Button size="sm" onClick={handleSendEmails} disabled={sendingEmails} className="h-10 rounded-full bg-amber-400 text-emerald-950 hover:bg-amber-300 font-bold">
                  {sendingEmails ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} Share
                </Button>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>
        </div>

        {/* Dashboard Panel */}
        {showDashboard && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" /> Dashboard Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                <StatCard icon={Users} label="Total Talabat" value={stats.total} color="text-indigo-600" bgColor="bg-indigo-50" />
                <StatCard icon={CheckCircle} label="Published" value={stats.published} color="text-emerald-600" bgColor="bg-emerald-50" />
                <StatCard icon={FileSpreadsheet} label="Drafts" value={stats.drafts} color="text-gray-600" bgColor="bg-gray-50" />
                <StatCard icon={EyeOff} label="Hidden" value={stats.hidden} color="text-amber-600" bgColor="bg-amber-50" />
                <StatCard icon={TrendingUp} label="Avg Progress" value={`${stats.avgProgress}%`} color="text-blue-600" bgColor="bg-blue-50" />
                <StatCard icon={Trophy} label="Top Performers" value={safeReports.filter(r => Math.round((r.parts.filter((p: any) => p.status === "COMPLETED").length / 30) * 100) >= 80).length} color="text-yellow-600" bgColor="bg-yellow-50" />
              </div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Progress by Darajah</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {darajahs.map(d => (
                  <div key={d} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="font-semibold text-gray-900 text-sm">{d}</div>
                    <div className="text-xs text-gray-500">{stats.byDarajah[d]?.total || 0} talabat</div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stats.byDarajah[d]?.avgProgress || 0}%`, background: "linear-gradient(90deg, #047857, #d4af37)" }} />
                    </div>
                    <div className="text-xs text-emerald-600 mt-1">{stats.byDarajah[d]?.avgProgress || 0}% avg</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Section */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <label htmlFor="import-sheet" className="sr-only">Google Sheets URL or ID</label>
              <input
                type="text"
                id="import-sheet"
                name="import-sheet"
                placeholder="Paste Google Sheets URL or ID..."
                value={importSheetId}
                onChange={(e) => setImportSheetId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <Button variant="admin" size="sm" onClick={handleImportFromSheet} disabled={importLoading || !importSheetId}>
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />} Import
              </Button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
              <span>💡 Paste either a full Google Sheets link or Sheet ID. Make sure the sheet&apos;s Share permission is set to <strong>&quot;Anyone with the link can view&quot;</strong>.</span>
            </p>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="import-year" className="sr-only">Academic Year</label>
              <input
                type="text"
                id="import-year"
                name="import-year"
                placeholder="Academic Year (e.g. 2025-2026)"
                value={importAcademicYear}
                onChange={(e) => setImportAcademicYear(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 w-44"
              />
              <label htmlFor="import-semester" className="sr-only">Semester</label>
              <select
                id="import-semester"
                name="import-semester"
                value={importSemester}
                onChange={(e) => setImportSemester(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={importAutoPublish}
                  onChange={(e) => setImportAutoPublish(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Auto-publish to talabat portal
              </label>
            </div>
            {importLoading && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Importing data...</span><span>{importProgress}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${importProgress}%`, background: "linear-gradient(90deg, #047857, #d4af37)" }} />
                </div>
              </div>
            )}
            {importError && <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200"><p className="text-sm text-red-600">{importError}</p></div>}
            {importResult && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-700">
                  Import successful! {importResult.studentsCreated > 0 && `${importResult.studentsCreated} talabat created, `}
                  {importResult.imported} parts imported, {importResult.updated} updated
                  {importResult.published > 0 && `, ${importResult.published} published to talabat portal`}
                  <span className="text-gray-500"> · {importResult.academicYear} Sem {importResult.semester}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={FileSpreadsheet} label="Reports" value={stats.total} color="text-indigo-600" bgColor="bg-indigo-50" />
          <StatCard icon={CheckCircle} label="Published" value={stats.published} color="text-emerald-600" bgColor="bg-emerald-50" />
          <StatCard icon={EyeOff} label="Hidden" value={stats.hidden} color="text-amber-600" bgColor="bg-amber-50" />
          <StatCard icon={TrendingUp} label="Avg Progress" value={`${stats.avgProgress}%`} color="text-blue-600" bgColor="bg-blue-50" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "published", "draft", "hidden"] as const).map((status) => (
                <Button key={status} variant={filterStatus === status ? "default" : "ghost"} size="sm" className="h-8 px-3 text-xs" onClick={() => setFilterStatus(status)}>
                  {status === "hidden" && <EyeOff className="w-3 h-3 mr-1" />}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            <label htmlFor="filter-darajah" className="sr-only">Filter by Darajah</label>
            <select id="filter-darajah" name="filter-darajah" value={filterDarajah} onChange={(e) => setFilterDarajah(e.target.value)} className="h-8 px-3 rounded-lg border border-gray-200 text-xs outline-none">
              <option value="all">All Darajahs</option>
              {darajahs.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label htmlFor="sort-hifz" className="sr-only">Sort talabat</label>
            <select id="sort-hifz" name="sort-hifz" value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [by, order] = e.target.value.split("-"); setSortBy(by as any); setSortOrder(order as any); }} className="h-8 px-3 rounded-lg border border-gray-200 text-xs outline-none">
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="progress-desc">Progress High-Low</option>
              <option value="progress-asc">Progress Low-High</option>
              <option value="darajah-asc">Darajah A-Z</option>
              <option value="recent-desc">Recent First</option>
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode("grid")}><LayoutGrid className="w-4 h-4" /></Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedReports.size > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-emerald-700 font-medium">{selectedReports.size} selected</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBatchPublish(true)}><Send className="w-3 h-3 mr-1" /> Publish</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBatchPublish(false)}><EyeOff className="w-3 h-3 mr-1" /> Unpublish</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={handleBatchDelete}><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedReports(new Set())}>Clear</Button>
          </div>
        )}

        {/* Select All */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={handleSelectAll} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            {selectedReports.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
            Select all ({filtered.length})
          </button>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex gap-6">
          {/* Left Panel - Report List */}
          <div className={`${selectedReport ? "w-[380px] flex-shrink-0" : "w-full"} transition-all duration-300`}>
            {loading ? (
              <div className={viewMode === "grid" ? "grid sm:grid-cols-2 gap-3" : "space-y-2"}>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="animate-pulse border-0 shadow-sm"><CardContent className="p-5"><div className="h-24 bg-gray-100 rounded-xl" /></CardContent></Card>
                ))}
              </div>
            ) : error ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                  <p className="text-red-600 font-medium">Error loading data</p>
                  <p className="text-gray-500 text-sm mt-1">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); fetchData(); }}><RefreshCw className="w-4 h-4 mr-1" /> Retry</Button>
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No hifz reports found</p>
                </CardContent>
              </Card>
            ) : viewMode === "grid" ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {filtered.map((report, idx) => {
                  const tags = getStudentTag(report);
                  const isSelected = selectedReportId === report.id;
                  const isBatchSelected = selectedReports.has(report.id);
                  const completedParts = report.parts.filter((p: any) => p.status === "COMPLETED").length;
                  const progress = Math.round((completedParts / 30) * 100);

                  return (
                    <Card
                      key={report.id}
                      className={`border-0 rounded-2xl bg-white overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 ${isSelected ? "ring-2 ring-emerald-500" : ""} ${isBatchSelected ? "ring-2 ring-blue-400" : ""}`}
                      onClick={() => setSelectedReportId(isSelected ? null : report.id)}
                    >
                      <div className={`h-1.5 ${report.isHidden ? 'bg-amber-400' : report.isPublished ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-200'}`} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div onClick={(e) => { e.stopPropagation(); toggleSelect(report.id); }}>
                              {isBatchSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                            </div>
                            <Avatar className="w-10 h-10 border-2" style={{ borderColor: "#d4af37" }}>
                              <AvatarFallback className="text-sm font-bold" style={{ background: "linear-gradient(135deg, #047857, #065f46)", color: "#d4af37", fontFamily: "'Al-Kanz', sans-serif" }}>
                                {report.studentName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>{report.studentName}</h3>
                              <p className="text-xs text-gray-500" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>الصف {report.studentGrade}{report.studentSection}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {tags.map((tag, i) => <Badge key={i} className={`${tag.color} border-0 text-[10px]`}>{tag.label}</Badge>)}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{completedParts}/30 parts</span><span>{progress}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #047857, #d4af37)" }} />
                          </div>
                        </div>

                        {/* Badges */}
                        {getStudentBadges(report).length > 0 && (
                          <div className="flex gap-1 mb-2">
                            {getStudentBadges(report).slice(0, 4).map(badgeId => {
                              const badge = ACHIEVEMENT_BADGES.find(b => b.id === badgeId);
                              return badge ? <span key={badgeId} className="text-sm" title={badge.description}>{badge.icon}</span> : null;
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-1 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className={`flex-1 h-7 text-[10px] ${report.isPublished ? "border-emerald-300 text-emerald-700" : "border-gray-200 text-gray-600"}`} onClick={() => handlePublish(report.id, !report.isPublished)} disabled={publishing === report.id}>
                            {publishing === report.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                            {report.isPublished ? "Published" : "Publish"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" onClick={() => printReport(report)} title="Print"><Printer className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => handleDelete(report.id)} disabled={saving === report.id}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((report) => {
                  const isSelected = selectedReportId === report.id;
                  const isBatchSelected = selectedReports.has(report.id);
                  const completedParts = report.parts.filter((p: any) => p.status === "COMPLETED").length;
                  const progress = Math.round((completedParts / 30) * 100);

                  return (
                    <Card
                      key={report.id}
                      className={`border-0 rounded-2xl bg-white overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)] ${isSelected ? "ring-2 ring-emerald-500" : ""} ${isBatchSelected ? "ring-2 ring-blue-400" : ""}`}
                      onClick={() => setSelectedReportId(isSelected ? null : report.id)}
                    >
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div onClick={(e) => { e.stopPropagation(); toggleSelect(report.id); }}>
                              {isBatchSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                            </div>
                            <Avatar className="w-10 h-10 border-2" style={{ borderColor: "#d4af37" }}>
                              <AvatarFallback className="text-sm font-bold" style={{ background: "linear-gradient(135deg, #047857, #065f46)", color: "#d4af37", fontFamily: "'Al-Kanz', sans-serif" }}>
                                {report.studentName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>{report.studentName}</h3>
                              <p className="text-xs text-gray-500" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>الصف {report.studentGrade}{report.studentSection}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>{completedParts}/30</span><span>{progress}%</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #047857, #d4af37)" }} />
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {getStudentTag(report).map((tag, i) => <Badge key={i} className={`${tag.color} border-0 text-[10px]`}>{tag.label}</Badge>)}
                            </div>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm" className={`h-7 text-[10px] ${report.isPublished ? "border-emerald-300 text-emerald-700" : "border-gray-200 text-gray-600"}`} onClick={() => handlePublish(report.id, !report.isPublished)}>
                                {report.isPublished ? "Published" : "Publish"}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" onClick={() => printReport(report)}><Printer className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel - Detail View (Inline, not overlay) */}
          {selectedReport && (
            <div className="flex-1 min-w-0">
              <Card className="border-0 shadow-sm sticky top-8 overflow-hidden">
                {/* Detail Header */}
                <div className="p-4 border-b border-gray-100 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedReportId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                      <h3 className="font-semibold text-gray-900 text-sm">Talabat Details</h3>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                        {selectedReport.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => printReport(selectedReport)} title="Print"><Printer className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => copyReportLink(selectedReport.id)} title="Copy link"><Link2 className="w-4 h-4" /></Button>
                    </div>
                  </div>

                  {/* Profile Summary */}
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 border-2" style={{ borderColor: "#d4af37" }}>
                      <AvatarFallback className="text-lg font-bold" style={{ background: "linear-gradient(135deg, #047857, #065f46)", color: "#d4af37", fontFamily: "'Al-Kanz', sans-serif" }}>
                        {selectedReport.studentName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>{selectedReport.studentName}</h4>
                      <p className="text-sm text-gray-500" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>
                        الصف {selectedReport.studentGrade}{selectedReport.studentSection} • {selectedReport.academicYear}
                      </p>
                      {selectedReport.studentId && <p className="text-xs text-gray-400 mt-0.5">ITS: {selectedReport.studentId}</p>}
                    </div>
                    <PreviewProgressRing progress={getPreviewStats(selectedReport).performancePercent} size={80} strokeWidth={7} />
                  </div>
                </div>

                {/* Detail Content */}
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto" style={{ background: "linear-gradient(135deg, #f0fdf4, #ffffff, #ecfdf5)" }}>
                  <div className="p-4 space-y-4">
                    {/* Performance Progress */}
                    <div className="flex items-center justify-center p-4 rounded-xl" style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", border: "1px solid #a7f3d0" }}>
                      <div className="text-center">
                        <p className="text-4xl font-bold" style={{ color: "#047857" }}>{getPreviewStats(selectedReport).performancePercent}%</p>
                        <p className="text-sm mt-1" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>نسبة الأداء العامة</p>
                        <p className="text-xs text-gray-500">Overall Performance</p>
                      </div>
                    </div>

                    {/* Stats - Sheet Columns F, G, H */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg text-center" style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", border: "1px solid #a7f3d0" }}>
                        <p className="text-xl font-bold" style={{ color: "#047857" }}>{getPreviewStats(selectedReport).currentJuz}</p>
                        <p className="text-xs" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>الجزء الحالي</p>
                        <p className="text-[10px] text-gray-400">Current Juz</p>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1px solid #bfdbfe" }}>
                        <p className="text-xl font-bold" style={{ color: "#1d4ed8" }}>{getPreviewStats(selectedReport).currentSafah}</p>
                        <p className="text-xs" style={{ color: "#1d4ed8", fontFamily: "'Al-Kanz', sans-serif" }}>الصفحة الحالية</p>
                        <p className="text-[10px] text-gray-400">Current Page</p>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1px solid #fde68a" }}>
                        <p className="text-xl font-bold" style={{ color: "#b45309" }}>{getPreviewStats(selectedReport).totalJadeedPages}</p>
                        <p className="text-xs" style={{ color: "#b45309", fontFamily: "'Al-Kanz', sans-serif" }}>الصفحات الجديدة</p>
                        <p className="text-[10px] text-gray-400">Pages Memorized</p>
                      </div>
                    </div>

                    {/* Status Summary */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2 rounded-lg text-center" style={{ background: "#d1fae5", border: "1px solid #a7f3d0" }}>
                        <p className="text-lg font-bold" style={{ color: "#047857" }}>{getPreviewStats(selectedReport).completed}</p>
                        <p className="text-[10px]" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>Completed</p>
                      </div>
                      <div className="p-2 rounded-lg text-center" style={{ background: "#dbeafe", border: "1px solid #bfdbfe" }}>
                        <p className="text-lg font-bold" style={{ color: "#1d4ed8" }}>{getPreviewStats(selectedReport).inProgress}</p>
                        <p className="text-[10px]" style={{ color: "#1d4ed8", fontFamily: "'Al-Kanz', sans-serif" }}>In Progress</p>
                      </div>
                      <div className="p-2 rounded-lg text-center" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                        <p className="text-lg font-bold" style={{ color: "#b45309" }}>{getPreviewStats(selectedReport).weak}</p>
                        <p className="text-[10px]" style={{ color: "#b45309", fontFamily: "'Al-Kanz', sans-serif" }}>ضعيف</p>
                      </div>
                      <div className="p-2 rounded-lg text-center" style={{ background: "#fae8ff", border: "1px solid #e9d5ff" }}>
                        <p className="text-lg font-bold" style={{ color: "#7c3aed" }}>{getPreviewStats(selectedReport).total}</p>
                        <p className="text-[10px]" style={{ color: "#7c3aed", fontFamily: "'Al-Kanz', sans-serif" }}>Total</p>
                      </div>
                    </div>

                    {/* Parts List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>
                        <BookOpen className="w-3.5 h-3.5" /> Part Details
                      </h4>

                      {selectedReport.parts.map((part: any) => {
                        const config = STATUS_CONFIG[part.status] || STATUS_CONFIG.NOT_STARTED;
                        const isEditing = editingPartId === part.id;

                        return (
                          <div key={part.id} className={`rounded-lg overflow-hidden transition-all duration-200 ${part.isHidden ? "opacity-50" : ""}`} style={{ border: `1px solid ${part.isHidden ? "#fde68a" : part.status === "COMPLETED" ? "#a7f3d0" : part.status === "IN_PROGRESS" ? "#bfdbfe" : "#e5e7eb"}` }}>
                            <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{ background: part.isHidden ? "linear-gradient(135deg, #f59e0b, #d97706)" : part.status === "COMPLETED" ? "linear-gradient(135deg, #059669, #047857)" : part.status === "IN_PROGRESS" ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "linear-gradient(135deg, #9ca3af, #6b7280)" }}>
                                  {part.isHidden ? <EyeOff className="w-3 h-3" /> : part.partNumber}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-xs" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>الجزء {part.partNumber} - Juz {part.partNumber}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${config.bgColor} ${config.color} border ${config.borderColor}`} style={{ fontFamily: "'Al-Kanz', sans-serif" }}>
                                      {config.label} - {config.labelEn}
                                    </span>
                                    <span className="text-[10px] text-gray-400">{part.progress}%</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 ${part.isHidden ? "text-amber-600" : "text-gray-500 hover:text-gray-700"}`} onClick={() => handleTogglePart(selectedReport.id, part.id, !part.isHidden)} disabled={togglingPart === part.id}>
                                  {togglingPart === part.id ? <Loader2 className="w-3 h-3 animate-spin" /> : part.isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                                <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 ${isEditing ? "text-emerald-500" : "text-gray-400 hover:text-gray-600"}`} onClick={() => isEditing ? setEditingPartId(null) : handleEditPart(part)}>
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="p-3 border-t" style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", borderColor: "#d1fae5" }}>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                    <label htmlFor="editPartStatus" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>الحالة - Status</label>
                                    <select id="editPartStatus" name="editPartStatus" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: "#a7f3d0" }} value={editPartForm.status} onChange={(e) => setEditPartForm({ ...editPartForm, status: e.target.value })}>
                                      <option value="NOT_STARTED">لم يبدأ - Not Started</option>
                                      <option value="IN_PROGRESS">In Progress</option>
                                      <option value="COMPLETED">Completed</option>
                                      <option value="WEAK">ضعيف - Weak</option>
                                      <option value="NEEDS_REVIEW">يحتاج مراجعة - Needs Review</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label htmlFor="editPartProgress" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>التقدم % - Progress</label>
                                    <input type="number" id="editPartProgress" name="editPartProgress" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: "#a7f3d0" }} value={editPartForm.progress} onChange={(e) => setEditPartForm({ ...editPartForm, progress: parseInt(e.target.value) || 0 })} min={0} max={100} />
                                  </div>
                                  <div>
                                    <label htmlFor="editPartReviewCount" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>المراجعات - Reviews</label>
                                    <input type="number" id="editPartReviewCount" name="editPartReviewCount" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: "#a7f3d0" }} value={editPartForm.reviewCount} onChange={(e) => setEditPartForm({ ...editPartForm, reviewCount: parseInt(e.target.value) || 0 })} />
                                  </div>
                                  <div>
                                    <label htmlFor="editPartSentences" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>الجمل - Sentences</label>
                                    <input type="number" id="editPartSentences" name="editPartSentences" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: "#a7f3d0" }} value={editPartForm.sentencesMemorized} onChange={(e) => setEditPartForm({ ...editPartForm, sentencesMemorized: parseInt(e.target.value) || 0 })} />
                                  </div>
                                  <div>
                                    <label htmlFor="editPartPages" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>الصفحات - Pages</label>
                                    <input type="number" id="editPartPages" name="editPartPages" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: "#a7f3d0" }} value={editPartForm.currentPage} onChange={(e) => setEditPartForm({ ...editPartForm, currentPage: parseInt(e.target.value) || 0 })} />
                                  </div>
                                  <div>
                                    <label htmlFor="editPartFirm" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>التثبيت - Firm</label>
                                    <input type="number" id="editPartFirm" name="editPartFirm" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none" style={{ borderColor: "#a7f3d0" }} value={editPartForm.firmProgress} onChange={(e) => setEditPartForm({ ...editPartForm, firmProgress: parseInt(e.target.value) || 0 })} />
                                  </div>
                                </div>
                                <div className="mb-2">
                                  <label htmlFor="editPartNotes" className="text-[10px] mb-0.5 block" style={{ color: "#047857", fontFamily: "'Al-Kanz', sans-serif" }}>ملاحظات - Notes</label>
                                  <textarea id="editPartNotes" name="editPartNotes" className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none resize-none h-10" style={{ borderColor: "#a7f3d0" }} value={editPartForm.notes} onChange={(e) => setEditPartForm({ ...editPartForm, notes: e.target.value })} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" className="h-7 text-[10px] text-white" style={{ background: "linear-gradient(135deg, #047857, #065f46)", fontFamily: "'Al-Kanz', sans-serif" }} onClick={() => handleSavePart(selectedReport.id, part.id)} disabled={saving === `part-${part.id}`}>
                                    {saving === `part-${part.id}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-gray-500" onClick={() => setEditingPartId(null)}>Cancel</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Share Modal */}
        {showShareModal && emailResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Share Report Cards</h3>
                  <p className="text-sm text-gray-500">{emailResult.sent} reports ready to share</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowShareModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div className="space-y-3">
                  {emailResult.emails?.map((email, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900" style={{ fontFamily: "'Al-Kanz', sans-serif" }}>{email.studentName}</p>
                          <p className="text-xs text-gray-500">Parent: {email.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openmailto(email.email, email.subject, `Hifz report for student ${email.studentName}\n\nReport link: ${window.location.origin}/talabat/hifz`)} className="text-xs">
                          <Globe className="w-3 h-3 mr-1" /> Email
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => previewEmail(email.html)} className="text-xs">
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadHtml(email.html, `hifz-report-${email.studentName.replace(/\s/g, "-")}.html`)} className="text-xs">
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
