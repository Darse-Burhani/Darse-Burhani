"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  Loader2,
  Trash2,
  ChevronRight,
  Filter,
  Sparkles,
  Building2,
  Package,
  Layers,
  HelpCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const CATEGORIES = [
  { value: "STATIONERY", label: "Stationery & Supplies", icon: "✏️" },
  { value: "ELECTRONICS", label: "IT Hardware & Cables", icon: "💻" },
  { value: "CLASSROOM", label: "Classroom & Teaching Aids", icon: "🏫" },
  { value: "BOOKS", label: "Books & Curriculum Print", icon: "📚" },
  { value: "FURNITURE", label: "Furniture & Seating", icon: "🪑" },
  { value: "LAB", label: "Science & Lab Equipment", icon: "🔬" },
  { value: "MAINTENANCE", label: "Facility & Maintenance", icon: "🛠️" },
  { value: "OTHER", label: "General & Miscellaneous", icon: "📦" },
];

const PRESET_LOCATIONS = [
  "Main Staff Room Desk",
  "Classroom 101",
  "Classroom 102",
  "Classroom 201",
  "Classroom 202",
  "Primary Section Office",
  "Hifz Hall",
  "Computer Lab",
  "Science Laboratory",
  "Library Staff Desk",
];

export default function TeacherProcurementPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "STATIONERY",
    quantity: 1,
    unit: "pcs",
    officeLocation: "",
    priority: "NORMAL",
    reason: "",
  });

  // Details Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [reqRes, statsRes] = await Promise.all([
        fetch("/api/procurement/my"),
        fetch("/api/procurement/my-stats"),
      ]);

      const reqData = await reqRes.json().catch(() => null);
      const statsData = await statsRes.json().catch(() => null);

      if (!reqRes.ok || !reqData?.success) {
        throw new Error(reqData?.error || `Requisitions server responded with HTTP ${reqRes.status}`);
      }
      if (!statsRes.ok || !statsData?.success) {
        throw new Error(statsData?.error || `Stats server responded with HTTP ${statsRes.status}`);
      }

      setRequests(reqData.data);
      setStats(statsData.data);
    } catch (err: any) {
      console.error("Failed to load requisitions:", err);
      const msg = err?.message || "Could not fetch procurement requisitions.";
      setError(msg);
      toast({
        title: "Connection Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast({ title: "Title Required", description: "Please enter the item name or requisition title.", variant: "destructive" });
      return;
    }

    if (!form.officeLocation.trim()) {
      toast({ title: "Office Location Required", description: "Please specify your office or classroom room place.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/procurement/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Requisition Submitted",
          description: "Your procurement request has been routed to administration.",
          variant: "success",
        });
        setCreateModalOpen(false);
        setForm({
          title: "",
          category: "STATIONERY",
          quantity: 1,
          unit: "pcs",
          officeLocation: "",
          priority: "NORMAL",
          reason: "",
        });
        fetchData();
      } else {
        toast({
          title: "Submission Failed",
          description: data.error || "Could not submit request.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to communicate with server.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this pending requisition?")) return;
    try {
      setCancellingId(id);
      const res = await fetch(`/api/procurement/request/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Cancelled", description: "Requisition cancelled successfully.", variant: "default" });
        if (selectedRequest?.id === id) setSelectedRequest(null);
        fetchData();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not cancel request", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === "ACTIVE" && ["FULFILLED", "REJECTED"].includes(r.status)) return false;
      if (activeTab === "PENDING" && r.status !== "PENDING") return false;
      if (activeTab === "IN_PROGRESS" && !["APPROVED", "ORDERED"].includes(r.status)) return false;
      if (activeTab === "FULFILLED" && r.status !== "FULFILLED") return false;
      if (activeTab === "REJECTED" && r.status !== "REJECTED") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchLoc = r.officeLocation.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q) ?? false;
        const matchCat = r.category.toLowerCase().includes(q);
        return matchTitle || matchLoc || matchReason || matchCat;
      }

      return true;
    });
  }, [requests, activeTab, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Clock className="w-3 h-3" /> Under Review</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
      case "ORDERED":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1"><Truck className="w-3 h-3" /> In Procurement</Badge>;
      case "FULFILLED":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 font-semibold"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fulfilled</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge className="bg-red-600 text-white font-bold animate-pulse text-[10px] uppercase">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500 text-white text-[10px] uppercase">High</Badge>;
      case "LOW":
        return <Badge variant="secondary" className="text-gray-500 text-[10px] uppercase">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-gray-700 text-[10px] uppercase">Normal</Badge>;
    }
  };

  const activeTeacherCount = (stats?.pending ?? 0) + (stats?.inProgress ?? 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-[#044e39] to-teal-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold tracking-wider uppercase">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Faculty Supplies &amp; Procurement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Procurement Requisitions
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
            Submit material and supply requests for your classroom or faculty office. All requests are routed directly to administration for fulfillment.
          </p>
        </div>

        <div className="relative z-10">
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-amber-400/20 transition-all flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Raise Requisition</span>
          </Button>
        </div>
      </div>

      {/* ── Displayed Error Message Banner (if error happens) ── */}
      {error && (
        <div className="relative overflow-hidden rounded-2xl border border-red-200/90 bg-gradient-to-r from-red-50 via-rose-50/70 to-amber-50/40 p-4 sm:p-5 shadow-lg shadow-red-500/5">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-500 to-rose-600" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 border border-red-200/70 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-red-950 tracking-tight">
                    Procurement Portal Notice
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-red-100/80 text-red-700 border-red-300">
                    Connection Error
                  </Badge>
                </div>
                <p className="text-xs text-red-800/90 leading-relaxed max-w-2xl">
                  {error}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="h-8 rounded-xl bg-white hover:bg-red-50 text-red-700 border-red-200 text-xs font-semibold shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Retry
              </Button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-100/60 transition-colors"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Stat Cards (Clickable) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          onClick={() => setActiveTab("ACTIVE")}
          className={`cursor-pointer border-gray-200 hover:shadow-md transition-all ${activeTab === "ACTIVE" ? "ring-2 ring-emerald-600 bg-emerald-50/40" : "bg-white"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Active Requests</p>
              <p className="text-xl font-bold text-gray-900">{activeTeacherCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("PENDING")}
          className={`cursor-pointer border-amber-200 hover:shadow-md transition-all ${activeTab === "PENDING" ? "ring-2 ring-amber-500 bg-amber-100/70" : "bg-amber-50/50"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-800">Pending Review</p>
              <p className="text-xl font-bold text-amber-900">{stats?.pending ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("IN_PROGRESS")}
          className={`cursor-pointer border-blue-200 hover:shadow-md transition-all ${activeTab === "IN_PROGRESS" ? "ring-2 ring-blue-600 bg-blue-100/60" : "bg-blue-50/50"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-800">In Procurement</p>
              <p className="text-xl font-bold text-blue-900">{stats?.inProgress ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("FULFILLED")}
          className={`cursor-pointer border-emerald-300 hover:shadow-md transition-all ${activeTab === "FULFILLED" ? "ring-2 ring-emerald-600 bg-emerald-100/80 shadow-emerald-500/10" : "bg-emerald-50/50"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200/80 flex items-center justify-center text-emerald-900 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Fulfilled Total</p>
              <p className="text-xl font-bold text-emerald-950">{stats?.fulfilled ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Tabs & Search Bar ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl overflow-x-auto">
          {[
            { id: "ACTIVE", label: `Active (${activeTeacherCount})` },
            { id: "PENDING", label: `Pending (${stats?.pending ?? 0})` },
            { id: "IN_PROGRESS", label: `In Procurement (${stats?.inProgress ?? 0})` },
            { id: "FULFILLED", label: `Fulfilled Total (${stats?.fulfilled ?? 0})` },
            { id: "REJECTED", label: `Declined (${stats?.rejected ?? 0})` },
            { id: "ALL", label: `All History (${requests.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-white text-emerald-900 shadow-sm font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, room location, or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Requisitions List ── */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Loading your procurement requisitions...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white/60 p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-gray-900 text-base">No Requisitions Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchQuery
                ? "No procurement requests matched your search criteria."
                : "You have not raised any procurement requests under this status."}
            </p>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            variant="outline"
            className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Raise New Request
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => {
            const cat = CATEGORIES.find((c) => c.value === req.category);
            return (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar: Category icon + Status & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{cat?.icon || "📦"}</span>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        {cat?.label || req.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getPriorityBadge(req.priority)}
                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Title & Quantity */}
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-base group-hover:text-emerald-800 transition-colors line-clamp-1">
                      {req.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Quantity: <span className="font-semibold text-gray-800">{req.quantity} {req.unit}</span>
                    </p>
                  </div>

                  {/* Office Place (Key Requirement) */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/80 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-medium">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="truncate">Destination: <strong className="font-semibold">{req.officeLocation}</strong></span>
                  </div>

                  {/* Purpose / Justification snippet */}
                  {req.reason && (
                    <p className="text-xs text-gray-600 line-clamp-2 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      "{req.reason}"
                    </p>
                  )}

                  {/* Admin Fulfillment Note / Feedback */}
                  {req.reviewerNotes && (
                    <div className="text-xs bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-amber-900 space-y-0.5">
                      <p className="font-semibold flex items-center gap-1 text-[11px] text-amber-800">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        Admin Remark:
                      </p>
                      <p className="line-clamp-2">{req.reviewerNotes}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer: Date & Details Action */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(req.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                  
                  <div className="flex items-center gap-2">
                    {req.status === "PENDING" && (
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        disabled={cancellingId === req.id}
                        className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="Cancel requisition"
                      >
                        {cancellingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 transition-colors hover:underline"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Raise Procurement Request ── */}
      <Modal open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>New Requisition</span>
            </div>
            <ModalTitle className="text-xl font-display font-bold text-gray-900">
              Raise Procurement Request
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2">
            {/* Item Title */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Item Title / Supply Needed <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Whiteboard Markers (Pack of 10) & Duster"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Urgency / Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-medium"
                >
                  <option value="LOW">Low (Whenever convenient)</option>
                  <option value="NORMAL">Normal (Standard order)</option>
                  <option value="HIGH">High (Needed this week)</option>
                  <option value="URGENT">Urgent (Immediate classroom need)</option>
                </select>
              </div>
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  placeholder="pcs, boxes, reams"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Office Place / Location (User Core Requirement) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700">
                  Office Place / Classroom Location <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-gray-500">Where this will be delivered</span>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Room 204 (Science Wing), Main Staff Room Desk 5"
                value={form.officeLocation}
                onChange={(e) => setForm({ ...form, officeLocation: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              {/* Quick Preset Location Chips */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] text-gray-500 font-semibold mr-1">Quick pick:</span>
                {PRESET_LOCATIONS.slice(0, 5).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setForm({ ...form, officeLocation: loc })}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-600 transition-colors"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose / Need Justification */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Purpose & Justification of Need
              </label>
              <textarea
                rows={2}
                placeholder="Explain why this item is needed and how it will be utilized in classroom/office..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none resize-none"
              />
            </div>



            <ModalFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit to Administration"
                )}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ── Modal: Requisition Detail ── */}
      {selectedRequest && (
        <Modal open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <ModalContent className="max-w-lg">
            <ModalHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getPriorityBadge(selectedRequest.priority)}
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(selectedRequest.createdAt).toLocaleString()}
                </span>
              </div>
              <ModalTitle className="text-xl font-display font-bold text-gray-900 mt-2">
                {selectedRequest.title}
              </ModalTitle>
            </ModalHeader>

            <div className="space-y-4 py-3 text-sm">
              {/* Delivery Location Banner */}
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">Destination Office Location</p>
                  <p className="text-sm font-bold">{selectedRequest.officeLocation}</p>
                </div>
              </div>

              {/* Core Details Grid */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs">
                <div>
                  <span className="text-gray-500">Category:</span>
                  <p className="font-semibold text-gray-800">{selectedRequest.category}</p>
                </div>
                <div>
                  <span className="text-gray-500">Quantity & Unit:</span>
                  <p className="font-semibold text-gray-800">{selectedRequest.quantity} {selectedRequest.unit}</p>
                </div>
                <div>
                  <span className="text-gray-500">Category:</span>
                  <p className="font-semibold text-gray-800">{selectedRequest.category}</p>
                </div>
              </div>

              {/* Justification */}
              {selectedRequest.reason && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-1">Purpose / Justification</h4>
                  <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    {selectedRequest.reason}
                  </p>
                </div>
              )}

              {/* Administration Review & Fulfillment Notes */}
              {selectedRequest.reviewerNotes && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-amber-900 space-y-1">
                  <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                    Administration Fulfillment Notes
                  </h4>
                  <p className="text-xs">{selectedRequest.reviewerNotes}</p>
                </div>
              )}
            </div>

            <ModalFooter className="flex justify-between items-center">
              {selectedRequest.status === "PENDING" ? (
                <Button
                  variant="outline"
                  onClick={() => handleCancelRequest(selectedRequest.id)}
                  disabled={cancellingId === selectedRequest.id}
                  className="text-red-600 hover:bg-red-50 border-red-200 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Cancel Requisition
                </Button>
              ) : <div />}

              <Button
                variant="outline"
                onClick={() => setSelectedRequest(null)}
                className="text-xs"
              >
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}
