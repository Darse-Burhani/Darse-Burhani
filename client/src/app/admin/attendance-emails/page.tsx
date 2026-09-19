"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Send,
  AlertTriangle,
  XCircle,
  Users,
  Search,
  Loader2,
  X,
  GraduationCap,
  Briefcase,
  BellRing,
  Layers,
  Clock,
  Fingerprint,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";


interface StudentSummary {
  id: string;
  userId: string;
  studentId: string;
  its: string;
  name: string;
  nameAr?: string | null;
  grade: string;
  section: string;
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  earlyDepartureCount: number;
  attendanceRate: number;
  parentEmails: string[];
  hasParentEmail: boolean;
  studentEmail?: string;
}

interface TeacherSummary {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  subjects: string[];
  totalClasses: number;
  status: "PRESENT" | "ABSENT";
  attendanceRate: number;
  absentDays: number;
}

interface SummaryResponse {
  periodType: "WEEKLY" | "MONTHLY";
  periodLabel: string;
  startDate: string;
  endDate: string;
  stats: {
    totalStudents: number;
    withParentEmail: number;
    withoutParentEmail: number;
    averageAttendanceRate: number;
  };
  students: StudentSummary[];
}

export default function AdminAttendanceEmailsPage() {
  // Bifurcation: Student vs Teacher
  const [activeRoleTab, setActiveRoleTab] = useState<"STUDENTS" | "TEACHERS">("STUDENTS");

  const [periodType, setPeriodType] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [weekPreset, setWeekPreset] = useState<"THIS_WEEK" | "LAST_WEEK" | "CUSTOM">("THIS_WEEK");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);

  // Teachers data
  const [teachersData, setTeachersData] = useState<TeacherSummary[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [emailFilter, setEmailFilter] = useState<"ALL" | "HAS_EMAIL" | "MISSING_EMAIL">("ALL");
  const [healthFilter, setEmailHealthFilter] = useState<"ALL" | "EXCELLENT" | "ATTENTION" | "CRITICAL">("ALL");

  // Direct Absent Email Modal State
  const [absentModalTarget, setAbsentModalTarget] = useState<{
    type: "STUDENT" | "TEACHER";
    id: string;
    name: string;
    email: string;
    details: string;
  } | null>(null);
  const [absentReasonNote, setAbsentReasonNote] = useState("");
  const [sendingDirectAbsent, setSendingDirectAbsent] = useState(false);

  // Fetch summary data
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("periodType", periodType);

      if (periodType === "WEEKLY") {
        if (weekPreset === "LAST_WEEK") {
          const now = new Date();
          const end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
          params.set("startDate", start.toISOString().slice(0, 10));
          params.set("endDate", end.toISOString().slice(0, 10));
        } else if (weekPreset === "CUSTOM" && customStartDate && customEndDate) {
          params.set("startDate", customStartDate);
          params.set("endDate", customEndDate);
        }
      } else {
        params.set("month", String(selectedMonth));
        params.set("year", String(selectedYear));
      }

      const res = await fetch(`/api/admin/attendance/email-reports/summary?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      toast({ title: "Failed to load student reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [periodType, weekPreset, customStartDate, customEndDate, selectedMonth, selectedYear]);

  // Fetch teacher data
  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    try {
      const res = await fetch("/api/admin/attendance/email-reports/teachers-summary");
      const json = await res.json();
      if (json.success && json.data) {
        setTeachersData(json.data.teachers || []);
      }
    } catch {
      toast({ title: "Failed to load teacher summary", variant: "destructive" });
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchTeachers();
  }, [fetchSummary, fetchTeachers]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter((s) => {
      if (selectedGrade !== "ALL" && s.grade !== selectedGrade) return false;
      if (emailFilter === "HAS_EMAIL" && !s.hasParentEmail) return false;
      if (emailFilter === "MISSING_EMAIL" && s.hasParentEmail) return false;

      if (healthFilter === "EXCELLENT" && s.attendanceRate < 90) return false;
      if (healthFilter === "ATTENTION" && (s.attendanceRate < 75 || s.attendanceRate >= 90)) return false;
      if (healthFilter === "CRITICAL" && s.attendanceRate >= 75) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesIts = s.its?.toLowerCase().includes(q);
        const matchesStudentId = s.studentId?.toLowerCase().includes(q);
        if (!matchesName && !matchesIts && !matchesStudentId) return false;
      }
      return true;
    });
  }, [data, selectedGrade, emailFilter, healthFilter, searchQuery]);

  // Filtered Teachers
  const filteredTeachers = useMemo(() => {
    return teachersData.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.employeeId.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [teachersData, searchQuery]);

  // Send Direct Absent Email
  const handleSendDirectAbsent = async () => {
    if (!absentModalTarget) return;
    setSendingDirectAbsent(true);
    try {
      const endpoint =
        absentModalTarget.type === "STUDENT"
          ? "/api/admin/attendance/email-reports/send-absent-student"
          : "/api/admin/attendance/email-reports/send-absent-teacher";

      const payload =
        absentModalTarget.type === "STUDENT"
          ? { studentId: absentModalTarget.id, reason: absentReasonNote }
          : { teacherId: absentModalTarget.id, reason: absentReasonNote };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Absent Alert Dispatched",
          description: `Direct notice sent to ${absentModalTarget.name}`,
          variant: "success",
        });
        setAbsentModalTarget(null);
        setAbsentReasonNote("");
      } else {
        toast({ title: json.error || "Failed to send absent alert", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send absent alert", variant: "destructive" });
    } finally {
      setSendingDirectAbsent(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometrics"
        hubDescription="Real-time terminal monitoring, daily scan windows, class schedules, and automated email reporting."
        tabs={[
          { label: "Live Scans & Attendance Logs", href: "/admin/attendance-logs", icon: Layers },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Live Feeds & Terminals", href: "/admin/biometric", icon: Fingerprint },
          { label: "Email Reports to Parents", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Mail className="w-7 h-7 text-[#d4af37]" />
            Attendance Notifications & Direct Alerts
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Bifurcated attendance dispatch for Talabat (Students) and Faculty (Teachers) with direct absence email dispatch.
          </p>
        </div>

        {/* Bifurcation Toggle */}
        <div className="flex items-center p-1 rounded-2xl bg-white border border-[#d4af37]/40 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveRoleTab("STUDENTS")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeRoleTab === "STUDENTS"
                ? "bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-white shadow-md"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Talabat (Students)
          </button>
          <button
            type="button"
            onClick={() => setActiveRoleTab("TEACHERS")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeRoleTab === "TEACHERS"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-800 text-white shadow-md"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Faculty (Teachers)
          </button>
        </div>
      </motion.div>

      {/* Search Bar & Quick Stats */}
      <Card className="fatimi-card">
        <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeRoleTab === "STUDENTS" ? "Search by student name or ITS..." : "Search by teacher name or department..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-gray-600">
            {activeRoleTab === "STUDENTS" ? (
              <>
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  {filteredStudents.length} Students Listed
                </span>
                <span className="flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {filteredStudents.filter((s) => s.absentCount > 0).length} with Absences
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  {filteredTeachers.length} Faculty Members
                </span>
                <span className="flex items-center gap-1.5 text-red-600">
                  <XCircle className="w-4 h-4" />
                  {filteredTeachers.filter((t) => t.status === "ABSENT").length} Absent Today
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student View */}
      {activeRoleTab === "STUDENTS" && (
        <Card className="fatimi-card shadow-lg">
          <div className="fatimi-card-header" />
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-gray-900">
              <GraduationCap className="w-5 h-5 text-[#b8860b]" />
              Talabat — Direct Absent Notification Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <p className="text-sm">No students found matching your criteria.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fdfbf5] text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-[#d4af37]/20">
                    <tr>
                      <th className="py-3.5 px-4">Talabat / ITS</th>
                      <th className="py-3.5 px-4">Grade & Sec</th>
                      <th className="py-3.5 px-4">Attendance Rate</th>
                      <th className="py-3.5 px-4">Absences</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          <div>{student.name}</div>
                          <div className="text-xs text-gray-500 font-normal">ITS: {student.its || "—"}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          Grade {student.grade}-{student.section}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              student.attendanceRate >= 90
                                ? "bg-emerald-100 text-emerald-800"
                                : student.attendanceRate >= 75
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {student.attendanceRate}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-700 font-semibold">
                          {student.absentCount > 0 ? (
                            <span className="text-red-600 font-bold">{student.absentCount} Absent</span>
                          ) : (
                            <span className="text-emerald-600">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAbsentModalTarget({
                                type: "STUDENT",
                                id: student.id,
                                name: student.name,
                                email: student.studentEmail || "Parent / Student Email",
                                details: `Grade ${student.grade}-${student.section} · ITS: ${student.its || "N/A"}`,
                              })
                            }
                            className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
                          >
                            <BellRing className="w-3.5 h-3.5 mr-1" />
                            Send Absent Alert
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teacher View */}
      {activeRoleTab === "TEACHERS" && (
        <Card className="fatimi-card shadow-lg">
          <div className="fatimi-card-header" />
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-gray-900">
              <Briefcase className="w-5 h-5 text-emerald-700" />
              Faculty Members & Direct Absence Alert Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingTeachers ? (
              <div className="py-16 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <p className="text-sm">No faculty members found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fdfbf5] text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-[#d4af37]/20">
                    <tr>
                      <th className="py-3.5 px-4">Faculty Member</th>
                      <th className="py-3.5 px-4">Employee ID</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4">Status Today</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          <div>{teacher.name}</div>
                          <div className="text-xs text-gray-500 font-normal">{teacher.email}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{teacher.employeeId || "—"}</td>
                        <td className="py-3 px-4 text-gray-700">{teacher.department}</td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              teacher.status === "PRESENT"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {teacher.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAbsentModalTarget({
                                type: "TEACHER",
                                id: teacher.id,
                                name: teacher.name,
                                email: teacher.email,
                                details: `${teacher.department} · ID: ${teacher.employeeId}`,
                              })
                            }
                            className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
                          >
                            <BellRing className="w-3.5 h-3.5 mr-1" />
                            Send Teacher Absent Notice
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Direct Absent Dispatch Modal */}
      <AnimatePresence>
        {absentModalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAbsentModalTarget(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-red-200"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-100 text-red-700">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      Send Instant Absence Notice
                    </h3>
                    <p className="text-xs text-gray-500">
                      {absentModalTarget.type === "STUDENT" ? "Dispatch to Student & Parents" : "Dispatch to Faculty Member"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAbsentModalTarget(null)}
                  className="text-gray-500 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="my-4 p-3 rounded-xl bg-red-50/70 border border-red-200 text-xs space-y-1">
                <p className="font-bold text-red-900">Recipient: {absentModalTarget.name}</p>
                <p className="text-red-700">{absentModalTarget.details}</p>
                <p className="text-red-600 font-mono">{absentModalTarget.email}</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Optional Note from Administration
                </label>
                <textarea
                  rows={3}
                  value={absentReasonNote}
                  onChange={(e) => setAbsentReasonNote(e.target.value)}
                  placeholder="e.g. Please submit a doctor note or formal leave justification..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAbsentModalTarget(null)}
                  disabled={sendingDirectAbsent}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendDirectAbsent}
                  disabled={sendingDirectAbsent}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {sendingDirectAbsent ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1.5" /> Dispatch Alert Now
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
