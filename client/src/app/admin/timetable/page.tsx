"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  ShieldCheck,
  Users,
  Award,
  GraduationCap,
  Filter,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

type ActiveTab = "classes" | "teachers" | "badal" | "takhteet";

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

export default function AdminTimetableMasterPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("classes");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Timetable core data
  const [slots, setSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [takhteetList, setTakhteetList] = useState<any[]>([]);

  // Selection states
  const [selectedClassName, setSelectedClassName] = useState<string>("1 A");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Badal Management State
  const [badalDate, setBadalDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [badals, setBadals] = useState<any[]>([]);
  const [badalLoading, setBadalLoading] = useState(false);

  // Badal Modal State
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
    badalTeacherId: "",
    badalTeacherName: "",
    reason: "Medical / Sick Leave",
    instructions: "",
    notes: "",
  });
  const [savingBadal, setSavingBadal] = useState(false);

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
        const teacherList = Array.isArray(dataT.data.teachers) ? dataT.data.teachers : [];
        setTeachers(teacherList);
        if (!selectedTeacherId && teacherList.length > 0) {
          setSelectedTeacherId(teacherList[0].id);
        }
      } else {
        setSlots([]);
        setClasses([]);
        setTeachers([]);
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
        toast({ variant: "success", title: "Synced", description: "Timetable & allocations updated." });
      }
    } catch {
      setSlots([]);
      setClasses([]);
      setTeachers([]);
      setTakhteetList([]);
      toast({ variant: "destructive", title: "Sync Error", description: "Could not load timetable data." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [selectedTeacherId]);

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

  // Fetch free teachers when scheduling a badal
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
      badalTeacherId: "",
      badalTeacherName: "",
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
          setBadalForm((prev) => ({
            ...prev,
            badalTeacherId: data.data[0].id,
            badalTeacherName: data.data[0].name,
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
      toast({ variant: "warning", title: "Select Teacher", description: "Please choose a substitute teacher." });
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
          description: `${badalForm.badalTeacherName} assigned for ${badalForm.subject} (${badalForm.className}).`,
        });
        setShowBadalModal(false);
        fetchBadals();
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
        toast({ variant: "success", title: "Status Updated", description: "Substitution status updated." });
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

  const activeClassObj = useMemo(() => {
    return (Array.isArray(classes) ? classes : []).find((c) => c && c.name === selectedClassName) || null;
  }, [classes, selectedClassName]);

  const activeTeacherObj = useMemo(() => {
    return (Array.isArray(teachers) ? teachers : []).find((t) => t && t.id === selectedTeacherId) || null;
  }, [teachers, selectedTeacherId]);

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
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl" style={{ background: "linear-gradient(135deg, #06241a 0%, #0a3d2c 50%, #03180f 100%)" }}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
              <CalendarDays className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  Official Academic Timetable &amp; Badal Master
                </span>
                <span className="text-xs text-emerald-200 font-mono">1448 H • Term I</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Darajah &amp; Faculty Timetable Hub
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5 max-w-2xl">
                Real-time multi-dimensional scheduling: Darajah class timetables, individual faculty schedules, automated Badal substitutions, and Takhteet syllabus tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <Button
              onClick={() => fetchTimetableData(true)}
              disabled={loading || refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold gap-2 backdrop-blur-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-emerald-800/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("classes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "classes"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>1. Darajah Classes (1A–4B)</span>
          </button>

          <button
            onClick={() => setActiveTab("teachers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "teachers"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Asatezaah Individual Timetables</span>
          </button>

          <button
            onClick={() => setActiveTab("badal")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "badal"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>3. Badal Substitution &amp; Coverage Desk</span>
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
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>4. Takhteet Allocations ({takhteetList.length})</span>
          </button>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DARAJAH CLASS TIMETABLES
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "classes" && (
        <div className="space-y-6">
          {/* Class Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider shrink-0 mr-1">
                Select Class:
              </span>
              {classes.map((cls) => {
                const isSelected = selectedClassName === cls.name;
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassName(cls.name)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#06241a] text-amber-300 ring-2 ring-emerald-600/30 shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                    }`}
                  >
                    <span>Class {cls.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-amber-400 text-slate-950 font-bold" : "bg-slate-200 text-slate-600"}`}>
                      {cls.studentCount || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeClassObj && (
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Class Teacher:</span>
                  <span className="font-bold text-slate-900">{activeClassObj.masoolName}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Room:</span>
                  <span className="font-bold text-emerald-700">Room {activeClassObj.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Grid View */}
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
                        const slot = classSlotsMap.get(`${d.day}_${p.period}`);
                        return (
                          <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                            {slot ? (
                              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50/80 to-slate-50 border border-emerald-200/70 hover:border-emerald-400 transition-all shadow-2xs group relative">
                                <div className="text-xs font-black text-slate-900 leading-tight">
                                  {slot.subject}
                                </div>
                                <div className="text-[11px] text-emerald-800 font-semibold mt-1 truncate" title={slot.teacherName}>
                                  {slot.teacherName}
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-emerald-100/60">
                                  <span className="text-[9px] font-mono text-slate-400 font-medium">{slot.roomNumber}</span>
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
          TAB 2: ASATEZAAH INDIVIDUAL TEACHER TIMETABLES
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "teachers" && (
        <div className="space-y-6">
          {/* Teacher Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider shrink-0 mr-1">
                Select Teacher:
              </span>
              {teachers.map((t) => {
                const isSelected = selectedTeacherId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacherId(t.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#06241a] text-amber-300 ring-2 ring-emerald-600/30 shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-amber-400 text-slate-950 font-bold" : "bg-slate-200 text-slate-600"}`}>
                      {t.weeklyPeriods} periods
                    </span>
                  </button>
                );
              })}
            </div>

            {activeTeacherObj && (
              <div className="flex items-center gap-3 shrink-0">
                <Avatar className="w-9 h-9 ring-1 ring-emerald-700">
                  {activeTeacherObj.avatarUrl && <AvatarImage src={activeTeacherObj.avatarUrl} alt={activeTeacherObj.name} />}
                  <AvatarFallback className="bg-emerald-950 text-amber-300 text-xs font-bold">
                    {getInitials(activeTeacherObj.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-xs font-bold text-slate-900">{activeTeacherObj.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">ITS: {activeTeacherObj.its || "—"} • {activeTeacherObj.weeklyPeriods} Weekly Lessons</div>
                </div>
              </div>
            )}
          </div>

          {/* Grid View */}
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
          TAB 3: BADAL SUBSTITUTION & COVERAGE DESK
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "badal" && (
        <div className="space-y-6">
          {/* Desk Controls Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
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
                    badalTeacherId: teachers[1]?.id || "",
                    badalTeacherName: teachers[1]?.name || "",
                    reason: "Medical / Sick Leave",
                    instructions: "Cover sabaq and check homework.",
                    notes: "",
                  });
                  setShowBadalModal(true);
                }}
                className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs gap-1.5 shadow-sm"
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
                  No teacher substitutions or badal requests recorded for {badalDate}. All scheduled teachers are present.
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
          TAB 4: ASATEZAAH TAKHTEET ALLOCATIONS (CSV DATA)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "takhteet" && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
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
          BADAL ASSIGNMENT MODAL (WITH INTELLIGENT TEACHER FINDER)
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
                  <h3 className="text-sm font-black text-slate-900">Assign Badal (Proxy Teacher)</h3>
                  <p className="text-[11px] text-slate-500">Intelligent conflict-free substitute allocation.</p>
                </div>
              </div>
              <button onClick={() => setShowBadalModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Class &amp; Subject</span>
                  <div className="font-black text-slate-900 mt-0.5">
                    Class {badalForm.className} • {badalForm.subject}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Period &amp; Time</span>
                  <div className="font-black text-slate-900 mt-0.5">
                    Period {badalForm.period} ({badalForm.startTime}–{badalForm.endTime})
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  1. Original Scheduled Teacher (Absent / On Leave)
                </label>
                <input
                  type="text"
                  value={badalForm.originalTeacherName}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  2. Choose Substitute Teacher (Filtered to Free Teachers)
                </label>
                {loadingAvailable ? (
                  <div className="p-3 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600 mx-auto" />
                    <span className="text-[10px] text-slate-500 mt-1 block">Checking faculty availability matrix...</span>
                  </div>
                ) : (
                  <select
                    value={badalForm.badalTeacherId}
                    onChange={(e) => {
                      const t = availableTeachers.find((item) => item.id === e.target.value);
                      setBadalForm((prev) => ({
                        ...prev,
                        badalTeacherId: e.target.value,
                        badalTeacherName: t ? t.name : "",
                      }));
                    }}
                    className="w-full px-3 py-2 bg-emerald-50/60 border border-emerald-300 rounded-xl font-bold text-emerald-950 outline-none"
                  >
                    {availableTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Free in Period {badalForm.period} • {t.badalCount} badals this week)
                      </option>
                    ))}
                  </select>
                )}
              </div>

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
    </div>
  );
}
