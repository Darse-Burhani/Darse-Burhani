"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Shield,
  BookOpen,
  Trash2,
  CheckCircle,
  XCircle,
  Heart,
  UserCheck,
  GraduationCap,
  RefreshCw,
  X,
  AlertTriangle,
  Link2,
  KeyRound,
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

const portalTypes = [
  { value: "HIFZ", label: "Hifz Portal", icon: BookOpen, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "PORTFOLIO", label: "Portfolio Portal", icon: Shield, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "ALL", label: "Full Access", icon: Users, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

export default function AdminPortalAssignmentsPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [revokingAssignment, setRevokingAssignment] = useState<any>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/portal-assignments");
      const data = await res.json();
      if (data.success) {
        setTeachers(data.data.teachers || []);
        setAssignments(data.data.assignments || []);
        if (isManual) {
          toast({ variant: "success", title: "Refreshed", description: "Portal permissions reloaded." });
        }
      } else {
        toast({ variant: "destructive", title: "Fetch Error", description: data.error || "Failed to load portal assignments." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to server." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return teachers;
    return teachers.filter(
      (t) =>
        t.name?.toLowerCase().includes(query) ||
        t.email?.toLowerCase().includes(query) ||
        t.employeeId?.toLowerCase().includes(query)
    );
  }, [teachers, search]);

  const handleAssign = async (portalType: string) => {
    if (!selectedTeacher) {
      toast({ variant: "warning", title: "Select Teacher", description: "Please select a teacher first." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/portal-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedTeacher.id, portalType }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ variant: "success", title: "Permission Granted", description: `Assigned ${portalType} portal to ${selectedTeacher.name}.` });
        setShowAssignModal(false);
        setSelectedTeacher(null);
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Assignment Failed", description: data.error || "Could not assign portal." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to connect to server." });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingAssignment) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/portal-assignments?id=${revokingAssignment.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Access Revoked", description: "Teacher portal permission removed." });
        setRevokingAssignment(null);
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Revocation Failed", description: data.error || "Failed to remove access." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not remove permission due to network error." });
    } finally {
      setRevoking(false);
    }
  };

  const getTeacherAssignments = (teacherId: string) => {
    return assignments.filter((a) => {
      const teacher = teachers.find((t) => t.id === teacherId);
      return teacher && a.teacherEmail === teacher.email;
    });
  };

  const openAssignModalForTeacher = (teacher?: any) => {
    setSelectedTeacher(teacher || (teachers.length > 0 ? teachers[0] : null));
    setShowAssignModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* People & Directory Hub Navigation Tabs */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, student profiles, parent directory, and portal permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Assign Talabat to Parent", href: "/admin/parents/assign", icon: Link2 },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: UserCheck },
        ]}
      />

      {/* Fatimi Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #047857 0%, #065f46 50%, #064e3b 100%)" }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
              >
                <UserCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">Teacher Portal Permissions</h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs text-white font-semibold">
                    {assignments.length} Active
                  </span>
                </div>
                <p className="text-emerald-100 text-sm mt-1">Assign module-level portal access (Hifz, Portfolio, Full Access) to teachers.</p>
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
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button
                className="bg-[#d4af37] hover:bg-[#b8972e] text-white font-semibold shadow-lg shadow-black/20"
                onClick={() => openAssignModalForTeacher()}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Assign Access
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
        </div>
      </motion.div>

      {/* Portal Type Legend */}
      <div className="flex flex-wrap gap-3 mb-6 bg-white p-4 rounded-xl border border-[#d4af37]/25 shadow-sm">
        <span className="text-xs font-bold text-[#6b4c0a] uppercase tracking-wider self-center mr-2">Available Portals:</span>
        {portalTypes.map((type) => (
          <div key={type.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${type.color}`}>
            <type.icon className="w-4 h-4" />
            <span>{type.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <label htmlFor="search-teachers" className="sr-only">
          Search teachers
        </label>
        <input
          type="text"
          id="search-teachers"
          name="search-teachers"
          placeholder="Search by teacher name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none shadow-sm transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Teachers Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-white p-6 rounded-xl border border-gray-100">
              <div className="h-20 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((teacher, idx) => {
            const teacherAssignments = getTeacherAssignments(teacher.id);
            const hasHifz = teacherAssignments.some((a: any) => a.portalType === "HIFZ" && a.isActive);
            const hasPortfolio = teacherAssignments.some((a: any) => a.portalType === "PORTFOLIO" && a.isActive);
            const hasAll = teacherAssignments.some((a: any) => a.portalType === "ALL" && a.isActive);

            return (
              <motion.div key={teacher.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                <Card className="hover:shadow-md transition-shadow rounded-xl border border-gray-200 bg-white h-full flex flex-col justify-between">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                          {getInitials(teacher.name.split(" ")[0] || "T", teacher.name.split(" ")[1] || "")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 text-sm truncate">{teacher.name}</h3>
                          <p className="text-xs text-gray-500 truncate">{teacher.email}</p>
                          {teacher.employeeId && <p className="text-[10px] text-gray-400 mt-0.5">{teacher.employeeId}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[70px]">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigned Portals</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hasAll ? (
                          <div className="flex items-center justify-between w-full">
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold py-1 px-2">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Full Access
                            </Badge>
                            {teacherAssignments.find((a: any) => a.portalType === "ALL") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setRevokingAssignment(teacherAssignments.find((a: any) => a.portalType === "ALL"))}
                                title="Revoke access"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <>
                            {hasHifz && (
                              <div className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded text-xs font-medium">
                                <BookOpen className="w-3 h-3" /> Hifz
                                <button
                                  className="text-indigo-400 hover:text-red-600 ml-1"
                                  onClick={() => setRevokingAssignment(teacherAssignments.find((a: any) => a.portalType === "HIFZ"))}
                                  title="Remove Hifz"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {hasPortfolio && (
                              <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-xs font-medium">
                                <Shield className="w-3 h-3" /> Portfolio
                                <button
                                  className="text-amber-400 hover:text-red-600 ml-1"
                                  onClick={() => setRevokingAssignment(teacherAssignments.find((a: any) => a.portalType === "PORTFOLIO"))}
                                  title="Remove Portfolio"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {!hasHifz && !hasPortfolio && !hasAll && (
                          <span className="text-xs text-gray-400 italic">No access assigned</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium"
                      onClick={() => openAssignModalForTeacher(teacher)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Grant / Modify Access
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      <Modal open={showAssignModal} onOpenChange={setShowAssignModal}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="text-gray-900 font-bold">Assign Teacher Portal Access</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-3">
            <div>
              <label htmlFor="selectedTeacher" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Teacher *
              </label>
              <select
                id="selectedTeacher"
                name="selectedTeacher"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none bg-white"
                value={selectedTeacher?.id || ""}
                onChange={(e) => {
                  const teacher = teachers.find((t) => t.id === e.target.value);
                  setSelectedTeacher(teacher || null);
                }}
              >
                <option value="">Select teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            {selectedTeacher && (
              <fieldset className="border-0 p-0 m-0">
                <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">
                  Choose Portal Permission to Grant
                </legend>
                <div className="grid grid-cols-1 gap-2.5">
                  {portalTypes.map((type) => {
                    const teacherAssignments = getTeacherAssignments(selectedTeacher.id);
                    const hasAccess = teacherAssignments.some((a: any) => a.portalType === type.value && a.isActive);
                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          hasAccess
                            ? "border-emerald-500 bg-emerald-50/50 cursor-default"
                            : "border-gray-200 hover:border-gray-400 bg-white hover:bg-gray-50"
                        }`}
                        onClick={() => !hasAccess && handleAssign(type.value)}
                        disabled={saving || hasAccess}
                      >
                        <div className={`p-2 rounded-lg ${type.color} shrink-0`}>
                          <type.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm">{type.label}</p>
                          <p className="text-xs text-gray-500">
                            {type.value === "HIFZ" && "Hifz memorization logs & reviews"}
                            {type.value === "PORTFOLIO" && "Student portfolio view & scoring"}
                            {type.value === "ALL" && "Full access to all teaching modules"}
                          </p>
                        </div>
                        {hasAccess ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold">
                            Active
                          </Badge>
                        ) : saving ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <Plus className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal open={!!revokingAssignment} onOpenChange={() => setRevokingAssignment(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              Revoke Portal Access
            </ModalTitle>
          </ModalHeader>
          <div className="py-3 text-sm text-gray-600">
            <p>
              Are you sure you want to remove <strong className="text-gray-900">{revokingAssignment?.portalType}</strong> portal access from{" "}
              <strong className="text-gray-900">{revokingAssignment?.teacherName}</strong>?
            </p>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={revoking}
            >
              {revoking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Revoke Access
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
