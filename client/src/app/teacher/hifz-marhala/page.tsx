"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Edit3,
  Eye,
  Filter,
  Award,
  Target,
  Users,
  BarChart3,
  GitBranch,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import TeacherHifzMarhalaReportForm from "@/components/teacher/HifzMarhalaReportForm";
import MarhalaFlowMap from "@/components/hifz/MarhalaFlowMap";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MARHALA_LABELS: Record<string, string> = {
  MARHALA_1: "Marhala 1 · Juz 1-6",
  MARHALA_2: "Marhala 2 · Juz 7-12",
  MARHALA_3: "Marhala 3 · Juz 13-18",
  MARHALA_4: "Marhala 4 · Juz 19-24",
  MARHALA_5: "Marhala 5 · Juz 25-30",
};

const MARHALA_ORDER = ["MARHALA_1", "MARHALA_2", "MARHALA_3", "MARHALA_4", "MARHALA_5"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  SUBMITTED: { label: "Submitted", color: "text-blue-700", bgColor: "bg-blue-100" },
  REVIEWED: { label: "Reviewed", color: "text-amber-700", bgColor: "bg-amber-100" },
  APPROVED: { label: "Approved", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  REJECTED: { label: "Rejected", color: "text-red-700", bgColor: "bg-red-100" },
};

function ProgressRing({ progress, size = 70, strokeWidth = 5 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#teacherProgressGradient)"
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${offset} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="teacherProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900">{progress}%</span>
      </div>
    </div>
  );
}

export default function TeacherHifzMarhalaPage() {
  const [data, setData] = useState<{ assignments: any[]; reports: any[]; students: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedMarhala, setSelectedMarhala] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [academicYear, setAcademicYear] = useState("");
  const [editingReport, setEditingReport] = useState<{ student: any; marhala: string; report?: any } | null>(null);
  const [teacherProfileId, setTeacherProfileId] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (academicYear) params.set("academicYear", academicYear);
      const res = await fetch(`/api/teacher/hifz-marhala?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        // Server annotates isMuhaffiz / isMusaid per assignment — grab my profile id from any of them
        const mine = (result.data?.assignments || []).find(
          (a: any) => a.isMuhaffiz || a.isMusaid
        );
        if (mine?.isMuhaffiz) setTeacherProfileId(mine.facultyId);
        else if (mine?.isMusaid && mine.facultyId) setTeacherProfileId(mine.facultyId);
        setError(null);
      } else {
        setError(result.error || "Failed to load data");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentYear = new Date().getFullYear();
  const defaultYear = `${currentYear}-${currentYear + 1}`;

  const reportsByStudent = new Map(
    (data?.reports || []).map((r) => [`${r.studentId}-${r.marhala}`, r] as [string, any])
  );

  const filteredAssignments = data?.assignments.filter((a) => {
    const studentName = `${a.student.user.firstName} ${a.student.user.lastName}`.toLowerCase();
    const its = (a.student.its || a.student.studentId || "").toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = q === "" || studentName.includes(q) || its.includes(q);
    const matchesMarhala = selectedMarhala === "all" || a.marhala === selectedMarhala;
    // additionally filter by status if needed
    if (selectedStatus !== "all") {
      const rep = reportsByStudent.get(`${a.student.id}-${a.marhala}`);
      const st = (rep?.status || "DRAFT").toUpperCase();
      if (st !== selectedStatus) return false;
    }
    return matchesSearch && matchesMarhala;
  }) || [];

  const handleSaveReport = async (reportData: any) => {
    if (editingReport) {
      if (editingReport.report?.id) {
        await fetch(`/api/teacher/hifz-marhala/report`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingReport.report.id, ...reportData }),
        });
      } else {
        await fetch(`/api/teacher/hifz-marhala/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: editingReport.student.id,
            marhala: editingReport.marhala,
            academicYear: academicYear || defaultYear,
            ...reportData,
          }),
        });
      }
      fetchData();
    }
  };

  const getReportForStudent = (studentId: string, marhala: string) => {
    return reportsByStudent.get(`${studentId}-${marhala}`);
  };

  const stats = data
    ? {
        totalStudents: data.assignments.length,
        submittedReports: data.reports.filter((r) => r.status !== "DRAFT").length,
        approvedReports: data.reports.filter((r) => r.status === "APPROVED").length,
        avgPerformance: data.reports.length > 0
          ? Math.round(data.reports.reduce((sum, r) => sum + (r.overallPerformance || 0), 0) / data.reports.length)
          : 0,
      }
    : { totalStudents: 0, submittedReports: 0, approvedReports: 0, avgPerformance: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-bl from-slate-50 via-white to-amber-50/30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="animate-fade-in mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Hifz Marhala Reports
              </h1>
              <p className="text-base text-gray-500">Track student reports across the five marhalas</p>
            </div>
          </div>
        </div>

        {/* Academic Year Selector & Stats */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <label htmlFor="academic-year" className="sr-only">Academic Year</label>
            <select
              id="academic-year"
              value={academicYear || defaultYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none shadow-sm"
            >
              <option value={`${currentYear - 1}-${currentYear}`}>{currentYear - 1}-{currentYear}</option>
              <option value={`${currentYear}-${currentYear + 1}`}>{currentYear}-{currentYear + 1}</option>
              <option value={`${currentYear + 1}-${currentYear + 2}`}>{currentYear + 1}-{currentYear + 2}</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? "w-4 h-4 animate-spin ml-1" : "w-4 h-4 ml-1"} />
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full sm:w-auto">
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                    <p className="text-sm text-gray-500">Assigned Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{stats.submittedReports}</p>
                    <p className="text-sm text-gray-500">Submitted Reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{stats.approvedReports}</p>
                    <p className="text-sm text-gray-500">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{stats.avgPerformance}%</p>
                    <p className="text-sm text-gray-500">Avg Performance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="search-student" className="sr-only">Search student</label>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                id="search-student"
                placeholder="Search student..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none shadow-sm"
              />
            </div>
            <Select value={selectedMarhala} onValueChange={setSelectedMarhala} className="w-48">
              <SelectTrigger className="">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {MARHALA_ORDER.map((m) => (
                  <SelectItem key={m} value={m}>{MARHALA_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus} className="w-40">
              <SelectTrigger className="">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="REVIEWED">Reviewed</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card key={i} className="animate-pulse border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="h-40 bg-gray-100 rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-600 text-xl font-medium">Failed to load data</p>
              <p className="text-gray-500 text-base mt-2">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 ml-1" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredAssignments.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-500 text-xl">No assignments</p>
              <p className="text-gray-500 text-base mt-1">No students assigned to this stage yet</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="cards" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 rounded-lg p-1 max-w-xl">
              <TabsTrigger value="cards" className="">
                <Users className="w-4 h-4 ml-1 inline" /> Student Cards
              </TabsTrigger>
              <TabsTrigger value="marhala" className="">
                <Target className="w-4 h-4 ml-1 inline" /> View by Marhala
              </TabsTrigger>
              <TabsTrigger value="flow-map" className="">
                <GitBranch className="w-4 h-4 ml-1 inline" /> Flow Map <span className="font-arabic mr-1">خريطة المراحل</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cards" className="space-y-0">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAssignments.map((assignment, idx) => {
                  const student = assignment.student;
                  const studentName = `${student.user.firstName} ${student.user.lastName}`;
                  const reports = data?.reports.filter(
                    (r) => r.studentId === student.id && r.marhala === assignment.marhala
                  ) || [];
                  const latestReport = reports[0];
                  const status = latestReport?.status || "DRAFT";
                  const config = STATUS_CONFIG[status];

                  return (
                    <Card
                      key={assignment.id}
                      className="animate-fade-in border-0 shadow-sm hover:shadow-lg transition-all duration-300 bg-white overflow-hidden group cursor-pointer"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className={`h-1.5 ${status === "APPROVED" ? "bg-emerald-500" : status === "SUBMITTED" ? "bg-blue-500" : status === "REVIEWED" ? "bg-amber-500" : "bg-gray-300"}`} />
                      
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12 rounded-xl shadow-lg shadow-amber-500/20 shrink-0 ring-1 ring-black/5">
                              {student.user?.avatarUrl && (
                                <AvatarImage src={student.user.avatarUrl} alt={studentName} className="object-cover" />
                              )}
                              <AvatarFallback className="w-full h-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl">
                                {studentName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-lg">{studentName}</h3>
                              <p className="text-sm text-gray-500">Grade {student.grade}{student.section}</p>
                            </div>
                          </div>
                          <Badge className={cn(config.bgColor, config.color, "text-xs")}>
                            {config.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <Badge className="bg-indigo-50 text-indigo-700 border-0 text-xs">
                            {MARHALA_LABELS[assignment.marhala]}
                          </Badge>
                          {assignment.isMusaid && (
                            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">Musa'id — you</Badge>
                          )}
                          {!assignment.isMusaid && assignment.isMuhaffiz && (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Muhaffiz — you</Badge>
                          )}
                          {assignment.faculty && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full border border-gray-100 text-xs text-gray-600">
                              <Avatar className="w-4 h-4 rounded-full shrink-0">
                                {(assignment.faculty.user?.avatarUrl || assignment.faculty.photoUrl) && (
                                  <AvatarImage src={assignment.faculty.user?.avatarUrl || assignment.faculty.photoUrl} alt={assignment.faculty.user?.firstName} className="object-cover" />
                                )}
                                <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                                  {assignment.faculty.user?.firstName?.charAt(0) || "T"}
                                </AvatarFallback>
                              </Avatar>
                              <span>Muhaffiz: {assignment.faculty.user.firstName} {assignment.faculty.user.lastName}</span>
                            </div>
                          )}
                          {assignment.musaid && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 rounded-full border border-sky-100 text-xs text-sky-700">
                              <Avatar className="w-4 h-4 rounded-full shrink-0">
                                {(assignment.musaid.user?.avatarUrl || assignment.musaid.photoUrl) && (
                                  <AvatarImage src={assignment.musaid.user?.avatarUrl || assignment.musaid.photoUrl} alt={assignment.musaid.user?.firstName} className="object-cover" />
                                )}
                                <AvatarFallback className="bg-sky-100 text-sky-800 text-[8px] font-bold">
                                  {assignment.musaid.user?.firstName?.charAt(0) || "M"}
                                </AvatarFallback>
                              </Avatar>
                              <span>Musa'id: {assignment.musaid.user.firstName} {assignment.musaid.user.lastName}</span>
                            </div>
                          )}
                        </div>

                        {latestReport && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                <span className="font-semibold text-gray-900">{latestReport.totalMarks || 0}/50</span>
                              </div>
                              <div className="text-sm text-gray-500">{latestReport.overallPerformance || 0}%</div>
                            </div>
                            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${latestReport.overallPerformance || 0}%`,
                                  background: (latestReport.overallPerformance || 0) >= 60 ? "linear-gradient(90deg, #059669, #10b981)" : "linear-gradient(90deg, #d97706, #f59e0b)",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                          <span className="">
                            {latestReport?.submittedAt ? `Submitted: ${new Date(latestReport.submittedAt).toLocaleDateString()}` : "Not submitted yet"}
                          </span>
                          <div className="flex items-center gap-2">
                            {latestReport && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 py-0 text-xs"
                                onClick={() => setEditingReport({ student, marhala: assignment.marhala, report: latestReport })}
                              >
                                <Eye className="w-3.5 h-3.5 ml-1" /> View
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 py-0 text-xs"
                              onClick={() => setEditingReport({ student, marhala: assignment.marhala, report: latestReport })}
                            >
                              <Edit3 className="w-3.5 h-3.5 ml-1" /> {latestReport ? "Edit" : "Enter"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="flow-map" className="space-y-4">
              <MarhalaFlowMap assignments={data?.assignments || []} teacherProfileId={teacherProfileId || undefined} academicYear={academicYear || defaultYear} />
            </TabsContent>

            <TabsContent value="marhala" className="space-y-6">
              {MARHALA_ORDER.map((marhala) => {
                const marhalaAssignments = filteredAssignments.filter((a) => a.marhala === marhala);
                if (marhalaAssignments.length === 0) return null;

                const marhalaReports = data?.reports.filter((r) => r.marhala === marhala) || [];
                const submitted = marhalaReports.filter((r) => r.status !== "DRAFT").length;
                const approved = marhalaReports.filter((r) => r.status === "APPROVED").length;
                const avgPerf = marhalaReports.length > 0
                  ? Math.round(marhalaReports.reduce((sum, r) => sum + (r.overallPerformance || 0), 0) / marhalaReports.length)
                  : 0;

                return (
                  <Card key={marhala} className="border-0 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white">{MARHALA_LABELS[marhala]}</h3>
                          <p className="text-amber-100 text-sm">
                            {marhalaAssignments.length} Students • {submitted} Submitted • {approved} Approved • Avg {avgPerf}%
                          </p>
                        </div>
                        <ProgressRing progress={avgPerf} size={60} strokeWidth={4} />
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {marhalaAssignments.map((assignment, idx) => {
                          const student = assignment.student;
                          const studentName = `${student.user.firstName} ${student.user.lastName}`;
                          const latestReport = marhalaReports.find((r) => r.studentId === student.id);
                          const status = latestReport?.status || "DRAFT";
                          const config = STATUS_CONFIG[status];

                          return (
                            <div
                              key={assignment.id}
                              className="p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => setEditingReport({ student, marhala, report: latestReport })}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-8 h-8 rounded-lg shrink-0 ring-1 ring-black/5">
                                    {student.user?.avatarUrl && (
                                      <AvatarImage src={student.user.avatarUrl} alt={studentName} className="object-cover" />
                                    )}
                                    <AvatarFallback className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold rounded-lg">
                                      {studentName.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-gray-900 text-sm">{studentName}</span>
                                </div>
                                <Badge className={cn(config.bgColor, config.color, "text-[10px]")}>
                                  {config.label}
                                </Badge>
                              </div>
                              {latestReport && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">{latestReport.totalMarks || 0}/50</span>
                                  <span className="font-bold text-amber-600">{latestReport.overallPerformance || 0}%</span>
                                </div>
                              )}
                              {!latestReport && (
                                <p className="text-xs text-gray-400">No report entered yet</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        )}

        {/* Edit Modal */}
        {editingReport && (
          <TeacherHifzMarhalaReportForm
            student={editingReport.student}
            marhala={editingReport.marhala}
            academicYear={academicYear || defaultYear}
            existingReport={editingReport.report}
            onClose={() => setEditingReport(null)}
            onSave={handleSaveReport}
          />
        )}
      </div>
    </div>
  );
}