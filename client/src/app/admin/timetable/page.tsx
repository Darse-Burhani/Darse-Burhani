"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  Trash2,
  Loader2,
  CalendarDays,
  ClipboardList,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Users,
  Award,
  GraduationCap,
  Filter,
  Check,
  X,
  FileSpreadsheet,
  Pencil,
  Printer,
  HelpCircle,
  AlertTriangle,
  Info,
  Calendar as CalendarIcon,
  Layers,
  Sparkle,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Subject color badges
function getSubjectBadgeStyle(subject: string) {
  const s = (subject || "").toLowerCase();
  if (s.includes("quran") || s.includes("hifz")) return "bg-emerald-100 text-emerald-950 border-emerald-300";
  if (s.includes("qasaid") || s.includes("daim")) return "bg-amber-100 text-amber-950 border-amber-300";
  if (s.includes("math") || s.includes("phys")) return "bg-blue-100 text-blue-950 border-blue-300";
  if (s.includes("science") || s.includes("bio") || s.includes("chem")) return "bg-teal-100 text-teal-950 border-teal-300";
  if (s.includes("lisan") || s.includes("arabi") || s.includes("insha")) return "bg-purple-100 text-purple-950 border-purple-300";
  if (s.includes("geography") || s.includes("hist")) return "bg-orange-100 text-orange-950 border-orange-300";
  return "bg-slate-100 text-slate-900 border-slate-300";
}

export default function AdminTimetableMasterPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("classes");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingMaster, setSyncingMaster] = useState(false);

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

  // Ref for horizontal darajah scroll
  const darajahScrollRef = useRef<HTMLDivElement>(null);

  // Badal Management State
  const [badalDate, setBadalDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
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

  // Load Badal records for the selected date
  const fetchBadals = useCallback(async () => {
    setBadalLoading(true);
    try {
      const res = await fetch(`/api/admin/timetable/badal?date=${encodeURIComponent(badalDate || "")}`);
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
  }, [badalDate]);

  useEffect(() => {
    fetchTimetableData();
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

  // ── SLOT CRUD ACTIONS (ADD / EDIT / DELETE) ──
  const openNewSlotModal = (presetClass?: string, presetDay?: number, presetPeriod?: number) => {
    const targetClass = presetClass || selectedClassName;
    const targetDay = presetDay !== undefined ? presetDay : 1;
    const targetPeriod = presetPeriod !== undefined ? presetPeriod : 1;

    const pDef = PERIOD_DEFS.find((p) => p.period === targetPeriod);
    const times = pDef ? pDef.time.split(" – ") : ["10:30", "11:00"];
    const activeCls = classes.find((c) => c.name === targetClass);

    setSlotFormData({
      id: "",
      classId: activeCls?.id || "",
      className: targetClass,
      teacherId: teachers[0]?.id || "",
      teacherName: teachers[0]?.name || "",
      dayOfWeek: targetDay,
      period: targetPeriod,
      subject: "",
      startTime: times[0] ? times[0].trim() : "10:30",
      endTime: times[1] ? times[1].trim() : "11:00",
      roomNumber: `Room ${targetClass}`,
      isBreak: false,
      breakName: "",
    });
    setIsEditingExistingSlot(false);
    setSlotModalOpen(true);
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
      toast({ variant: "warning", title: "Subject Required", description: "Please enter a subject name or mark as Break." });
      return;
    }
    setSavingSlot(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slotFormData),
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
  const openBadalModalForSlot = async (slot: any) => {
    setSelectedSlotForBadal(slot);
    setBadalForm({
      date: badalDate,
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
    setLoadingAvailable(true);
    try {
      const res = await fetch(
        `/api/admin/timetable/badal/available-teachers?dayOfWeek=${slot.dayOfWeek}&period=${slot.period}&date=${encodeURIComponent(badalDate || "")}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableTeachers(data.data);
        if (data.data.length > 0) {
          // Pre-select top recommended free teacher
          setBadalForm((prev) => ({
            ...prev,
            badalTeacherId: data.data[0].id,
            badalTeacherName: data.data[0].name,
            badalTeacherAvatar: data.data[0].avatarUrl || "",
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
          { label: "Daily Monitoring", href: "/admin/monitoring", icon: ShieldCheck },
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
              onClick={() => openNewSlotModal(selectedClassName)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs gap-1.5 shadow-md px-3.5 py-2 rounded-xl"
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

          {/* Active Class Header Card with Masool Profile & Quick Actions */}
          {activeClassObj && (
            <div className="bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/60 p-4 sm:p-5 rounded-3xl border border-emerald-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Masool Profile Picture & Info */}
                <Avatar className="w-13 h-13 ring-2 ring-amber-400 shadow-md shrink-0">
                  {activeClassObj.masoolAvatar && <AvatarImage src={activeClassObj.masoolAvatar} alt={activeClassObj.masoolName} />}
                  <AvatarFallback className="bg-[#06241a] text-amber-300 text-sm font-black border border-amber-400/30">
                    {getInitials(activeClassObj.masoolName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-[#06241a] text-amber-300 px-2 py-0.5 rounded-md">
                      Class Masool (مسؤول)
                    </span>
                    <span className="text-xs font-semibold text-slate-500 font-mono">
                      ITS: {activeClassObj.masoolIts || "—"}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    {activeClassObj.masoolName || "Not Assigned"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                    <span className="font-semibold text-emerald-800">Class {activeClassObj.name}</span>
                    <span>•</span>
                    <span className="text-slate-500">Room {activeClassObj.name}</span>
                    <span>•</span>
                    <span className="font-mono font-bold text-slate-700">{activeClassObj.studentCount || 0} Talabat Enrolled</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
                <Button
                  onClick={() => openNewSlotModal(activeClassObj.name)}
                  className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-black text-xs gap-1.5 shadow-sm px-3.5 py-2 rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Slot to {activeClassObj.name}
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  size="sm"
                  className="text-xs font-bold gap-1 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl px-3 py-2"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" /> Print Timetable
                </Button>
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

                        return (
                          <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot ? (
                              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border border-emerald-200/80 hover:border-emerald-400 hover:shadow-md transition-all shadow-2xs group relative flex flex-col justify-between min-h-[110px]">
                                <div>
                                  {/* Subject Badge */}
                                  <div className="flex items-start justify-between gap-1">
                                    <span
                                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border leading-tight ${getSubjectBadgeStyle(
                                        slot.subject
                                      )}`}
                                    >
                                      {slot.subject}
                                    </span>

                                    {/* Action buttons on hover */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/90 p-0.5 rounded-md shadow-2xs">
                                      <button
                                        onClick={() => openEditSlotModal(slot)}
                                        className="p-1 rounded hover:bg-emerald-100 text-slate-600 hover:text-emerald-900"
                                        title="Edit lesson details"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSlot(slot.id)}
                                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                                        title="Delete slot"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Asatezah Profile Picture & Name */}
                                  <div className="flex items-center gap-2 mt-2 pt-1">
                                    <Avatar className="w-6 h-6 ring-1 ring-emerald-600/40 shrink-0">
                                      {slot.teacherAvatar && <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />}
                                      <AvatarFallback
                                        className={`text-[9px] font-black bg-gradient-to-br ${getTeacherAvatarGradient(
                                          slot.teacherName
                                        )}`}
                                      >
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
                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                                  <span className="text-[9px] font-mono text-slate-400 font-medium">
                                    {slot.roomNumber || `Room ${slot.className}`}
                                  </span>
                                  <button
                                    onClick={() => openBadalModalForSlot(slot)}
                                    className="px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-black shrink-0 flex items-center gap-1 shadow-2xs transition-colors"
                                    title="Get Badal help or assign substitute for this lesson"
                                  >
                                    <ArrowRightLeft className="w-2.5 h-2.5" />
                                    <span>Badal Help</span>
                                  </button>
                                </div>
                              </div>
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
                        return (
                          <td key={cls.id} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot ? (
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-emerald-400 transition-all shadow-2xs">
                                <div className="text-xs font-extrabold text-slate-900 leading-tight">
                                  {slot.subject}
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Avatar className="w-5 h-5 ring-1 ring-emerald-600/30 shrink-0">
                                    {slot.teacherAvatar && <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />}
                                    <AvatarFallback className="text-[8px] font-black bg-[#06241a] text-amber-300">
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
                    <Avatar className="w-10 h-10 ring-2 ring-emerald-700 shrink-0 shadow-sm">
                      {activeTeacherObj.avatarUrl && <AvatarImage src={activeTeacherObj.avatarUrl} alt={activeTeacherObj.name} />}
                      <AvatarFallback className="bg-emerald-950 text-amber-300 text-xs font-black">
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
                    onClick={() => window.print()}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold gap-1 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" /> Print
                  </Button>
                </div>
              )}
            </div>

            {/* Teacher Chips with Avatars */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-100">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider shrink-0 mr-1">
                Faculty ({teachers.length}):
              </span>
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
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-2 ${
                        isSelected
                          ? "bg-[#06241a] text-amber-300 ring-2 ring-emerald-600/30 shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                      }`}
                    >
                      <Avatar className="w-5 h-5 ring-1 ring-amber-400/50">
                        {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                        <AvatarFallback className="text-[8px] bg-emerald-900 text-amber-300 font-bold">
                          {getInitials(t.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{t.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-amber-400 text-slate-950 font-bold" : "bg-slate-200 text-slate-600"}`}>
                        {t.weeklyPeriods}
                      </span>
                    </button>
                  );
                })}
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
                        return (
                          <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot ? (
                              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-50/70 to-slate-50 border border-amber-200/80 hover:border-amber-400 transition-all shadow-2xs group relative">
                                <div className="text-xs font-black text-slate-900 leading-tight">
                                  {slot.subject}
                                </div>
                                <div className="text-[11px] text-amber-900 font-bold mt-1">
                                  Class {slot.className}
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-amber-200/60">
                                  <span className="text-[9px] font-mono text-slate-400 font-medium">Room {slot.className}</span>
                                  <button
                                    onClick={() => openBadalModalForSlot(slot)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9px] font-black shrink-0 flex items-center gap-1 shadow-2xs"
                                    title="Assign substitute for this lesson"
                                  >
                                    <ArrowRightLeft className="w-2.5 h-2.5" />
                                    Badal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                                Free
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
          {/* Desk Controls Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Badal Substitution Tracking</h3>
                <p className="text-xs text-slate-500">Live proxy coverage for teacher absences, official khidmat &amp; leaves.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Date:</span>
                <input
                  type="date"
                  value={badalDate}
                  onChange={(e) => setBadalDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 outline-none"
                />
              </div>

              <Button
                onClick={() => {
                  setBadalForm({
                    date: badalDate,
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
                }}
                className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs gap-1.5 shadow-sm rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Badal
              </Button>
            </div>
          </div>

          {/* Badal Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            {badalLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Loading substitutions for {badalDate}...</p>
              </div>
            ) : (!Array.isArray(badals) || badals.length === 0) ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Full Regular Coverage Active</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No teacher substitutions recorded for {badalDate}. All scheduled faculty are present.
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
                    {(Array.isArray(badals) ? badals : []).map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4">
                          <div className="font-black text-slate-900">Period {b.period}</div>
                          <div className="text-[10.5px] font-mono text-slate-500">{b.startTime} – {b.endTime}</div>
                        </td>
                        <td className="p-4">
                          <span className="font-black text-slate-900">Class {b.className}</span>
                          <div className="text-emerald-700 font-bold text-[11px]">{b.subject}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              {b.originalTeacherAvatar && <AvatarImage src={b.originalTeacherAvatar} />}
                              <AvatarFallback className="bg-rose-100 text-rose-800 text-[10px] font-bold">
                                {getInitials(b.originalTeacherName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-rose-900">{b.originalTeacherName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 ring-1 ring-emerald-600">
                              {b.badalTeacherAvatar && <AvatarImage src={b.badalTeacherAvatar} />}
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
                    ))}
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

              {/* Original Teacher with Avatar */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  1. Scheduled Teacher (Absent / Needs Coverage)
                </label>
                <div className="flex items-center gap-2.5 p-2 bg-slate-100 rounded-xl border border-slate-200">
                  <Avatar className="w-7 h-7 ring-1 ring-slate-400">
                    {badalForm.originalTeacherAvatar && <AvatarImage src={badalForm.originalTeacherAvatar} />}
                    <AvatarFallback className="bg-rose-100 text-rose-800 text-[10px] font-bold">
                      {getInitials(badalForm.originalTeacherName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="font-bold text-slate-800 text-xs">
                    {badalForm.originalTeacherName || "Scheduled Ustad"}
                  </div>
                </div>
              </div>

              {/* Free Available Teachers Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  2. Choose Substitute Teacher (Filtered to Available Teachers)
                </label>
                {loadingAvailable ? (
                  <div className="p-3 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600 mx-auto" />
                    <span className="text-[10px] text-slate-500 mt-1 block">Calculating faculty availability matrix...</span>
                  </div>
                ) : availableTeachers.length === 0 ? (
                  <div className="p-3 text-center bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs">
                    No faculty completely free in Period {badalForm.period}. Please check another period or assign manually.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
                            <Avatar className="w-7 h-7 ring-1 ring-emerald-600">
                              {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                              <AvatarFallback className="bg-emerald-950 text-amber-300 text-[10px] font-bold">
                                {getInitials(t.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-extrabold text-slate-900 text-xs">{t.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Free in Period {badalForm.period} • {t.badalCount || 0} Badals taken
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

            {/* Subject Selector & Quick Subject Chips */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">4. Subject / Sabaq Name</label>
              <input
                type="text"
                value={slotFormData.subject}
                onChange={(e) => setSlotFormData({ ...slotFormData, subject: e.target.value })}
                placeholder="e.g. Quran Hifz, Lisan ud Dawat, Sharhal akhbar, Maths"
                disabled={slotFormData.isBreak}
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
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-[10px] font-bold text-slate-700 shrink-0 border border-slate-200 hover:border-emerald-300"
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Asatezah (Teacher) Selector with Avatar Preview */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">5. Teaching Ustad (Faculty)</label>
              <select
                value={slotFormData.teacherId}
                onChange={(e) => {
                  const t = teachers.find((item) => item.id === e.target.value);
                  setSlotFormData({ ...slotFormData, teacherId: e.target.value, teacherName: t ? t.name : "" });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
              >
                <option value="">Unassigned / Free Period</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (ITS: {t.its || "—"} • {t.weeklyPeriods} lessons/week)
                  </option>
                ))}
              </select>
            </div>

            {/* Timings & Room Number */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={slotFormData.startTime}
                  onChange={(e) => setSlotFormData({ ...slotFormData, startTime: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">End Time</label>
                <input
                  type="time"
                  value={slotFormData.endTime}
                  onChange={(e) => setSlotFormData({ ...slotFormData, endTime: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Room</label>
                <input
                  type="text"
                  value={slotFormData.roomNumber}
                  onChange={(e) => setSlotFormData({ ...slotFormData, roomNumber: e.target.value })}
                  placeholder="e.g. Room 1 A"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                />
              </div>
            </div>

            {/* Break / Recess Checkbox */}
            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slotFormData.isBreak}
                  onChange={(e) => setSlotFormData({ ...slotFormData, isBreak: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Mark as Break / Recess Period (e.g. Zohr Namaz, Lunch)
              </label>
            </div>
            {slotFormData.isBreak && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Break Title</label>
                <input
                  type="text"
                  value={slotFormData.breakName}
                  onChange={(e) => setSlotFormData({ ...slotFormData, breakName: e.target.value })}
                  placeholder="e.g. Namaz & Recess, Lunch Break"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                />
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
    </div>
  );
}
