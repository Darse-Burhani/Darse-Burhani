"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  Edit3,
  Star,
  GraduationCap,
  X,
  Send,
  Eye,
  Award,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TalabatProfileDocument, TalabatProfileData } from "@/components/talabat/TalabatProfileDocument";

interface StudentListItem {
  studentId: string;
  idNo: string;
  its: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  grade: string;
  section: string;
  status: string;
  hasProfile: boolean;
  ratings?: {
    behaviour?: number | null;
    communication?: number | null;
    dedication?: number | null;
    discipline?: number | null;
    hasRemarks?: boolean;
  } | null;
  updatedAt?: string | null;
}

export default function AdminTalabatProfilesPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Review / View Modal State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<TalabatProfileData | null>(null);
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  // Remarks Form State inside modal
  const [behaviourRating, setBehaviourRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [dedicationRating, setDedicationRating] = useState<number>(5);
  const [disciplineRating, setDisciplineRating] = useState<number>(5);

  // 10 Granular Category Remarks
  const [remarksMasool, setRemarksMasool] = useState<string>("");
  const [remarksTahfeez, setRemarksTahfeez] = useState<string>("");
  const [remarksTaleem, setRemarksTaleem] = useState<string>("");
  const [remarksTadeeb, setRemarksTadeeb] = useState<string>("");
  const [remarksTanzeem, setRemarksTanzeem] = useState<string>("");
  const [remarksSports, setRemarksSports] = useState<string>("");
  const [remarksMaktabat, setRemarksMaktabat] = useState<string>("");
  const [remarksSkills, setRemarksSkills] = useState<string>("");
  const [remarksOtherExams, setRemarksOtherExams] = useState<string>("");
  const [remarksCounselling, setRemarksCounselling] = useState<string>("");
  const [counsellingNotes, setCounsellingNotes] = useState<string>("");

  const [savingRemarks, setSavingRemarks] = useState(false);
  const [modalViewTab, setModalViewTab] = useState<"fill" | "document">("fill");
  const [showStudentDetailsAbove, setShowStudentDetailsAbove] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/talabat-profile/list");
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      }
    } catch (e) {
      console.error("Failed to load list", e);
    } finally {
      setLoading(false);
    }
  };

  const openStudentModal = async (studentId: string, defaultTab: "fill" | "document" = "fill") => {
    setSelectedStudentId(studentId);
    setModalLoading(true);
    setFeedbackMsg(null);
    setModalViewTab(defaultTab);

    try {
      const res = await fetch(`/api/talabat-profile/view/${studentId}`);
      const data = await res.json();
      if (data.success && data.profile) {
        const p = data.profile;
        setActiveProfile(p);
        setReviewerName(data.reviewerName || null);
        setBehaviourRating(p.behaviourRating || 5);
        setCommunicationRating(p.communicationRating || 5);
        setDedicationRating(p.dedicationRating || 5);
        setDisciplineRating(p.disciplineRating || 5);

        setRemarksMasool(p.remarksMasool || p.masoolRemarks || "");
        setRemarksTahfeez(p.remarksTahfeez || "");
        setRemarksTaleem(p.remarksTaleem || "");
        setRemarksTadeeb(p.remarksTadeeb || "");
        setRemarksTanzeem(p.remarksTanzeem || "");
        setRemarksSports(p.remarksSports || "");
        setRemarksMaktabat(p.remarksMaktabat || "");
        setRemarksSkills(p.remarksSkills || "");
        setRemarksOtherExams(p.remarksOtherExams || "");
        setRemarksCounselling(p.remarksCounselling || "");
        setCounsellingNotes(p.counsellingNotes || "");
      }
    } catch (err) {
      console.error("Failed to fetch student profile", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveRemarks = async () => {
    if (!selectedStudentId) return;
    try {
      setSavingRemarks(true);
      setFeedbackMsg(null);
      const res = await fetch(`/api/talabat-profile/remarks/${selectedStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          behaviourRating,
          communicationRating,
          dedicationRating,
          disciplineRating,
          remarksMasool,
          remarksTahfeez,
          remarksTaleem,
          remarksTadeeb,
          remarksTanzeem,
          remarksSports,
          remarksMaktabat,
          remarksSkills,
          remarksOtherExams,
          remarksCounselling,
          counsellingNotes,
          masoolRemarks: remarksMasool,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: "success", text: "Remarks and ratings saved successfully!" });
        if (activeProfile) {
          setActiveProfile({
            ...activeProfile,
            behaviourRating,
            communicationRating,
            dedicationRating,
            disciplineRating,
            remarksMasool,
            remarksTahfeez,
            remarksTaleem,
            remarksTadeeb,
            remarksTanzeem,
            remarksSports,
            remarksMaktabat,
            remarksSkills,
            remarksOtherExams,
            remarksCounselling,
            counsellingNotes,
            masoolRemarks: remarksMasool,
            status: "REVIEWED",
          });
        }
        fetchList();
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Failed to save remarks" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setSavingRemarks(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.its && s.its.includes(searchQuery)) ||
      (s.idNo && s.idNo.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "SUBMITTED") return matchesSearch && s.status === "SUBMITTED";
    if (statusFilter === "REVIEWED") return matchesSearch && s.status === "REVIEWED";
    if (statusFilter === "PENDING") return matchesSearch && (s.status === "DRAFT" || s.status === "NOT_STARTED");
    return matchesSearch;
  });

  const totalStudents = students.length;
  const submittedCount = students.filter((s) => s.status === "SUBMITTED").length;
  const reviewedCount = students.filter((s) => s.status === "REVIEWED").length;
  const pendingCount = students.filter((s) => s.status === "DRAFT" || s.status === "NOT_STARTED").length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#961212] to-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur">
            <GraduationCap className="w-8 h-8 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full">
                Darajah 4 Profiles
              </span>
              <span className="text-xs text-white/80 font-alkanz">Yearly Profile – توجيه الطالب (1447 H)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Talabat Profile Master Hub (توجيه الطالب)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Complete institutional oversight of Darajah 4 profiles, 10-department remarks (Al-Kanz font), ratings, and official PDF printouts.
            </p>
          </div>
        </div>
      </div>

      {/* ── Stat Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center font-bold text-base">
            {totalStudents}
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-500">Total Darajah 4</span>
            <span className="text-sm font-bold text-slate-900">Talabat</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-base">
            {submittedCount}
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-500">Submitted</span>
            <span className="text-sm font-bold text-emerald-700">Awaiting Remarks</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-base">
            {reviewedCount}
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-500">Reviewed</span>
            <span className="text-sm font-bold text-blue-700">Remarks Complete</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center font-bold text-base">
            {pendingCount}
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-500">Pending</span>
            <span className="text-sm font-bold text-amber-700">Draft / Incomplete</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Name, ITS, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { key: "ALL", label: "All" },
            { key: "SUBMITTED", label: "Submitted" },
            { key: "REVIEWED", label: "Reviewed" },
            { key: "PENDING", label: "Pending" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                statusFilter === tab.key
                  ? "bg-[#961212] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Student List Table ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 border-3 border-[#961212] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading profiles...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No Darajah 4 student profiles match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-4">Talib Name &amp; ID</th>
                  <th className="py-3.5 px-4">ITS No.</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Masul Ratings</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.studentId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {s.avatarUrl ? (
                          <img
                            src={s.avatarUrl}
                            alt={s.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-500">ID: {s.idNo} • Darajah {s.grade}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {s.its || "—"}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        s.status === "SUBMITTED"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "REVIEWED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.status === "SUBMITTED" ? "bg-emerald-600" : s.status === "REVIEWED" ? "bg-blue-600" : "bg-amber-600"
                        }`} />
                        {s.status === "REVIEWED" ? "Reviewed" : s.status === "SUBMITTED" ? "Submitted" : s.status === "DRAFT" ? "Draft Saved" : "Not Started"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {s.ratings?.behaviour ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900 flex items-center gap-0.5">
                            ★ {(
                              ((s.ratings.behaviour || 0) +
                                (s.ratings.communication || 0) +
                                (s.ratings.dedication || 0) +
                                (s.ratings.discipline || 0)) / 4
                            ).toFixed(1)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            (Avg of 4 traits)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No ratings yet</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openStudentModal(s.studentId, "fill")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#961212] hover:bg-[#b31b1b] text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Remarks &amp; Ratings
                        </button>
                        <button
                          onClick={() => openStudentModal(s.studentId, "document")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Document
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          STUDENT PROFILE & REMARKS MODAL
      ════════════════════════════════════════════════════════════ */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:px-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-bold">
                  {activeProfile?.name?.slice(0, 2).toUpperCase() || "TP"}
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">{activeProfile?.name || "Talabat Profile"}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>ITS: {activeProfile?.itsNo || "—"}</span>
                    <span>•</span>
                    <span>ID: {activeProfile?.idNo || "—"}</span>
                    <span>•</span>
                    <span className="text-amber-300 font-semibold">{activeProfile?.status || "DRAFT"}</span>
                    {reviewerName && (
                      <>
                        <span>•</span>
                        <span className="text-blue-300">Reviewed by: {reviewerName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Actions & Close */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setModalViewTab("fill")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      modalViewTab === "fill" ? "bg-[#961212] text-white" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    📝 Remarks Form
                  </button>
                  <button
                    onClick={() => setModalViewTab("document")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      modalViewTab === "document" ? "bg-[#961212] text-white" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    👁️ 2-Page Print View
                  </button>
                </div>

                <button
                  onClick={() => setSelectedStudentId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
              {modalLoading ? (
                <div className="py-20 text-center text-slate-500">
                  <div className="w-8 h-8 border-3 border-[#961212] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading profile...
                </div>
              ) : activeProfile ? (
                modalViewTab === "document" ? (
                  <TalabatProfileDocument data={activeProfile} showPrintButton={true} />
                ) : (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* ════════════════════════════════════════════════════
                        SECTION 1: TALABAT YEARLY PROFILE (VISIBLE ABOVE)
                    ════════════════════════════════════════════════════ */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div
                        onClick={() => setShowStudentDetailsAbove(!showStudentDetailsAbove)}
                        className="bg-gradient-to-r from-slate-100 to-amber-50/50 p-4 flex items-center justify-between cursor-pointer border-b border-slate-200 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <GraduationCap className="w-5 h-5 text-[#961212]" />
                          <div>
                            <span className="font-bold text-sm text-slate-900">
                              Talabat Filled Profile – 1447 H (Student Submission Details)
                            </span>
                            <span className="block text-xs text-slate-500">
                              Review personal, academic, and self-assessment information before assigning remarks.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <span>{showStudentDetailsAbove ? "Collapse" : "Expand View"}</span>
                          {showStudentDetailsAbove ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {showStudentDetailsAbove && (
                        <div className="p-5 space-y-4 text-xs bg-white">
                          {/* Basic Profile Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pb-4 border-b border-slate-100">
                            <div className="sm:col-span-2 flex justify-center sm:justify-start">
                              {activeProfile.studentPhotoUrl ? (
                                <img
                                  src={activeProfile.studentPhotoUrl}
                                  alt={activeProfile.name || "Student"}
                                  className="w-20 h-24 object-cover rounded-lg border border-slate-300 shadow-xs"
                                />
                              ) : (
                                <div className="w-20 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200">
                                  No Photo
                                </div>
                              )}
                            </div>

                            <div className="sm:col-span-10 grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div>
                                <span className="text-slate-500 block text-[11px]">Full Name:</span>
                                <span className="font-bold text-slate-900">{activeProfile.name || "—"}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[11px]">ITS / ID:</span>
                                <span className="font-mono font-bold">{activeProfile.itsNo || "—"} • ID {activeProfile.idNo || "—"}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[11px]">Jamaat / Vatan:</span>
                                <span className="font-semibold">{activeProfile.jamaat || "—"} / {activeProfile.vatan || "—"}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[11px]">Father:</span>
                                <span className="font-semibold">{activeProfile.fatherName || "—"} ({activeProfile.fatherOccupation || "Business"})</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[11px]">Mother:</span>
                                <span className="font-semibold">{activeProfile.motherName || "—"} ({activeProfile.motherOccupation || "Homemaker"})</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[11px]">Age / DOB:</span>
                                <span className="font-semibold">{activeProfile.age ? `${activeProfile.age} Yrs` : "—"} ({activeProfile.dob || "—"})</span>
                              </div>
                            </div>
                          </div>

                          {/* Academics & Self-Assessment Snippet */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-700 block mb-1">Academic Scores:</span>
                              <div className="text-[11px] space-y-0.5">
                                <div>1444 H: <b>{activeProfile.result1444 || "—"}</b></div>
                                <div>1445 H: <b>{activeProfile.result1445 || "—"}</b></div>
                                <div>1446 H: <b>{activeProfile.result1446 || "—"}</b></div>
                                <div>Hifz Year: <b>{activeProfile.hifzYear || "—"}</b> (Tabaqa: {activeProfile.hifzTabaqa || "—"})</div>
                              </div>
                            </div>

                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                              <span className="font-bold text-emerald-900 block mb-1">Strengths:</span>
                              <ul className="list-disc pl-3 text-[11px] text-emerald-950 space-y-0.5">
                                {(activeProfile.strengths || []).filter(Boolean).map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200">
                              <span className="font-bold text-rose-900 block mb-1">Weaknesses:</span>
                              <ul className="list-disc pl-3 text-[11px] text-rose-950 space-y-0.5">
                                {(activeProfile.weaknesses || []).filter(Boolean).map((w, idx) => (
                                  <li key={idx}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* About Myself */}
                          {activeProfile.aboutMyself && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                              <span className="font-bold text-slate-700 block mb-0.5">About Myself:</span>
                              <p className="text-slate-800">{activeProfile.aboutMyself}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ════════════════════════════════════════════════════
                        SECTION 2: REMARKS & 10 CATEGORIES FORM
                    ════════════════════════════════════════════════════ */}
                    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#b31b1b] uppercase tracking-wider">
                          <Sparkles className="w-4 h-4" />
                          Faculty Remarks Evaluation Form
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mt-1">
                          Darajah Masul &amp; Darse Burhani Masul Collective Remarks
                        </h4>
                        <p className="text-xs text-slate-500">
                          Type in Arabic (Al-Kanz font) or English for each specific institutional category below.
                        </p>
                      </div>

                      {feedbackMsg && (
                        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                          feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                          {feedbackMsg.text}
                        </div>
                      )}

                      {/* 4 Rating Traits Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Behaviour */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Behaviour</span>
                            <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                              {behaviourRating} / 5
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Cooperates with faculty and peers, maintains a positive attitude.
                          </p>
                          <div className="flex items-center gap-1 pt-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setBehaviourRating(val)}
                                className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                  behaviourRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Communication */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Communication</span>
                            <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                              {communicationRating} / 5
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Conveys ideas effectively, fosters clear and polite conversations.
                          </p>
                          <div className="flex items-center gap-1 pt-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setCommunicationRating(val)}
                                className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                  communicationRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Dedication */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Dedication</span>
                            <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                              {dedicationRating} / 5
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Demonstrates strong commitment to tasks, classes, or assigned work.
                          </p>
                          <div className="flex items-center gap-1 pt-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setDedicationRating(val)}
                                className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                  dedicationRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 4. Discipline */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Discipline</span>
                            <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                              {disciplineRating} / 5
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Follows and practices rules and punctuality in all activities.
                          </p>
                          <div className="flex items-center gap-1 pt-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setDisciplineRating(val)}
                                className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                  disciplineRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── 10 Granular Category Inputs ── */}
                      <div className="space-y-4 pt-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                          Institutional Department Remarks (ملاحظات الأقسام):
                        </h5>

                        {/* 1. المسؤول عن الدرجة */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">1. Darajah Masul Remarks</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">المسؤول عن الدرجة</span>
                          </div>
                          <textarea
                            rows={3}
                            dir="auto"
                            value={remarksMasool}
                            onChange={(e) => setRemarksMasool(e.target.value)}
                            placeholder="طالب ما بهتر معاشرة ني خوبي چھے، برامج علمية ما ساهمة فعالة كيدي چھے..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 2. عن التحفيظ */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">2. Tahfeez / Hifz Remarks</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن التحفيظ</span>
                          </div>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={remarksTahfeez}
                            onChange={(e) => setRemarksTahfeez(e.target.value)}
                            placeholder="He has good character and makes sincere efforts for Tahfeez-ul-Qur'an..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 3. عن التعليم */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">3. Academic Progress &amp; Ta'leem</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن التعليم</span>
                          </div>
                          <textarea
                            rows={3}
                            dir="auto"
                            value={remarksTaleem}
                            onChange={(e) => setRemarksTaleem(e.target.value)}
                            placeholder="طالب علم نو تعليمي مستوى ممتاز چھے، حلقة ما برابر دهيان سي پرھے چھے..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 4. عن التأديب والرياضة والمنازل البرهانية */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">4. Ta'deeb &amp; Manazil al-Burhaniyah</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن التأديب والرياضة والمنازل البرهانية</span>
                          </div>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={remarksTadeeb}
                            onChange={(e) => setRemarksTadeeb(e.target.value)}
                            placeholder="focused person in every aspects and always follow norms."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 5. عن التنظيم */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">5. Tanzeem &amp; Punctuality</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن التنظيم</span>
                          </div>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={remarksTanzeem}
                            onChange={(e) => setRemarksTanzeem(e.target.value)}
                            placeholder="تلاوة الدعاء ، حلقة انے تمام برامج ما مواظبة سي حاضر تھائي چھے..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 6. عن خيمة الرياضة */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">6. Sports &amp; Athletics Activities</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن خيمة الرياضة</span>
                          </div>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={remarksSports}
                            onChange={(e) => setRemarksSports(e.target.value)}
                            placeholder="The student has not participated in any sports activities during this academic year."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 7. المكتبة */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">7. Maktabat &amp; Library Utilization</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">المكتبة</span>
                          </div>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={remarksMaktabat}
                            onChange={(e) => setRemarksMaktabat(e.target.value)}
                            placeholder="The student had issued 9 books from the Maktabat and demonstrated consistent library usage..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 8. عن الفن والمهارة */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">8. Art, IT &amp; Special Skills</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن الفن والمهارة</span>
                          </div>
                          <input
                            type="text"
                            dir="auto"
                            value={remarksSkills}
                            onChange={(e) => setRemarksSkills(e.target.value)}
                            placeholder="IT Skills, Coding Skills"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 9. عن الامتحانات الأخرى */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">9. External Board Exams</span>
                            <span className="font-alkanz text-xs font-bold text-[#b31b1b] dir-rtl" dir="rtl">عن الامتحانات الأخرى</span>
                          </div>
                          <input
                            type="text"
                            dir="auto"
                            value={remarksOtherExams}
                            onChange={(e) => setRemarksOtherExams(e.target.value)}
                            placeholder="10th done From MP BOARD Board 12th not done"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* 10. Recommended Further Studies (Counselling) */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">10. Career Counselling &amp; Guidance</span>
                            <span className="text-xs font-bold text-[#b31b1b]">Recommended Further Studies (Counselling)</span>
                          </div>
                          <textarea
                            rows={2}
                            dir="auto"
                            value={remarksCounselling}
                            onChange={(e) => setRemarksCounselling(e.target.value)}
                            placeholder="A note regarding the student's career counselling is provided below along with counselor remarks."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>

                        {/* Section 11: Sibling Details & Family Background */}
                        <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950">11. Sibling &amp; Family Background Notes</span>
                            <span className="text-[11px] text-amber-700">Elder/Younger siblings, Parents Career</span>
                          </div>
                          <textarea
                            rows={3}
                            dir="auto"
                            value={counsellingNotes}
                            onChange={(e) => setCounsellingNotes(e.target.value)}
                            placeholder={"Elder Sister (Married)\nYounger Brother\nAbba - Software Engineering\n18 yrs, Ratlam"}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm leading-relaxed font-mono focus:ring-2 focus:ring-[#961212] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Save Action Buttons */}
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentId(null)}
                          className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveRemarks}
                          disabled={savingRemarks}
                          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#961212] hover:bg-[#b31b1b] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {savingRemarks ? "Saving..." : "Save All Remarks & Ratings"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
