"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Users, Search, Loader2, Trash2, GraduationCap, Phone, Mail, MapPin, Droplet, CalendarDays, BookMarked, Pencil, Save, User, Power, Camera, Sparkles, BookOpen, Award, Heart, UserCheck, KeyRound } from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter, ModalClose } from "@/components/ui/modal";
import { getInitials } from "@/lib/utils";

interface StudentRecord {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  avatarUrl: string | null;
  studentId: string;
  its: string | null;
  trNo: string | null;
  grade: string;
  section: string;
  status: string | null;
  bloodGroup: string | null;
  dobGregorian: string | null;
  dobHijri: string | null;
  hafizYear: string | null;
  motherName: string | null;
  fatherName: string | null;
  fatherOccupation: string | null;
  age: number | null;
  fatherEmail: string | null;
  motherEmail: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  admissionYear: string | null;
  currentYear: string | null;
  darsId: string | null;
  externalSchooling: string | null;
  watan: string | null;
  residentCity: string | null;
  address: string | null;
  mobileNumber: string | null;
  currentPoints: number;
  totalPoints: number;
  tier: string;
  streakDays: number;
  counts: { pointLogs: number; attendanceRecords: number };
}

const tierColors: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-700",
  SILVER: "bg-gray-100 text-gray-600",
  GOLD: "bg-yellow-100 text-yellow-700",
  PLATINUM: "bg-indigo-100 text-indigo-700",
  DIAMOND: "bg-cyan-100 text-cyan-700",
};

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "HAFIZ" | "SANAH">("ALL");
  const [deleting, setDeleting] = useState<StudentRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const openEdit = (s: StudentRecord) => {
    setEditSaved(false);
    setEditing(s);
    setAvatarUrl(s.avatarUrl);
    setEditForm({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      its: s.its || "",
      trNo: s.trNo || "",
      grade: s.grade,
      section: s.section,
      status: s.status || "",
      bloodGroup: s.bloodGroup || "",
      dobGregorian: s.dobGregorian ? (typeof s.dobGregorian === "string" ? s.dobGregorian.slice(0, 10) : "") : "",
      dobHijri: s.dobHijri || "",
      hafizYear: s.hafizYear || "",
      motherName: s.motherName || "",
      fatherName: s.fatherName || "",
      fatherOccupation: s.fatherOccupation || "",
      age: s.age?.toString() || "",
      fatherEmail: s.fatherEmail || "",
      motherEmail: s.motherEmail || "",
      fatherPhone: s.fatherPhone || "",
      motherPhone: s.motherPhone || "",
      admissionYear: s.admissionYear || "",
      currentYear: s.currentYear || "",
      darsId: s.darsId || "",
      externalSchooling: s.externalSchooling || "",
      watan: s.watan || "",
      residentCity: s.residentCity || "",
      address: s.address || "",
      mobileNumber: s.mobileNumber || "",
    });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setEditSaving(true);
    setEditSaved(false);
    try {
      const res = await fetch(`/api/admin/students/${editing.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, avatarUrl, isActive: editing.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        setEditSaved(true);
        await loadStudents();
        setTimeout(() => setEditing(null), 1200);
      } else {
        alert(json.error || "Failed to update student");
      }
    } catch {
      alert("Failed to update student");
    } finally {
      setEditSaving(false);
    }
  };

  const setField = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file || !editing) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/students/${editing.userId}/avatar`, { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) {
        setAvatarUrl(json.url);
        await loadStudents();
      } else {
        alert(json.error || "Failed to upload photo");
      }
    } catch {
      alert("Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleToggleActive = async (s: StudentRecord) => {
    try {
      const res = await fetch(`/api/admin/students/${s.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        setStudents((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)));
      } else {
        alert(json.error || "Failed to update status");
      }
    } catch {
      alert("Failed to update status");
    }
  };

  const loadStudents = async () => {
    try {
      const res = await fetch("/api/admin/students");
      const json = await res.json();
      if (json.success) setStudents(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const grades = useMemo(() => {
    const set = new Set(students.map((s) => `${s.grade}${s.section}`));
    return Array.from(set).sort();
  }, [students]);

  const hafizCount = useMemo(() => students.filter((s) => s.status === "HAFIZ").length, [students]);
  const sanahCount = useMemo(() => students.filter((s) => s.status !== "HAFIZ").length, [students]);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      `${s.firstName} ${s.lastName} ${s.its || ""} ${s.trNo || ""} ${s.studentId} ${s.watan || ""}`
        .toLowerCase()
        .includes(q);
    const matchGrade = gradeFilter === "ALL" || `${s.grade}${s.section}` === gradeFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "HAFIZ" && s.status === "HAFIZ") ||
      (statusFilter === "SANAH" && s.status !== "HAFIZ");
    return matchSearch && matchGrade && matchStatus;
  });

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${deleting.userId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setStudents((prev) => prev.filter((s) => s.id !== deleting.id));
        setDeleting(null);
      } else {
        alert(json.error || "Failed to delete student");
      }
    } catch {
      alert("Failed to delete student");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── People & Directory Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, student profiles, parent directory, and portal permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: UserCheck },
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
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Talabat</h1>
                <p className="text-emerald-100 text-sm mt-1">{students.length} total talabat enrolled</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/25 text-amber-100 border border-amber-300/40 shadow-sm backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                {hafizCount} Hafiz
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 shadow-sm backdrop-blur-sm">
                <BookOpen className="w-3.5 h-3.5 text-emerald-200" />
                {sanahCount} Sanah
              </span>
              <Badge className="bg-white/10 text-white border-white/20">{filtered.length} shown</Badge>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#047857]/50" />
          <input
            type="text"
            id="student-search"
            name="student-search"
            placeholder="Search by name, ITS, TR No., watan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-emerald-200/60 bg-white text-sm focus:border-[#d4af37]/60 focus:ring-2 focus:ring-[#d4af37]/20 outline-none transition-all shadow-sm"
          />
        </div>

        {/* Status Filter Toggle */}
        <div className="flex items-center gap-1.5 bg-emerald-50/70 p-1 rounded-xl border border-emerald-100 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "ALL"
                ? "bg-white text-gray-900 shadow-sm border border-emerald-200/60"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("HAFIZ")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "HAFIZ"
                ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-sm shadow-amber-300/40 border border-amber-300"
                : "text-amber-800 hover:bg-amber-100/50"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Hafiz ({hafizCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("SANAH")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "SANAH"
                ? "bg-[#047857] text-white shadow-sm shadow-emerald-700/20 border border-emerald-600"
                : "text-emerald-800 hover:bg-emerald-100/50"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Sanah ({sanahCount})
          </button>
        </div>

        {/* Grade Filters */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={gradeFilter === "ALL" ? "default" : "outline"}
            size="sm"
            className={gradeFilter === "ALL" ? "fatimi-emerald-gradient text-white text-xs h-8" : "border-emerald-200/60 text-gray-600 hover:bg-emerald-50 text-xs h-8"}
            onClick={() => setGradeFilter("ALL")}
          >
            All Grades
          </Button>
          {grades.map((g) => (
            <Button
              key={g}
              variant={gradeFilter === g ? "default" : "outline"}
              size="sm"
              className={gradeFilter === g ? "fatimi-emerald-gradient text-white text-xs h-8" : "border-emerald-200/60 text-gray-600 hover:bg-emerald-50 text-xs h-8"}
              onClick={() => setGradeFilter(g)}
            >
              Grade {g}
            </Button>
          ))}
        </div>
      </div>

      {/* Talabat Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="fatimi-card animate-pulse">
              <div className="fatimi-card-header" />
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2"><div className="w-32 h-4 bg-gray-200 rounded" /><div className="w-24 h-3 bg-gray-200 rounded" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s, i) => {
            const isHafiz = s.status === "HAFIZ";
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className={`hover:shadow-lg transition-all duration-300 overflow-hidden ${
                  isHafiz
                    ? "border-amber-300/80 ring-1 ring-amber-400/25 bg-gradient-to-b from-amber-50/20 via-white to-amber-50/10 shadow-sm"
                    : "border-emerald-100/90 bg-white hover:border-emerald-300/80 shadow-sm"
                } ${!s.isActive ? "opacity-60" : ""}`}>
                  {/* Decorative top accent line */}
                  <div
                    className="h-1.5 w-full"
                    style={{
                      background: isHafiz
                        ? "linear-gradient(90deg, #d4af37, #f59e0b, #d4af37)"
                        : "linear-gradient(90deg, #047857, #10b981, #047857)"
                    }}
                  />
                  <CardContent className="p-5">
                    {/* Header row: photo + name */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        <Avatar
                          className={`w-16 h-16 border-4 shadow-sm ${isHafiz ? "border-[#d4af37]" : "border-[#047857]"}`}
                        >
                          {s.avatarUrl && (
                            <AvatarImage src={s.avatarUrl} alt={`${s.firstName} ${s.lastName}`} />
                          )}
                          <AvatarFallback className={isHafiz ? "bg-gradient-to-br from-amber-500 to-yellow-600 text-white text-lg font-bold" : "fatimi-emerald-gradient text-white text-lg font-bold"}>
                            {getInitials(s.firstName, s.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        {isHafiz ? (
                          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 border-2 border-white flex items-center justify-center shadow-md" title="Hafiz al-Quran">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </span>
                        ) : (
                          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#047857] border-2 border-white flex items-center justify-center shadow-sm" title="Talabat (Sanah)">
                            <BookOpen className="w-3 h-3 text-emerald-100" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate text-base">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{s.email}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {isHafiz ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-sm border border-amber-300/80">
                              <Sparkles className="w-3 h-3 text-yellow-100" />
                              Hafiz {s.hafizYear ? `(${s.hafizYear})` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-[#047857] border border-emerald-200/80">
                              <BookOpen className="w-3 h-3 text-[#047857]" />
                              Sanah
                            </span>
                          )}
                          <Badge className={`text-[9px] ${tierColors[s.tier] || "bg-gray-100 text-gray-600"}`}>{s.tier}</Badge>
                          {!s.isActive && <Badge variant="destructive" className="text-[9px]">Inactive</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-[#047857] hover:bg-emerald-50" onClick={() => openEdit(s)} title="View / Edit profile">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={s.isActive ? "text-amber-700 hover:text-amber-800 hover:bg-amber-50" : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"}
                          onClick={() => handleToggleActive(s)}
                          title={s.isActive ? "Deactivate profile" : "Activate profile"}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleting(s)} title="Delete profile">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* ID badges */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="text-[10px] bg-emerald-50 text-[#047857] px-2 py-1 rounded-full font-medium border border-emerald-200/60">ITS: {s.its || "—"}</span>
                      {s.trNo && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium border border-amber-200/60">TR: {s.trNo}</span>
                      )}
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium border border-blue-200/60">
                        <GraduationCap className="w-3 h-3 inline mr-0.5" />Grade {s.grade}{s.section}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className={`grid grid-cols-2 gap-2 text-xs rounded-xl p-3 ${isHafiz ? "bg-amber-50/40 border border-amber-100/60" : "bg-emerald-50/40 border border-emerald-100/60"}`}>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Droplet className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>{s.bloodGroup || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <CalendarDays className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{s.dobHijri || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isHafiz ? (
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200/80 truncate">
                            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">Hafiz {s.hafizYear || ""}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Sanah</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{s.watan || s.residentCity || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{s.fatherPhone || s.motherPhone || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                        <span className="truncate">{s.fatherEmail || s.motherEmail || "—"}</span>
                      </div>
                    </div>

                    {/* Footer stats */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-emerald-100/60">
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">{s.currentPoints}</p>
                        <p className="text-[10px] text-gray-400">Points</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">{s.streakDays}</p>
                        <p className="text-[10px] text-gray-400">Streak</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">{s.counts.pointLogs}</p>
                        <p className="text-[10px] text-gray-400">Point Logs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">{s.counts.attendanceRecords}</p>
                        <p className="text-[10px] text-gray-400">Attendance</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <Card className="fatimi-card">
          <CardContent className="p-12 text-center text-gray-400">
            <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-40" />
            No talabat found
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Talabat Profile
            </ModalTitle>
            <ModalDescription>
              This will permanently delete the profile, user account, attendance records, and point logs for <strong>{deleting?.firstName} {deleting?.lastName}</strong>. This action cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <ModalClose asChild><Button variant="outline" size="sm" className="border-emerald-200/60">Cancel</Button></ModalClose>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteBusy} className="bg-red-600 text-white hover:bg-red-700">
              {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Profile
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View / Edit Talabat Profile Modal */}
      <Modal open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl fatimi-emerald-gradient flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              {editing?.firstName} {editing?.lastName}
            </ModalTitle>
            <ModalDescription>View and edit all talabat profile information.</ModalDescription>
          </ModalHeader>

          <div className="space-y-5">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-20 h-20 border-4" style={{ borderColor: "#d4af37" }}>
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={`${editing?.firstName} ${editing?.lastName}`} />}
                  <AvatarFallback className="fatimi-emerald-gradient text-white text-lg font-bold">
                    {getInitials(editing?.firstName || "", editing?.lastName || "")}
                  </AvatarFallback>
                </Avatar>
                {avatarUploading && (
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border-2 border-emerald-200 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-[#047857]" />
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Profile Picture</p>
                <p className="text-xs text-gray-400 mb-2">JPEG, PNG, WebP or GIF up to 5MB</p>
                <input
                  ref={avatarInputRef}
                  id="student-avatar-upload"
                  name="student-avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="border-emerald-200/60 text-gray-600 hover:bg-emerald-50" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
                    {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
                    Upload Photo
                  </Button>
                  {avatarUrl && (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setAvatarUrl(null)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Account Status */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Account Status</p>
              <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200/60 bg-emerald-50/40">
                <div className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${editing?.isActive ? "text-emerald-600" : "text-red-500"}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {editing?.isActive ? "Active" : "Deactivated"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {editing?.isActive ? "This talabat can sign in" : "This talabat cannot sign in"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={editing?.isActive ? "outline" : "default"}
                  className={editing?.isActive ? "border-amber-200/60 text-amber-700 hover:bg-amber-50" : "fatimi-emerald-gradient text-white hover:opacity-90"}
                  onClick={() => {
                    if (editing) {
                      setStudents((prev) => prev.map((x) => (x.id === editing.id ? { ...x, isActive: !x.isActive } : x)));
                      setEditing({ ...editing, isActive: !editing.isActive });
                    }
                  }}
                >
                  <Power className="w-3.5 h-3.5 mr-1" />
                  {editing?.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>

            {/* Identity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Account</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label htmlFor="edit-firstName" className="text-xs font-medium text-gray-600">First Name</label><input id="edit-firstName" name="firstName" className="fatimi-input mt-1" value={editForm.firstName || ""} onChange={setField("firstName")} /></div>
                <div><label htmlFor="edit-lastName" className="text-xs font-medium text-gray-600">Last Name</label><input id="edit-lastName" name="lastName" className="fatimi-input mt-1" value={editForm.lastName || ""} onChange={setField("lastName")} /></div>
                <div><label htmlFor="edit-email" className="text-xs font-medium text-gray-600">Email</label><input id="edit-email" name="email" type="email" className="fatimi-input mt-1" value={editForm.email || ""} onChange={setField("email")} /></div>
              </div>
            </div>

            {/* IDs & Academic */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">IDs & Academic</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label htmlFor="edit-its" className="text-xs font-medium text-gray-600">ITS No.</label><input id="edit-its" name="its" className="fatimi-input mt-1" value={editForm.its || ""} onChange={setField("its")} /></div>
                <div><label htmlFor="edit-trNo" className="text-xs font-medium text-gray-600">TR No.</label><input id="edit-trNo" name="trNo" className="fatimi-input mt-1" value={editForm.trNo || ""} onChange={setField("trNo")} /></div>
                <div><label htmlFor="edit-grade" className="text-xs font-medium text-gray-600">Grade</label><input id="edit-grade" name="grade" className="fatimi-input mt-1" value={editForm.grade || ""} onChange={setField("grade")} /></div>
                <div><label htmlFor="edit-section" className="text-xs font-medium text-gray-600">Section</label><input id="edit-section" name="section" className="fatimi-input mt-1" value={editForm.section || ""} onChange={setField("section")} /></div>
                <div><label htmlFor="edit-admissionYear" className="text-xs font-medium text-gray-600">Admission Year</label><input id="edit-admissionYear" name="admissionYear" className="fatimi-input mt-1" value={editForm.admissionYear || ""} onChange={setField("admissionYear")} /></div>
                <div><label htmlFor="edit-currentYear" className="text-xs font-medium text-gray-600">Current Year</label><input id="edit-currentYear" name="currentYear" className="fatimi-input mt-1" value={editForm.currentYear || ""} onChange={setField("currentYear")} /></div>
                <div><label htmlFor="edit-darsId" className="text-xs font-medium text-gray-600">Dars ID</label><input id="edit-darsId" name="darsId" className="fatimi-input mt-1" value={editForm.darsId || ""} onChange={setField("darsId")} /></div>
                <div className="md:col-span-2"><label htmlFor="edit-externalSchooling" className="text-xs font-medium text-gray-600">External Schooling</label><input id="edit-externalSchooling" name="externalSchooling" className="fatimi-input mt-1" value={editForm.externalSchooling || ""} onChange={setField("externalSchooling")} /></div>
              </div>
            </div>

            {/* Personal */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Personal Information</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label htmlFor="edit-motherName" className="text-xs font-medium text-gray-600">Mother&apos;s Name</label><input id="edit-motherName" name="motherName" className="fatimi-input mt-1" value={editForm.motherName || ""} onChange={setField("motherName")} /></div>
                <div><label htmlFor="edit-fatherName" className="text-xs font-medium text-gray-600">Father&apos;s Name</label><input id="edit-fatherName" name="fatherName" className="fatimi-input mt-1" value={editForm.fatherName || ""} onChange={setField("fatherName")} /></div>
                <div><label htmlFor="edit-fatherOccupation" className="text-xs font-medium text-gray-600">Father&apos;s Occupation</label><input id="edit-fatherOccupation" name="fatherOccupation" className="fatimi-input mt-1" value={editForm.fatherOccupation || ""} onChange={setField("fatherOccupation")} /></div>
                <div><label htmlFor="edit-age" className="text-xs font-medium text-gray-600">Age</label><input id="edit-age" name="age" type="number" className="fatimi-input mt-1" value={editForm.age || ""} onChange={setField("age")} /></div>
                <div><label htmlFor="edit-status" className="text-xs font-medium text-gray-600">Status</label>
                  <select id="edit-status" name="status" className="fatimi-input mt-1" value={editForm.status || ""} onChange={setField("status")}>
                    <option value="">Select status</option>
                    <option value="HAFIZ">Hafiz</option>
                    <option value="SANAH">Sanah</option>
                  </select>
                </div>
                <div><label htmlFor="edit-bloodGroup" className="text-xs font-medium text-gray-600">Blood Group</label><input id="edit-bloodGroup" name="bloodGroup" className="fatimi-input mt-1" value={editForm.bloodGroup || ""} onChange={setField("bloodGroup")} /></div>
                <div><label htmlFor="edit-dobGregorian" className="text-xs font-medium text-gray-600">DOB (Gregorian)</label><input id="edit-dobGregorian" name="dobGregorian" type="date" className="fatimi-input mt-1" value={editForm.dobGregorian || ""} onChange={setField("dobGregorian")} /></div>
                <div><label htmlFor="edit-dobHijri" className="text-xs font-medium text-gray-600">DOB (Hijri)</label><input id="edit-dobHijri" name="dobHijri" className="fatimi-input mt-1" value={editForm.dobHijri || ""} onChange={setField("dobHijri")} /></div>
                <div><label htmlFor="edit-hafizYear" className="text-xs font-medium text-gray-600">Hafiz Year (Hijri)</label><input id="edit-hafizYear" name="hafizYear" className="fatimi-input mt-1" value={editForm.hafizYear || ""} onChange={setField("hafizYear")} /></div>
              </div>
            </div>

            {/* Parent Contact */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Parent Contact</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label htmlFor="edit-fatherPhone" className="text-xs font-medium text-gray-600">Father&apos;s Phone</label><input id="edit-fatherPhone" name="fatherPhone" className="fatimi-input mt-1" value={editForm.fatherPhone || ""} onChange={setField("fatherPhone")} /></div>
                <div><label htmlFor="edit-motherPhone" className="text-xs font-medium text-gray-600">Mother&apos;s Phone</label><input id="edit-motherPhone" name="motherPhone" className="fatimi-input mt-1" value={editForm.motherPhone || ""} onChange={setField("motherPhone")} /></div>
                <div><label htmlFor="edit-fatherEmail" className="text-xs font-medium text-gray-600">Father&apos;s Email</label><input id="edit-fatherEmail" name="fatherEmail" className="fatimi-input mt-1" value={editForm.fatherEmail || ""} onChange={setField("fatherEmail")} /></div>
                <div><label htmlFor="edit-motherEmail" className="text-xs font-medium text-gray-600">Mother&apos;s Email</label><input id="edit-motherEmail" name="motherEmail" className="fatimi-input mt-1" value={editForm.motherEmail || ""} onChange={setField("motherEmail")} /></div>
              </div>
            </div>

            {/* Contact & Location */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Contact & Location</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label htmlFor="edit-watan" className="text-xs font-medium text-gray-600">Watan</label><input id="edit-watan" name="watan" className="fatimi-input mt-1" value={editForm.watan || ""} onChange={setField("watan")} /></div>
                <div><label htmlFor="edit-residentCity" className="text-xs font-medium text-gray-600">Resident City</label><input id="edit-residentCity" name="residentCity" className="fatimi-input mt-1" value={editForm.residentCity || ""} onChange={setField("residentCity")} /></div>
                <div className="md:col-span-2"><label htmlFor="edit-address" className="text-xs font-medium text-gray-600">Address</label><textarea id="edit-address" name="address" rows={2} className="fatimi-input mt-1" value={editForm.address || ""} onChange={setField("address")} /></div>
                <div><label htmlFor="edit-mobileNumber" className="text-xs font-medium text-gray-600">Mobile Number</label><input id="edit-mobileNumber" name="mobileNumber" className="fatimi-input mt-1" value={editForm.mobileNumber || ""} onChange={setField("mobileNumber")} /></div>
              </div>
            </div>
          </div>

          <ModalFooter>
            {editSaved && (
              <span className="text-sm text-[#047857] flex items-center gap-1 mr-auto">
                <Save className="w-4 h-4" /> Saved successfully!
              </span>
            )}
            <ModalClose asChild><Button variant="outline" size="sm" className="border-emerald-200/60">Cancel</Button></ModalClose>
            <Button size="sm" className="fatimi-emerald-gradient text-white hover:opacity-90" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
