"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Link2,
  Plus,
  Trash2,
  Heart,
  Users,
  GraduationCap,
  UserCheck,
  RefreshCw,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  UsersRound,
  UserPlus,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LinkedStudent {
  linkId: string;
  studentId: string;
  relationship: string | null;
  studentName: string;
  grade: string;
  section: string;
  avatarUrl: string | null;
}

interface ParentData {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  phone: string | null;
  linkedStudents: LinkedStudent[];
}

interface StudentOption {
  id: string;
  userId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  avatarUrl: string | null;
}

export default function AdminAssignTalabatPage() {
  const location = useLocation();
  const [parents, setParents] = useState<ParentData[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{ parent: ParentData } | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState("");

  // Revoke confirmation state
  const [revokingLink, setRevokingLink] = useState<{ linkId: string; studentName: string; parentName: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/parent-student-links");
      const data = await res.json();
      if (data.success) {
        const fetchedParents: ParentData[] = data.data.parents || [];
        const fetchedStudents: StudentOption[] = data.data.students || [];
        setParents(fetchedParents);
        setStudents(fetchedStudents);
        if (isManual) {
          toast({ variant: "success", title: "Refreshed", description: "Parent-student assignments reloaded." });
        }
        return { parents: fetchedParents, students: fetchedStudents };
      } else {
        toast({ variant: "destructive", title: "Fetch Error", description: data.error || "Failed to load data." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to server." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
    return null;
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL query parameters to auto-focus or open parent
  useEffect(() => {
    if (parents.length === 0) return;
    const params = new URLSearchParams(location.search);
    const targetParentId = params.get("parentId") || params.get("parent");
    const targetSearch = params.get("search");

    if (targetSearch) {
      setSearch(targetSearch);
    }

    if (targetParentId) {
      const found = parents.find((p) => p.id === targetParentId || p.userId === targetParentId);
      if (found) {
        setExpandedParentId(found.id);
        setStudentSearch("");
        setRelationship("");
        setAssignModal({ parent: found });
      }
    }
  }, [location.search, parents]);

  const filteredParents = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.linkedStudents.some((s) => s.studentName.toLowerCase().includes(q))
    );
  }, [parents, search]);

  // Students not yet linked to the selected parent
  const availableStudents = useMemo(() => {
    if (!assignModal) return students;
    const linked = new Set(assignModal.parent.linkedStudents.map((s) => s.studentId));
    const q = studentSearch.toLowerCase().trim();
    return students.filter((s) => {
      if (linked.has(s.id)) return false;
      if (!q) return true;
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.grade && s.grade.toLowerCase().includes(q)) ||
        (s.section && s.section.toLowerCase().includes(q))
      );
    });
  }, [students, assignModal, studentSearch]);

  const handleAssign = async (studentId: string) => {
    if (!assignModal) return;
    setAssigningStudentId(studentId);
    try {
      const res = await fetch("/api/admin/parent-student-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: assignModal.parent.id,
          studentId,
          relationship: relationship.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const studentObj = students.find((s) => s.id === studentId);
        toast({
          variant: "success",
          title: "Talabat Linked",
          description: `${studentObj ? `${studentObj.firstName} ${studentObj.lastName}` : "Student"} linked to ${assignModal.parent.firstName} ${assignModal.parent.lastName}.`,
        });
        const freshData = await fetchData();
        if (freshData) {
          const freshParent = freshData.parents.find((p) => p.id === assignModal.parent.id);
          if (freshParent) {
            setAssignModal({ parent: freshParent });
          }
        }
        setStudentSearch("");
        setRelationship("");
      } else {
        toast({ variant: "destructive", title: "Link Failed", description: data.error || "Could not link student." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to connect to server." });
    } finally {
      setAssigningStudentId(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokingLink) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/parent-student-links?linkId=${revokingLink.linkId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Link Removed", description: `${revokingLink.studentName} unlinked from parent.` });
        setRevokingLink(null);
        const freshData = await fetchData();
        if (freshData && assignModal) {
          const freshParent = freshData.parents.find((p) => p.id === assignModal.parent.id);
          if (freshParent) {
            setAssignModal({ parent: freshParent });
          }
        }
      } else {
        toast({ variant: "destructive", title: "Remove Failed", description: data.error || "Could not remove link." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Network error while removing link." });
    } finally {
      setRevoking(false);
    }
  };

  // Open assign modal and fetch fresh data for available students
  const openAssignModal = (parent: ParentData) => {
    setStudentSearch("");
    setRelationship("");
    setAssignModal({ parent });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hub Tabs */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, student profiles, parent directory, and portal permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Assign Talabat to Parent", href: "/admin/parents/assign", icon: Link2 },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: UserCheck },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #047857 0%, #065f46 50%, #064e3b 100%)" }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
              >
                <Link2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Assign Talabat to Parents
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs text-white font-semibold">
                    {parents.reduce((acc, p) => acc + p.linkedStudents.length, 0)} Links
                  </span>
                </div>
                <p className="text-emerald-100 text-sm mt-1">
                  Link student (talabat) accounts to their parent accounts for dashboard access.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm"
                onClick={() => fetchData(true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
        </div>
      </motion.div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Parents", value: parents.length, icon: Heart, color: "text-pink-600 bg-pink-50" },
          { label: "Total Students", value: students.length, icon: GraduationCap, color: "text-indigo-600 bg-indigo-50" },
          {
            label: "Active Links",
            value: parents.reduce((acc, p) => acc + p.linkedStudents.length, 0),
            icon: Link2,
            color: "text-emerald-600 bg-emerald-50",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color} shrink-0`}>
              <stat.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <label htmlFor="search-parents-assign" className="sr-only">Search parents</label>
        <input
          id="search-parents-assign"
          name="search-parents-assign"
          type="text"
          placeholder="Search by parent name, email, or student name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none shadow-sm transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Parents List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-white p-5 rounded-xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-40" />
                  <div className="h-3 bg-gray-200 rounded w-56" />
                </div>
                <div className="h-8 bg-gray-200 rounded w-28" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredParents.length === 0 ? (
        <Card className="border-dashed border-gray-300 bg-gray-50/50">
          <CardContent className="p-12 text-center text-gray-500">
            <UsersRound className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p className="font-semibold text-gray-700">No parents found</p>
            {search && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearch("")}>
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredParents.map((parent, idx) => {
            const isExpanded = expandedParentId === parent.id;
            return (
              <motion.div
                key={parent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
              >
                <Card className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Parent Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5">
                      {/* Avatar + Info */}
                      <button
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        onClick={() => setExpandedParentId(isExpanded ? null : parent.id)}
                      >
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                          {getInitials(parent.firstName, parent.lastName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm">{parent.firstName} {parent.lastName}</p>
                            <Badge className="text-[10px] bg-pink-50 text-pink-700 border-pink-200 font-semibold">PARENT</Badge>
                            {!parent.isActive && <Badge className="text-[10px] bg-red-50 text-red-700 border-red-200 font-semibold">INACTIVE</Badge>}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{parent.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {parent.linkedStudents.length} student{parent.linkedStudents.length !== 1 ? "s" : ""}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Assign Button */}
                      <Button
                        size="sm"
                        className="bg-[#047857] hover:bg-[#065f46] text-white font-semibold shadow-sm shrink-0 self-end sm:self-center"
                        onClick={() => openAssignModal(parent)}
                      >
                        <UserPlus className="w-4 h-4 mr-1.5" />
                        Assign Student
                      </Button>
                    </div>

                    {/* Expandable Linked Students */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-100 bg-gray-50/60 px-4 sm:px-5 py-3">
                            {parent.linkedStudents.length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-2 text-center">No students linked yet.</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                  Linked Talabat
                                </p>
                                {parent.linkedStudents.map((ls) => (
                                  <div
                                    key={ls.linkId}
                                    className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2"
                                  >
                                    <Avatar className="w-8 h-8 shrink-0">
                                      {ls.avatarUrl && <AvatarImage src={ls.avatarUrl} alt={ls.studentName} />}
                                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold">
                                        {getInitials(ls.studentName.split(" ")[0], ls.studentName.split(" ")[1] || "")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{ls.studentName}</p>
                                      <p className="text-xs text-gray-500">
                                        Grade {ls.grade}{ls.section}
                                        {ls.relationship && (
                                          <span className="ml-2 text-emerald-600 font-medium">· {ls.relationship}</span>
                                        )}
                                      </p>
                                    </div>
                                    <button
                                      className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                      title="Remove link"
                                      onClick={() =>
                                        setRevokingLink({
                                          linkId: ls.linkId,
                                          studentName: ls.studentName,
                                          parentName: `${parent.firstName} ${parent.lastName}`,
                                        })
                                      }
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Assign Student Modal ── */}
      <Modal open={!!assignModal} onOpenChange={(open) => !open && setAssignModal(null)}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle className="text-gray-900 font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-700" />
              Assign Talabat to Parent
            </ModalTitle>
          </ModalHeader>

          {assignModal && (
            <div className="space-y-4 py-2">
              {/* Parent Summary */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {getInitials(assignModal.parent.firstName, assignModal.parent.lastName)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {assignModal.parent.firstName} {assignModal.parent.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{assignModal.parent.email}</p>
                </div>
                <Badge className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                  {assignModal.parent.linkedStudents.length} linked
                </Badge>
              </div>

              {/* Relationship optional */}
              <div>
                <label htmlFor="relationship" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Relationship <span className="font-normal text-gray-400 normal-case">(optional)</span>
                </label>
                <input
                  id="relationship"
                  name="relationship"
                  type="text"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="e.g. Father, Mother, Guardian"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none bg-white"
                />
              </div>

              {/* Student Search */}
              <div>
                <label htmlFor="student-search-modal" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Select Student to Link
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="student-search-modal"
                    name="student-search-modal"
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by name, ID, or grade..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none bg-white"
                  />
                </div>

                {/* Available Students List */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                  {availableStudents.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-4">
                      {assignModal.parent.linkedStudents.length === students.length
                        ? "All students are already linked to this parent."
                        : "No students match your search."}
                    </p>
                  ) : (
                    availableStudents.map((student) => {
                      const isAssigning = assigningStudentId === student.id;
                      return (
                        <button
                          key={student.id}
                          type="button"
                          disabled={!!assigningStudentId}
                          onClick={() => handleAssign(student.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 bg-white text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Avatar className="w-9 h-9 shrink-0">
                            {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={`${student.firstName} ${student.lastName}`} />}
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold">
                              {getInitials(student.firstName, student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Grade {student.grade}{student.section} · ID: {student.studentId || "—"}
                            </p>
                          </div>
                          {isAssigning ? (
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                          ) : (
                            <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Currently Linked */}
              {assignModal.parent.linkedStudents.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Currently Linked</p>
                  <div className="flex flex-wrap gap-1.5">
                    {assignModal.parent.linkedStudents.map((ls) => (
                      <span
                        key={ls.linkId}
                        className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-medium"
                      >
                        <GraduationCap className="w-3 h-3" />
                        {ls.studentName}
                        <button
                          className="text-emerald-400 hover:text-red-600 ml-0.5"
                          onClick={() =>
                            setRevokingLink({
                              linkId: ls.linkId,
                              studentName: ls.studentName,
                              parentName: `${assignModal.parent.firstName} ${assignModal.parent.lastName}`,
                            })
                          }
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Revoke Confirmation Modal ── */}
      <Modal open={!!revokingLink} onOpenChange={() => setRevokingLink(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              Remove Student Link
            </ModalTitle>
          </ModalHeader>
          <div className="py-3 text-sm text-gray-600">
            <p>
              Are you sure you want to unlink{" "}
              <strong className="text-gray-900">{revokingLink?.studentName}</strong> from parent{" "}
              <strong className="text-gray-900">{revokingLink?.parentName}</strong>?
            </p>
            <p className="mt-2 text-xs text-gray-500">
              The parent will no longer be able to view this student's dashboard or progress.
            </p>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ModalClose>
            <Button size="sm" variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Remove Link
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
