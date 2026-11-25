"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Sparkles,
  BookCheck,
  Printer,
  Copy,
  RotateCw,
  Check,
  BookMarked,
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  Maximize2,
  Search,
  Save,
  CheckCircle2,
  Users,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { FatimiCornerBracket } from "@/components/FatimiOrnaments";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  QURAN_IKHTEBAAR_DATA,
  DARAJAH_LIST,
  getDarajahSyllabus,
  getRandomizedExamPaper,
  type NizamType,
  type QuestionItem,
} from "@/lib/quran-ikhtebaar-data";

interface MushafWord {
  id: number;
  text: string;
  lineNumber: number;
  pageNumber: number;
  verseKey: string;
  isEnd: boolean;
}

interface MushafPageData {
  pageNumber: number;
  lines: Record<number, MushafWord[]>;
}

interface SavedSession {
  id: string;
  q1Marks: number | null;
  q2Marks: number | null;
  q3Marks: number | null;
  q4Marks: number | null;
  q5Marks: number | null;
  q6Marks: number | null;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  status: string;
  questionsSnapshot?: QuestionItem[] | null;
  scoresSnapshot?: Record<string, number> | null;
  updatedAt: string;
}

interface AssignedTalibItem {
  assignmentId: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  its: string;
  name: string;
  grade: string;
  section: string;
  nizam: NizamType;
  darajah: number;
  session: SavedSession | null;
}

interface AdminTeacherOption {
  id: string;
  name: string;
  its: string;
  department: string;
  avatarUrl?: string | null;
}

interface AdminStudentOption {
  id: string;
  name: string;
  its: string;
  grade: string;
  section: string;
  inferredDarajah: number;
}

interface AdminAssignmentRow {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherIts: string;
  teacherAvatarUrl?: string | null;
  studentId: string;
  studentName: string;
  studentIts: string;
  grade: string;
  section: string;
  nizam: NizamType;
  darajah: number;
  session: SavedSession | null;
}

const mushafPageCache = new Map<number, MushafPageData>();

const EASTERN_TO_WESTERN: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function getDisplayedAyahEnd(q: QuestionItem): number {
  const matches = Array.from(q.ayahTextAr.matchAll(/﴿([٠-٩0-9]+)﴾/g));
  if (matches.length === 0) return q.ayahStart;
  const nums = matches
    .map((m) =>
      parseInt(
        m[1].replace(/[٠-٩]/g, (d) => EASTERN_TO_WESTERN[d] ?? d),
        10
      )
    )
    .filter((n) => !isNaN(n));
  return nums.length > 0 ? Math.max(...nums) : q.ayahStart;
}

async function fetchMushafPage(pageNumber: number): Promise<MushafPageData> {
  const cached = mushafPageCache.get(pageNumber);
  if (cached) return cached;

  const res = await fetch(
    `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=text_uthmani,text_imlaei,line_number,page_number&per_page=50`
  );
  if (!res.ok) throw new Error("Failed to load Mushaf page");
  const json = await res.json();
  const verses = Array.isArray(json?.verses) ? json.verses : [];

  const lines: Record<number, MushafWord[]> = {};
  for (const v of verses) {
    const verseKey = String(v.verse_key || "");
    const words = Array.isArray(v.words) ? v.words : [];
    for (const w of words) {
      const ln = Number(w.line_number) || 1;
      if (!lines[ln]) lines[ln] = [];
      const isEnd = w.char_type_name === "end";
      const rawText = String(w.text_uthmani || w.text_imlaei || w.text || "");
      lines[ln].push({
        id: Number(w.id),
        text: isEnd ? `﴿${rawText}﴾` : rawText,
        lineNumber: ln,
        pageNumber: Number(w.page_number) || pageNumber,
        verseKey,
        isEnd,
      });
    }
  }

  const data: MushafPageData = { pageNumber, lines };
  mushafPageCache.set(pageNumber, data);
  return data;
}

export default function QuranIkhtebaarPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toUpperCase() === "ADMIN";
  const [canManageQuran, setCanManageQuran] = useState(false);
  const canManage = isAdmin || canManageQuran;

  const [viewMode, setViewMode] = useState<"EXAM" | "MANAGE">("EXAM");

  // Exam State
  const [nizam, setNizam] = useState<NizamType>("OLD");
  const [selectedDarajah, setSelectedDarajah] = useState<number>(2);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [resumedQuestions, setResumedQuestions] = useState<QuestionItem[] | null>(null);
  const [savingStatus, setSavingStatus] = useState<"IDLE" | "SAVING" | "SAVED">("IDLE");
  const [doneEvaluation, setDoneEvaluation] = useState<{
    name: string;
    its: string;
    total: number;
    max: number;
    percentage: number;
  } | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Assigned Talabat Search & Selection State
  const [assignedTalabat, setAssignedTalabat] = useState<AssignedTalibItem[]>([]);
  const [talabatLoading, setTalabatLoading] = useState(false);
  const [talibSearch, setTalibSearch] = useState("");
  const [selectedTalib, setSelectedTalib] = useState<AssignedTalibItem | null>(null);

  // Admin Management State
  const [adminTeachers, setAdminTeachers] = useState<AdminTeacherOption[]>([]);
  const [adminStudents, setAdminStudents] = useState<AdminStudentOption[]>([]);
  const [adminAssignments, setAdminAssignments] = useState<AdminAssignmentRow[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignDarajah, setAssignDarajah] = useState<string>("AUTO");
  const [assignStudentSearch, setAssignStudentSearch] = useState("");
  const [assignSelectedStudentIds, setAssignSelectedStudentIds] = useState<string[]>([]);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [expandedDarajahs, setExpandedDarajahs] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const [adminFilterSearch, setAdminFilterSearch] = useState("");
  const [exportingBlankMarksheet, setExportingBlankMarksheet] = useState(false);
  const [selectedMumtahinId, setSelectedMumtahinId] = useState<string>("ALL");
  const [exportingGroupExcel, setExportingGroupExcel] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveSyncAt, setLastLiveSyncAt] = useState<string | null>(null);
  const [liveLoadMetrics, setLiveLoadMetrics] = useState<{
    inFlightSaves: number;
    peakConcurrentSaves: number;
    totalSavesProcessed: number;
    lastSaveMs: number;
    activeListeners: number;
  }>({
    inFlightSaves: 0,
    peakConcurrentSaves: 0,
    totalSavesProcessed: 0,
    lastSaveMs: 0,
    activeListeners: 0,
  });

  // Mushaf Page Popup State
  const [activeMushafQuestion, setActiveMushafQuestion] = useState<QuestionItem | null>(null);
  const [mushafLoading, setMushafLoading] = useState(false);
  const [mushafError, setMushafError] = useState<string | null>(null);
  const [mushafLines, setMushafLines] = useState<
    Array<{ pageNumber: number; lineNumber: number; words: MushafWord[] }>
  >([]);
  const [startPageNum, setStartPageNum] = useState<number | null>(null);
  const [highlightBounds, setHighlightBounds] = useState<{
    surah: number;
    ayahStart: number;
    ayahEnd: number;
  } | null>(null);
  const firstHighlightRef = useRef<HTMLSpanElement | null>(null);

  const nizamConfig = useMemo(() => QURAN_IKHTEBAAR_DATA[nizam], [nizam]);

  const activeSyllabus = useMemo(
    () => getDarajahSyllabus(nizam, selectedDarajah),
    [nizam, selectedDarajah]
  );

  const generatedQuestions = useMemo(
    () => getRandomizedExamPaper(nizam, selectedDarajah, shuffleSeed, seenIds),
    [nizam, selectedDarajah, shuffleSeed, seenIds]
  );

  const questions = resumedQuestions && resumedQuestions.length > 0 ? resumedQuestions : generatedQuestions;

  const totalScore = useMemo(
    () => questions.reduce((sum, q) => sum + (scores[q.id] || 0), 0),
    [questions, scores]
  );

  const maxTotalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + q.marks, 0) || 60,
    [questions]
  );

  const percentage = useMemo(
    () => Math.round((totalScore / maxTotalMarks) * 1000) / 10,
    [totalScore, maxTotalMarks]
  );

  // Load assigned Talabat for logged-in teacher (or admin)
  const loadMyTalabat = useCallback(async () => {
    setTalabatLoading(true);
    try {
      const res = await fetch("/api/quran-ikhtebaar/my-talabat");
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setAssignedTalabat(json.data);
        if (typeof json.canManageQuran === "boolean") {
          setCanManageQuran(json.canManageQuran);
        }
      }
    } catch {
      // silent fallback
    } finally {
      setTalabatLoading(false);
    }
  }, []);

  // Load Admin Management Overview
  const loadAdminOverview = useCallback(async () => {
    if (!canManage) return;
    setAdminLoading(true);
    try {
      const res = await fetch("/api/quran-ikhtebaar/admin/overview");
      const json = await res.json();
      if (json?.success && json.data) {
        setAdminTeachers(json.data.teachers || []);
        setAdminStudents(json.data.students || []);
        setAdminAssignments(json.data.assignments || []);
        if (json.data.loadMetrics) {
          setLiveLoadMetrics(json.data.loadMetrics);
        }
        setLastLiveSyncAt(new Date().toLocaleTimeString());
      }
    } catch {
      toast({ title: "Failed to load management data", variant: "destructive" });
    } finally {
      setAdminLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadMyTalabat();
  }, [loadMyTalabat]);

  useEffect(() => {
    if (canManage && viewMode === "MANAGE") {
      loadAdminOverview();
    }
  }, [canManage, viewMode, loadAdminOverview]);

  // Real-Time SSE Live Sync & Load Telemetry when in Admin Management
  useEffect(() => {
    if (!canManage || viewMode !== "MANAGE") {
      setLiveConnected(false);
      return;
    }

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/quran-ikhtebaar/live");
      es.onopen = () => setLiveConnected(true);
      es.onerror = () => setLiveConnected(false);

      const handleSyncPayload = (raw: string) => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.loadMetrics) {
            setLiveLoadMetrics(parsed.loadMetrics);
          }
          setLastLiveSyncAt(new Date().toLocaleTimeString());
        } catch {}
      };

      es.addEventListener("load-status", (e: MessageEvent) => {
        setLiveConnected(true);
        handleSyncPayload(e.data);
      });

      es.addEventListener("marks-updated", (e: MessageEvent) => {
        handleSyncPayload(e.data);
        loadAdminOverview();
      });

      es.addEventListener("assignment-updated", (e: MessageEvent) => {
        handleSyncPayload(e.data);
        loadAdminOverview();
      });
    } catch {
      setLiveConnected(false);
    }

    const fallbackInterval = setInterval(() => {
      loadAdminOverview();
    }, 15_000);

    return () => {
      if (es) es.close();
      clearInterval(fallbackInterval);
      setLiveConnected(false);
    };
  }, [canManage, viewMode, loadAdminOverview]);

  // Filter assigned Talabat by ITS or Name
  const filteredAssignedTalabat = useMemo(() => {
    const q = talibSearch.trim().toLowerCase();
    if (!q) return assignedTalabat;
    return assignedTalabat.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.its.toLowerCase().includes(q) ||
        `${t.grade} ${t.section}`.toLowerCase().includes(q)
    );
  }, [assignedTalabat, talibSearch]);

  // Select a Talib and resume any saved session
  const handleSelectTalib = useCallback(
    async (talib: AssignedTalibItem) => {
      setSelectedTalib(talib);
      setNizam(talib.nizam);
      setSelectedDarajah(talib.darajah);
      setSavingStatus("IDLE");

      try {
        const res = await fetch(
          `/api/quran-ikhtebaar/session?studentId=${encodeURIComponent(
            talib.studentId
          )}&nizam=${talib.nizam}&darajah=${talib.darajah}&teacherId=${encodeURIComponent(
            talib.teacherId
          )}`
        );
        const json = await res.json();
        const saved: SavedSession | null = json?.data || null;

        if (saved && Array.isArray(saved.questionsSnapshot) && saved.questionsSnapshot.length > 0) {
          setResumedQuestions(saved.questionsSnapshot);
          const restoredScores: Record<string, number> = {};
          const snapScores = saved.scoresSnapshot || {};
          const markArray = [
            saved.q1Marks,
            saved.q2Marks,
            saved.q3Marks,
            saved.q4Marks,
            saved.q5Marks,
            saved.q6Marks,
          ];
          saved.questionsSnapshot.forEach((qItem, idx) => {
            if (snapScores[qItem.id] !== undefined) {
              restoredScores[qItem.id] = Number(snapScores[qItem.id]);
            } else if (markArray[idx] !== null && markArray[idx] !== undefined) {
              restoredScores[qItem.id] = Number(markArray[idx]);
            }
          });
          setScores(restoredScores);
          setSavingStatus("SAVED");
          toast({
            title: `Resumed ${talib.name}`,
            description: `Restored ${saved.totalMarks}/60 (${saved.percentage}%)`,
            variant: "success",
          });
        } else {
          setResumedQuestions(null);
          setScores({});
        }
      } catch {
        setResumedQuestions(null);
        setScores({});
      }
    },
    []
  );

  // Save or Submit Marks
  const handleSaveSession = async (targetStatus: "IN_PROGRESS" | "COMPLETED") => {
    if (!selectedTalib) {
      toast({
        title: "Select an assigned Talib first",
        description: "Search by ITS or name above to record marks.",
        variant: "destructive",
      });
      return;
    }

    if (savingStatus === "SAVING") return;

    setSavingStatus("SAVING");
    const clientTimestamp = Date.now();
    const retryDelays = [600, 1500, 3000];
    let lastErr: any = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        const res = await fetch("/api/quran-ikhtebaar/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: selectedTalib.studentId,
            teacherId: selectedTalib.teacherId,
            nizam,
            darajah: selectedDarajah,
            scores,
            questions,
            status: targetStatus,
            clientTimestamp,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          const isRetryable = res.status >= 500 || res.status === 429;
          if (isRetryable && attempt < retryDelays.length) {
            await new Promise((r) => setTimeout(r, retryDelays[attempt]));
            continue;
          }
          throw new Error(json?.error || "Failed to save");
        }
        if (json.loadMetrics) {
          setLiveLoadMetrics(json.loadMetrics);
        }
        setResumedQuestions(questions);
        setSavingStatus("SAVED");
        await loadMyTalabat();
        if (canManage) loadAdminOverview();
        if (targetStatus === "COMPLETED") {
          setDoneEvaluation({
            name: selectedTalib.name,
            its: selectedTalib.its,
            total: totalScore,
            max: maxTotalMarks,
            percentage,
          });
        } else {
          toast({
            title: "Progress saved",
            description: `${selectedTalib.name} · ${totalScore}/${maxTotalMarks} (${percentage}%)`,
            variant: "success",
          });
        }
        return;
      } catch (err: any) {
        lastErr = err;
        if (attempt < retryDelays.length) {
          await new Promise((r) => setTimeout(r, retryDelays[attempt]));
          continue;
        }
      }
    }

    setSavingStatus("IDLE");
    toast({
      title: "Save failed",
      description: lastErr?.message || "Please try again.",
      variant: "destructive",
    });
  };

  const handleScoreChange = (qId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setScores((prev) => ({ ...prev, [qId]: clamped }));
    setSavingStatus("IDLE");
  };

  const handleRegenerate = () => {
    setResumedQuestions(null);
    setSeenIds((prev) => {
      const next = [...prev, ...questions.map((q) => q.id)];
      return next.length > 24 ? questions.map((q) => q.id) : next;
    });
    setShuffleSeed((prev) => prev + 1);
    setScores({});
    setSavingStatus("IDLE");
    toast({
      title: "New question set ready",
      description: `${activeSyllabus?.nameEn} · ${nizamConfig.titleEn} (6 distinct Juz)`,
      variant: "success",
    });
  };

  const handleCopyQuestions = () => {
    if (!questions.length) return;
    const textLines = questions.map(
      (q, idx) =>
        `Question ${idx + 1} (${q.marks} Marks)\n` +
        `${q.promptEn}\n` +
        `${q.ayahTextAr}\n` +
        `[${q.surahNameEn} · Ayah ${q.ayahStart}${q.ayahEnd ? `–${q.ayahEnd}` : ""} · Juz ${q.juzNumber}]`
    );

    navigator.clipboard.writeText(textLines.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({
      title: "Copied 6 questions",
      description: "All 6 examination questions copied to clipboard.",
      variant: "success",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Admin: Assign Teacher -> Selected Talabat
  const handleAdminAssign = async () => {
    if (!assignTeacherId || assignSelectedStudentIds.length === 0) {
      toast({
        title: "Select teacher and talabat",
        description: "Choose a teacher and at least one student.",
        variant: "destructive",
      });
      return;
    }

    setAssignSubmitting(true);
    try {
      const res = await fetch("/api/quran-ikhtebaar/admin/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: assignTeacherId,
          studentIds: assignSelectedStudentIds,
          darajah: assignDarajah === "AUTO" ? undefined : Number(assignDarajah),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Assignment failed");

      toast({
        title: "Talabat assigned",
        description: `Assigned ${assignSelectedStudentIds.length} student(s).`,
        variant: "success",
      });
      setAssignSelectedStudentIds([]);
      await Promise.all([loadAdminOverview(), loadMyTalabat()]);
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err?.message, variant: "destructive" });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/quran-ikhtebaar/admin/assign/${assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Assignment removed", variant: "success" });
      await Promise.all([loadAdminOverview(), loadMyTalabat()]);
    } catch {
      toast({ title: "Could not remove assignment", variant: "destructive" });
    }
  };

  const handleDownloadExcel = async (teacherId?: string, teacherName?: string) => {
    if (teacherId) setExportingGroupExcel(true);
    else setExportingExcel(true);
    try {
      const qs = teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : "";
      const res = await fetch(`/api/quran-ikhtebaar/admin/export-excel${qs}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      if (teacherId && teacherName) {
        const slug = teacherName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Mumtahin";
        a.download = `Quran_Ikhtebaar_${slug}_Marks.xlsx`;
      } else {
        a.download = "Quran_Ikhtebaar_All_Darajah_Marks.xlsx";
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: teacherId ? "Mumtahin Excel Downloaded" : "Bulk Excel Downloaded",
        description: teacherId
          ? `${teacherName || "Mumtahin"}'s group marksheet exported.`
          : "Multi-tab workbook (Summary, Darajah 1–4, Mumtahin Wise).",
        variant: "success",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not export Excel workbook.",
        variant: "destructive",
      });
    } finally {
      if (teacherId) setExportingGroupExcel(false);
      else setExportingExcel(false);
    }
  };

  const handleDownloadBlankMarksheet = async () => {
    setExportingBlankMarksheet(true);
    try {
      const res = await fetch("/api/quran-ikhtebaar/admin/export-blank-marksheet");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Quran_Ikhtebaar_Blank_Marksheets_1448H.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Blank Marksheets Downloaded",
        description: "One sheet per Mumtahin with assigned Talabat & 6-question marking boxes.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not export blank marksheets.",
        variant: "destructive",
      });
    } finally {
      setExportingBlankMarksheet(false);
    }
  };

  // Stack Admin Assignments Darajah-wise (1 to 4)
  const groupedByDarajah = useMemo(() => {
    const q = adminFilterSearch.trim().toLowerCase();
    return ([1, 2, 3, 4] as const).map((dNum) => {
      const dMeta = DARAJAH_LIST.find((d) => d.num === dNum)!;
      const rows = adminAssignments.filter((row) => {
        if (row.darajah !== dNum) return false;
        if (!q) return true;
        return (
          row.teacherName.toLowerCase().includes(q) ||
          row.studentName.toLowerCase().includes(q) ||
          row.studentIts.toLowerCase().includes(q) ||
          row.teacherIts.toLowerCase().includes(q)
        );
      });
      return {
        darajah: dNum,
        nameEn: dMeta.nameEn,
        shortName: dMeta.shortName,
        nameAr: dMeta.nameAr,
        rows,
      };
    });
  }, [adminAssignments, adminFilterSearch]);

  // Mumtahin Profile Tabs (sorted alphabetically)
  const mumtahinTabs = useMemo(() => {
    const map = new Map<
      string,
      {
        teacherId: string;
        teacherName: string;
        teacherIts: string;
        teacherAvatarUrl: string | null;
        rows: AdminAssignmentRow[];
        completedCount: number;
        avgPct: number;
      }
    >();

    for (const row of adminAssignments) {
      if (!map.has(row.teacherId)) {
        map.set(row.teacherId, {
          teacherId: row.teacherId,
          teacherName: row.teacherName,
          teacherIts: row.teacherIts,
          teacherAvatarUrl: row.teacherAvatarUrl || null,
          rows: [],
          completedCount: 0,
          avgPct: 0,
        });
      }
      map.get(row.teacherId)!.rows.push(row);
    }

    const q = adminFilterSearch.trim().toLowerCase();
    const list = Array.from(map.values())
      .map((g) => {
        const filteredRows = q
          ? g.rows.filter(
              (r) =>
                r.studentName.toLowerCase().includes(q) ||
                r.studentIts.toLowerCase().includes(q) ||
                r.teacherName.toLowerCase().includes(q)
            )
          : g.rows;
        const completed = g.rows.filter((r) => r.session?.status === "COMPLETED");
        const avgPct =
          completed.length > 0
            ? Math.round(
                completed.reduce((s, r) => s + (r.session?.percentage || 0), 0) /
                  completed.length
              )
            : 0;
        return {
          ...g,
          rows: filteredRows.sort(
            (a, b) => a.darajah - b.darajah || a.studentName.localeCompare(b.studentName)
          ),
          totalCount: g.rows.length,
          completedCount: completed.length,
          avgPct,
        };
      })
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName));

    return list;
  }, [adminAssignments, adminFilterSearch]);

  const activeMumtahinTab = useMemo(
    () =>
      selectedMumtahinId === "ALL"
        ? null
        : mumtahinTabs.find((m) => m.teacherId === selectedMumtahinId) || null,
    [selectedMumtahinId, mumtahinTabs]
  );

  const filteredAdminStudents = useMemo(() => {
    const q = assignStudentSearch.trim().toLowerCase();
    if (!q) return adminStudents;
    return adminStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.its.toLowerCase().includes(q) ||
        `${s.grade} ${s.section}`.toLowerCase().includes(q)
    );
  }, [adminStudents, assignStudentSearch]);

  // Mushaf Popup logic
  const openMushafPopup = useCallback(async (q: QuestionItem) => {
    const ayahEnd = getDisplayedAyahEnd(q);
    const bounds = {
      surah: q.surahNumber,
      ayahStart: q.ayahStart,
      ayahEnd,
    };

    setActiveMushafQuestion(q);
    setMushafLoading(true);
    setMushafError(null);
    setMushafLines([]);
    setStartPageNum(null);
    setHighlightBounds(bounds);

    try {
      const verseKey = `${q.surahNumber}:${q.ayahStart}`;
      const keyRes = await fetch(
        `https://api.quran.com/api/v4/verses/by_key/${verseKey}?words=true&word_fields=text_uthmani,text_imlaei,line_number,page_number`
      );
      if (!keyRes.ok) throw new Error("Could not locate Mushaf page");
      const keyJson = await keyRes.json();
      const verse = keyJson?.verse;
      const startPage = Number(verse?.page_number) || 1;
      const startLine = Number(verse?.words?.[0]?.line_number) || 1;
      setStartPageNum(startPage);

      const page1 = await fetchMushafPage(startPage);
      const allPages: MushafPageData[] = [page1];
      if (startPage < 604) {
        allPages.push(await fetchMushafPage(startPage + 1));
      }

      const ordered: Array<{ pageNumber: number; lineNumber: number; words: MushafWord[] }> = [];
      for (const pg of allPages) {
        const lineNums = Object.keys(pg.lines)
          .map(Number)
          .sort((a, b) => a - b);
        for (const ln of lineNums) {
          if (pg.pageNumber === startPage && ln < startLine) continue;
          let words = pg.lines[ln] || [];
          if (pg.pageNumber === startPage && ln === startLine) {
            words = words.filter((w) => {
              const [s, a] = w.verseKey.split(":").map(Number);
              return s > q.surahNumber || (s === q.surahNumber && a >= q.ayahStart);
            });
          }
          if (words.length > 0) {
            ordered.push({ pageNumber: pg.pageNumber, lineNumber: ln, words });
          }
        }
      }

      let lastQuestionIdx = 0;
      ordered.forEach((line, idx) => {
        const hasQuestionWord = line.words.some((w) => {
          const [s, a] = w.verseKey.split(":").map(Number);
          return s === bounds.surah && a >= bounds.ayahStart && a <= bounds.ayahEnd;
        });
        if (hasQuestionWord) lastQuestionIdx = idx;
      });

      setMushafLines(ordered.slice(0, lastQuestionIdx + 16));
    } catch {
      setMushafError("Unable to load full Mushaf page offline. Showing question Ayah.");
    } finally {
      setMushafLoading(false);
    }
  }, []);

  const closeMushafPopup = useCallback(() => {
    setActiveMushafQuestion(null);
  }, []);

  useEffect(() => {
    if (!activeMushafQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMushafPopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeMushafQuestion, closeMushafPopup]);

  useEffect(() => {
    if (!mushafLoading && mushafLines.length > 0 && firstHighlightRef.current) {
      firstHighlightRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [mushafLoading, mushafLines]);

  const isQuestionWord = (wordVerseKey: string): boolean => {
    if (!highlightBounds) return false;
    const [s, a] = wordVerseKey.split(":").map(Number);
    return (
      s === highlightBounds.surah &&
      a >= highlightBounds.ayahStart &&
      a <= highlightBounds.ayahEnd
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-7 pb-28 sm:pb-32 lg:pb-14 space-y-5 min-w-0 selection:bg-[#f3b833]/30 selection:text-[#221c12]">
      {/* ── Academics Hub Navigation Tabs ── */}
      <div className="print:hidden">
        <AdminHubTabs
          hubTitle="Academics & Curriculum"
          hubDescription="Classes, weekly timetable, Takhteet, Tilawat Dua, and Quran Ikhtebaar."
          tabs={[
            { label: "Classes & Darajahs", href: "/admin/classes", icon: BookOpen },
            { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
            { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
            { label: "Tilawat Dua", href: "/admin/tilawat-dua", icon: Sparkles, badge: "Daily" },
            { label: "Quran Ikhtebaar", href: "/admin/quran-ikhtebaar", icon: BookCheck, badge: "Syllabus" },
          ]}
        />
      </div>

      {/* ── ADMIN MODE SWITCHER (Exam Console vs Admin Management) ── */}
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="inline-flex p-1 rounded-xl bg-[#f4efe5] border border-[#e7e0d0]">
            <button
              type="button"
              onClick={() => setViewMode("EXAM")}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${viewMode === "EXAM"
                ? "bg-[#221c14] text-[#fcd468] shadow-sm"
                : "text-[#3d3426] hover:text-[#221c12]"
                }`}
            >
              <BookCheck className="w-4 h-4" />
              <span>Exam Console</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("MANAGE")}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${viewMode === "MANAGE"
                ? "bg-[#221c14] text-[#fcd468] shadow-sm"
                : "text-[#3d3426] hover:text-[#221c12]"
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Admin Management ({adminAssignments.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 1: ADMIN MANAGEMENT (ASSIGN TEACHER -> TALABAT & VIEW MARKS)  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {canManage && viewMode === "MANAGE" ? (
        <div className="space-y-5 print:hidden">
          {/* Real-Time Live Sync & Concurrency Load Monitor */}
          <section className="rounded-2xl px-4 py-3 bg-[#0b2545] text-white border border-[#f3b833]/30 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  liveConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <div>
                <div className="text-xs font-extrabold text-[#fcd468] tracking-wide">
                  {liveConnected ? "Real-Time Live Sync Active" : "Auto-Sync Active (15s)"}
                </div>
                <div className="text-[11px] text-slate-300">
                  Atomic per-Mumtahin marks queue · Zero-collision concurrent uploads
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tabular-nums">
              <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                Active Queue: <strong className="text-[#fcd468]">{liveLoadMetrics.inFlightSaves}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                Peak Concurrent: <strong className="text-emerald-300">{liveLoadMetrics.peakConcurrentSaves}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                Synced Saves: <strong className="text-white">{liveLoadMetrics.totalSavesProcessed}</strong>
              </span>
              {liveLoadMetrics.lastSaveMs > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15">
                  Latency: <strong className="text-emerald-300">{liveLoadMetrics.lastSaveMs}ms</strong>
                </span>
              )}
              {lastLiveSyncAt && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                  Updated {lastLiveSyncAt}
                </span>
              )}
            </div>
          </section>

          {/* Assign Teacher & Talabat Card */}
          <section className="bg-white rounded-2xl p-4 sm:p-6 border border-[#e7e0d0] shadow-[0_2px_10px_-3px_rgba(34,28,18,0.06)] space-y-4">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#221c12]">
              <UserPlus className="w-4 h-4 text-[#a37a1a]" />
              <span>Assign Teacher &amp; Talabat</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#5c503e] block mb-1.5">
                  Select Teacher (Mumtahin)
                </label>
                <select
                  value={assignTeacherId}
                  onChange={(e) => setAssignTeacherId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-base sm:text-sm text-[#221c12] font-medium focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                >
                  <option value="">Choose a Mumtahin…</option>
                  {adminTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.its})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#5c503e] block mb-1.5">
                  Darajah (1–4)
                </label>
                <select
                  value={assignDarajah}
                  onChange={(e) => setAssignDarajah(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-base sm:text-sm text-[#221c12] font-medium focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                >
                  <option value="AUTO">Auto from Student Grade</option>
                  <option value="1">Darajah 1</option>
                  <option value="2">Darajah 2</option>
                  <option value="3">Darajah 3</option>
                  <option value="4">Darajah 4</option>
                </select>
              </div>
            </div>

            {/* Search & Multi-select Students */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#6b5f4b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={assignStudentSearch}
                    onChange={(e) => setAssignStudentSearch(e.target.value)}
                    placeholder="Search Talabat by ITS or Name…"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-base sm:text-sm text-[#221c12] focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                  />
                </div>
                <Button
                  onClick={handleAdminAssign}
                  disabled={assignSubmitting || !assignTeacherId || assignSelectedStudentIds.length === 0}
                  className="min-h-[44px] px-5 bg-[#221c14] hover:bg-[#332a1e] text-[#fcd468] text-xs sm:text-sm font-bold shrink-0"
                >
                  {assignSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-1.5" />
                  )}
                  Assign Selected ({assignSelectedStudentIds.length})
                </Button>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-[#e7e0d0] divide-y divide-[#f0eadb] bg-[#fffdf8]">
                {filteredAdminStudents.slice(0, 80).map((s) => {
                  const checked = assignSelectedStudentIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2 cursor-pointer transition-colors ${checked ? "bg-[#fff8e7]" : "hover:bg-[#faf7f0]"
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setAssignSelectedStudentIds((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                            )
                          }
                          className="w-4 h-4 accent-[#221c14] rounded shrink-0"
                        />
                        <span className="text-sm font-semibold text-[#221c12] truncate">
                          {s.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-[#5c503e] tabular-nums">
                        <span>ITS {s.its}</span>
                        <span className="px-2 py-0.5 rounded bg-white border border-[#e7e0d0] font-medium">
                          {s.grade} {s.section}
                        </span>
                      </div>
                    </label>
                  );
                })}
                {filteredAdminStudents.length === 0 && (
                  <div className="p-4 text-center text-xs text-[#5c503e]">
                    No matching Talabat found.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Darajah-Wise Talabat Marks & Excel Export */}
          <section className="bg-white rounded-2xl p-4 sm:p-6 border border-[#e7e0d0] shadow-[0_2px_10px_-3px_rgba(34,28,18,0.06)] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#221c12] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#a37a1a]" />
                  <span>Darajah-Wise Talabat Marks &amp; Mumtahin Roster</span>
                </h2>
                <p className="text-xs text-[#5c503e] mt-0.5">
                  Stacked Darajah 1 to 4 with individual Q1–Q6 marks, totals, percentages, and assigned Mumtahin.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-[#6b5f4b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={adminFilterSearch}
                    onChange={(e) => setAdminFilterSearch(e.target.value)}
                    placeholder="Filter teacher, student, or ITS…"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-base sm:text-sm text-[#221c12] focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBlankMarksheet}
                  disabled={exportingBlankMarksheet || adminLoading}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0f5132] text-white hover:bg-[#0c4228] font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  title="Download printable empty marksheet (1 sheet per Mumtahin)"
                >
                  {exportingBlankMarksheet ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  <span>{exportingBlankMarksheet ? "Preparing…" : "Blank Marksheets"}</span>
                  <Download className="w-3.5 h-3.5 opacity-80" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadExcel()}
                  disabled={exportingExcel || adminLoading}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#221c14] text-[#fcd468] hover:bg-[#332a1e] font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {exportingExcel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  <span>{exportingExcel ? "Generating Excel…" : "Bulk Excel"}</span>
                  <Download className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>

            {/* Mumtahin Profile Pic Tabs */}
            {!adminLoading && mumtahinTabs.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5c503e]">
                    Select Mumtahin ({mumtahinTabs.length})
                  </span>
                  {selectedMumtahinId !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setSelectedMumtahinId("ALL")}
                      className="text-xs font-bold text-[#a37a1a] hover:underline cursor-pointer"
                    >
                      Show All Darajahs
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setSelectedMumtahinId("ALL")}
                    className={`min-h-[48px] px-3.5 py-2 rounded-xl border text-left transition-all shrink-0 flex items-center gap-2.5 cursor-pointer ${
                      selectedMumtahinId === "ALL"
                        ? "bg-[#221c14] text-[#fcd468] border-[#221c14] shadow-sm"
                        : "bg-[#faf7f0] text-[#221c12] border-[#e7e0d0] hover:bg-[#f4efe5]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        selectedMumtahinId === "ALL"
                          ? "bg-[#fcd468] text-[#221c14]"
                          : "bg-[#e7e0d0] text-[#221c12]"
                      }`}
                    >
                      All
                    </div>
                    <div>
                      <div className="text-xs font-bold whitespace-nowrap">All Mumtahins</div>
                      <div className="text-[10.5px] opacity-80 tabular-nums whitespace-nowrap">
                        {adminAssignments.length} Talabat · Darajah 1–4
                      </div>
                    </div>
                  </button>

                  {mumtahinTabs.map((m) => {
                    const isSelected = selectedMumtahinId === m.teacherId;
                    const initials = m.teacherName
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <button
                        key={m.teacherId}
                        type="button"
                        onClick={() => setSelectedMumtahinId(m.teacherId)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-all shrink-0 flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#221c14] text-[#fcd468] border-[#221c14] shadow-sm ring-2 ring-[#f3b833]/50"
                            : "bg-[#faf7f0] text-[#221c12] border-[#e7e0d0] hover:bg-[#f4efe5]"
                        }`}
                      >
                        {m.teacherAvatarUrl ? (
                          <img
                            src={m.teacherAvatarUrl}
                            alt={m.teacherName}
                            className="w-9 h-9 rounded-full object-cover border border-[#d4af37]/60 shrink-0 bg-white"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                              isSelected
                                ? "bg-[#fcd468] text-[#221c14]"
                                : "bg-[#0b2545] text-[#fcd468]"
                            }`}
                          >
                            {initials || "M"}
                          </div>
                        )}
                        <div className="min-w-0 max-w-[175px]">
                          <div className="text-xs font-bold truncate">{m.teacherName}</div>
                          <div className="text-[10.5px] opacity-80 tabular-nums flex items-center gap-1.5">
                            <span>
                              {m.completedCount}/{m.totalCount} Done
                            </span>
                            {m.completedCount > 0 && <span>· {m.avgPct}%</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {adminLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#5c503e]">
                <Loader2 className="w-5 h-5 animate-spin text-[#a37a1a]" />
                <span>Loading assignments and marks…</span>
              </div>
            ) : activeMumtahinTab ? (
              /* Selected Individual Mumtahin View & Individual Group Excel */
              <div className="rounded-xl border border-[#e7e0d0] overflow-hidden bg-[#fffdf8]">
                <div className="px-4 py-3.5 bg-[#faf7f0] border-b border-[#e7e0d0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {activeMumtahinTab.teacherAvatarUrl ? (
                      <img
                        src={activeMumtahinTab.teacherAvatarUrl}
                        alt={activeMumtahinTab.teacherName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#d4af37] shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#0b2545] text-[#fcd468] flex items-center justify-center text-sm font-extrabold border-2 border-[#d4af37] shrink-0">
                        {activeMumtahinTab.teacherName
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-[#221c12] truncate">
                        {activeMumtahinTab.teacherName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5c503e] tabular-nums mt-0.5">
                        {activeMumtahinTab.teacherIts && (
                          <span>ITS {activeMumtahinTab.teacherIts}</span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-white border border-[#e7e0d0] font-semibold text-[#221c12]">
                          {activeMumtahinTab.rows.length} Talabat
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#fff8e7] border border-[#f3b833]/40 font-semibold text-[#7a5a13]">
                          {activeMumtahinTab.completedCount}/{activeMumtahinTab.totalCount} Completed
                        </span>
                        {activeMumtahinTab.completedCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                            Avg {activeMumtahinTab.avgPct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadExcel(
                        activeMumtahinTab.teacherId,
                        activeMumtahinTab.teacherName
                      )
                    }
                    disabled={exportingGroupExcel}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0f5132] text-white hover:bg-[#0c4228] font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {exportingGroupExcel ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    <span>
                      {exportingGroupExcel ? "Exporting…" : "Download Group Excel"}
                    </span>
                    <Download className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </div>

                {activeMumtahinTab.rows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#5c503e]">
                    No Talabat match your search filter for this Mumtahin.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[780px]">
                      <thead className="border-b border-[#e7e0d0] bg-white text-[#5c503e] font-semibold">
                        <tr>
                          <th className="py-2.5 px-3.5">Sr.</th>
                          <th className="py-2.5 px-3.5">Talib (ITS)</th>
                          <th className="py-2.5 px-2.5">Darajah</th>
                          <th className="py-2.5 px-2.5">Nizam</th>
                          <th className="py-2.5 px-2 text-center">Q1</th>
                          <th className="py-2.5 px-2 text-center">Q2</th>
                          <th className="py-2.5 px-2 text-center">Q3</th>
                          <th className="py-2.5 px-2 text-center">Q4</th>
                          <th className="py-2.5 px-2 text-center">Q5</th>
                          <th className="py-2.5 px-2 text-center">Q6</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                          <th className="py-2.5 px-3 text-right">%</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0eadb] tabular-nums">
                        {activeMumtahinTab.rows.map((row, idx) => {
                          const s = row.session;
                          const pct = s ? s.percentage : 0;
                          const total = s ? s.totalMarks : 0;
                          const status = s?.status || "NOT_STARTED";

                          return (
                            <tr key={row.id} className="hover:bg-[#faf7f0]/60">
                              <td className="py-2.5 px-3.5 font-semibold text-[#5c503e]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <div className="font-bold text-[#221c12]">
                                  {row.studentName}
                                </div>
                                <div className="text-[11px] text-[#5c503e]">
                                  ITS {row.studentIts} · {row.grade} {row.section}
                                </div>
                              </td>
                              <td className="py-2.5 px-2.5 font-semibold text-[#221c12]">
                                Darajah {row.darajah}
                              </td>
                              <td className="py-2.5 px-2.5 font-medium text-[#3d3426]">
                                {row.nizam}
                              </td>
                              {[
                                s?.q1Marks,
                                s?.q2Marks,
                                s?.q3Marks,
                                s?.q4Marks,
                                s?.q5Marks,
                                s?.q6Marks,
                              ].map((m, i) => (
                                <td
                                  key={i}
                                  className="py-2.5 px-2 text-center font-semibold text-[#221c12]"
                                >
                                  {m !== null && m !== undefined ? m : "—"}
                                </td>
                              ))}
                              <td className="py-2.5 px-3 text-right font-extrabold text-[#221c12]">
                                {s ? `${total}/60` : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#a37a1a]">
                                {s ? `${pct}%` : "—"}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                    status === "COMPLETED"
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : status === "IN_PROGRESS"
                                        ? "bg-[#fff8e7] text-[#7a5a13] border border-[#f3b833]/40"
                                        : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {status === "COMPLETED"
                                    ? "Completed"
                                    : status === "IN_PROGRESS"
                                      ? "In Progress"
                                      : "Pending"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewMode("EXAM");
                                      handleSelectTalib({
                                        assignmentId: row.id,
                                        teacherId: row.teacherId,
                                        teacherName: row.teacherName,
                                        studentId: row.studentId,
                                        its: row.studentIts,
                                        name: row.studentName,
                                        grade: row.grade,
                                        section: row.section,
                                        nizam: row.nizam,
                                        darajah: row.darajah,
                                        session: row.session,
                                      });
                                    }}
                                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#221c14] text-[#fcd468] text-[11px] font-bold hover:bg-[#332a1e] cursor-pointer"
                                  >
                                    {s ? "Resume" : "Open"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignment(row.id)}
                                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 cursor-pointer"
                                    title="Remove assignment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : groupedByDarajah.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#5c503e] bg-[#faf7f0] rounded-xl border border-[#e7e0d0]">
                No Quran Ikhtebaar teacher assignments match your filter. Assign a Mumtahin and Talabat above.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByDarajah.map((group) => {
                  const isOpen = expandedDarajahs[group.darajah] ?? true;
                  const completedRows = group.rows.filter(
                    (r) => r.session?.status === "COMPLETED"
                  );
                  const completedCount = completedRows.length;
                  const avgPct =
                    completedCount > 0
                      ? Math.round(
                          completedRows.reduce(
                            (sum, r) => sum + (r.session?.percentage || 0),
                            0
                          ) / completedCount
                        )
                      : 0;

                  return (
                    <div
                      key={group.darajah}
                      className="rounded-xl border border-[#e7e0d0] overflow-hidden bg-[#fffdf8]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDarajahs((prev) => ({
                            ...prev,
                            [group.darajah]: !isOpen,
                          }))
                        }
                        className="w-full min-h-[52px] px-4 py-3 bg-[#faf7f0] hover:bg-[#f4efe5] flex flex-wrap items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-[#a37a1a]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#a37a1a]" />
                          )}
                          <span className="font-bold text-sm text-[#221c12]">
                            {group.nameEn}
                          </span>
                          <span className="text-xs font-semibold text-[#7a5a13]">
                            {group.nameAr}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                          <span className="px-2.5 py-1 rounded-md bg-white border border-[#e7e0d0] font-semibold text-[#221c12]">
                            {group.rows.length} Talabat
                          </span>
                          <span className="px-2.5 py-1 rounded-md bg-[#fff8e7] border border-[#f3b833]/40 font-semibold text-[#7a5a13]">
                            {completedCount}/{group.rows.length} Completed
                          </span>
                          {completedCount > 0 && (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                              Avg {avgPct}%
                            </span>
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[820px]">
                            <thead className="border-y border-[#e7e0d0] bg-white text-[#5c503e] font-semibold">
                              <tr>
                                <th className="py-2.5 px-3.5">Talib (ITS)</th>
                                <th className="py-2.5 px-3">Mumtahin</th>
                                <th className="py-2.5 px-2.5">Nizam</th>
                                <th className="py-2.5 px-2 text-center">Q1</th>
                                <th className="py-2.5 px-2 text-center">Q2</th>
                                <th className="py-2.5 px-2 text-center">Q3</th>
                                <th className="py-2.5 px-2 text-center">Q4</th>
                                <th className="py-2.5 px-2 text-center">Q5</th>
                                <th className="py-2.5 px-2 text-center">Q6</th>
                                <th className="py-2.5 px-3 text-right">Total</th>
                                <th className="py-2.5 px-3 text-right">%</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0eadb] tabular-nums">
                              {group.rows.map((row) => {
                                const s = row.session;
                                const pct = s ? s.percentage : 0;
                                const total = s ? s.totalMarks : 0;
                                const status = s?.status || "NOT_STARTED";
                                const activeNizam = row.nizam;

                                return (
                                  <tr key={row.id} className="hover:bg-[#faf7f0]/60">
                                    <td className="py-2.5 px-3.5">
                                      <div className="font-bold text-[#221c12]">
                                        {row.studentName}
                                      </div>
                                      <div className="text-[11px] text-[#5c503e]">
                                        ITS {row.studentIts} · {row.grade} {row.section}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <div className="font-semibold text-[#221c12]">
                                        {row.teacherName}
                                      </div>
                                      <div className="text-[11px] text-[#5c503e]">
                                        ITS {row.teacherIts}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2.5 font-medium text-[#3d3426]">
                                      {activeNizam}
                                    </td>
                                    {[
                                      s?.q1Marks,
                                      s?.q2Marks,
                                      s?.q3Marks,
                                      s?.q4Marks,
                                      s?.q5Marks,
                                      s?.q6Marks,
                                    ].map((m, i) => (
                                      <td
                                        key={i}
                                        className="py-2.5 px-2 text-center font-semibold text-[#221c12]"
                                      >
                                        {m !== null && m !== undefined ? m : "—"}
                                      </td>
                                    ))}
                                    <td className="py-2.5 px-3 text-right font-extrabold text-[#221c12]">
                                      {s ? `${total}/60` : "—"}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-[#a37a1a]">
                                      {s ? `${pct}%` : "—"}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                          status === "COMPLETED"
                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                            : status === "IN_PROGRESS"
                                              ? "bg-[#fff8e7] text-[#7a5a13] border border-[#f3b833]/40"
                                              : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {status === "COMPLETED"
                                          ? "Completed"
                                          : status === "IN_PROGRESS"
                                            ? "In Progress"
                                            : "Pending"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setViewMode("EXAM");
                                            handleSelectTalib({
                                              assignmentId: row.id,
                                              teacherId: row.teacherId,
                                              teacherName: row.teacherName,
                                              studentId: row.studentId,
                                              its: row.studentIts,
                                              name: row.studentName,
                                              grade: row.grade,
                                              section: row.section,
                                              nizam: row.nizam,
                                              darajah: row.darajah,
                                              session: row.session,
                                            });
                                          }}
                                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#221c14] text-[#fcd468] text-[11px] font-bold hover:bg-[#332a1e] cursor-pointer"
                                        >
                                          {s ? "Resume" : "Open"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAssignment(row.id)}
                                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 cursor-pointer"
                                          title="Remove assignment"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════ */
        /* VIEW 2: EXAM CONSOLE (ASSIGNED TALABAT SEARCH + RESUME + 6 QUESTIONS) */
        /* ════════════════════════════════════════════════════════════════════ */
        <>
          {/* ── 1. ASSIGNED TALABAT SEARCH & RESUME BAR ── */}
          <section
            aria-label="Assigned Talabat search and marks"
            className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e7e0d0] shadow-[0_2px_10px_-3px_rgba(34,28,18,0.06)] space-y-3.5 print:hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#221c12]">
                <Users className="w-4 h-4 text-[#a37a1a]" />
                <span>Assigned Talabat</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#faf7f0] border border-[#e7e0d0] text-[#5c503e] tabular-nums">
                  {assignedTalabat.length}
                </span>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#6b5f4b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={talibSearch}
                  onChange={(e) => setTalibSearch(e.target.value)}
                  placeholder="Type ITS number or name…"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-base sm:text-sm text-[#221c12] focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                />
              </div>
            </div>

            {talabatLoading ? (
              <div className="py-4 flex items-center gap-2 text-xs text-[#5c503e]">
                <Loader2 className="w-4 h-4 animate-spin text-[#a37a1a]" />
                <span>Loading your assigned Talabat…</span>
              </div>
            ) : filteredAssignedTalabat.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                {filteredAssignedTalabat.map((t) => {
                  const isActive = selectedTalib?.studentId === t.studentId;
                  const s = t.session;
                  return (
                    <button
                      key={t.assignmentId}
                      type="button"
                      onClick={() => handleSelectTalib(t)}
                      className={`min-h-[64px] p-3 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${isActive
                        ? "border-2 border-[#f3b833] bg-[#fff8e7] shadow-xs"
                        : "border border-[#e7e0d0] bg-[#faf7f0]/70 hover:bg-[#faf7f0]"
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs sm:text-[13px] font-bold text-[#221c12] truncate">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-[#5c503e] tabular-nums">
                          ITS {t.its} · Darajah {t.darajah} ({t.nizam})
                        </div>
                      </div>

                      <div className="shrink-0 text-right tabular-nums">
                        {s ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-extrabold text-[#221c12]">
                              {s.totalMarks}/60 ({s.percentage}%)
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${s.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-[#221c14] text-[#fcd468]"
                                }`}
                            >
                              <PlayCircle className="w-2.5 h-2.5" />
                              {s.status === "COMPLETED" ? "Done" : "Resume"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white border border-[#e7e0d0] text-[#5c503e]">
                            Start
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#5c503e] bg-[#faf7f0] px-3.5 py-3 rounded-xl border border-[#e7e0d0]">
                {assignedTalabat.length === 0
                  ? "No Talabat assigned to your account yet. Ask Admin to assign Talabat under Admin Management."
                  : "No assigned Talabat match your search."}
              </div>
            )}

            {/* Active Talib Live Score & Save/Resume Bar */}
            {selectedTalib && (
              <div className="pt-3 border-t border-[#f0eadb] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-[#221c14] text-[#fcd468] text-xs font-bold">
                    {selectedTalib.name} · ITS {selectedTalib.its}
                  </div>
                  <div className="text-sm font-extrabold text-[#221c12] tabular-nums">
                    Total: {totalScore} / {maxTotalMarks}{" "}
                    <span className="text-[#a37a1a] ml-1">({percentage}%)</span>
                  </div>
                  {savingStatus === "SAVED" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => handleSaveSession("IN_PROGRESS")}
                    disabled={savingStatus === "SAVING"}
                    variant="outline"
                    className="min-h-[44px] px-4 text-xs font-bold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5 text-[#a37a1a]" />
                    <span>Save Progress (Resume)</span>
                  </Button>

                  <Button
                    onClick={() => handleSaveSession("COMPLETED")}
                    disabled={savingStatus === "SAVING"}
                    className="min-h-[44px] px-4 bg-[#221c14] hover:bg-[#332a1e] text-[#fcd468] text-xs font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit Final Marks</span>
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* ── 2. NIZAM & DARAJAH CONTROLS ── */}
          <section
            aria-label="Curriculum and Darajah selector"
            className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e7e0d0] shadow-[0_2px_10px_-3px_rgba(34,28,18,0.06)] space-y-4 print:hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#221c12]">
                <SlidersHorizontal className="w-4 h-4 text-[#a37a1a]" />
                <span>Select Curriculum &amp; Darajah</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex p-1 rounded-xl bg-[#f4efe5] border border-[#e7e0d0]">
                  {(["OLD", "NEW"] as const).map((type) => {
                    const active = nizam === type;
                    const cfg = QURAN_IKHTEBAAR_DATA[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setNizam(type);
                          setResumedQuestions(null);
                          setSeenIds([]);
                          setScores({});
                        }}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3b833] ${active
                          ? "bg-[#221c14] text-[#fcd468] shadow-sm border border-[#f3b833]/30"
                          : "text-[#3d3426] hover:text-[#221c12] hover:bg-white/70"
                          }`}
                      >
                        <span>{cfg.titleEn}</span>
                        <span
                          dir="rtl"
                          lang="ar"
                          className={`font-alkanz text-sm font-normal ${active ? "text-[#fcd468]" : "text-[#7a5a13]"
                            }`}
                          style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                        >
                          {cfg.titleAr}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleRegenerate}
                    variant="outline"
                    className="min-h-[44px] px-3.5 text-xs sm:text-[13px] font-semibold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#a37a1a]" />
                    <span>Shuffle</span>
                  </Button>

                  <Button
                    onClick={handleCopyQuestions}
                    variant="outline"
                    className="min-h-[44px] px-3.5 text-xs sm:text-[13px] font-semibold border-[#e7e0d0] text-[#221c12] hover:bg-[#faf7f0] flex items-center gap-1.5"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#a37a1a]" />
                    )}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </Button>

                  <Button
                    onClick={handlePrint}
                    className="min-h-[44px] px-3.5 bg-[#221c14] hover:bg-[#332a1e] text-[#faf7f0] text-xs sm:text-[13px] font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#f3b833]" />
                    <span>Print</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {DARAJAH_LIST.map((d) => {
                const isSelected = selectedDarajah === d.num;
                const syl = getDarajahSyllabus(nizam, d.num);

                return (
                  <button
                    key={d.num}
                    type="button"
                    onClick={() => {
                      setSelectedDarajah(d.num);
                      setResumedQuestions(null);
                      setSeenIds([]);
                      setScores({});
                    }}
                    className={`min-h-[84px] flex flex-col justify-between p-3.5 rounded-xl text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3b833] ${isSelected
                      ? "border-2 border-[#f3b833] bg-[#fff8e7] shadow-sm"
                      : "border border-[#e7e0d0] bg-[#faf7f0]/75 hover:bg-[#faf7f0] hover:border-[#d4c8ae]"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-[13px] sm:text-sm font-extrabold text-[#221c12] leading-tight">
                        {d.nameEn} ({d.shortName})
                      </span>
                      <span
                        dir="rtl"
                        lang="ar"
                        className={`font-alkanz text-base font-bold shrink-0 ${isSelected ? "text-[#a37a1a]" : "text-[#7a5a13]"
                          }`}
                        style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                      >
                        {d.nameAr}
                      </span>
                    </div>

                    {syl && (
                      <div className="mt-2.5 flex items-center justify-between gap-2 w-full">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${isSelected
                            ? "bg-[#221c14] text-[#fcd468]"
                            : "bg-white text-[#3d3426] border border-[#e7e0d0]"
                            }`}
                        >
                          {syl.juzRangeEn}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#f3b833] shrink-0" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 3. THE 6 QUESTIONS (10 MARKS EACH · DISTINCT JUZ) ── */}
          <section aria-label="Examination questions" className="space-y-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="text-base sm:text-lg font-bold text-[#221c12] flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[#a37a1a]" />
                <span>Examination Questions ({questions.length} × 10 Marks)</span>
              </h2>
              <span className="text-xs font-medium text-[#5c503e]">
                Tap any verse to open Mushaf page
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {questions.map((q, idx) => {
                const currentScore = scores[q.id] ?? "";

                return (
                  <article
                    key={q.id}
                    className="bg-white rounded-2xl border border-[#e7e0d0] p-4 sm:p-6 shadow-[0_2px_10px_-3px_rgba(34,28,18,0.05)] space-y-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#f0eadb]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-[#221c14] text-[#fcd468] font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-[#221c12]">
                          Question {idx + 1}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#fff8e7] text-[#7a5a13] border border-[#f3b833]/40 tabular-nums">
                          {q.marks} Marks
                        </span>

                        <div className="flex items-center gap-1.5 bg-[#faf7f0] px-2.5 py-1 rounded-lg border border-[#e7e0d0]">
                          <label
                            htmlFor={`score-${q.id}`}
                            className="text-xs font-semibold text-[#5c503e]"
                          >
                            Score:
                          </label>
                          <input
                            id={`score-${q.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={q.marks}
                            value={currentScore}
                            onChange={(e) =>
                              handleScoreChange(q.id, parseInt(e.target.value, 10), q.marks)
                            }
                            placeholder={`/${q.marks}`}
                            className="w-14 min-h-[36px] text-center text-base sm:text-sm font-bold bg-white text-[#221c12] rounded-md border border-[#e7e0d0] py-1 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#f3b833]"
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-[13px] sm:text-sm font-medium text-[#3d3426]">
                      {q.promptEn}
                    </p>

                    <button
                      type="button"
                      onClick={() => openMushafPopup(q)}
                      className="group relative w-full text-left rounded-2xl px-3.5 py-5 sm:px-8 sm:py-7 bg-[#fffcf2] hover:bg-[#fff9eb] border border-[#e7e0d0] hover:border-[#f3b833] shadow-inner transition-colors cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3b833]"
                    >
                      <div className="absolute top-2.5 left-2.5 pointer-events-none opacity-60">
                        <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} />
                      </div>
                      <div className="absolute top-2.5 right-2.5 pointer-events-none opacity-60">
                        <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} flipH />
                      </div>
                      <div className="absolute bottom-2.5 left-2.5 pointer-events-none opacity-60">
                        <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} flipV />
                      </div>
                      <div className="absolute bottom-2.5 right-2.5 pointer-events-none opacity-60">
                        <FatimiCornerBracket size={16} stroke="#b8972e" opacity={0.7} flipH flipV />
                      </div>

                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-quran text-[22px] sm:text-[26px] lg:text-[30px] text-[#221c12] text-center leading-[2.35] tracking-normal px-2 select-text"
                        style={{
                          fontFamily:
                            "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                        }}
                      >
                        {q.ayahTextAr}
                      </p>

                      <div className="mt-4 pt-3 border-t border-[#f0eadb] flex items-center justify-center gap-2 text-xs text-[#5c503e] flex-wrap">
                        <span className="font-semibold text-[#221c12] bg-[#f7f3ea] px-2.5 py-0.5 rounded-md border border-[#e7e0d0]">
                          {q.surahNameEn}
                        </span>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="font-alkanz text-sm font-bold text-[#7a5a13]"
                          style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                        >
                          {q.surahNameAr}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          Ayah {q.ayahStart}
                          {q.ayahEnd ? `–${q.ayahEnd}` : ""}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-[#221c12] tabular-nums">
                          Juz {q.juzNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 ml-1 text-xs font-semibold text-[#7a5a13] group-hover:underline">
                          <Maximize2 className="w-3.5 h-3.5" />
                          Open Mushaf page
                        </span>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ── DONE EVALUATION CELEBRATION ANIMATION MODAL ── */}
      <AnimatePresence>
        {doneEvaluation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDoneEvaluation(null)}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Evaluation completed"
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-[#fffdf8] border-2 border-[#f3b833] p-6 text-center shadow-2xl space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="w-16 h-16 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg ring-8 ring-emerald-100"
              >
                <Check className="w-8 h-8" strokeWidth={3} />
              </motion.div>

              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-[#221c12]">Evaluation Done</h3>
                <p className="text-sm font-semibold text-[#5c503e]">{doneEvaluation.name}</p>
                <p className="text-xs text-[#6b5f4b] tabular-nums">ITS {doneEvaluation.its}</p>
              </div>

              <div className="rounded-2xl bg-[#faf7f0] border border-[#e7e0d0] p-4 flex items-center justify-around tabular-nums">
                <div>
                  <div className="text-[11px] font-semibold text-[#6b5f4b]">Total Marks</div>
                  <div className="text-2xl font-black text-[#221c12]">
                    {doneEvaluation.total}
                    <span className="text-xs font-semibold text-[#6b5f4b]">
                      /{doneEvaluation.max}
                    </span>
                  </div>
                </div>
                <div className="h-9 w-px bg-[#e7e0d0]" />
                <div>
                  <div className="text-[11px] font-semibold text-[#6b5f4b]">Percentage</div>
                  <div className="text-2xl font-black text-[#a37a1a]">
                    {doneEvaluation.percentage}%
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setDoneEvaluation(null)}
                  className="flex-1 min-h-[44px] border-[#e7e0d0] text-[#221c12] font-bold text-xs"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setDoneEvaluation(null);
                    setSelectedTalib(null);
                    setScores({});
                    setResumedQuestions(null);
                    setSavingStatus("IDLE");
                  }}
                  className="flex-1 min-h-[44px] bg-[#221c14] hover:bg-[#332a1e] text-[#fcd468] font-bold text-xs"
                >
                  Next Talib
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MUSHAF PAGE POPUP MODAL (QUESTION HIGHLIGHTED + 15 LINES AFTER) ── */}
      <AnimatePresence>
        {activeMushafQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closeMushafPopup}
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 print:hidden"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${activeMushafQuestion.surahNameEn} Mushaf Page`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl bg-[#fffcf2] sm:rounded-3xl border border-[#d4af37]/50 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#221c14] text-[#faf7f0] border-b border-[#f3b833]/30 shrink-0">
                <button
                  type="button"
                  onClick={closeMushafPopup}
                  className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f3b833] hover:bg-[#e5a922] text-[#191510] text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="text-center min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#fcd468] truncate">
                    {activeMushafQuestion.surahNameEn} · Ayah {activeMushafQuestion.ayahStart}
                  </div>
                  <div className="text-[11px] text-[#e7e0d0]/85 tabular-nums">
                    Juz {activeMushafQuestion.juzNumber}
                    {startPageNum ? ` · Page ${startPageNum}` : ""} · +15 Lines
                  </div>
                </div>

                <span
                  dir="rtl"
                  lang="ar"
                  className="font-alkanz text-sm font-bold text-[#fcd468] hidden sm:inline shrink-0"
                  style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                >
                  {activeMushafQuestion.surahNameAr}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
                {mushafLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#5c503e]">
                    <Loader2 className="w-7 h-7 animate-spin text-[#a37a1a]" />
                    <span className="text-xs font-medium">Loading Mushaf page…</span>
                  </div>
                )}

                {!mushafLoading && mushafError && (
                  <div className="space-y-4">
                    <div className="text-xs text-center text-[#7a5a13] bg-[#fff8e7] px-3 py-2 rounded-xl border border-[#f3b833]/40">
                      {mushafError}
                    </div>
                    <div className="rounded-2xl p-6 bg-[#fff8e7] border border-[#f3b833]/50">
                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-quran text-2xl sm:text-3xl text-[#221c12] text-center leading-[2.35]"
                        style={{
                          fontFamily:
                            "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                        }}
                      >
                        {activeMushafQuestion.ayahTextAr}
                      </p>
                    </div>
                  </div>
                )}

                {!mushafLoading && !mushafError && mushafLines.length > 0 && (() => {
                  let attachedRef = false;

                  return (
                    <div className="rounded-2xl border-2 border-[#d4af37]/55 ring-1 ring-[#e7e0d0] bg-[#fffcf2] p-3 sm:p-6 shadow-inner space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#5c503e] pb-2 border-b border-[#e7e0d0]">
                        <span className="tabular-nums">
                          Page {startPageNum}
                          {mushafLines[mushafLines.length - 1]?.pageNumber !== startPageNum
                            ? `–${mushafLines[mushafLines.length - 1]?.pageNumber}`
                            : ""}
                        </span>
                        <span className="font-bold text-[#7a5a13]">Misri Mushaf · 15 Lines</span>
                      </div>

                      <div dir="rtl" lang="ar" className="divide-y divide-[#efe6d2]">
                        {mushafLines.map((line, idx) => {
                          const prevPage = idx > 0 ? mushafLines[idx - 1].pageNumber : line.pageNumber;
                          const isPageBreak = idx > 0 && line.pageNumber !== prevPage;

                          return (
                            <div key={`${line.pageNumber}-${line.lineNumber}`}>
                              {isPageBreak && (
                                <div
                                  dir="ltr"
                                  className="my-2 py-1 text-center text-[11px] font-semibold text-[#7a5a13] bg-[#faf4e4] rounded-lg border border-[#e7e0d0]"
                                >
                                  Page {line.pageNumber}
                                </div>
                              )}
                              <div className="flex items-center gap-2 py-1">
                                <span
                                  dir="ltr"
                                  className="text-[10px] font-mono text-[#a37a1a]/75 w-5 text-center shrink-0 select-none tabular-nums"
                                >
                                  {line.lineNumber}
                                </span>
                                <div
                                  className="flex-1 font-quran text-[18px] sm:text-[22px] lg:text-[25px] text-[#221c12] leading-[2.15] text-center flex flex-wrap justify-center gap-x-1.5"
                                  style={{
                                    fontFamily:
                                      "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                                  }}
                                >
                                  {line.words.map((w) => {
                                    const highlighted = isQuestionWord(w.verseKey);
                                    const shouldAttachRef = highlighted && !attachedRef;
                                    if (shouldAttachRef) attachedRef = true;

                                    return (
                                      <span
                                        key={w.id}
                                        ref={shouldAttachRef ? firstHighlightRef : undefined}
                                        className={
                                          highlighted
                                            ? "bg-[#fef08a]/90 text-[#221c12] rounded-md px-1"
                                            : "px-0.5"
                                        }
                                      >
                                        {w.text}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OFFICIAL PRINTABLE PAPER (Shown only on Print) ── */}
      <div className="hidden print:block p-6 space-y-5 text-black bg-white">
        <div className="text-center space-y-1 pb-3 border-b-2 border-black">
          <div dir="rtl" lang="ar" className="font-quran text-base font-bold">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </div>
          <div className="text-lg font-extrabold">
            Darse Burhani · Al-Quran al-Majeed Ikhtebaar ({activeSyllabus?.nameEn})
          </div>
          <div className="text-xs text-gray-800">
            Aljamea Syllabus (1447–1448 H) · {nizamConfig.titleEn} · {activeSyllabus?.juzRangeEn}
          </div>
        </div>

        <table className="w-full text-xs border border-black border-collapse">
          <tbody>
            <tr>
              <td className="p-2 border border-black font-bold bg-gray-100 w-1/4">Student Name:</td>
              <td className="p-2 border border-black w-1/4">
                {selectedTalib?.name || "______________________"}
              </td>
              <td className="p-2 border border-black font-bold bg-gray-100 w-1/4">ITS Number:</td>
              <td className="p-2 border border-black w-1/4">
                {selectedTalib?.its || "______________________"}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-black font-bold bg-gray-100">Date:</td>
              <td className="p-2 border border-black">{new Date().toLocaleDateString("en-GB")}</td>
              <td className="p-2 border border-black font-bold bg-gray-100">Total / Passing Marks:</td>
              <td className="p-2 border border-black">
                {activeSyllabus?.totalMarks} / {activeSyllabus?.passingMarks}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-3.5">
          {questions.map((q, idx) => (
            <div key={q.id} className="border border-black p-3 rounded-lg space-y-1.5 break-inside-avoid">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1">
                <span className="font-bold text-xs">Question {idx + 1}</span>
                <span className="font-bold text-xs">
                  [{q.marks} Marks] · Score: [{scores[q.id] ?? "____"}]
                </span>
              </div>

              <div className="text-xs text-gray-800">{q.promptEn}</div>

              <div
                dir="rtl"
                lang="ar"
                className="font-quran text-xl p-2.5 bg-gray-50 rounded border border-gray-300 text-center leading-[2.3]"
                style={{
                  fontFamily: "'Amiri Quran', 'Scheherazade New', 'Amiri', 'Traditional Arabic', serif",
                }}
              >
                {q.ayahTextAr}
              </div>

              <div className="flex justify-between text-[11px] text-gray-700">
                <span>
                  {q.surahNameEn} · Ayah {q.ayahStart}{q.ayahEnd ? `–${q.ayahEnd}` : ""} · Juz {q.juzNumber}
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  className="font-alkanz text-xs"
                  style={{ fontFamily: "'Al-Kanz', 'AL-KANZ', 'Al Kanz', serif" }}
                >
                  {q.surahNameAr}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 flex justify-between items-end text-xs">
          <div>Examiner Signature: ____________________</div>
          <div className="text-center font-bold">
            Final Score: [ {selectedTalib ? totalScore : "____"} / {maxTotalMarks} ] &nbsp;|&nbsp; [ ] Pass &nbsp;[ ] Retest
          </div>
          <div>Academic Head: ____________________</div>
        </div>
      </div>
    </div>
  );
}
