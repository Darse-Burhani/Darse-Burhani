"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { getInitials } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon..Sat

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
  startTime: "07:00",
  endTime: "08:00",
  subject: "",
  roomNumber: "",
  isBreak: false,
  breakName: "",
};

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", grade: "", section: "", subject: "", roomNumber: "", teacherId: "", masoolId: "", academicYear: "2025-2026" });
  const [saving, setSaving] = useState(false);

  // ── Manage modal state ──
  const [managing, setManaging] = useState<any>(null); // class summary (from list)
  const [detail, setDetail] = useState<any>(null);
  const [available, setAvailable] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "students" | "timetable">("students");
  const [detailLoading, setDetailLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // Edit form (Details tab)
  const [editForm, setEditForm] = useState({ name: "", grade: "", section: "", subject: "", roomNumber: "", teacherId: "", masoolId: "", academicYear: "", isActive: true });
  // Timetable editor
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    const res = await fetch("/api/admin/classes").then((r) => r.json());
    if (res.success) setClasses(res.data);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/classes").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]).then(([classesRes, usersRes]) => {
      if (classesRes.success) setClasses(classesRes.data);
      if (usersRes.success) setTeachers(usersRes.data.filter((u: any) => u.role === "TEACHER"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);  const filtered = classes.filter((c) => `${c.name} ${c.subject} ${c.teacherName} ${c.masoolName ?? ""}`.toLowerCase().includes(search.toLowerCase()));

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
    await loadClasses(); // refresh counts on the cards
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
      const res = await fetch("/api/admin/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) {
        setShowCreateModal(false);
        setForm({ name: "", grade: "", section: "", subject: "", roomNumber: "", teacherId: "", masoolId: "", academicYear: "2025-2026" });
        await loadClasses();
      }
    } finally { setSaving(false); }
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
      if (res.ok) {
        await refreshDetail();
        setManaging({ ...managing, name: editForm.name });
        await loadClasses();
      }
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!managing) return;
    if (!window.confirm(`Delete class "${managing.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${managing.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(json?.error || "Failed to delete class");
        return;
      }
      await closeManage();
    } finally { setBusy(false); }
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
    } finally { setBusy(false); }
  };

  const removeStudent = async (studentProfileId: string) => {
    if (!managing) return;
    if (!window.confirm("Remove this talabat from the class?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${managing.id}/students/${studentProfileId}`, { method: "DELETE" });
      if (res.ok) await refreshDetail();
    } finally { setBusy(false); }
  };

  const availableFiltered = available.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(rosterSearch.toLowerCase()),
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
    } finally { setBusy(false); }
  };

  const deleteSlot = async (slotId: string) => {
    if (!window.confirm("Delete this timetable slot?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/timetable?id=${slotId}`, { method: "DELETE" });
      if (res.ok) await refreshDetail();
    } finally { setBusy(false); }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Academics Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Academics & Curriculum"
        hubDescription="Class management, weekly master timetable matrix, and Takhteet curriculum portion tracking."
        tabs={[
          { label: "Classes", href: "/admin/classes", icon: BookOpen },
          { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="fatimi-header-banner">
          <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
              <circle cx="50" cy="50" r="25" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            </svg>
          </div>
          <div className="absolute bottom-0 right-0 w-24 h-24 opacity-10 rotate-45">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Class Management</h1>
                <p className="text-emerald-100 text-sm mt-1">Manage classes and timetables</p>
              </div>
            </div>
            <Button className="fatimi-gold-accent text-white hover:opacity-90 shadow-lg" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Class
            </Button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#047857]/50" />
        <label htmlFor="search-classes" className="sr-only">Search classes</label>
        <input
          type="text"
          id="search-classes"
          name="search-classes"
          placeholder="Search classes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-emerald-200/60 bg-white text-sm focus:border-[#d4af37]/60 focus:ring-2 focus:ring-[#d4af37]/20 outline-none transition-all"
        />
      </div>

      {/* Class Cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="fatimi-card animate-pulse">
              <div className="fatimi-card-header" />
              <CardContent className="p-6"><div className="w-20 h-5 bg-gray-200 rounded mb-4" /><div className="w-full h-4 bg-gray-200 rounded mb-2" /><div className="w-2/3 h-4 bg-gray-200 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cls) => (
            <motion.div key={cls.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="fatimi-card hover:shadow-lg transition-shadow h-full flex flex-col">
                <div className="fatimi-card-header" />
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className="text-xs border-emerald-200/60 text-[#047857] bg-emerald-50/50">{cls.subject}</Badge>
                    <Badge variant={cls.isActive ? "success" : "secondary"} className="text-[10px]">{cls.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">{cls.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">Grade {cls.grade}{cls.section} &bull; Room {cls.roomNumber || "TBA"}</p>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">Teacher: {cls.teacherName}</span>
                    <span className="flex items-center gap-1 text-gray-600"><Users className="w-4 h-4" /> {cls.studentCount}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Masool: {cls.masoolName || "—"}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Button size="sm" variant="outline" className="border-emerald-200/60 text-[#047857] hover:bg-emerald-50" onClick={() => openManage(cls)}>
                      <Settings className="w-3.5 h-3.5 mr-1" /> Manage
                    </Button>
                    <span className="text-xs text-gray-400">{cls.academicYear}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-12 col-span-full">No classes found</p>}
        </div>
      )}

      {/* Create Class Modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl fatimi-gold-accent flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              Create New Class
            </ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div><label htmlFor="className" className="text-sm font-medium text-gray-700">Class Name</label><input id="className" name="className" className="fatimi-input mt-1" placeholder="e.g. Physics 10A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="grade" className="text-sm font-medium text-gray-700">Grade</label><input id="grade" name="grade" className="fatimi-input mt-1" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
              <div><label htmlFor="section" className="text-sm font-medium text-gray-700">Section</label><input id="section" name="section" className="fatimi-input mt-1" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="subject" className="text-sm font-medium text-gray-700">Subject</label><input id="subject" name="subject" className="fatimi-input mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              <div><label htmlFor="roomNumber" className="text-sm font-medium text-gray-700">Room Number</label><input id="roomNumber" name="roomNumber" className="fatimi-input mt-1" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} /></div>
            </div>
            <div><label htmlFor="teacherId" className="text-sm font-medium text-gray-700">Teacher</label>
              <select id="teacherId" name="teacherId" className="fatimi-input mt-1" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">Select teacher...</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </div>
            <div><label htmlFor="masoolId" className="text-sm font-medium text-gray-700">Masool (مسؤول) <span className="text-gray-400 font-normal">— in-charge, optional</span></label>
              <select id="masoolId" name="masoolId" className="fatimi-input mt-1" value={form.masoolId} onChange={(e) => setForm({ ...form, masoolId: e.target.value })}>
                <option value="">None</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </div>
            <div><label htmlFor="academicYear" className="text-sm font-medium text-gray-700">Academic Year</label><input id="academicYear" name="academicYear" className="fatimi-input mt-1" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
          </div>
          <ModalFooter>
            <ModalClose asChild><Button variant="outline" size="sm" className="border-emerald-200/60">Cancel</Button></ModalClose>
            <Button size="sm" className="fatimi-emerald-gradient text-white hover:opacity-90" onClick={handleCreate} disabled={saving || !form.name || !form.grade || !form.subject || !form.teacherId}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Create Class
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Manage Class Modal */}
      <Modal open={Boolean(managing)} onOpenChange={(open) => { if (!open) closeManage(); }}>
        <ModalContent className="max-w-3xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl fatimi-gold-accent flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span>{managing?.name}</span>
              <span className="text-xs font-normal text-gray-400">Grade {managing?.grade}{managing?.section}</span>
            </ModalTitle>
          </ModalHeader>

          {/* Tabs */}
          <div className="flex gap-1.5 mt-2 border-b border-gray-100 pb-3">
            {([
              { key: "students", label: "Students", icon: Users, count: roster.length },
              { key: "details", label: "Details", icon: Pencil, count: null },
              { key: "timetable", label: "Timetable", icon: Calendar, count: slots.length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-emerald-50 text-[#047857] border border-emerald-200/70 shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 border border-transparent"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-[#047857] text-white" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : activeTab === "students" ? (
              /* ── Students / Roster ── */
              <div className="space-y-6">
                {/* Enrolled roster */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#047857]" /> Enrolled Talabat ({roster.length})
                  </h4>
                  {roster.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-6 text-center">No talabat in this class yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {roster.map((s: any) => (
                        <div key={s.studentProfileId} className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-100/70 hover:bg-emerald-50/40 transition-colors">
                          <Avatar className="w-9 h-9 border-2" style={{ borderColor: "#d4af37" }}>
                            {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt={`${s.firstName} ${s.lastName}`} />}
                            <AvatarFallback className="bg-gradient-to-br from-[#047857] to-[#064e3b] text-xs font-bold" style={{ color: "#d4af37" }}>{getInitials(s.firstName, s.lastName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-gray-500">ITS {s.studentId} &bull; {s.status || "—"}</p>
                          </div>
                          {!s.isActive && <Badge variant="secondary" className="text-[9px]">Inactive</Badge>}
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeStudent(s.studentProfileId)} disabled={busy}>
                            <UserMinus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add talabat */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-[#047857]" /> Add Talabat
                  </h4>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#047857]/50" />
                    <input
                      type="text"
                      placeholder="Search by name or ITS..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-emerald-200/60 bg-white text-sm focus:border-[#d4af37]/60 focus:ring-2 focus:ring-[#d4af37]/20 outline-none transition-all"
                    />
                  </div>
                  {availableFiltered.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-4 text-center">No talabat available{rosterSearch ? " matching your search" : ""}.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {availableFiltered.slice(0, 60).map((s: any) => (
                        <div key={s.studentProfileId} className="flex items-center gap-3 p-2 rounded-xl border border-gray-100 hover:border-emerald-200/70 hover:bg-emerald-50/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{s.firstName} {s.lastName}</p>
                            <p className="text-[11px] text-gray-400">ITS {s.studentId} &bull; Grade {s.grade}{s.section}</p>
                          </div>
                          <Button size="sm" variant="outline" className="border-emerald-200/60 text-[#047857] hover:bg-emerald-50" onClick={() => addStudent(s.studentProfileId)} disabled={busy}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add
                          </Button>
                        </div>
                      ))}
                      {availableFiltered.length > 60 && <p className="text-xs text-gray-400 text-center py-1">Showing 60 of {availableFiltered.length} — refine your search</p>}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "details" ? (
              /* ── Details / Edit ── */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Class Name</label><input id="edit-name" className="fatimi-input mt-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                  <div><label htmlFor="edit-subject" className="text-sm font-medium text-gray-700">Subject</label><input id="edit-subject" className="fatimi-input mt-1" value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label htmlFor="edit-grade" className="text-sm font-medium text-gray-700">Grade</label><input id="edit-grade" className="fatimi-input mt-1" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} /></div>
                  <div><label htmlFor="edit-section" className="text-sm font-medium text-gray-700">Section</label><input id="edit-section" className="fatimi-input mt-1" value={editForm.section} onChange={(e) => setEditForm({ ...editForm, section: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label htmlFor="edit-room" className="text-sm font-medium text-gray-700">Room Number</label><input id="edit-room" className="fatimi-input mt-1" value={editForm.roomNumber} onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })} /></div>
                  <div><label htmlFor="edit-year" className="text-sm font-medium text-gray-700">Academic Year</label><input id="edit-year" className="fatimi-input mt-1" value={editForm.academicYear} onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })} /></div>
                </div>
                <div><label htmlFor="edit-teacher" className="text-sm font-medium text-gray-700">Teacher</label>
                  <select id="edit-teacher" className="fatimi-input mt-1" value={editForm.teacherId} onChange={(e) => setEditForm({ ...editForm, teacherId: e.target.value })}>
                    <option value="">Select teacher...</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
                <div><label htmlFor="edit-masool" className="text-sm font-medium text-gray-700">Masool (مسؤول) <span className="text-gray-400 font-normal">— in-charge, optional</span></label>
                  <select id="edit-masool" className="fatimi-input mt-1" value={editForm.masoolId} onChange={(e) => setEditForm({ ...editForm, masoolId: e.target.value })}>
                    <option value="">None</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-emerald-300 text-[#047857] focus:ring-[#d4af37]/40"
                  />
                  Active class (scans record attendance)
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <Button className="fatimi-emerald-gradient text-white hover:opacity-90 shadow-md" onClick={handleUpdate} disabled={busy || !editForm.name || !editForm.grade || !editForm.subject}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />} Save Changes
                  </Button>
                </div>

                {/* Danger zone */}
                <div className="border border-red-200/70 bg-red-50/50 rounded-2xl p-4 mt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Delete Class</p>
                        <p className="text-xs text-red-500 mt-0.5">Removes the class, its enrollments and timetable. Blocked if attendance or point history exists — mark inactive instead.</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-100 flex-shrink-0" onClick={handleDelete} disabled={busy}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Timetable ── */
              <div className="space-y-5">
                {/* Slot form */}
                <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/30 p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#047857]" /> {editingSlotId ? "Edit Slot" : "Add Slot"}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Day</label>
                      <select className="fatimi-input mt-0.5" value={slotForm.dayOfWeek} onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: Number(e.target.value) })}>
                        {WEEK_DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Period</label>
                      <input type="number" min={1} className="fatimi-input mt-0.5" value={slotForm.period} onChange={(e) => setSlotForm({ ...slotForm, period: Number(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Start</label>
                      <input type="time" className="fatimi-input mt-0.5" value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">End</label>
                      <input type="time" className="fatimi-input mt-0.5" value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-gray-600">Subject</label>
                      <input className="fatimi-input mt-0.5" placeholder={slotForm.isBreak ? "Break slot — no subject" : "e.g. Quran Studies"} value={slotForm.isBreak ? "" : slotForm.subject} disabled={slotForm.isBreak} onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Room</label>
                      <input className="fatimi-input mt-0.5" value={slotForm.roomNumber} onChange={(e) => setSlotForm({ ...slotForm, roomNumber: e.target.value })} />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-600 pb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slotForm.isBreak}
                          onChange={(e) => setSlotForm({ ...slotForm, isBreak: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-emerald-300 text-[#047857]"
                        />
                        Break slot
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" className="fatimi-emerald-gradient text-white hover:opacity-90 shadow-md" onClick={saveSlot} disabled={busy || !slotForm.startTime || !slotForm.endTime}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      {editingSlotId ? "Save Slot" : "Add Slot"}
                    </Button>
                    {editingSlotId && (
                      <Button size="sm" variant="outline" className="border-emerald-200/60" onClick={() => { setEditingSlotId(null); setSlotForm(emptySlotForm); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Weekly grid */}
                {WEEK_DAYS.map((day) => {
                  const daySlots = slots.filter((s: Slot) => s.dayOfWeek === day).sort((a: Slot, b: Slot) => a.period - b.period);
                  return (
                    <div key={day} className="rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-4 py-2 bg-emerald-50/60 border-b border-emerald-100/70 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#047857]">{DAY_LABELS[day]}</span>
                        <span className="text-[11px] text-gray-400">{daySlots.length} slot{daySlots.length === 1 ? "" : "s"}</span>
                      </div>
                      {daySlots.length === 0 ? (
                        <p className="text-xs text-gray-400 px-4 py-3">No slots scheduled</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {daySlots.map((s: Slot) => (
                            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                              <Badge variant={s.isBreak ? "secondary" : "outline"} className="text-[10px] w-14 justify-center shrink-0">
                                P{s.period}
                              </Badge>
                              <Clock className={`w-3.5 h-3.5 shrink-0 ${s.isBreak ? "text-gray-400" : "text-emerald-500"}`} />
                              <span className="text-sm text-gray-700 tabular-nums">{s.startTime}–{s.endTime}</span>
                              <span className="text-sm text-gray-800 font-medium truncate flex-1">
                                {s.isBreak ? (s.breakName || "Break") : s.subject}
                              </span>
                              {s.roomNumber && <span className="text-[11px] text-gray-400 flex items-center gap-0.5 shrink-0"><MapPin className="w-3 h-3" /> {s.roomNumber}</span>}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-[#047857] hover:bg-emerald-50" onClick={() => editSlot(s)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteSlot(s.id)} disabled={busy}>
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
            )}
          </div>

          <ModalFooter>
            <ModalClose asChild><Button variant="outline" size="sm" className="border-emerald-200/60">Close</Button></ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
