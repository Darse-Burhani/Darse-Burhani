"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  BookOpen,
  Trash2,
  Loader2,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Users,
  Check,
  X,
  FileSpreadsheet,
  Pencil,
  Printer,
  AlertTriangle,
  Layers,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Lock,
  Unlock,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { usePortalAccess } from "@/context/PortalAccessContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { getSubjectTheme, SUBJECT_PALETTE } from "@/lib/timetable-theme";
import { aiFillTimetable, quickToggleTeacherFreeTime } from "@/lib/api";

type ActiveTab = "classes" | "master-overview" | "teachers" | "badal" | "takhteet";

const DAYS = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
  { day: 6, name: "Saturday", short: "Sat" },
];

const PERIOD_DEFS = [
  { period: 1, time: "10:30 – 11:00", label: "P1" },
  { period: 2, time: "11:00 – 11:30", label: "P2" },
  { period: 3, time: "11:30 – 12:00", label: "P3" },
  { period: 4, time: "12:00 – 12:30", label: "P4" },
  { period: 5, time: "12:30 – 13:00", label: "P5" },
  { period: 6, time: "14:15 – 14:45", label: "P6 (Post-Zohr)" },
  { period: 7, time: "14:45 – 15:15", label: "P7" },
  { period: 8, time: "15:15 – 15:45", label: "P8" },
  { period: 9, time: "15:45 – 16:15", label: "P9" },
];

const POPULAR_SUBJECTS = [
  "Quran Hifz",
  "Qasaid",
  "Daim al-Islam",
  "Sharhal akhbar",
  "Kitab al-Taharat",
  "Kitab al-Iqtisar",
  "Mukhtasar al-Asar",
  "Muntaza al-Akhbar",
  "Raudat Hidayat",
  "Dirasat Uloom il-Quran",
  "Lisan Arabi",
  "Tamreen",
  "Tadreeb",
  "Insha",
  "Science",
  "Maths",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Geography",
  "Hist/Civ",
];

// Helper to provide deterministic luxury color accents for teachers
function getTeacherAvatarGradient(name: string = ""): string {
  const gradients = [
    "from-emerald-800 to-teal-950 text-amber-200 border-emerald-600/40",
    "from-amber-700 to-yellow-950 text-white border-amber-500/40",
    "from-teal-800 to-emerald-950 text-amber-300 border-teal-500/40",
    "from-slate-800 to-slate-950 text-amber-200 border-slate-600/40",
    "from-indigo-800 to-blue-950 text-sky-200 border-indigo-500/40",
    "from-emerald-900 to-green-950 text-amber-300 border-emerald-500/40",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

// Subject color badges powered by TableMaster palette
function getSubjectBadgeStyle(subject: string) {
  return getSubjectTheme(subject).badge;
}

export default function AdminTimetableMasterPage() {
  const { modules, refreshModules } = usePortalAccess();
  const [togglingPortalRole, setTogglingPortalRole] = useState<"talabat" | "teacher" | null>(null);

  // Tab Hide/Display controls
  const [visibleTabs, setVisibleTabs] = useState<{
    classes: boolean;
    "master-overview": boolean;
    teachers: boolean;
    badal: boolean;
    takhteet: boolean;
  }>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("admin_timetable_tabs_visible") : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      classes: true,
      "master-overview": true,
      teachers: true,
      badal: true,
      takhteet: true,
    };
  });
  const [showTabSettingsModal, setShowTabSettingsModal] = useState(false);

  const toggleTabVisibility = (tabKey: keyof typeof visibleTabs) => {
    setVisibleTabs((prev) => {
      const next = { ...prev, [tabKey]: !prev[tabKey] };
      if (!Object.values(next).some(Boolean)) {
        toast({ title: "At least one tab must remain visible", variant: "warning" });
        return prev;
      }
      try {
        localStorage.setItem("admin_timetable_tabs_visible", JSON.stringify(next));
      } catch {}
      if (tabKey === activeTab && !next[tabKey]) {
        const firstVisible = (Object.keys(next) as Array<keyof typeof next>).find((k) => next[k]);
        if (firstVisible) setActiveTab(firstVisible);
      }
      return next;
    });
  };

  const showAllTabs = () => {
    const allOn = {
      classes: true,
      "master-overview": true,
      teachers: true,
      badal: true,
      takhteet: true,
    };
    setVisibleTabs(allOn);
    try {
      localStorage.setItem("admin_timetable_tabs_visible", JSON.stringify(allOn));
    } catch {}
    toast({ title: "All Timetable Tabs Displayed", variant: "success" });
  };

  const handleTogglePortalTimetable = async (targetRole: "talabat" | "teacher") => {
    setTogglingPortalRole(targetRole);
    try {
      const currentVal = modules?.[targetRole]?.timetable !== false;
      const nextVal = !currentVal;

      const getRes = await fetch("/api/admin/profile-permissions");
      const currentPerms = getRes.ok ? (await getRes.json()).data : null;

      const updatedModules = {
        ...modules,
        [targetRole]: {
          ...(modules?.[targetRole] || {}),
          timetable: nextVal,
        },
      };

      const putRes = await fetch("/api/admin/profile-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(currentPerms || {}),
          modules: updatedModules,
        }),
      });

      if (putRes.ok) {
        await refreshModules();
        toast({
          title: `${targetRole === "talabat" ? "Talabat" : "Teacher"} Timetable Tab ${nextVal ? "Displayed" : "Hidden"}`,
          description: `Timetable tab is now ${nextVal ? "visible" : "hidden"} in the ${targetRole === "talabat" ? "student" : "faculty"} portal navigation.`,
          variant: "success",
        });
      } else {
        toast({ title: "Failed to update portal permissions", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error updating visibility", variant: "destructive" });
    } finally {
      setTogglingPortalRole(null);
    }
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>("classes");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingMaster, setSyncingMaster] = useState(false);

  // TableMaster Spotlight & Talabat State
  const [spotlightSubject, setSpotlightSubject] = useState<string | null>(null);
  const [talabatModalOpen, setTalabatModalOpen] = useState(false);
  const [talabatSearch, setTalabatSearch] = useState("");
  const [badalSubjectFilter, setBadalSubjectFilter] = useState<string>("ALL");

  // Timetable core data
  const [slots, setSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [todayBadals, setTodayBadals] = useState<any[]>([]);
  const [takhteetList, setTakhteetList] = useState<any[]>([]);

  // Selection states
  const [selectedClassName, setSelectedClassName] = useState<string>("1 A");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [overviewDay, setOverviewDay] = useState<number>(1);

  // Refs for horizontal scroll
  const darajahScrollRef = useRef<HTMLDivElement>(null);
  const facultyScrollRef = useRef<HTMLDivElement>(null);

  // Masool Photo Lightbox Modal
  const [viewingMasoolPhoto, setViewingMasoolPhoto] = useState<{
    name: string;
    avatar: string;
    its?: string;
    className?: string;
  } | null>(null);

  // Badal Management State & Filters
  const [badalDate, setBadalDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [badalDateMode, setBadalDateMode] = useState<"today" | "tomorrow" | "week" | "all" | "custom">("today");
  const [badalStatusFilter, setBadalStatusFilter] = useState<"ALL" | "FULFILLED" | "PENDING">("ALL");
  const [badalSearch, setBadalSearch] = useState("");
  const [badals, setBadals] = useState<any[]>([]);
  const [badalLoading, setBadalLoading] = useState(false);

  // Badal Modal / Assistant State
  const [showBadalModal, setShowBadalModal] = useState(false);
  const [selectedSlotForBadal, setSelectedSlotForBadal] = useState<any>(null);
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [badalForm, setBadalForm] = useState({
    date: new Date().toISOString().split("T")[0],
    slotId: "",
    classId: "",
    className: "1 A",
    period: 1,
    startTime: "10:30",
    endTime: "11:00",
    subject: "",
    originalTeacherId: "",
    originalTeacherName: "",
    originalTeacherAvatar: "",
    badalTeacherId: "",
    badalTeacherName: "",
    badalTeacherAvatar: "",
    reason: "Medical / Sick Leave",
    instructions: "",
    notes: "",
  });
  const [savingBadal, setSavingBadal] = useState(false);

  // Teacher Filter State
  const [teacherSearch, setTeacherSearch] = useState("");

  // Slot Management Modal State (New / Edit / Delete slots directly)
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [isEditingExistingSlot, setIsEditingExistingSlot] = useState(false);
  const [slotFormData, setSlotFormData] = useState({
    id: "",
    classId: "",
    className: "1 A",
    teacherId: "",
    teacherName: "",
    dayOfWeek: 1,
    period: 1,
    subject: "",
    startTime: "10:30",
    endTime: "11:00",
    roomNumber: "Room 1 A",
    isBreak: false,
    breakName: "",
  });
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState(false);

  // Takhteet filter
  const [takhteetSearch, setTakhteetSearch] = useState("");
  const [takhteetClassFilter, setTakhteetClassFilter] = useState("ALL");

  // AI Timetable Auto-Fill state
  const [aiFillModalOpen, setAiFillModalOpen] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiFillScope, setAiFillScope] = useState<"ALL" | "SELECTED">("ALL");
  const [aiPreserveExisting, setAiPreserveExisting] = useState(true);

  // Load core data
  const fetchTimetableData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [resTimetable, resTakhteet] = await Promise.all([
        fetch("/api/admin/timetable"),
        fetch("/api/admin/takhteet"),
      ]);

      const dataT = await resTimetable.json();
      const dataTak = await resTakhteet.json();

      if (dataT.success && dataT.data) {
        setSlots(Array.isArray(dataT.data.slots) ? dataT.data.slots : []);
        setClasses(Array.isArray(dataT.data.classes) ? dataT.data.classes : []);
        setTodayBadals(Array.isArray(dataT.data.todayBadals) ? dataT.data.todayBadals : []);
        const teacherList = Array.isArray(dataT.data.teachers) ? dataT.data.teachers : [];
        setTeachers(teacherList);
        if (!selectedTeacherId && teacherList.length > 0) {
          setSelectedTeacherId(teacherList[0].id);
        }
      } else {
        setSlots([]);
        setClasses([]);
        setTeachers([]);
        setTodayBadals([]);
      }

      if (dataTak.success && dataTak.data) {
        const rawPlans = Array.isArray(dataTak.data)
          ? dataTak.data
          : Array.isArray(dataTak.data.plans)
          ? dataTak.data.plans
          : [];
        setTakhteetList(rawPlans);
      } else {
        setTakhteetList([]);
      }

      if (isManual) {
        toast({ variant: "success", title: "Synced", description: "Timetable, Badal, & Asatezah allocations refreshed." });
      }
    } catch {
      setSlots([]);
      setClasses([]);
      setTeachers([]);
      setTodayBadals([]);
      setTakhteetList([]);
      toast({ variant: "destructive", title: "Sync Error", description: "Could not load timetable data." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [selectedTeacherId]);

  const handleSyncMasterTimetable = async () => {
    if (!window.confirm("Initialize / Synchronize Master Timetable (240 slots) across Darajah 1A–4B, assign Class Masools, and auto-enroll Talabat?")) return;
    setSyncingMaster(true);
    try {
      const res = await fetch("/api/admin/timetable/sync-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        toast({ variant: "success", title: "Master Timetable Synced", description: data.message || "240 slots generated across 8 classes." });
        await fetchTimetableData(true);
      } else {
        toast({ variant: "destructive", title: "Sync Failed", description: data?.error || `Server error (${res.status})` });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection Error", description: "Could not connect to server." });
    } finally {
      setSyncingMaster(false);
    }
  };

  // Load Badal records with dynamic multi-mode filtering
  const fetchBadals = useCallback(async (customDateQuery?: string) => {
    setBadalLoading(true);
    try {
      let dateParam = "";
      if (customDateQuery !== undefined) {
        dateParam = customDateQuery;
      } else if (badalDateMode === "all") {
        dateParam = "ALL";
      } else if (badalDateMode === "week") {
        dateParam = "week";
      } else if (badalDateMode === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateParam = tomorrow.toISOString().split("T")[0];
      } else if (badalDateMode === "today") {
        dateParam = new Date().toISOString().split("T")[0];
      } else {
        dateParam = badalDate;
      }

      const params = new URLSearchParams();
      if (dateParam) params.set("date", dateParam);
      if (badalStatusFilter !== "ALL") params.set("status", badalStatusFilter);
      if (badalSearch.trim()) params.set("search", badalSearch.trim());

      const res = await fetch(`/api/admin/timetable/badal?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setBadals(data.data);
      } else {
        setBadals([]);
      }
    } catch {
      setBadals([]);
    } finally {
      setBadalLoading(false);
    }
  }, [badalDate, badalDateMode, badalStatusFilter, badalSearch]);

  useEffect(() => {
    fetchTimetableData();
    // Live dynamic synchronization: auto-refreshes every 20 seconds so faculty changes appear in real-time
    const interval = setInterval(() => {
      fetchTimetableData(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchTimetableData]);

  useEffect(() => {
    if (activeTab === "badal") {
      fetchBadals();
    }
  }, [activeTab, fetchBadals]);

  // Read URL query params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("class");
      if (c) setSelectedClassName(c);
      const t = params.get("tab");
      if (t === "teachers" || t === "classes" || t === "badal" || t === "takhteet" || t === "master-overview") {
        setActiveTab(t as ActiveTab);
      }
    }
  }, []);

  // Scroll controls for Darajah navigation carousel
  const scrollDarajah = (direction: "left" | "right") => {
    if (darajahScrollRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      darajahScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Scroll controls for Faculty navigation carousel in Tab 3
  const scrollFaculty = (direction: "left" | "right") => {
    if (facultyScrollRef.current) {
      const scrollAmount = direction === "left" ? -280 : 280;
      facultyScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // ── SLOT CRUD ACTIONS (ADD / EDIT / DELETE) ──
  const openNewSlotModal = (
    presetClass?: string,
    presetDay?: number,
    presetPeriod?: number,
    presetTeacherId?: string,
    isFreeTimePreset?: boolean
  ) => {
    const targetClass = presetClass !== undefined ? presetClass : selectedClassName;
    const targetDay = presetDay !== undefined ? presetDay : 1;
    const targetPeriod = presetPeriod !== undefined ? presetPeriod : 1;

    const pDef = PERIOD_DEFS.find((p) => p.period === targetPeriod);
    const times = pDef ? pDef.time.split(" – ") : ["10:30", "11:00"];
    const activeCls = classes.find((c) => c.name === targetClass);
    const targetTeacher = presetTeacherId ? teachers.find((t) => t.id === presetTeacherId) : (teachers[0] || null);

    setSlotFormData({
      id: "",
      classId: activeCls?.id || "",
      className: targetClass || "",
      teacherId: targetTeacher?.id || teachers[0]?.id || "",
      teacherName: targetTeacher?.name || teachers[0]?.name || "",
      dayOfWeek: targetDay,
      period: targetPeriod,
      subject: "",
      startTime: times[0] ? times[0].trim() : "10:30",
      endTime: times[1] ? times[1].trim() : "11:00",
      roomNumber: targetClass ? `Room ${targetClass}` : "Faculty Desk",
      isBreak: Boolean(isFreeTimePreset),
      breakName: isFreeTimePreset ? "Free Time / Receiving Period (استقبال وتفرغ)" : "",
    });
    setIsEditingExistingSlot(false);
    setSlotModalOpen(true);
  };

  const handleRunAiFill = async () => {
    setAiFilling(true);
    try {
      const payload = {
        className: aiFillScope === "SELECTED" ? selectedClassName : "ALL",
        preserveExisting: aiPreserveExisting,
      };
      const res = await aiFillTimetable(payload);
      if (res.success) {
        toast({
          variant: "success",
          title: "✨ AI Timetable Auto-Fill Complete",
          description: res.message || `Successfully assigned ${res.data.createdCount} lesson slots! Protected ${res.data.skippedFreeTimeCount} free periods.`,
        });
        setAiFillModalOpen(false);
        await fetchTimetableData(true);
      } else {
        toast({ variant: "destructive", title: "AI Fill Failed", description: res.message || "Failed to fill timetable slots" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "AI Error", description: err.message || "Failed to execute AI timetable fill" });
    } finally {
      setAiFilling(false);
    }
  };

  const handleQuickToggleFreeTime = async (teacherId: string, dayOfWeek: number, period: number) => {
    try {
      const res = await quickToggleTeacherFreeTime({ teacherId, dayOfWeek, period });
      if (res.success) {
        toast({
          variant: "success",
          title: "Free Time Updated",
          description: res.message,
        });
        await fetchTimetableData(true);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to toggle free time" });
    }
  };

  const openEditSlotModal = (slot: any) => {
    setSlotFormData({
      id: slot.id,
      classId: slot.classId || "",
      className: slot.className || selectedClassName,
      teacherId: slot.teacherId || "",
      teacherName: slot.teacherName || "",
      dayOfWeek: slot.dayOfWeek,
      period: slot.period,
      subject: slot.subject || "",
      startTime: slot.startTime || "10:30",
      endTime: slot.endTime || "11:00",
      roomNumber: slot.roomNumber || `Room ${slot.className || selectedClassName}`,
      isBreak: Boolean(slot.isBreak),
      breakName: slot.breakName || "",
    });
    setIsEditingExistingSlot(true);
    setSlotModalOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!slotFormData.subject && !slotFormData.isBreak) {
      toast({ variant: "warning", title: "Subject Required", description: "Please enter a subject name or select Free Time / Receiving Period." });
      return;
    }
    setSavingSlot(true);
    try {
      const payload = {
        ...slotFormData,
        subject: slotFormData.isBreak ? "" : slotFormData.subject,
        breakName: slotFormData.isBreak ? (slotFormData.breakName || "Free Time / Receiving Period (استقبال وتفرغ)") : null,
      };
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        toast({ variant: "success", title: "Lesson Saved", description: `${slotFormData.subject || "Slot"} updated for Class ${slotFormData.className}.` });
        setSlotModalOpen(false);
        // Optimistically update slots in state
        setSlots((prev) => {
          const index = prev.findIndex((s) => s.id === json.data.id || (s.className === json.data.className && s.dayOfWeek === json.data.dayOfWeek && s.period === json.data.period));
          if (index >= 0) {
            const next = [...prev];
            next[index] = json.data;
            return next;
          }
          return [...prev, json.data];
        });
        await fetchTimetableData(false);
      } else {
        toast({ variant: "destructive", title: "Save Failed", description: json.error || "Failed to save slot." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to connect to server." });
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!window.confirm("Delete this lesson slot from the master timetable?")) return;
    setDeletingSlot(true);
    try {
      const res = await fetch(`/api/admin/timetable/${slotId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ variant: "success", title: "Deleted", description: "Lesson slot removed from timetable." });
        setSlotModalOpen(false);
        setSlots((prev) => prev.filter((s) => s.id !== slotId));
        await fetchTimetableData(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: json.error || "Failed to delete slot." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to connect to server." });
    } finally {
      setDeletingSlot(false);
    }
  };

  // ── BADAL ASSISTANT: FETCH FREE TEACHERS & ALLOCATE ──
  const fetchAvailableTeachersForSlot = async (dayOfWeek: number, period: number, dateStr: string) => {
    setLoadingAvailable(true);
    try {
      const res = await fetch(
        `/api/admin/timetable/badal/available-teachers?dayOfWeek=${dayOfWeek}&period=${period}&date=${encodeURIComponent(dateStr || "")}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableTeachers(data.data);
        if (data.data.length > 0) {
          const firstFree = data.data.find((t: any) => t.isFree) || data.data[0];
          setBadalForm((prev) => ({
            ...prev,
            badalTeacherId: firstFree.id,
            badalTeacherName: firstFree.name,
            badalTeacherAvatar: firstFree.avatarUrl || "",
          }));
        }
      } else {
        setAvailableTeachers([]);
      }
    } catch {
      setAvailableTeachers([]);
      toast({ variant: "destructive", title: "Error", description: "Failed to query available teachers." });
    } finally {
      setLoadingAvailable(false);
    }
  };

  const openBadalModalForSlot = async (slot: any, targetDate?: string) => {
    const chosenDate = targetDate || badalDate || new Date().toISOString().split("T")[0];
    setSelectedSlotForBadal(slot);
    setBadalForm({
      date: chosenDate,
      slotId: slot.id,
      classId: slot.classId || "",
      className: slot.className,
      period: slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      originalTeacherId: slot.teacherId || "",
      originalTeacherName: slot.teacherName || "",
      originalTeacherAvatar: slot.teacherAvatar || "",
      badalTeacherId: "",
      badalTeacherName: "",
      badalTeacherAvatar: "",
      reason: "Medical / Sick Leave",
      instructions: `Please teach ${slot.subject} sabaq for Class ${slot.className}.`,
      notes: "",
    });

    setShowBadalModal(true);
    fetchAvailableTeachersForSlot(slot.dayOfWeek, slot.period, chosenDate);
  };

  const handleSaveBadal = async () => {
    if (!badalForm.badalTeacherId) {
      toast({ variant: "warning", title: "Select Substitute", description: "Please choose a free substitute teacher." });
      return;
    }

    setSavingBadal(true);
    try {
      const res = await fetch("/api/admin/timetable/badal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badalForm),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: "Badal Assigned",
          description: `${badalForm.badalTeacherName} assigned for ${badalForm.subject} (Class ${badalForm.className}).`,
        });
        setShowBadalModal(false);
        fetchBadals();
        fetchTimetableData(false);
      } else {
        toast({ variant: "destructive", title: "Failed", description: data.error || "Could not assign badal." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to connect to server." });
    } finally {
      setSavingBadal(false);
    }
  };

  const handleToggleBadalFulfillment = async (badalId: string, currentVal: boolean) => {
    try {
      const res = await fetch(`/api/admin/timetable/badal/${badalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFulfilled: !currentVal,
          status: !currentVal ? "COMPLETED" : "ASSIGNED",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBadals((prev) =>
          prev.map((b) => (b.id === badalId ? { ...b, isFulfilled: !currentVal, status: !currentVal ? "COMPLETED" : "ASSIGNED" } : b))
        );
        toast({ variant: "success", title: "Status Updated", description: "Badal substitution marked as completed." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not update status." });
    }
  };

  const handleDeleteBadal = async (badalId: string) => {
    if (!confirm("Are you sure you want to remove this badal substitution?")) return;
    try {
      const res = await fetch(`/api/admin/timetable/badal/${badalId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setBadals((prev) => prev.filter((b) => b.id !== badalId));
        toast({ variant: "success", title: "Removed", description: "Badal assignment deleted." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete badal." });
    }
  };

  // Matrix mappings
  const classSlotsMap = useMemo(() => {
    const map = new Map<string, any>(); // `${dayOfWeek}_${period}` -> slot
    (Array.isArray(slots) ? slots : [])
      .filter((s) => s && s.className === selectedClassName)
      .forEach((s) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    return map;
  }, [slots, selectedClassName]);

  const teacherSlotsMap = useMemo(() => {
    const map = new Map<string, any>(); // `${dayOfWeek}_${period}` -> slot
    (Array.isArray(slots) ? slots : [])
      .filter((s) => s && s.teacherId === selectedTeacherId)
      .forEach((s) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    return map;
  }, [slots, selectedTeacherId]);

  // Today's active badals map: `${className}_${period}` -> badal
  const todayBadalsMap = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(todayBadals) ? todayBadals : []).forEach((b) => {
      map.set(`${b.className}_${b.period}`, b);
    });
    return map;
  }, [todayBadals]);

  const activeClassObj = useMemo(() => {
    return (Array.isArray(classes) ? classes : []).find((c) => c && c.name === selectedClassName) || null;
  }, [classes, selectedClassName]);

  const activeTeacherObj = useMemo(() => {
    return (Array.isArray(teachers) ? teachers : []).find((t) => t && t.id === selectedTeacherId) || null;
  }, [teachers, selectedTeacherId]);

  // TableMaster Subject Load Distribution & Stats for selected class
  const classSubjectStats = useMemo(() => {
    const classSlots = (Array.isArray(slots) ? slots : []).filter(
      (s) => s && s.className === selectedClassName && !s.isBreak && s.subject
    );
    const countMap: Record<string, number> = {};
    classSlots.forEach((s) => {
      const sub = s.subject.trim();
      countMap[sub] = (countMap[sub] || 0) + 1;
    });

    const total = classSlots.length || 1;
    return Object.entries(countMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
        theme: getSubjectTheme(name),
      }))
      .sort((a, b) => b.count - a.count);
  }, [slots, selectedClassName]);

  const toggleSpotlight = (subjectName: string) => {
    setSpotlightSubject((prev) => (prev?.toLowerCase() === subjectName.toLowerCase() ? null : subjectName));
  };

  // Filtered Talabat for Darajah Roster Modal
  const filteredTalabat = useMemo(() => {
    const list: any[] = activeClassObj?.talabat || [];
    const q = talabatSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.its?.toLowerCase().includes(q) ||
      (s.rollNumber && String(s.rollNumber).toLowerCase().includes(q))
    );
  }, [activeClassObj, talabatSearch]);

  // Live Teacher Clash Checker for Slot Creation / Editing
  const teacherClashWarning = useMemo(() => {
    if (!slotFormData.teacherId || !slotFormData.dayOfWeek || !slotFormData.period) return null;
    const clashingSlot = slots.find(
      (s) =>
        s.teacherId === slotFormData.teacherId &&
        s.dayOfWeek === slotFormData.dayOfWeek &&
        s.period === slotFormData.period &&
        s.id !== slotFormData.id &&
        s.className !== slotFormData.className
    );
    if (clashingSlot) {
      return `Warning: ${slotFormData.teacherName || "Selected Ustad"} is already scheduled to teach Class ${clashingSlot.className} in Period ${clashingSlot.period} (${clashingSlot.subject})!`;
    }
    return null;
  }, [slots, slotFormData]);

  const filteredTakhteet = useMemo(() => {
    const list = Array.isArray(takhteetList) ? takhteetList : [];
    const q = takhteetSearch.toLowerCase().trim();
    return list.filter((item) => {
      if (!item) return false;
      const cName = item.className || item.class?.name || "";
      if (takhteetClassFilter !== "ALL" && cName !== takhteetClassFilter && !cName.startsWith(takhteetClassFilter)) {
        return false;
      }
      if (!q) return true;
      const tName = item.teacherName || (item.teacher?.user ? `${item.teacher.user.firstName || ""} ${item.teacher.user.lastName || ""}` : "");
      return (
        item.subject?.toLowerCase().includes(q) ||
        tName.toLowerCase().includes(q) ||
        cName.toLowerCase().includes(q) ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    });
  }, [takhteetList, takhteetSearch, takhteetClassFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* People & Directory Hub Navigation */}
      <AdminHubTabs
        hubTitle="Academics & Operations"
        hubDescription="Manage timetables, Darajah classes, teacher allocations, badal substitutions, and curriculum takhteet."
        tabs={[
          { label: "Classes Directory", href: "/admin/classes", icon: BookOpen },
          { label: "Timetable & Badal Master", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
          { label: "Daily Tracking", href: "/admin/tracking", icon: ShieldCheck },
        ]}
      />

      {/* Hero Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #041a12 0%, #0a3d2c 50%, #03170e 100%)" }}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-400/40"
              style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}
            >
              <CalendarDays className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  Official Academic Timetable Master
                </span>
                <span className="text-xs text-emerald-200 font-mono">1448 H • Term I</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Darajah &amp; Faculty Timetable Hub
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-2xl">
                Multi-dimensional scheduling: Asatezah profile tracking, dynamic Darajah navigation, 1-click Badal (Proxy) assistant, and master slot creation.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 self-start lg:self-center flex-wrap">
            <Button
              onClick={() => setShowTabSettingsModal(true)}
              className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/50 text-xs font-black gap-1.5 shadow-md px-3.5 py-2 rounded-xl cursor-pointer"
              title="Configure which timetable tabs are displayed or hidden"
            >
              <Eye className="w-3.5 h-3.5 text-amber-300" />
              Hide / Display Tabs
            </Button>
            <Button
              onClick={() => setAiFillModalOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs gap-1.5 shadow-md px-3.5 py-2 rounded-xl cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              ✨ AI Smart-Fill Slots
            </Button>
            <Button
              onClick={() => openNewSlotModal(selectedClassName)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs gap-1.5 shadow-md px-3.5 py-2 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950" />
              New Lesson Slot
            </Button>
            <Button
              onClick={() => {
                setBadalForm({
                  date: badalDate,
                  slotId: "",
                  classId: classes[0]?.id || "",
                  className: selectedClassName,
                  period: 1,
                  startTime: "10:30",
                  endTime: "11:00",
                  subject: "Qasaid",
                  originalTeacherId: teachers[0]?.id || "",
                  originalTeacherName: teachers[0]?.name || "",
                  originalTeacherAvatar: teachers[0]?.avatarUrl || "",
                  badalTeacherId: teachers[1]?.id || "",
                  badalTeacherName: teachers[1]?.name || "",
                  badalTeacherAvatar: teachers[1]?.avatarUrl || "",
                  reason: "Medical / Sick Leave",
                  instructions: "Cover lesson and review homework.",
                  notes: "",
                });
                setShowBadalModal(true);
              }}
              className="bg-emerald-900/80 hover:bg-emerald-800 text-amber-300 border border-amber-400/30 font-bold text-xs gap-1.5 px-3 py-2 rounded-xl"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
              Assign Badal
            </Button>
            <Button
              onClick={() => fetchTimetableData(true)}
              disabled={loading || refreshing || syncingMaster}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold gap-2 backdrop-blur-sm px-3 py-2 rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={handleSyncMasterTimetable}
              disabled={loading || syncingMaster}
              className="bg-white/10 hover:bg-white/20 text-white border border-amber-400/40 text-xs font-black gap-1.5 px-3 py-2 rounded-xl"
            >
              <Sparkles className={`w-3.5 h-3.5 ${syncingMaster ? "animate-spin text-amber-300" : "text-amber-300"}`} />
              {syncingMaster ? "Syncing..." : "Sync Master"}
            </Button>
          </div>
        </div>

        {/* Live Metrics Counter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-emerald-800/60">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-white">{classes.length || 8} Classes</div>
              <div className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-semibold">Darajah 1A–4B</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-white">{slots.length} Slots</div>
              <div className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-semibold">Weekly Scheduled</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-400/20 text-teal-300 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-white">{teachers.length} Asatezah</div>
              <div className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-semibold">Teaching Faculty</div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-white">{todayBadals.length} Badals</div>
              <div className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-semibold">Active Substitutions</div>
            </div>
          </div>
        </div>

        {/* Primary View Switcher Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-emerald-800/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {visibleTabs.classes && (
            <button
              onClick={() => setActiveTab("classes")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === "classes"
                  ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>1. Darajah Schedule (1A–4B)</span>
            </button>
          )}

          {visibleTabs["master-overview"] && (
            <button
              onClick={() => setActiveTab("master-overview")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === "master-overview"
                  ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. All 8 Darajahs Master View</span>
            </button>
          )}

          {visibleTabs.teachers && (
            <button
              onClick={() => setActiveTab("teachers")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === "teachers"
                  ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>3. Asatezah Individual Timetables</span>
            </button>
          )}

          {visibleTabs.badal && (
            <button
              onClick={() => setActiveTab("badal")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === "badal"
                  ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>4. Badal Coverage Desk</span>
              {badals.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-950 text-amber-300 font-mono font-bold">
                  {badals.length}
                </span>
              )}
            </button>
          )}

          {visibleTabs.takhteet && (
            <button
              onClick={() => setActiveTab("takhteet")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === "takhteet"
                  ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>5. Takhteet Allocations ({takhteetList.length})</span>
            </button>
          )}

          {/* Hide / Display Tabs Config Button */}
          <button
            onClick={() => setShowTabSettingsModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 bg-white/10 hover:bg-white/20 text-amber-200 border border-dashed border-amber-400/40 cursor-pointer ml-auto"
            title="Configure which timetable tabs are displayed or hidden"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
            <span>Hide / Display Tabs</span>
            {Object.values(visibleTabs).filter((v) => !v).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                {Object.values(visibleTabs).filter((v) => !v).length} hidden
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Empty State Banner if no slots exist */}
      {slots.length === 0 && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-300/80 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#06241a] text-amber-300 flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Timetable Not Initialized in Cloud Database
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-xl">
                  The database currently has 0 timetable slots. Click below to generate all 8 Darajah classes (1A–4B), assign official Class Masools, and populate all 240 weekly slots for classes and Asatezah.
                </p>
              </div>
            </div>
            <Button
              onClick={handleSyncMasterTimetable}
              disabled={syncingMaster}
              className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 hover:text-white font-black text-xs sm:text-sm gap-2 shrink-0 px-5 py-3 rounded-2xl shadow-lg border border-amber-400/40"
            >
              <Sparkles className={`w-4 h-4 ${syncingMaster ? "animate-spin text-amber-400" : "text-amber-400"}`} />
              {syncingMaster ? "Generating 240 Slots..." : "Initialize Master Timetable (240 Slots)"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DARAJAH CLASS TIMETABLES (WITH DYNAMIC SCROLLING CAROUSEL)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "classes" && (
        <div className="space-y-6">
          {/* Dynamic Darajah Horizontal Scroll Selector Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Darajah Classes:
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Click a class to view its weekly timetable
                </span>
              </div>

              {/* Scroll Arrow Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => scrollDarajah("left")}
                  className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollDarajah("right")}
                  className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Pills Container */}
            <div
              ref={darajahScrollRef}
              className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
            >
              {classes.map((cls) => {
                const isSelected = selectedClassName === cls.name;
                const slotCount = cls.slotCount || 30;
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassName(cls.name)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-3 border ${
                      isSelected
                        ? "bg-[#06241a] text-amber-300 border-amber-400/50 shadow-md ring-2 ring-emerald-600/30"
                        : "bg-slate-50 hover:bg-emerald-50/60 text-slate-700 border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    {/* Masool micro-avatar */}
                    <Avatar className="w-7 h-7 ring-1 ring-amber-400/50 shrink-0">
                      {cls.masoolAvatar && <AvatarImage src={cls.masoolAvatar} alt={cls.masoolName} />}
                      <AvatarFallback className={`text-[10px] font-bold ${isSelected ? "bg-amber-400 text-slate-950" : "bg-emerald-900 text-amber-300"}`}>
                        {getInitials(cls.masoolName || cls.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="text-left">
                      <div className="font-extrabold text-xs">
                        Class {cls.name}
                      </div>
                      <div className={`text-[10px] ${isSelected ? "text-emerald-200" : "text-slate-400"}`}>
                        {cls.studentCount || 0} Talabat • {slotCount} Slots
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ml-1 ${
                        isSelected ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {cls.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Class Header Card with Masool Profile, Talabat Roster & Live Status */}
          {activeClassObj && (
            <div className="bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/70 p-4 sm:p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Masool Profile Picture & Info */}
                <div className="flex items-center gap-4">
                  {activeClassObj.masoolAvatar ? (
                    <div
                      onClick={() =>
                        setViewingMasoolPhoto({
                          name: activeClassObj.masoolName,
                          avatar: activeClassObj.masoolAvatar,
                          its: activeClassObj.masoolIts,
                          className: activeClassObj.name,
                        })
                      }
                      className="relative group cursor-pointer shrink-0"
                      title="Click to view full Masool profile photo"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ring-4 ring-amber-400/90 shadow-md overflow-hidden bg-slate-900 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                        <img
                          src={activeClassObj.masoolAvatar}
                          alt={activeClassObj.masoolName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                        <Eye className="w-3.5 h-3.5 text-amber-300" />
                        <span>View</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ring-3 ring-amber-400/50 bg-gradient-to-br from-[#06241a] to-[#0a3d2c] text-amber-300 flex items-center justify-center text-lg sm:text-xl font-black shrink-0 shadow-md">
                      {getInitials(activeClassObj.masoolName)}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#06241a] text-amber-300 px-2 py-0.5 rounded-md shadow-2xs">
                        Class Masool (مسؤول)
                      </span>
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        ITS: {activeClassObj.masoolIts || "—"}
                      </span>
                      {activeClassObj.masoolAvatar && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewingMasoolPhoto({
                              name: activeClassObj.masoolName,
                              avatar: activeClassObj.masoolAvatar,
                              its: activeClassObj.masoolIts,
                              className: activeClassObj.name,
                            })
                          }
                          className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-amber-600" /> View Photo
                        </button>
                      )}
                    </div>
                    <h3 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                      {activeClassObj.masoolName || "Not Assigned"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                      <span className="font-semibold text-emerald-800">Class {activeClassObj.name}</span>
                      <span>•</span>
                      <span className="text-slate-500">Room {activeClassObj.name}</span>
                    </div>
                  </div>
                </div>

                {/* Enrolled Talabat (Students) of this Specific Darajah */}
                <div className="flex items-center gap-3 pl-0 sm:pl-5 sm:border-l border-emerald-200/80">
                  <div className="flex -space-x-2 overflow-hidden shrink-0">
                    {(activeClassObj.talabat || []).slice(0, 4).map((student: any) => (
                      <Avatar key={student.id} className="inline-block w-8 h-8 ring-2 ring-white">
                        {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={student.name} />}
                        <AvatarFallback className="bg-emerald-800 text-amber-200 text-[9px] font-black">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>{(activeClassObj.talabat?.length || activeClassObj.studentCount || 0)} Talabat Enrolled</span>
                    </div>
                    <button
                      onClick={() => setTalabatModalOpen(true)}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1 cursor-pointer transition-colors mt-0.5"
                    >
                      <Users className="w-3 h-3 text-emerald-700" />
                      View Talabat Directory
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Live Dynamic Sync Indicator */}
              <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-[11px] font-black text-emerald-950 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Live Dynamic Sync</span>
                </div>
                <Button
                  onClick={() => setTalabatModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="bg-white/90 hover:bg-emerald-50 text-emerald-900 border-emerald-300 font-bold text-xs gap-1.5 rounded-xl shadow-2xs"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                  Talabat Directory ({(activeClassObj.talabat?.length || activeClassObj.studentCount || 0)})
                </Button>
                <Button
                  onClick={() => openNewSlotModal(activeClassObj.name)}
                  className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-black text-xs gap-1.5 shadow-sm px-3.5 py-2 rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Slot
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  size="sm"
                  className="text-xs font-bold gap-1 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl px-3 py-2"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" /> Print
                </Button>
              </div>
            </div>
          )}

          {/* TableMaster Subject Load Distribution & Spotlight Bar */}
          {classSubjectStats.length > 0 && (
            <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    TableMaster Subject Load ({classSubjectStats.length} Subjects):
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click any subject to spotlight across the weekly timetable
                  </span>
                </div>
                {spotlightSubject && (
                  <button
                    onClick={() => setSpotlightSubject(null)}
                    className="text-[10.5px] font-black text-amber-900 hover:text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-amber-300 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear Spotlight: {spotlightSubject}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {classSubjectStats.map((item) => {
                  const isSpotlighted = spotlightSubject?.toLowerCase() === item.name.toLowerCase();
                  return (
                    <button
                      key={item.name}
                      onClick={() => toggleSpotlight(item.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isSpotlighted
                          ? "ring-2 ring-amber-400 shadow-md scale-105 font-black " + item.theme.badge
                          : "hover:scale-[1.02] " + item.theme.bgLight + " " + item.theme.text + " " + item.theme.border
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.theme.dot}`} />
                      <span>{item.name}</span>
                      <span className="text-[10px] opacity-80 font-mono font-bold">
                        {item.count}p ({item.percentage}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timetable Weekly Matrix with Sticky Day Column & Horizontal Scrolling */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto relative">
              <table className="w-full border-collapse min-w-[960px]">
                <thead>
                  <tr className="bg-[#06241a] text-white">
                    <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-32 sticky left-0 z-20 bg-[#06241a]">
                      Day / Period
                    </th>
                    {PERIOD_DEFS.map((p) => (
                      <th key={p.period} className="p-3 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[130px]">
                        <div className="text-xs font-black text-amber-300">{p.label}</div>
                        <div className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.day} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      {/* Sticky Day Column */}
                      <td className="p-3.5 font-black text-xs text-slate-900 border-r border-slate-200/80 bg-slate-50/95 sticky left-0 z-10 shadow-2xs">
                        <div className="font-extrabold text-slate-900">{d.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 font-normal">Day {d.day}</div>
                      </td>

                      {/* Periods */}
                      {PERIOD_DEFS.map((p) => {
                        const slot = classSlotsMap.get(`${d.day}_${p.period}`);
                        const todayBadal = todayBadalsMap.get(`${selectedClassName}_${p.period}`);
                        const theme = slot ? getSubjectTheme(slot.subject) : null;
                        const isMatch = !spotlightSubject || (slot && slot.subject && slot.subject.toLowerCase() === spotlightSubject.toLowerCase());

                        return (
                          <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot ? (
                              slot.isBreak ? (
                                <div className="p-2.5 rounded-2xl bg-amber-50/80 border border-dashed border-amber-300 hover:shadow-md transition-all shadow-2xs group relative flex flex-col justify-between min-h-[114px]">
                                  <div>
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md leading-tight text-left bg-amber-200/90 text-amber-950 border border-amber-300">
                                        ☕ {slot.breakName || "Free / Receiving"}
                                      </span>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/90 p-0.5 rounded-md shadow-2xs">
                                        <button
                                          onClick={() => openEditSlotModal(slot)}
                                          className="p-1 rounded hover:bg-emerald-100 text-slate-600 hover:text-emerald-900 cursor-pointer"
                                          title="Edit slot details"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSlot(slot.id)}
                                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                                          title="Delete slot"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-[11px] font-bold text-amber-900 mt-2">
                                      {slot.teacherName ? `${slot.teacherName} (Receiving)` : "Free Period"}
                                    </div>
                                  </div>
                                  <div className="text-[9px] font-mono text-slate-500 pt-1 border-t border-amber-200/60">
                                    {slot.roomNumber || "Faculty Desk"}
                                  </div>
                                </div>
                              ) : theme ? (
                                <div
                                  style={{ borderLeftColor: theme.accent, borderLeftWidth: "4px" }}
                                  className={`p-2.5 rounded-2xl bg-gradient-to-br ${theme.bgGradient} border ${theme.border} hover:shadow-md transition-all shadow-2xs group relative flex flex-col justify-between min-h-[114px] ${
                                    !isMatch ? "opacity-30 grayscale-[40%] scale-98" : spotlightSubject ? "ring-2 ring-amber-400 shadow-md scale-[1.02]" : ""
                                  }`}
                                >
                                  <div>
                                    {/* Subject Badge */}
                                    <div className="flex items-start justify-between gap-1">
                                      <button
                                        onClick={() => toggleSpotlight(slot.subject)}
                                        title="Click to spotlight this subject"
                                        className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md leading-tight text-left cursor-pointer transition-transform hover:scale-105 ${theme.badge}`}
                                      >
                                        {slot.subject}
                                      </button>

                                      {/* Action buttons on hover */}
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/90 p-0.5 rounded-md shadow-2xs">
                                        <button
                                          onClick={() => openEditSlotModal(slot)}
                                          className="p-1 rounded hover:bg-emerald-100 text-slate-600 hover:text-emerald-900 cursor-pointer"
                                          title="Edit lesson details"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSlot(slot.id)}
                                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                                          title="Delete slot"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Asatezah Profile Picture & Name */}
                                    <div className="flex items-center gap-2 mt-2 pt-1">
                                      <Avatar className="w-6 h-6 ring-1 ring-emerald-600/40 shrink-0 shadow-2xs">
                                        {slot.teacherAvatar && <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />}
                                        <AvatarFallback className="bg-emerald-950 text-amber-300 text-[9px] font-black">
                                          {getInitials(slot.teacherName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <div
                                          className="text-[11px] text-slate-900 font-bold truncate leading-tight"
                                          title={slot.teacherName}
                                        >
                                          {slot.teacherName}
                                        </div>
                                        {slot.teacherIts && (
                                          <div className="text-[9px] font-mono text-slate-400">
                                            ITS: {slot.teacherIts}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Active Badal Alert Tag if substituted today */}
                                    {todayBadal && (
                                      <div className="mt-1.5 p-1 rounded-lg bg-amber-100/90 border border-amber-300 text-[9.5px] font-bold text-amber-950 flex items-center gap-1">
                                        <ArrowRightLeft className="w-3 h-3 text-amber-700 shrink-0" />
                                        <span className="truncate">Badal: {todayBadal.badalTeacherName}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Bottom bar: Room & "Get Help in Badal" Button */}
                                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/80">
                                    <span className="text-[9px] font-mono text-slate-500 font-medium">
                                      {slot.roomNumber || `Room ${slot.className}`}
                                    </span>
                                    <button
                                      onClick={() => openBadalModalForSlot(slot)}
                                      className="px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-black shrink-0 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                      title="Get Badal help or assign substitute for this lesson"
                                    >
                                      <ArrowRightLeft className="w-2.5 h-2.5" />
                                      <span>Badal Help</span>
                                    </button>
                                  </div>
                                </div>
                              ) : null
                            ) : (
                              <button
                                onClick={() => openNewSlotModal(selectedClassName, d.day, p.period)}
                                className="w-full h-24 rounded-2xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all flex flex-col items-center justify-center text-slate-300 hover:text-emerald-700 group cursor-pointer"
                                title="Click to schedule a new lesson slot"
                              >
                                <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                <span className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                  + Add Slot
                                </span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ALL 8 DARAJAH MASTER OVERVIEW (SCROLLABLE MULTI-DARAJAH MATRIX)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "master-overview" && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Synchronized All 8 Darajah Master Panorama</h3>
                <p className="text-xs text-slate-500">Horizontal scroll across all Darajah 1A–4B classes side-by-side.</p>
              </div>
            </div>

            {/* Select Day Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider shrink-0 mr-1">
                Day:
              </span>
              {DAYS.map((d) => (
                <button
                  key={d.day}
                  onClick={() => setOverviewDay(d.day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    overviewDay === d.day
                      ? "bg-[#06241a] text-amber-300 shadow-sm ring-1 ring-amber-400/40"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontally Scrollable 8-Class Master Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-[#06241a] text-white">
                    <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-28 sticky left-0 z-20 bg-[#06241a]">
                      Period
                    </th>
                    {classes.map((cls) => (
                      <th key={cls.id} className="p-3 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[140px]">
                        <div className="text-xs font-black text-amber-300">Class {cls.name}</div>
                        <div className="text-[10px] text-emerald-200 font-mono mt-0.5">Room {cls.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIOD_DEFS.map((p) => (
                    <tr key={p.period} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-black text-xs text-slate-900 border-r border-slate-200/80 bg-slate-50/95 sticky left-0 z-10">
                        <div className="text-amber-900 font-bold">{p.label}</div>
                        <div className="text-[10px] font-mono text-slate-500">{p.time}</div>
                      </td>

                      {classes.map((cls) => {
                        const slot = slots.find(
                          (s) => s.className === cls.name && s.dayOfWeek === overviewDay && s.period === p.period
                        );
                        const theme = slot ? getSubjectTheme(slot.subject) : null;
                        const isMatch = !spotlightSubject || (slot && slot.subject && slot.subject.toLowerCase() === spotlightSubject.toLowerCase());

                        return (
                          <td key={cls.id} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot && theme ? (
                              <div
                                style={{ borderLeftColor: theme.accent, borderLeftWidth: "3px" }}
                                className={`p-2.5 rounded-xl border transition-all shadow-2xs ${theme.bgLight} ${theme.border} hover:shadow-md ${
                                  !isMatch ? "opacity-30 grayscale-[40%]" : spotlightSubject ? "ring-2 ring-amber-400 shadow-md scale-[1.02]" : ""
                                }`}
                              >
                                <div className={`text-xs font-black truncate leading-tight ${theme.text}`}>
                                  {slot.subject}
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Avatar className="w-5 h-5 ring-1 ring-emerald-600/30 shrink-0">
                                    {slot.teacherAvatar && <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />}
                                    <AvatarFallback className="bg-emerald-950 text-amber-300 text-[8px] font-black">
                                      {getInitials(slot.teacherName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[10.5px] text-slate-700 font-bold truncate" title={slot.teacherName}>
                                    {slot.teacherName}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="h-14 flex items-center justify-center text-[10px] text-slate-300 font-mono">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: ASATEZAAH INDIVIDUAL TEACHER TIMETABLES
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "teachers" && (
        <div className="space-y-6">
          {/* Teacher Selector Bar & Search */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search faculty by name or ITS..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-medium"
                />
              </div>

              {activeTeacherObj && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200">
                    <Avatar
                      onClick={() =>
                        activeTeacherObj.avatarUrl && setViewingMasoolPhoto({
                          name: activeTeacherObj.name,
                          avatar: activeTeacherObj.avatarUrl,
                          its: activeTeacherObj.its,
                          className: "Faculty Member",
                        })
                      }
                      className={`w-11 h-11 ring-2 ring-emerald-700 shrink-0 shadow-sm ${activeTeacherObj.avatarUrl ? "cursor-pointer hover:scale-105 transition-transform" : ""}`}
                      title={activeTeacherObj.avatarUrl ? "Click to view full photo" : activeTeacherObj.name}
                    >
                      {activeTeacherObj.avatarUrl && <AvatarImage src={activeTeacherObj.avatarUrl} alt={activeTeacherObj.name} />}
                      <AvatarFallback className="bg-gradient-to-br from-[#06241a] to-[#0a3d2c] text-amber-300 font-bold text-xs">
                        {getInitials(activeTeacherObj.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{activeTeacherObj.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ITS: {activeTeacherObj.its || "—"} • {activeTeacherObj.weeklyPeriods} Lessons / Week • {Math.max(0, 54 - (activeTeacherObj.weeklyPeriods || 0))} Free Periods
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => openNewSlotModal("", 1, 1, activeTeacherObj.id)}
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold gap-1 rounded-xl shadow-xs cursor-pointer"
                    title="Schedule a new lesson for this teacher"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Lesson
                  </Button>

                  <Button
                    onClick={() => openNewSlotModal("", 1, 1, activeTeacherObj.id, true)}
                    size="sm"
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black gap-1 rounded-xl shadow-xs cursor-pointer"
                    title="Designate a free time / receiving period for this teacher"
                  >
                    ☕ Free Period
                  </Button>

                  <Button
                    onClick={() => window.print()}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold gap-1 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" /> Print
                  </Button>
                </div>
              )}
            </div>

            {/* Asatezah Horizontal Scroll Navigation Bar */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    All Faculty Members ({teachers.length})
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    Use arrows or scroll horizontally to browse
                  </span>
                </div>

                {/* Left & Right Scroll Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollFaculty("left")}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Scroll Faculty Left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollFaculty("right")}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Scroll Faculty Right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Faculty Chips Row */}
              <div
                ref={facultyScrollRef}
                className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scroll-smooth scrollbar-thin scrollbar-thumb-slate-300"
              >
                {teachers
                  .filter(
                    (t) =>
                      !teacherSearch ||
                      t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
                      (t.its && t.its.includes(teacherSearch))
                  )
                  .map((t) => {
                    const isSelected = selectedTeacherId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTeacherId(t.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-2 cursor-pointer shadow-2xs ${
                          isSelected
                            ? "bg-[#06241a] text-amber-300 ring-2 ring-emerald-600/40 shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 border border-transparent hover:border-emerald-200"
                        }`}
                      >
                        <Avatar className="w-5 h-5 ring-1 ring-amber-400/50 shrink-0">
                          {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                          <AvatarFallback className={`text-[9px] font-bold ${isSelected ? "bg-amber-400 text-slate-950" : "bg-emerald-900 text-amber-300"}`}>
                            {getInitials(t.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="whitespace-nowrap">{t.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected
                              ? "bg-amber-400 text-slate-950 font-bold"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {t.weeklyPeriods}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Teacher Timetable Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#06241a] text-white">
                    <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-28">
                      Day / Period
                    </th>
                    {PERIOD_DEFS.map((p) => (
                      <th key={p.period} className="p-2.5 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[110px]">
                        <div className="text-xs font-black text-amber-300">{p.label}</div>
                        <div className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.day} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-black text-xs text-slate-900 border-r border-slate-200/80 bg-slate-50/80">
                        {d.name}
                      </td>
                      {PERIOD_DEFS.map((p) => {
                        const slot = teacherSlotsMap.get(`${d.day}_${p.period}`);
                        const theme = slot && !slot.isBreak ? getSubjectTheme(slot.subject) : null;
                        return (
                          <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot ? (
                              slot.isBreak ? (
                                <div className="p-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50/80 hover:shadow-md transition-all shadow-2xs group relative">
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-200/90 text-amber-950 border border-amber-300">
                                      ☕ {slot.breakName || "Free / Receiving"}
                                    </span>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/90 p-0.5 rounded-md shadow-2xs">
                                      <button
                                        onClick={() => openEditSlotModal(slot)}
                                        className="p-1 rounded hover:bg-emerald-100 text-slate-600 hover:text-emerald-900 cursor-pointer"
                                        title="Edit slot"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSlot(slot.id)}
                                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                                        title="Delete slot"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-[10.5px] text-amber-900 font-bold mt-1">
                                    Receiving &amp; Free Time
                                  </div>
                                  <div className="text-[9px] font-mono text-slate-500 mt-1">
                                    {slot.roomNumber || "Faculty Desk"}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  style={{ borderLeftColor: theme?.accent || "#059669", borderLeftWidth: "3px" }}
                                  className={`p-2.5 rounded-xl border hover:shadow-md transition-all shadow-2xs group relative ${theme?.bgLight || "bg-emerald-50"} ${theme?.border || "border-emerald-200"}`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className={`text-xs font-black leading-tight ${theme?.text || "text-emerald-950"}`}>
                                      {slot.subject}
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/90 p-0.5 rounded-md shadow-2xs">
                                      <button
                                        onClick={() => openEditSlotModal(slot)}
                                        className="p-1 rounded hover:bg-emerald-100 text-slate-600 hover:text-emerald-900 cursor-pointer"
                                        title="Edit lesson details"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-700 font-bold mt-1">
                                    Class {slot.className}
                                  </div>
                                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60">
                                    <span className="text-[9px] font-mono text-slate-500 font-medium">Room {slot.className}</span>
                                    <button
                                      onClick={() => openBadalModalForSlot(slot)}
                                      className="px-1.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9px] font-black shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
                                      title="Assign substitute for this lesson"
                                    >
                                      <ArrowRightLeft className="w-2.5 h-2.5" />
                                      Badal
                                    </button>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="h-16 flex flex-col items-center justify-center p-1 rounded-xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group relative">
                                <span className="text-[10px] text-slate-300 font-medium group-hover:hidden">Free</span>
                                <div className="hidden group-hover:flex items-center gap-1">
                                  <button
                                    onClick={() => openNewSlotModal("", d.day, p.period, activeTeacherObj?.id)}
                                    className="px-1.5 py-1 rounded bg-emerald-600 text-white text-[9px] font-bold hover:bg-emerald-700 shadow-2xs cursor-pointer"
                                    title="Add lesson slot"
                                  >
                                    + Lesson
                                  </button>
                                  {activeTeacherObj && (
                                    <button
                                      onClick={() => handleQuickToggleFreeTime(activeTeacherObj.id, d.day, p.period)}
                                      className="px-1.5 py-1 rounded bg-amber-400 text-slate-950 text-[9px] font-black hover:bg-amber-300 shadow-2xs cursor-pointer"
                                      title="Mark as Free Time / Receiving Period"
                                    >
                                      ☕ Free
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: BADAL SUBSTITUTION & COVERAGE DESK
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "badal" && (
        <div className="space-y-6">
          {/* Desk Controls & Dynamic Filter Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-2xs">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Badal Substitution Tracking</h3>
                  <p className="text-xs text-slate-500">Live proxy coverage for teacher absences, official khidmat &amp; leaves.</p>
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={() => {
                  const initialDate = badalDateMode === "custom" ? badalDate : new Date().toISOString().split("T")[0];
                  setBadalForm({
                    date: initialDate,
                    slotId: "",
                    classId: classes[0]?.id || "",
                    className: "1 A",
                    period: 1,
                    startTime: "10:30",
                    endTime: "11:00",
                    subject: "Qasaid",
                    originalTeacherId: teachers[0]?.id || "",
                    originalTeacherName: teachers[0]?.name || "",
                    originalTeacherAvatar: teachers[0]?.avatarUrl || "",
                    badalTeacherId: teachers[1]?.id || "",
                    badalTeacherName: teachers[1]?.name || "",
                    badalTeacherAvatar: teachers[1]?.avatarUrl || "",
                    reason: "Medical / Sick Leave",
                    instructions: "Cover sabaq and check homework.",
                    notes: "",
                  });
                  setShowBadalModal(true);
                  if (teachers[0]) {
                    fetchAvailableTeachersForSlot(1, 1, initialDate);
                  }
                }}
                className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs gap-1.5 shadow-sm rounded-xl px-4 py-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Badal
              </Button>
            </div>

            {/* Date Quick Filter Pills + Custom Picker + Status Filter + Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {/* Date Mode Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider mr-1">
                  Timeline:
                </span>
                <button
                  type="button"
                  onClick={() => setBadalDateMode("today")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    badalDateMode === "today"
                      ? "bg-[#06241a] text-amber-300 ring-1 ring-amber-400/40 shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setBadalDateMode("tomorrow")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    badalDateMode === "tomorrow"
                      ? "bg-[#06241a] text-amber-300 ring-1 ring-amber-400/40 shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setBadalDateMode("week")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    badalDateMode === "week"
                      ? "bg-[#06241a] text-amber-300 ring-1 ring-amber-400/40 shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setBadalDateMode("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    badalDateMode === "all"
                      ? "bg-[#06241a] text-amber-300 ring-1 ring-amber-400/40 shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Records
                </button>

                {/* Custom Date Input */}
                <div className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-xl transition-all ${
                  badalDateMode === "custom"
                    ? "bg-amber-50/80 border-amber-400 text-slate-900"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={badalDate}
                    onChange={(e) => {
                      setBadalDate(e.target.value);
                      setBadalDateMode("custom");
                    }}
                    className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Status & Search */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Status Filter */}
                <select
                  value={badalStatusFilter}
                  onChange={(e) => setBadalStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending (Assigned)</option>
                  <option value="FULFILLED">Fulfilled (Completed)</option>
                </select>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search teacher, class, subject..."
                    value={badalSearch}
                    onChange={(e) => setBadalSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600 w-48 sm:w-60"
                  />
                </div>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={() => fetchBadals()}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 shadow-2xs transition-all cursor-pointer"
                  title="Refresh Badal list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${badalLoading ? "animate-spin text-amber-600" : ""}`} />
                </button>
              </div>
            </div>

            {/* Quick Summary Pill Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600 flex-wrap">
              <span className="font-bold text-slate-800">
                Found {badals.length} substitution record{badals.length === 1 ? "" : "s"}
              </span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">
                {badals.filter((b) => b.isFulfilled).length} Completed
              </span>
              <span>•</span>
              <span className="text-amber-700 font-bold">
                {badals.filter((b) => !b.isFulfilled).length} Pending
              </span>
            </div>
          </div>

          {/* Badal Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            {badalLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Loading substitutions...</p>
              </div>
            ) : (!Array.isArray(badals) || badals.length === 0) ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-900">No Substitutions Found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {badalSearch ? `No Badal records matching "${badalSearch}".` : "No teacher substitutions recorded for this timeline. All scheduled faculty are present."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                      <th className="p-4">Period / Time</th>
                      <th className="p-4">Class &amp; Subject</th>
                      <th className="p-4">Original Teacher (Absent)</th>
                      <th className="p-4">Badal Teacher (Substitute)</th>
                      <th className="p-4">Reason &amp; Instructions</th>
                      <th className="p-4">Fulfillment Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(Array.isArray(badals) ? badals : []).map((b) => {
                      const bTheme = getSubjectTheme(b.subject);
                      return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4">
                          <div className="font-black text-slate-900">Period {b.period}</div>
                          <div className="text-[10.5px] font-mono text-slate-500">{b.startTime} – {b.endTime}</div>
                        </td>
                        <td className="p-4">
                          <span className="font-black text-slate-900">Class {b.className}</span>
                          <div className="mt-1">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold ${bTheme.badge}`}>
                              {b.subject}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 ring-1 ring-slate-200 shrink-0">
                              {b.originalTeacherAvatar && <AvatarImage src={b.originalTeacherAvatar} alt={b.originalTeacherName} />}
                              <AvatarFallback className="bg-rose-950 text-rose-200 text-[10px] font-bold">
                                {getInitials(b.originalTeacherName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-rose-900">{b.originalTeacherName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 ring-1 ring-emerald-600 shrink-0">
                              {b.badalTeacherAvatar && <AvatarImage src={b.badalTeacherAvatar} alt={b.badalTeacherName} />}
                              <AvatarFallback className="bg-emerald-950 text-amber-300 text-[10px] font-bold">
                                {getInitials(b.badalTeacherName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-emerald-950">{b.badalTeacherName}</span>
                          </div>
                        </td>
                        <td className="p-4 max-w-xs">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {b.reason}
                          </span>
                          {b.instructions && (
                            <p className="text-[11px] text-slate-600 mt-1 italic truncate" title={b.instructions}>
                              &ldquo;{b.instructions}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleBadalFulfillment(b.id, b.isFulfilled)}
                            className={`px-3 py-1 rounded-full text-[11px] font-black transition-all flex items-center gap-1.5 ${
                              b.isFulfilled
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            }`}
                          >
                            {b.isFulfilled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                            <span>{b.isFulfilled ? "Fulfilled" : "Assigned (Pending)"}</span>
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBadal(b.id)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-1.5 h-auto rounded-lg"
                            title="Remove Badal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: ASATEZAAH TAKHTEET ALLOCATIONS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "takhteet" && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Official Takhteet Syllabus Lessons</h3>
                <p className="text-xs text-slate-500">118 official syllabus allocations synced from lessons export CSV.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subject or teacher..."
                  value={takhteetSearch}
                  onChange={(e) => setTakhteetSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <select
                value={takhteetClassFilter}
                onChange={(e) => setTakhteetClassFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="ALL">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    Class {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                    <th className="p-4">#</th>
                    <th className="p-4">Class</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Assigned Teacher</th>
                    <th className="p-4">Portion / Description</th>
                    <th className="p-4">Target Month</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTakhteet.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-4 font-black text-slate-900">Class {item.className || item.class?.name}</td>
                      <td className="p-4 font-bold text-emerald-800">{item.subject}</td>
                      <td className="p-4 font-semibold text-slate-800">
                        {item.teacherName || (item.teacher?.user ? `${item.teacher.user.firstName || ""} ${item.teacher.user.lastName || ""}`.trim() : "TBA")}
                      </td>
                      <td className="p-4 max-w-sm text-slate-600 text-[11.5px] truncate" title={item.description || item.title}>
                        {item.description || item.title}
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        {item.month ? `Month ${item.month} (Jumādā al-Ūlā)` : "—"}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          Active Planning
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          BADAL ASSISTANT MODAL (INTELLIGENT FREE TEACHER FINDER)
         ───────────────────────────────────────────────────────────── */}
      {showBadalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Get Help in Badal (Proxy Teacher)</h3>
                  <p className="text-[11px] text-slate-500">Conflict-free substitute teacher matching engine.</p>
                </div>
              </div>
              <button onClick={() => setShowBadalModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Slot Target Context */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Class &amp; Subject</span>
                  <div className="font-black text-slate-900 mt-0.5">
                    Class {badalForm.className} • {badalForm.subject || "Lesson"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Period &amp; Time</span>
                  <div className="font-black text-slate-900 mt-0.5">
                    Period {badalForm.period} ({badalForm.startTime}–{badalForm.endTime})
                  </div>
                </div>
              </div>

              {/* Substitution Date Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Substitution Date
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-600">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={badalForm.date}
                    onChange={(e) => {
                      const newD = e.target.value;
                      setBadalForm((prev) => ({ ...prev, date: newD }));
                      if (selectedSlotForBadal) {
                        const dt = new Date(newD);
                        const dayIdx = dt.getDay() === 0 ? 1 : dt.getDay();
                        fetchAvailableTeachersForSlot(dayIdx, badalForm.period, newD);
                      }
                    }}
                    className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Original Teacher with Conditional Avatar */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  1. Scheduled Teacher (Absent / Needs Coverage)
                </label>
                <div className="flex items-center gap-2.5 p-2 bg-slate-100 rounded-xl border border-slate-200">
                  {badalForm.originalTeacherAvatar ? (
                    <Avatar className="w-7 h-7 ring-1 ring-slate-400 shrink-0">
                      <AvatarImage src={badalForm.originalTeacherAvatar} alt={badalForm.originalTeacherName} />
                    </Avatar>
                  ) : null}
                  <div className="font-bold text-slate-800 text-xs">
                    {badalForm.originalTeacherName || "Scheduled Ustad"}
                  </div>
                </div>
              </div>

              {/* Free Available Teachers Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  2. Choose Substitute Teacher (Free Teachers Prioritized)
                </label>
                {loadingAvailable ? (
                  <div className="p-3 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600 mx-auto" />
                    <span className="text-[10px] text-slate-500 mt-1 block">Calculating faculty availability matrix...</span>
                  </div>
                ) : availableTeachers.length === 0 ? (
                  <div className="p-3 text-center bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs">
                    No faculty found. Please verify teacher rosters or assign manually.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {availableTeachers.map((t) => {
                      const isChosen = badalForm.badalTeacherId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() =>
                            setBadalForm((prev) => ({
                              ...prev,
                              badalTeacherId: t.id,
                              badalTeacherName: t.name,
                              badalTeacherAvatar: t.avatarUrl || "",
                            }))
                          }
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isChosen
                              ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/30"
                              : "bg-white hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {t.avatarUrl ? (
                              <Avatar className="w-7 h-7 ring-1 ring-emerald-600 shrink-0">
                                <AvatarImage src={t.avatarUrl} alt={t.name} />
                              </Avatar>
                            ) : null}
                            <div>
                              <div className="font-extrabold text-slate-900 text-xs">{t.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {t.isFree ? (
                                  <span className="text-emerald-700 font-bold">Free in Period {badalForm.period}</span>
                                ) : (
                                  <span className="text-amber-700 font-bold">Has Class in Period {badalForm.period}</span>
                                )}{" "}
                                • {t.badalCount || 0} Badals taken
                              </div>
                            </div>
                          </div>
                          {isChosen && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Reason for Badal</label>
                <select
                  value={badalForm.reason}
                  onChange={(e) => setBadalForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none"
                >
                  <option value="Medical / Sick Leave">Medical / Sick Leave</option>
                  <option value="Official Institutional Khidmat">Official Institutional Khidmat</option>
                  <option value="Approved Personal Leave">Approved Personal Leave</option>
                  <option value="Late / Traffic Delay">Late / Traffic Delay</option>
                  <option value="Other">Other Duty</option>
                </select>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Sabaq &amp; Homework Instructions for Substitute
                </label>
                <textarea
                  rows={2}
                  value={badalForm.instructions}
                  onChange={(e) => setBadalForm((prev) => ({ ...prev, instructions: e.target.value }))}
                  placeholder="Instructions for the substitute teacher during this session..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={() => setShowBadalModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBadal}
                disabled={savingBadal || !badalForm.badalTeacherId}
                className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs gap-1.5"
              >
                {savingBadal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm Badal Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          NEW TIMETABLE CREATING / EDITING FORM FROM MASTER
         ───────────────────────────────────────────────────────────── */}
      <Modal open={slotModalOpen} onOpenChange={setSlotModalOpen}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#06241a] text-amber-300 flex items-center justify-center text-xs font-black">
                {isEditingExistingSlot ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <span>{isEditingExistingSlot ? "Edit Timetable Lesson Slot" : "Create New Master Timetable Slot"}</span>
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Live Clash Warning Banner */}
            {teacherClashWarning && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs font-bold leading-tight">{teacherClashWarning}</div>
              </div>
            )}

            {/* Darajah Class Selector Buttons */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">1. Darajah Class</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {classes.map((c) => {
                  const isSelected = slotFormData.className === c.name;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() =>
                        setSlotFormData({
                          ...slotFormData,
                          className: c.name,
                          classId: c.id,
                          roomNumber: `Room ${c.name}`,
                        })
                      }
                      className={`py-1.5 px-2 rounded-xl font-black text-xs transition-all border ${
                        isSelected
                          ? "bg-[#06241a] text-amber-300 border-amber-400 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day and Period Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">2. Day of Week</label>
                <select
                  value={slotFormData.dayOfWeek}
                  onChange={(e) => setSlotFormData({ ...slotFormData, dayOfWeek: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                >
                  {DAYS.map((d) => (
                    <option key={d.day} value={d.day}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">3. Period &amp; Time Slot</label>
                <select
                  value={slotFormData.period}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    const def = PERIOD_DEFS.find((item) => item.period === p);
                    const times = def ? def.time.split(" – ") : ["10:30", "11:00"];
                    setSlotFormData({
                      ...slotFormData,
                      period: p,
                      startTime: times[0]?.trim() || slotFormData.startTime,
                      endTime: times[1]?.trim() || slotFormData.endTime,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                >
                  {PERIOD_DEFS.map((p) => (
                    <option key={p.period} value={p.period}>{p.label} ({p.time})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Slot Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSlotFormData({ ...slotFormData, isBreak: false, breakName: "" })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  !slotFormData.isBreak
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Academic Subject Lesson</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setSlotFormData({
                    ...slotFormData,
                    isBreak: true,
                    breakName: "Free Time / Receiving Period (استقبال وتفرغ)",
                    subject: "",
                  })
                }
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  slotFormData.isBreak
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>☕ Free Time / Receiving Period</span>
              </button>
            </div>

            {/* Conditional form fields based on Slot Mode */}
            {slotFormData.isBreak ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Free Time &amp; Receiving Period (استقبال وتفرغ) Active</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                  No academic subject is assigned to this period. This slot is designated for teacher student/parent reception, lesson planning, and recess.
                </p>
                <div>
                  <label className="text-[11px] font-bold text-amber-950 block mb-1">
                    Designation Label
                  </label>
                  <input
                    type="text"
                    value={slotFormData.breakName}
                    onChange={(e) => setSlotFormData({ ...slotFormData, breakName: e.target.value })}
                    placeholder="Free Time / Receiving Period (استقبال وتفرغ)"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">4. Lesson Subject</label>
                <input
                  type="text"
                  value={slotFormData.subject}
                  onChange={(e) => setSlotFormData({ ...slotFormData, subject: e.target.value })}
                  placeholder="e.g. Quran Hifz, Lisan ud Dawat, Sharhal akhbar, Maths"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                />

                {/* Quick Select Subject Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none mt-2">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">Quick Subjects:</span>
                  {POPULAR_SUBJECTS.slice(0, 8).map((sub) => (
                    <button
                      type="button"
                      key={sub}
                      onClick={() => setSlotFormData({ ...slotFormData, subject: sub })}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-[10px] font-bold text-slate-700 shrink-0 border border-slate-200 hover:border-emerald-300 cursor-pointer"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ModalFooter className="flex items-center justify-between">
            {isEditingExistingSlot ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteSlot(slotFormData.id)}
                disabled={deletingSlot || savingSlot}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold gap-1"
              >
                {deletingSlot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Slot
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <ModalClose asChild>
                <Button variant="outline" size="sm" className="text-xs border-slate-300">
                  Cancel
                </Button>
              </ModalClose>
              <Button
                size="sm"
                onClick={handleSaveSlot}
                disabled={savingSlot}
                className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs gap-1.5"
              >
                {savingSlot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isEditingExistingSlot ? "Save Changes" : "Save & Add Slot"}
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          AI TIMETABLE AUTO-FILL MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal open={aiFillModalOpen} onOpenChange={setAiFillModalOpen}>
        <ModalContent className="max-w-lg rounded-3xl p-6 bg-white border border-slate-200 shadow-2xl">
          <ModalHeader className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-xs">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <ModalTitle className="text-lg font-black text-slate-900">
                  AI Timetable Smart-Fill Assistant
                </ModalTitle>
                <p className="text-xs text-slate-500 font-medium">
                  Auto-distribute curriculum subjects, prevent teacher clashes, and protect free time.
                </p>
              </div>
            </div>
          </ModalHeader>

          <div className="space-y-4 py-3">
            {/* Scope Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                1. Target Classes Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiFillScope("ALL")}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    aiFillScope === "ALL"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-xs font-black">All Darajah Classes</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">Classes 1A to 4B (8 Classes)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setAiFillScope("SELECTED")}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    aiFillScope === "SELECTED"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-xs font-black">Selected Class Only</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">Class {selectedClassName}</div>
                </button>
              </div>
            </div>

            {/* Preserve Existing Lessons Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiPreserveExisting}
                  onChange={(e) => setAiPreserveExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Fill Empty Slots Only (Preserve Existing Lessons)</span>
              </label>
              <p className="text-[11px] text-slate-500 pl-6.5">
                Preserves all current subject assignments. Only unassigned periods will be populated by AI.
              </p>
            </div>

            {/* Strict Free Time Protection Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Strict Free Time &amp; Receiving Period Protection</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                On free time, AI will NOT assign any subject. Designated teacher receiving periods and breaks remain completely protected.
              </p>
            </div>
          </div>

          <ModalFooter className="flex items-center justify-between">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="text-xs border-slate-300 cursor-pointer">
                Cancel
              </Button>
            </ModalClose>
            <Button
              onClick={handleRunAiFill}
              disabled={aiFilling}
              className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs gap-1.5 px-4 py-2 rounded-xl shadow-md cursor-pointer"
            >
              {aiFilling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Analyzing &amp; Scheduling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Execute AI Auto-Fill</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          TALABAT ROSTER MODAL (DARAJAH ENROLLED STUDENTS)
         ───────────────────────────────────────────────────────────── */}
      <Modal open={talabatModalOpen} onOpenChange={setTalabatModalOpen}>
        <ModalContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#06241a] text-amber-300 flex items-center justify-center text-sm font-black shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-extrabold text-slate-900">
                  Enrolled Talabat — Class {activeClassObj?.name}
                </div>
                <div className="text-xs text-slate-500 font-normal">
                  {filteredTalabat.length} of {activeClassObj?.talabat?.length || activeClassObj?.studentCount || 0} Talabat enrolled in Darajah {activeClassObj?.grade || ""}{activeClassObj?.section || ""}
                </div>
              </div>
            </ModalTitle>
          </ModalHeader>

          {/* Search Bar inside Modal */}
          <div className="px-6 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search students by name, ITS, or roll number..."
                value={talabatSearch}
                onChange={(e) => setTalabatSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-medium"
              />
            </div>
          </div>

          {/* Student List Grid */}
          <div className="p-6 overflow-y-auto max-h-[50vh] divide-y divide-slate-100">
            {filteredTalabat.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No students match your search in Class {activeClassObj?.name}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredTalabat.map((s: any, idx: number) => (
                  <div
                    key={s.id || idx}
                    className="p-3 rounded-2xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center gap-3"
                  >
                    <Avatar className="w-10 h-10 ring-1 ring-emerald-600/30 shrink-0">
                      {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt={s.name} />}
                      <AvatarFallback className="bg-[#06241a] text-amber-300 text-xs font-bold">
                        {getInitials(s.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-900 truncate" title={s.name}>
                        {s.name}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.rollNumber && <span className="font-bold text-emerald-800">Roll #{s.rollNumber}</span>}
                        {s.rollNumber && <span>•</span>}
                        <span>ITS: {s.its || "—"}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ModalFooter className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Class {activeClassObj?.name} • Room {activeClassObj?.name}
            </span>
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="text-xs">
                Close
              </Button>
            </ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* ─────────────────────────────────────────────────────────────
          MODAL: TIMETABLE TAB HIDE / DISPLAY MANAGEMENT
         ───────────────────────────────────────────────────────────── */}
      <Modal open={showTabSettingsModal} onOpenChange={setShowTabSettingsModal}>
        <ModalContent className="max-w-2xl p-0 overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-2xl">
          <div className="relative bg-[#06241a] p-5 sm:p-6 text-white border-b border-emerald-800/80">
            <button
              type="button"
              onClick={() => setShowTabSettingsModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                Administrative Controls
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white mt-1.5 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-amber-400" />
              Timetable Hide / Display Tab Functions
            </h3>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-xl">
              Control which timetable tabs are visible in the Admin Hub, and toggle timetable module access live across the Talabat (Student) and Teacher (Faculty) portals.
            </p>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Section 1: Admin Hub Timetable Tabs Visibility */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    Admin Timetable Sub-Tabs (Show / Hide)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Customize your timetable working view. Toggle tabs on or off according to your workflow.
                  </p>
                </div>
                <Button
                  onClick={showAllTabs}
                  variant="ghost"
                  size="sm"
                  className="text-xs font-bold text-emerald-800 hover:bg-emerald-50 h-8"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Show All Tabs
                </Button>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    key: "classes" as const,
                    num: "1",
                    label: "Darajah Schedule (1A–4B)",
                    desc: "Interactive schedule grid per darajah, subject color tags & period slots",
                    icon: BookOpen,
                  },
                  {
                    key: "master-overview" as const,
                    num: "2",
                    label: "All 8 Darajahs Master View",
                    desc: "Unified day-by-day cross-darajah master grid (all classes simultaneously)",
                    icon: Layers,
                  },
                  {
                    key: "teachers" as const,
                    num: "3",
                    label: "Asatezah Individual Timetables",
                    desc: "Faculty-centric schedules, teaching hours breakdown & free-period finder",
                    icon: Users,
                  },
                  {
                    key: "badal" as const,
                    num: "4",
                    label: "Badal Coverage Desk",
                    desc: "Proxy/substitution management, emergency leaves & cover assignments",
                    icon: ArrowRightLeft,
                  },
                  {
                    key: "takhteet" as const,
                    num: "5",
                    label: "Takhteet Allocations",
                    desc: "Curriculum portion pacing, textbook milestones & lesson plans",
                    icon: ClipboardList,
                  },
                ].map((tab) => {
                  const isVisible = visibleTabs[tab.key] !== false;
                  const Icon = tab.icon;
                  return (
                    <div
                      key={tab.key}
                      onClick={() => toggleTabVisibility(tab.key)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                        isVisible
                          ? "bg-white border-emerald-200/90 shadow-2xs hover:border-emerald-400"
                          : "bg-slate-50/80 border-slate-200 opacity-60 hover:opacity-90"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            isVisible ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{tab.label}</span>
                            <span className="text-[10px] font-mono text-slate-400">Tab {tab.num}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{tab.desc}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTabVisibility(tab.key);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isVisible
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                            : "bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300"
                        }`}
                      >
                        {isVisible ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Displayed</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Student & Teacher Portal Timetable Tab Visibility (Live System Locks) */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="pb-2 border-b border-slate-200">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Portal Navigation Timetable Tab (Student &amp; Faculty Access)
                </h4>
                <p className="text-xs text-slate-500">
                  Control whether the Timetable tab is displayed or hidden in the navigation menus for Students and Teachers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Talabat Portal Timetable Toggle */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      Talabat (Student) Portal
                    </span>
                    {modules?.talabat?.timetable !== false ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Visible
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Controls /talabat/timetable tab in student sidebar.
                  </p>
                  <Button
                    onClick={() => handleTogglePortalTimetable("talabat")}
                    disabled={togglingPortalRole === "talabat"}
                    size="sm"
                    className={`w-full text-xs font-bold rounded-xl gap-1.5 cursor-pointer ${
                      modules?.talabat?.timetable !== false
                        ? "bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                    }`}
                  >
                    {togglingPortalRole === "talabat" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : modules?.talabat?.timetable !== false ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide for Students</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Display for Students</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Teacher Portal Timetable Toggle */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-teal-700" />
                      Teacher (Faculty) Portal
                    </span>
                    {modules?.teacher?.timetable !== false ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Visible
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Controls /teacher/timetable tab in faculty sidebar.
                  </p>
                  <Button
                    onClick={() => handleTogglePortalTimetable("teacher")}
                    disabled={togglingPortalRole === "teacher"}
                    size="sm"
                    className={`w-full text-xs font-bold rounded-xl gap-1.5 cursor-pointer ${
                      modules?.teacher?.timetable !== false
                        ? "bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                    }`}
                  >
                    {togglingPortalRole === "teacher" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : modules?.teacher?.timetable !== false ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide for Teachers</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Display for Teachers</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Preferences are saved automatically in your browser and system database.
            </span>
            <Button
              onClick={() => setShowTabSettingsModal(false)}
              className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 text-xs font-bold rounded-xl px-5 cursor-pointer"
            >
              Done
            </Button>
          </div>
        </ModalContent>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          LIGHTBOX MODAL FOR MASOOL & FACULTY PROFILE PHOTO
         ───────────────────────────────────────────────────────────── */}
      <Modal open={!!viewingMasoolPhoto} onOpenChange={(open) => !open && setViewingMasoolPhoto(null)}>
        <ModalContent className="max-w-md p-0 overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-2xl">
          {viewingMasoolPhoto && (
            <div>
              <div className="relative bg-[#06241a] p-4 text-center">
                <button
                  type="button"
                  onClick={() => setViewingMasoolPhoto(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  {viewingMasoolPhoto.className ? `Class ${viewingMasoolPhoto.className} Masool` : "Faculty Profile"}
                </span>
                <h3 className="text-base font-extrabold text-white mt-1.5">{viewingMasoolPhoto.name}</h3>
                {viewingMasoolPhoto.its && (
                  <p className="text-xs font-mono text-emerald-200 mt-0.5">ITS: {viewingMasoolPhoto.its}</p>
                )}
              </div>

              <div className="p-6 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden ring-4 ring-amber-400 shadow-xl bg-slate-900">
                  <img
                    src={viewingMasoolPhoto.avatar}
                    alt={viewingMasoolPhoto.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-500 font-medium">Official Profile Photograph</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <Button
                  onClick={() => setViewingMasoolPhoto(null)}
                  size="sm"
                  className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 text-xs font-bold rounded-xl px-4 cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
