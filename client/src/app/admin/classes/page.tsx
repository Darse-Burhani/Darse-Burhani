"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Users,
  Loader2,
  MapPin,
  Calendar,
  Trash2,
  Pencil,
  Settings,
  UserPlus,
  UserMinus,
  Clock,
  AlertTriangle,
  Check,
  CalendarDays,
  ClipboardList,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon..Sat

const DARAJAH_ARABIC: Record<string, string> = {
  "1": "الدرجة الأولى",
  "2": "الدرجة الثانية",
  "3": "الدرجة الثالثة",
  "4": "الدرجة الرابعة",
};

interface Slot {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  roomNumber: string | null;
  isBreak: boolean;
  breakName: string | null;
}

const emptySlotForm = {
  dayOfWeek: 1,
  period: 1,
  startTime: "10:30",
  endTime: "11:00",
  subject: "",
  roomNumber: "",
  isBreak: false,
  breakName: "",
};

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingDarajah, setSyncingDarajah] = useState(false);
  const [search, setSearch] = useState("");
  const [darajahFilter, setDarajahFilter] = useState<string>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    grade: "1",
    section: "A",
    subject: "Core Darajah Curriculum",
    roomNumber: "Room 101",
    teacherId: "",
    masoolId: "",
    academicYear: "1448 H",
  });
  const [saving, setSaving] = useState(false);

  // ── Manage modal state ──
  const [managing, setManaging] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [available, setAvailable] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"students" | "details" | "timetable">("students");
  const [detailLoading, setDetailLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // ── Delete modal state ──
  const [classToDelete, setClassToDelete] = useState<any | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form (Details tab)
  const [editForm, setEditForm] = useState({
    name: "",
    grade: "",
    section: "",
    subject: "",
    roomNumber: "",
    teacherId: "",
    masoolId: "",
    academicYear: "",
    isActive: true,
  });

  // Timetable editor
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/classes").then((r) => r.json());
      if (res.success) setClasses(res.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load classes." });
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/classes").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ])
      .then(([classesRes, usersRes]) => {
        if (classesRes.success) setClasses(classesRes.data);
        if (usersRes.success) {
          setTeachers(usersRes.data.filter((u: any) => u.role === "TEACHER"));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Filtered classes list
  const filtered = useMemo(() => {
    return classes.filter((c) => {
      if (darajahFilter !== "ALL") {
        if (darajahFilter === "ACTIVE") {
          if (!c.isActive) return false;
        } else if (String(c.grade) !== darajahFilter) {
          return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const str = `${c.name} ${c.subject} ${c.teacherName} ${c.masoolName ?? ""} Grade ${c.grade}${c.section}`.toLowerCase();
        return str.includes(q);
      }
      return true;
    });
  }, [classes, darajahFilter, search]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    const masoolAssigned = classes.filter((c) => c.masoolId || c.masoolName).length;
    const totalSlots = classes.reduce((sum, c) => sum + (c.slotCount || 0), 0);
    return { totalClasses, totalStudents, masoolAssigned, totalSlots };
  }, [classes]);

  // ── Manage modal ──
  const openManage = async (cls: any) => {
    setManaging(cls);
    setActiveTab("students");
    setDetail(null);
    setAvailable([]);
    setDetailLoading(true);
    try {
      const [d, av] = await Promise.all([
        fetch(`/api/admin/classes/${cls.id}`).then((r) => r.json()),
        fetch(`/api/admin/classes/${cls.id}/available-students`).then((r) => r.json()),
      ]);
      if (d.success) {
        setDetail(d.data);
        setEditForm({
          name: d.data.name,
          grade: d.data.grade,
          section: d.data.section,
          subject: d.data.subject,
          roomNumber: d.data.roomNumber || "",
          teacherId: d.data.teacherId || "",
          masoolId: d.data.masoolId || "",
          academicYear: d.data.academicYear || "",
          isActive: d.data.isActive,
        });
      }
      if (av.success) setAvailable(av.data.students);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeManage = async () => {
    setManaging(null);
    setDetail(null);
    setAvailable([]);
    await loadClasses();
  };

  const refreshDetail = async () => {
    if (!managing) return;
    const [d, av] = await Promise.all([
      fetch(`/api/admin/classes/${managing.id}`).then((r) => r.json()),
      fetch(`/api/admin/classes/${managing.id}/available-students`).then((r) => r.json()),
    ]);
    if (d.success) setDetail(d.data);
    if (av.success) setAvailable(av.data.students);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Class Created", description: `Class "${form.name}" has been established.`, variant: "success" });
        setShowCreateModal(false);
        setForm({
          name: "",
          grade: "1",
          section: "A",
          subject: "Core Darajah Curriculum",
          roomNumber: "Room 101",
          teacherId: "",
          masoolId: "",
          academicYear: "1448 H",
        });
        await loadClasses();
      } else {
        toast({ title: "Creation Failed", description: json.error || "Could not create class.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSyncDarajah = async () => {
    if (!window.confirm("Initialize/synchronize all 8 Darajah classes (1A–4B), auto-assign official Masools, and auto-enroll matching students for 1448 H?")) return;
    setSyncingDarajah(true);
    try {
      const res = await fetch("/api/admin/classes/sync-darajah", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Darajah Matrix Synchronized",
          description: `${json.data.classesCreatedOrUpdated} classes verified, ${json.data.enrolledStudents} talabat enrolled.`,
          variant: "success",
        });
        await loadClasses();
      } else {
        toast({ title: "Sync Failed", description: json.error || "Failed to sync Darajah classes.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network Error", description: "Failed to connect to server.", variant: "destructive" });
    } finally {
      setSyncingDarajah(false);
    }
  };

  const handleAutoEnroll = async () => {
    if (!managing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${managing.id}/auto-enroll`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Auto-Enrollment Complete",
          description: `${json.data.enrolled} talabat enrolled into Class ${managing.name}.`,
          variant: "success",
        });
        await refreshDetail();
        await loadClasses();
      } else {
        toast({ title: "Auto-Enroll Notice", description: json.error || "Failed to auto-enroll students.", variant: "warning" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to auto-enroll students.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ── Details tab ──
  const handleUpdate = async () => {
    if (!managing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${managing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Changes Saved", description: "Class details successfully updated.", variant: "success" });
        await refreshDetail();
        setManaging({ ...managing, name: editForm.name });
        await loadClasses();
      } else {
        toast({ title: "Update Failed", description: json.error || "Could not update class.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Delete Class Handler ──
  const triggerDeleteModal = (cls: any) => {
    setClassToDelete(cls);
    setForceDelete(false);
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    setDeleting(true);
    try {
      const url = `/api/admin/classes/${classToDelete.id}${forceDelete ? "?force=true" : ""}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: forceDelete }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.hasHistory) {
          toast({
            title: "Historical Records Detected",
            description: "Class has attendance logs or point logs. Check 'Purge all history & force delete' to proceed, or deactivate instead.",
            variant: "destructive",
          });
          setForceDelete(true);
          return;
        }
        toast({
          title: "Delete Failed",
          description: json?.error || "Could not delete class.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Class Deleted",
        description: `Class "${classToDelete.name}" was permanently removed.`,
        variant: "success",
      });
      setClassToDelete(null);
      setForceDelete(false);
      if (managing?.id === classToDelete.id) {
        setManaging(null);
      }
      await loadClasses();
    } catch (err: any) {
      toast({
        title: "Network Error",
        description: err?.message || "Failed to communicate with server.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!classToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/classes/${classToDelete.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        toast({
          title: "Class Deactivated",
          description: `Class "${classToDelete.name}" marked inactive. Historical records preserved.`,
          variant: "success",
        });
        setClassToDelete(null);
        await loadClasses();
      }
    } finally {
      setDeleting(false);
    }
  };

  // ── Students tab ──
  const addStudent = async (studentProfileId: string) => {
    if (!managing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${managing.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId }),
      });
      if (res.ok) await refreshDetail();
    } finally {
      setBusy(false);
    }
  };

  const removeStudent = async (studentProfileId: string) => {
    if (!managing) return;
    if (!window.confirm("Remove this talabat from the class?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${managing.id}/students/${studentProfileId}`, { method: "DELETE" });
      if (res.ok) await refreshDetail();
    } finally {
      setBusy(false);
    }
  };

  const availableFiltered = available.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  // ── Timetable tab ──
  const saveSlot = async () => {
    if (!managing) return;
    if (!slotForm.startTime || !slotForm.endTime) return;
    setBusy(true);
    try {
      const payload = {
        ...(editingSlotId ? { id: editingSlotId } : {}),
        classId: managing.id,
        dayOfWeek: slotForm.dayOfWeek,
        period: slotForm.period,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        subject: slotForm.isBreak ? "" : slotForm.subject,
        roomNumber: slotForm.roomNumber || null,
        isBreak: slotForm.isBreak,
        breakName: slotForm.isBreak ? slotForm.breakName : null,
      };
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSlotForm(emptySlotForm);
        setEditingSlotId(null);
        await refreshDetail();
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!window.confirm("Delete this timetable slot?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/timetable?id=${slotId}`, { method: "DELETE" });
      if (res.ok) await refreshDetail();
    } finally {
      setBusy(false);
    }
  };

  const editSlot = (slot: Slot) => {
    setEditingSlotId(slot.id);
    setSlotForm({
      dayOfWeek: slot.dayOfWeek,
      period: slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      roomNumber: slot.roomNumber || "",
      isBreak: slot.isBreak,
      breakName: slot.breakName || "",
    });
  };

  const slots = detail?.slots ?? [];
  const roster = detail?.students ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Academics Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Academics &amp; Curriculum"
        hubDescription="Official class matrix, appointed Class Masools, weekly timetables, and student enrollments."
        tabs={[
          { label: "Classes & Darajahs", href: "/admin/classes", icon: BookOpen },
          { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
        ]}
      />

      {/* ── Header Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #06241a 0%, #0a3d2c 50%, #03180f 100%)" }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-400/40"
              style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}
            >
              <BookOpen className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  دار النور والبرهان
                </span>
                <span className="text-xs text-emerald-200 font-mono">Academic Term I • 1448 H</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Darajah Classes &amp; Academic Faculty Hub
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                Official Darajah 1 to 4 sections (1A–4B), appointed Class Masool (مسؤول الفصل), teachers, and student rosters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-center">
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold gap-1.5 rounded-xl shadow-sm"
              onClick={handleSyncDarajah}
              disabled={syncingDarajah}
            >
              {syncingDarajah ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300 mr-1" />}
              Sync 8 Darajah Classes (1A–4B)
            </Button>
            <Button
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs gap-1.5 rounded-xl shadow-lg"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" /> New Class
            </Button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* ── Quick Statistics Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Total Classes</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalClasses}</div>
            <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">Darajah 1A to 4B Active</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Enrolled Talabat</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalStudents}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Verified Registered Students</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Class Masools</div>
            <div className="text-2xl font-black text-amber-950 mt-0.5">
              {stats.masoolAssigned} / {stats.totalClasses}
            </div>
            <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
              {stats.totalClasses > 0 ? `${Math.round((stats.masoolAssigned / stats.totalClasses) * 100)}% Assigned` : "0%"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider">Weekly Sabaq Sessions</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalSlots}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Periods Scheduled Weekly</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Darajah Segment Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "ALL", label: "All Classes" },
            { id: "1", label: "Darajah 1" },
            { id: "2", label: "Darajah 2" },
            { id: "3", label: "Darajah 3" },
            { id: "4", label: "Darajah 4" },
            { id: "ACTIVE", label: "Active Only" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDarajahFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                darajahFilter === tab.id
                  ? "bg-[#06241a] text-amber-300 ring-2 ring-emerald-600/30 shadow-xs font-black"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by class name, masool, teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
          />
        </div>
      </div>

      {/* ── Class Cards Grid ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200/80 animate-pulse space-y-4">
              <div className="h-5 w-24 bg-slate-200 rounded-lg" />
              <div className="h-8 w-48 bg-slate-200 rounded-lg" />
              <div className="h-16 w-full bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-white border border-dashed border-slate-200 flex flex-col items-center justify-center">
          <BookOpen className="w-10 h-10 text-slate-300 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No classes match your filter</h3>
          <p className="text-xs text-slate-400 mt-0.5">Try searching for a different class or resetting filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cls) => {
            const darajahArabic = DARAJAH_ARABIC[String(cls.grade)] || `الدرجة ${cls.grade}`;

            return (
              <motion.div key={cls.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden bg-white flex flex-col h-full group">
                  {/* Card Header Topline with Fatimi Arabic */}
                  <div className="p-5 pb-3 border-b border-slate-100 bg-gradient-to-r from-emerald-950 via-[#0a3d2c] to-emerald-900 text-white flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-amber-300 font-black uppercase tracking-wider">
                        {darajahArabic} • Section {cls.section || "A"}
                      </div>
                      <h3 className="text-lg font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                        <span>Class {cls.name}</span>
                        {cls.isActive ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Class" />
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">Inactive</span>
                        )}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                        {cls.slotCount ? `${cls.slotCount} Periods` : "Curriculum"}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5 flex flex-col flex-1 space-y-3.5">
                    {/* Class Details & Location */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{cls.roomNumber || `Room ${cls.name}`}</span>
                      </div>
                      <span className="font-mono text-[11px]">{cls.academicYear || "1448 H"}</span>
                    </div>

                    {/* Class Masool Section */}
                    <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="w-10 h-10 ring-2 ring-amber-400 shadow-xs shrink-0">
                          {cls.masoolAvatar && <AvatarImage src={cls.masoolAvatar} alt={cls.masoolName} />}
                          <AvatarFallback className="bg-[#06241a] text-amber-300 text-xs font-black">
                            {cls.masoolName ? getInitials(cls.masoolName) : "—"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                              مسؤول الفصل (Class Masool)
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900 truncate" title={cls.masoolName || "Unassigned"}>
                            {cls.masoolName || "Unassigned"}
                          </div>
                          {cls.masoolIts && (
                            <div className="text-[9.5px] font-mono text-slate-500">ITS: {cls.masoolIts}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subject Teacher & Student Enrollment Count */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 ring-1 ring-emerald-600/30 shrink-0">
                          {cls.teacherAvatar && <AvatarImage src={cls.teacherAvatar} alt={cls.teacherName} />}
                          <AvatarFallback className="bg-emerald-800 text-amber-200 text-[10px] font-bold">
                            {getInitials(cls.teacherName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-[9.5px] uppercase font-bold text-slate-400">Lead Faculty</div>
                          <div className="text-xs font-bold text-slate-800 truncate" title={cls.teacherName}>
                            {cls.teacherName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1 justify-end">
                          <Users className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{cls.studentCount || 0}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Talabat Enrolled</div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-2 mt-auto border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300 font-bold text-xs gap-1.5 rounded-xl shadow-2xs"
                          onClick={() => openManage(cls)}
                        >
                          <Settings className="w-3.5 h-3.5 text-emerald-700" /> Manage
                        </Button>

                        <Link href={`/admin/timetable?class=${encodeURIComponent(cls.name)}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-amber-900 hover:text-amber-950 hover:bg-amber-100 font-bold text-xs gap-1 rounded-xl"
                          >
                            <Calendar className="w-3.5 h-3.5 text-amber-600" /> Timetable
                          </Button>
                        </Link>
                      </div>

                      {/* Direct Delete Class Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => triggerDeleteModal(cls)}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-2 rounded-xl"
                        title="Delete this class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CREATE CLASS MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#06241a] text-amber-300 flex items-center justify-center shadow-xs">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-extrabold text-slate-900">Create New Class</div>
                <div className="text-xs text-slate-500 font-normal">Establish a new Darajah section and appoint faculty</div>
              </div>
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Class Identifier / Display Name</label>
              <input
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none mt-1"
                placeholder="e.g. 1 A or Darajah 1 A"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Darajah (Grade 1–4)</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none mt-1"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                >
                  <option value="1">Darajah 1 (الدرجة الأولى)</option>
                  <option value="2">Darajah 2 (الدرجة الثانية)</option>
                  <option value="3">Darajah 3 (الدرجة الثالثة)</option>
                  <option value="4">Darajah 4 (الدرجة الرابعة)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Section</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                  placeholder="e.g. A or B"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Curriculum Subject</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Classroom / Room Number</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                  value={form.roomNumber}
                  onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Lead Subject Teacher</label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none mt-1"
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              >
                <option value="">Select faculty member...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} {t.teacherProfile?.its ? `(ITS: ${t.teacherProfile.its})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Class Masool (مسؤول الفصل)</span>
                <span className="text-slate-400 font-normal">Assigned class mentor &amp; in-charge</span>
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-semibold bg-amber-50/50 outline-none mt-1"
                value={form.masoolId}
                onChange={(e) => setForm({ ...form, masoolId: e.target.value })}
              >
                <option value="">Select official Masool...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} {t.teacherProfile?.its ? `(ITS: ${t.teacherProfile.its})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ModalFooter className="flex items-center justify-between">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="text-xs rounded-xl">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-black text-xs rounded-xl shadow-sm"
              onClick={handleCreate}
              disabled={saving || !form.name || !form.grade || !form.teacherId}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Create Class
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MANAGE CLASS MODAL (STUDENTS, DETAILS, TIMETABLE)
         ───────────────────────────────────────────────────────────── */}
      <Modal open={Boolean(managing)} onOpenChange={(open) => { if (!open) closeManage(); }}>
        <ModalContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <ModalHeader>
            <ModalTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#06241a] text-amber-300 flex items-center justify-center font-black shadow-xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    Manage Class {managing?.name}
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    Darajah {managing?.grade} Section {managing?.section} • Room {managing?.roomNumber || managing?.name}
                  </div>
                </div>
              </div>

              {/* Quick Delete shortcut */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => triggerDeleteModal(managing)}
                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-bold gap-1 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Class
              </Button>
            </ModalTitle>
          </ModalHeader>

          {/* Navigation Tabs */}
          <div className="flex gap-2 px-6 pt-2 pb-3 border-b border-slate-100">
            {([
              { key: "students", label: "Talabat Roster", icon: Users, count: roster.length },
              { key: "details", label: "Class Details", icon: Pencil, count: null },
              { key: "timetable", label: "Timetable Slots", icon: Calendar, count: slots.length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-[#06241a] text-amber-300 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {detailLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Loading class details and roster...</p>
              </div>
            ) : activeTab === "students" ? (
              /* ── Students / Roster Tab ── */
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-700" />
                      Enrolled Talabat ({roster.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-900 hover:bg-emerald-50 text-xs font-bold rounded-xl"
                      onClick={handleAutoEnroll}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500 mr-1" />}
                      Auto-Enroll Matching Talabat
                    </Button>
                  </div>

                  {roster.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-6 text-center border border-slate-200/60">
                      No talabat enrolled in this class yet. Click Auto-Enroll or search below to add students.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {roster.map((s: any) => (
                        <div
                          key={s.studentProfileId}
                          className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="w-9 h-9 ring-1 ring-emerald-600/30 shrink-0">
                              {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt={`${s.firstName} ${s.lastName}`} />}
                              <AvatarFallback className="bg-[#06241a] text-amber-300 text-xs font-bold">
                                {getInitials(s.firstName, s.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {s.firstName} {s.lastName}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                ITS: {s.studentId} • {s.status || "Active"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg p-1.5"
                            onClick={() => removeStudent(s.studentProfileId)}
                            disabled={busy}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Available Talabat */}
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-emerald-700" /> Add Available Talabat
                  </h4>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search students by name or ITS..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                    />
                  </div>

                  {availableFiltered.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-4 text-center">
                      No unenrolled students available{rosterSearch ? " matching your search" : ""}.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {availableFiltered.slice(0, 50).map((s: any) => (
                        <div
                          key={s.studentProfileId}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {s.firstName} {s.lastName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ITS: {s.studentId} • Grade {s.grade}{s.section}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-900 hover:bg-emerald-50 text-xs font-bold rounded-lg"
                            onClick={() => addStudent(s.studentProfileId)}
                            disabled={busy}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add
                          </Button>
                        </div>
                      ))}
                      {availableFiltered.length > 50 && (
                        <p className="text-[10px] text-slate-400 text-center py-1">
                          Showing 50 of {availableFiltered.length} students — refine your search
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "details" ? (
              /* ── Details Tab ── */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Class Name</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Curriculum Subject</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                      value={editForm.subject}
                      onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Darajah (Grade)</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                      value={editForm.grade}
                      onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Section</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                      value={editForm.section}
                      onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Room Number</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                      value={editForm.roomNumber}
                      onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Academic Year</label>
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none mt-1"
                      value={editForm.academicYear}
                      onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Lead Subject Teacher</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none mt-1"
                    value={editForm.teacherId}
                    onChange={(e) => setEditForm({ ...editForm, teacherId: e.target.value })}
                  >
                    <option value="">Select teacher...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} {t.teacherProfile?.its ? `(ITS: ${t.teacherProfile.its})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Class Masool (مسؤول الفصل)</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-semibold bg-amber-50/50 outline-none mt-1"
                    value={editForm.masoolId}
                    onChange={(e) => setEditForm({ ...editForm, masoolId: e.target.value })}
                  >
                    <option value="">None (Unassigned)</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} {t.teacherProfile?.its ? `(ITS: ${t.teacherProfile.its})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span>Active class (enables attendance recording and timetable scheduling)</span>
                </label>

                <div className="pt-2">
                  <Button
                    className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs rounded-xl shadow-xs"
                    onClick={handleUpdate}
                    disabled={busy || !editForm.name || !editForm.grade}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                    Save Changes
                  </Button>
                </div>

                {/* Danger zone */}
                <div className="border border-rose-200 bg-rose-50/60 rounded-2xl p-4 mt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-rose-950 uppercase tracking-wider">Danger Zone: Delete Class</p>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          Permanently removes this class, enrollments, and timetables. If historical attendance records exist, you can purge them cleanly or mark inactive.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs font-bold rounded-xl shrink-0"
                      onClick={() => triggerDeleteModal(managing)}
                      disabled={busy}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Class
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Timetable Tab ── */
              <div className="space-y-5">
                {/* Slot form */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <h4 className="text-xs font-black uppercase text-emerald-950 tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    {editingSlotId ? "Edit Period Slot" : "Add New Period Slot"}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Day</label>
                      <select
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white mt-0.5"
                        value={slotForm.dayOfWeek}
                        onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: Number(e.target.value) })}
                      >
                        {WEEK_DAYS.map((d) => (
                          <option key={d} value={d}>
                            {DAY_LABELS[d]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Period (1–9)</label>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold mt-0.5"
                        value={slotForm.period}
                        onChange={(e) => setSlotForm({ ...slotForm, period: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Start Time</label>
                      <input
                        type="time"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold mt-0.5"
                        value={slotForm.startTime}
                        onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">End Time</label>
                      <input
                        type="time"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold mt-0.5"
                        value={slotForm.endTime}
                        onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700">Subject</label>
                      <input
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold mt-0.5"
                        placeholder={slotForm.isBreak ? "Break" : "e.g. Al-Quran Al-Kareem"}
                        value={slotForm.isBreak ? "" : slotForm.subject}
                        disabled={slotForm.isBreak}
                        onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700">Room Number</label>
                      <input
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold mt-0.5"
                        value={slotForm.roomNumber}
                        onChange={(e) => setSlotForm({ ...slotForm, roomNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      className="bg-[#06241a] hover:bg-[#0a3d2c] text-amber-300 font-bold text-xs rounded-xl shadow-xs"
                      onClick={saveSlot}
                      disabled={busy || !slotForm.startTime || !slotForm.endTime}
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                      {editingSlotId ? "Save Slot" : "Add Period"}
                    </Button>
                    {editingSlotId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs rounded-xl"
                        onClick={() => {
                          setEditingSlotId(null);
                          setSlotForm(emptySlotForm);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Slots per day */}
                <div className="space-y-2">
                  {WEEK_DAYS.map((day) => {
                    const daySlots = slots
                      .filter((s: Slot) => s.dayOfWeek === day)
                      .sort((a: Slot, b: Slot) => a.period - b.period);

                    return (
                      <div key={day} className="rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800">{DAY_LABELS[day]}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {daySlots.length} period{daySlots.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {daySlots.length === 0 ? (
                          <p className="text-xs text-slate-400 px-4 py-3">No periods scheduled</p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {daySlots.map((s: Slot) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-slate-50/70 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <Badge variant="outline" className="text-[10px] w-12 justify-center font-bold">
                                    P{s.period}
                                  </Badge>
                                  <span className="text-xs text-slate-600 font-mono">
                                    {s.startTime}–{s.endTime}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900">{s.subject}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-500 hover:text-emerald-700 p-1.5 rounded-lg"
                                    onClick={() => editSlot(s)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg"
                                    onClick={() => deleteSlot(s.id)}
                                    disabled={busy}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <ModalFooter className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Class {managing?.name} • ID: {managing?.id?.slice(0, 8)}…
            </span>
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="text-xs rounded-xl">
                Close
              </Button>
            </ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          DELETE CLASS CONFIRMATION MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal open={Boolean(classToDelete)} onOpenChange={(open) => { if (!open) setClassToDelete(null); }}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2.5 text-rose-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-extrabold text-rose-950">
                  Delete Class {classToDelete?.name}
                </div>
                <div className="text-xs text-rose-700 font-normal">
                  Darajah {classToDelete?.grade} • {classToDelete?.studentCount || 0} Talabat Enrolled
                </div>
              </div>
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-700 leading-relaxed">
              Are you sure you want to delete <span className="font-extrabold text-slate-950">Class {classToDelete?.name}</span>?
              This will remove the class entry, student enrollments, and all scheduled timetable periods.
            </p>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Historical Data Safeguard</span>
              </div>
              <p className="text-[11px] text-amber-900/90 leading-tight">
                If this class already has attendance records or point history, you can either:
              </p>
              <ul className="text-[11px] text-amber-900 list-disc pl-4 space-y-1">
                <li><strong className="text-amber-950">Deactivate:</strong> Safely preserve all historical attendance and marks.</li>
                <li><strong className="text-amber-950">Force Delete:</strong> Purge all related attendance and point history completely.</li>
              </ul>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-rose-600 border-rose-300 focus:ring-rose-500"
              />
              <div className="text-xs">
                <span className="font-bold text-rose-950">Purge all history &amp; force permanent deletion</span>
                <p className="text-[10.5px] text-rose-700 mt-0.5">
                  Check this if the class was previously active or if the standard delete was blocked.
                </p>
              </div>
            </label>
          </div>

          <ModalFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivateInstead}
              disabled={deleting}
              className="text-xs font-bold rounded-xl border-amber-300 text-amber-900 hover:bg-amber-50"
            >
              Deactivate Instead
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClassToDelete(null)}
                disabled={deleting}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDeleteClass}
                disabled={deleting}
                className="text-xs font-black rounded-xl gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {forceDelete ? "Confirm Force Delete" : "Delete Class"}
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
