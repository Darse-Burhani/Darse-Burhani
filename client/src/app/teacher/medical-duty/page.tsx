"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Search,
  ShieldCheck,
  AlertCircle,
  Clock,
  User,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  XCircle,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Calendar,
  HeartPulse,
  Pill,
  ChevronRight,
  Filter,
  Users,
  Building2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

interface MedicalExemptionItem {
  id: string;
  personType: "STUDENT" | "TEACHER";
  studentId?: string | null;
  teacherId?: string | null;
  date: string;
  eventId?: string | null;
  eventName: string;
  reason: string;
  assignedById: string;
  assignedByName?: string | null;
  isActive: boolean;
  createdAt: string;
  student?: {
    id: string;
    studentId: string;
    its?: string | null;
    grade: string;
    section: string;
    user: { firstName: string; lastName: string; email?: string; avatarUrl?: string | null };
    classEnrollments?: Array<{ class: { name: string; grade: string; section: string } }>;
  } | null;
  teacher?: {
    id: string;
    employeeId: string;
    its?: string | null;
    department?: string | null;
    user: { firstName: string; lastName: string; email?: string; avatarUrl?: string | null };
  } | null;
}

interface MemberSearchResult {
  id: string;
  personType: "STUDENT" | "TEACHER";
  studentId?: string;
  employeeId?: string;
  its?: string;
  name: string;
  grade?: string;
  section?: string;
  className?: string;
  department?: string;
  avatarUrl?: string | null;
}

const QUICK_REASONS = [
  "Fever / Flu Symptoms",
  "Clinic Rest / Observation",
  "Doctor / Hospital Appointment",
  "Severe Headache / Nausea",
  "Minor Injury / Sprain",
  "Prescribed Bed Rest",
  "Stomach Infection",
];

export default function MedicalDutyPage() {
  const [personType, setPersonType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [selectedEventId, setSelectedEventId] = useState<string>("default");
  const [selectedEventName, setSelectedEventName] = useState<string>("Tilawat al Dua");
  const [scheduleEvents, setScheduleEvents] = useState<Array<{ id: string; name: string; time: string }>>([]);
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Exemption List
  const [exemptions, setExemptions] = useState<MedicalExemptionItem[]>([]);
  const [loadingExemptions, setLoadingExemptions] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");

  // Fetch today's exemptions & schedule events
  const loadExemptions = useCallback(async () => {
    try {
      setLoadingExemptions(true);
      const res = await fetch("/api/medical/exemptions", { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setExemptions(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load medical exemptions:", e);
    } finally {
      setLoadingExemptions(false);
    }
  }, []);

  const loadScheduleEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/medical/schedule-events", { credentials: "include" });
      const json = await res.json();
      if (json.success && json.data) {
        setScheduleEvents(json.data);
      }
    } catch (e) {
      console.error("Failed to load schedule events:", e);
    }
  }, []);

  useEffect(() => {
    loadExemptions();
    loadScheduleEvents();
  }, [loadExemptions, loadScheduleEvents]);

  // Search members debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/medical/search-members?q=${encodeURIComponent(searchQuery)}&type=${personType}`,
          { credentials: "include" }
        );
        const json = await res.json();
        if (json.success && json.data) {
          const list = personType === "STUDENT" ? json.data.students : json.data.teachers;
          setSearchResults(list || []);
        }
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, personType]);

  const handleSelectMember = (member: MemberSearchResult) => {
    setSelectedMember(member);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleMarkMedical = async () => {
    if (!selectedMember) {
      toast({ title: "Select Member", description: "Please select a Talabat or Faculty member first.", variant: "destructive" });
      return;
    }

    const reason = customReason.trim();
    if (!reason) {
      toast({ title: "Reason Required", description: "Please provide the medical condition or reason.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/medical/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          personType: selectedMember.personType,
          personId: selectedMember.id,
          eventId: selectedEventId === "full_day" ? null : selectedEventId,
          eventName: selectedEventName,
          reason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Medical Leave Logged",
          description: `${selectedMember.name} marked on Medical Leave (${selectedEventName}). Status set to MEDICAL (Not Absent).`,
        });
        setSelectedMember(null);
        setCustomReason("");
        loadExemptions();
      } else {
        toast({ title: "Action Failed", description: json.error || "Failed to mark medical leave", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeExemption = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke medical exemption for ${name}?`)) return;

    try {
      const res = await fetch(`/api/medical/revoke/${id}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Exemption Revoked", description: `Medical exemption for ${name} has been cancelled.` });
        loadExemptions();
      } else {
        toast({ title: "Revocation Failed", description: json.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filteredExemptions = useMemo(() => {
    if (filterType === "ALL") return exemptions;
    return exemptions.filter((e) => e.personType === filterType);
  }, [exemptions, filterType]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/20 p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <HeartPulse className="w-3.5 h-3.5 animate-pulse" />
              Health Duty & Medical Operations
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Stethoscope className="w-8 h-8 text-emerald-400" />
              Medical Leave & Biometric Exemption Hub
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Assigned Medical Teachers & Admins can mark Talabat or Faculty on medical leave for Tilawat al-Dua or specific class periods.
              <span className="text-emerald-300 font-semibold block mt-1">
                🛡️ Guaranteed Rule: When on medical leave, unscanned members are marked <u>MEDICAL</u> — NEVER <u>ABSENT</u>.
              </span>
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur border border-emerald-500/30 rounded-xl p-4 shadow-lg">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl">
              {exemptions.length}
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold">Today&apos;s Active Exemptions</div>
              <div className="text-sm font-medium text-white">
                {exemptions.filter((e) => e.personType === "STUDENT").length} Talabat · {exemptions.filter((e) => e.personType === "TEACHER").length} Faculty
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Action Desk / Right = Active Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Medical Desk Form */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Assign Medical Exemption
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                1-Click Medical Leave recording with instant biometric waiver
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Choose Role Type */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  1. Member Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonType("STUDENT");
                      setSelectedMember(null);
                      setSearchResults([]);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      personType === "STUDENT"
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30"
                        : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    Talabat (Student)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonType("TEACHER");
                      setSelectedMember(null);
                      setSearchResults([]);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      personType === "TEACHER"
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30"
                        : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    Faculty (Teacher)
                  </button>
                </div>
              </div>

              {/* Step 2: Search Member */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  2. Search & Select {personType === "STUDENT" ? "Student" : "Faculty"}
                </label>
                {!selectedMember ? (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={personType === "STUDENT" ? "Search by Name, ITS, Student ID, Grade..." : "Search by Name, Employee ID, Department..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />

                    {/* Search Dropdown */}
                    <AnimatePresence>
                      {searchResults.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="absolute z-50 left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 divide-y divide-slate-800"
                        >
                          {searchResults.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectMember(m)}
                              className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800/80 transition-colors flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                                  {getInitials(m.name)}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                    {m.name}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {m.personType === "STUDENT"
                                      ? `${m.className || `Grade ${m.grade}-${m.section}`} · ITS: ${m.its || m.studentId}`
                                      : `${m.department || "Faculty"} · ID: ${m.employeeId}`}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-sm flex items-center justify-center border border-emerald-500/40">
                        {getInitials(selectedMember.name)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          {selectedMember.name}
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px]">
                            {selectedMember.personType}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-300">
                          {selectedMember.personType === "STUDENT"
                            ? `${selectedMember.className || `Grade ${selectedMember.grade}-${selectedMember.section}`} · ITS: ${selectedMember.its || selectedMember.studentId}`
                            : `${selectedMember.department || "Faculty"} · ID: ${selectedMember.employeeId}`}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedMember(null)}
                      className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 h-8 w-8 p-0 rounded-lg"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Step 3: Event / Session Scope */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  3. Exemption Event / Session
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={selectedEventId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedEventId(val);
                      const matched = scheduleEvents.find((ev) => ev.id === val);
                      setSelectedEventName(matched ? matched.name : "Tilawat al Dua");
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {scheduleEvents.length > 0 ? (
                      scheduleEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} ({ev.time})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="default">Tilawat al Dua (Morning Session)</option>
                        <option value="full_day">Full Day Medical Exemption</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Step 4: Medical Reason & Quick Chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  4. Reason / Clinic Symptoms
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QUICK_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCustomReason(r)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        customReason === r
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="E.g., High fever reported at clinic, given medication and resting in infirmary..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="button"
                disabled={!selectedMember || !customReason.trim() || submitting}
                onClick={handleMarkMedical}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Recording Medical Exemption...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Confirm Medical Leave (Exempt from Scan)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active Exemptions Roster */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-emerald-400" />
                    Today&apos;s Active Medical Leaves ({filteredExemptions.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Live registry of all scan-exempt students and faculty for today
                  </CardDescription>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => setFilterType("ALL")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      filterType === "ALL" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    All ({exemptions.length})
                  </button>
                  <button
                    onClick={() => setFilterType("STUDENT")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      filterType === "STUDENT" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Talabat ({exemptions.filter((e) => e.personType === "STUDENT").length})
                  </button>
                  <button
                    onClick={() => setFilterType("TEACHER")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      filterType === "TEACHER" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Faculty ({exemptions.filter((e) => e.personType === "TEACHER").length})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingExemptions ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RotateCcw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-sm">Loading today&apos;s medical records...</span>
                </div>
              ) : filteredExemptions.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl p-8">
                  <Stethoscope className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <div className="text-base font-medium text-slate-300">No Medical Exemptions Logged for Today</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Use the desk on the left to mark students or faculty on medical duty. When marked, they are protected from absence marks.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredExemptions.map((item) => {
                    const isStudent = item.personType === "STUDENT";
                    const person = isStudent ? item.student : item.teacher;
                    const name = person?.user ? `${person.user.firstName} ${person.user.lastName}`.trim() : "Unknown";
                    const identifier = isStudent
                      ? `Grade ${item.student?.grade}-${item.student?.section} · ITS: ${item.student?.its || item.student?.studentId}`
                      : `${item.teacher?.department || "Faculty"} · ID: ${item.teacher?.employeeId}`;

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950/60 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20 shrink-0 mt-0.5">
                            {getInitials(name)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-white">{name}</span>
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                {item.personType}
                              </Badge>
                              <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700 text-[10px]">
                                <Clock className="w-3 h-3 mr-1 text-emerald-400 inline" />
                                {item.eventName}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-400">{identifier}</div>
                            <div className="text-xs text-slate-300 italic bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800 inline-block mt-1">
                              &ldquo;{item.reason}&rdquo;
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Assigned by: <span className="text-slate-400 font-medium">{item.assignedByName || "Medical In-Charge"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Medical Protected
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevokeExemption(item.id, name)}
                            className="text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 h-7 px-2.5 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
