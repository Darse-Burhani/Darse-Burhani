"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Loader2,
  CalendarDays,
  Pencil,
  History,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { monthName, statusMeta } from "@/lib/takhteet";

export default function TeacherTakhteetPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [updatingPlan, setUpdatingPlan] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/teacher/takhteet");
      const data = await res.json();
      if (data.success) setPlans(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentMonth = new Date().getMonth() + 1;

  const stats = useMemo(() => {
    const pending = plans.filter((p) => p.status === "PENDING").length;
    const inProgress = plans.filter((p) => p.status === "IN_PROGRESS").length;
    const completed = plans.filter((p) => p.status === "COMPLETED").length;
    const overdue = plans.filter((p) => p.month && p.month < currentMonth && p.status !== "COMPLETED").length;
    const avg = plans.length ? Math.round(plans.reduce((a, p) => a + p.progress, 0) / plans.length) : 0;
    return { total: plans.length, pending, inProgress, completed, overdue, avg };
  }, [plans]);
  const currentPlans = plans.filter(
    (p) => p.status !== "COMPLETED" && (!p.month || p.month === currentMonth)
  );

  const filteredPlans = plans.filter((p) => !filterStatus || p.status === filterStatus);

  const openUpdateModal = (plan: any) => {
    setUpdatingPlan(plan);
    setUpdateForm({ progress: String(plan.progress), status: plan.status, note: "" });
  };

  const handleSave = async () => {
    if (!updatingPlan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher/takhteet/${updatingPlan.id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateForm),
      });
      const data = await res.json();
      if (data.success) {
        setUpdatingPlan(null);
        await fetchData();
      } else {
        alert(data.error || "Failed to update progress");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="fatimi-header-banner">
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent">
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>My Takhteet</h1>
                <p className="text-emerald-100 text-sm mt-1">Portions assigned to you — track your progress</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      {/* Overdue alert */}
      {!loading && stats.overdue > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">You have {stats.overdue} overdue portion{stats.overdue === 1 ? "" : "s"}</p>
              <p className="text-xs text-red-600">Update their progress or mark them complete.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="fatimi-card animate-pulse"><div className="fatimi-card-header" /><CardContent className="p-5"><div className="w-10 h-10 bg-gray-200 rounded-xl mb-3" /><div className="w-16 h-4 bg-gray-200 rounded mb-2" /><div className="w-10 h-7 bg-gray-200 rounded" /></CardContent></Card>)}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { title: "Total Portions", value: stats.total, color: "bg-indigo-100 text-indigo-600" },
            { title: "Due This Month", value: currentPlans.length, color: "bg-amber-100 text-amber-600" },
            { title: "In Progress", value: stats.inProgress, color: "bg-amber-100 text-amber-600" },
            { title: "Completed", value: stats.completed, color: "bg-emerald-100 text-[#047857]" },
          ].map((stat) => (
            <Card key={stat.title} className="fatimi-card hover:shadow-md transition-shadow">
              <div className="fatimi-card-header" />
              <CardContent className="p-5">
                <div className={`p-2 rounded-xl w-fit ${stat.color} mb-3`}><ClipboardList className="w-4 h-4" /></div>
                <p className="text-xs text-gray-500 font-medium">{stat.title}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {["", "PENDING", "IN_PROGRESS", "COMPLETED"].map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? "default" : "outline"}
            size="sm"
            className={filterStatus === s ? "fatimi-emerald-gradient text-white" : "border-emerald-200/60 text-gray-600 hover:bg-emerald-50"}
            onClick={() => setFilterStatus(s)}
          >
            {s === "" ? "All" : s === "PENDING" ? "Pending" : s === "IN_PROGRESS" ? "In Progress" : "Completed"}
          </Button>
        ))}
      </div>

      {/* Plans */}
      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="fatimi-card animate-pulse"><div className="fatimi-card-header" /><CardContent className="p-5"><div className="w-2/3 h-5 bg-gray-200 rounded mb-3" /><div className="w-full h-3 bg-gray-200 rounded mb-2" /><div className="w-1/2 h-3 bg-gray-200 rounded" /></CardContent></Card>)}
        </div>
      ) : filteredPlans.length > 0 ? (
        <div className="grid gap-4">
          {filteredPlans.map((p, i) => {
            const meta = statusMeta(p.status);
            const overdue = p.month && p.month < currentMonth && p.status !== "COMPLETED";
            const due = p.month === currentMonth && p.status !== "COMPLETED";
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`fatimi-card hover:shadow-md transition-shadow ${overdue ? "border-red-200" : ""}`}>
                  <div className="fatimi-card-header" />
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{p.title}</h3>
                          <Badge variant="outline" className="text-[10px]">{p.subject}</Badge>
                          <Badge className={`text-[10px] border ${meta.badge}`}>{meta.label}</Badge>
                          {overdue && <Badge variant="destructive" className="text-[10px] flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Overdue</Badge>}
                          {due && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1"><CalendarDays className="w-2.5 h-2.5" /> Due this month</Badge>}
                        </div>
                        <p className="text-sm text-gray-500">{p.className}</p>
                        {p.description && <p className="text-xs text-gray-500 mt-1 truncate">{p.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {p.academicYear}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {monthName(p.month)}</span>
                          {!p.month && <span>Full year</span>}
                        </div>
                      </div>

                      <div className="lg:w-56 shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500 font-medium">Progress</span>
                          <span className="text-xs font-bold text-gray-900">{p.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-emerald-100/60 overflow-hidden">
                          <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${p.progress}%` }} />
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="border-emerald-200/60 text-[#047857] hover:bg-emerald-50" onClick={() => openUpdateModal(p)}>
                          <Pencil className="w-3 h-3 mr-1" /> Update Progress
                        </Button>
                      </div>
                    </div>

                    {p.logs && p.logs.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2"><History className="w-3 h-3" /> Progress History</p>
                        <div className="space-y-1.5">
                          {p.logs.slice(0, 3).map((log: any) => (
                            <div key={log.id} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="text-gray-500 shrink-0">{new Date(log.createdAt).toLocaleDateString()}</span>
                              <span className="text-gray-700 shrink-0">{log.progressBefore}% → {log.progressAfter}%</span>
                              {log.note && <span className="truncate italic text-gray-500">“{log.note}”</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card><CardContent className="p-12 text-center text-gray-500">No takhteet assigned to you yet.</CardContent></Card>
      )}

      {/* Update Progress Modal */}
      <Modal open={!!updatingPlan} onOpenChange={() => setUpdatingPlan(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl fatimi-emerald-gradient flex items-center justify-center">
                <Pencil className="w-4 h-4 text-white" />
              </div>
              Update Progress
            </ModalTitle>
          </ModalHeader>
          {updatingPlan && updateForm && (
            <div className="space-y-4 py-4">
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3">
                <p className="font-medium text-gray-900 text-sm">{updatingPlan.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{updatingPlan.className} • {updatingPlan.subject}</p>
              </div>
              <div>
                <label htmlFor="up-status" className="text-sm font-medium text-gray-700">Status</label>
                <select id="up-status" name="status" className="fatimi-input mt-1" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label htmlFor="up-progress" className="text-sm font-medium text-gray-700">Progress: {updateForm.progress}%</label>
                <input id="up-progress" name="progress" type="range" min={0} max={100} step={5} className="w-full mt-2 accent-[#047857]" value={updateForm.progress} onChange={(e) => setUpdateForm({ ...updateForm, progress: e.target.value })} />
              </div>
              <div>
                <label htmlFor="up-note" className="text-sm font-medium text-gray-700">Note (optional)</label>
                <input id="up-note" name="note" className="fatimi-input mt-1" placeholder="e.g., Covered first half of unit" value={updateForm.note} onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })} />
              </div>
            </div>
          )}
          <ModalFooter>
            <ModalClose asChild><Button variant="outline" size="sm" className="border-emerald-200/60">Cancel</Button></ModalClose>
            <Button size="sm" className="fatimi-emerald-gradient text-white hover:opacity-90" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}