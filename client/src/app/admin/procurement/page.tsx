"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Search,
  Filter,
  Download,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  User,
  Loader2,
  Trash2,
  Sparkles,
  Layers,
  ChevronRight,
  Send,
  Building2,
  Calendar,
  Eye,
  Check,
  Package,
  RefreshCw,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "STATIONERY", label: "Stationery & Supplies", icon: "✏️" },
  { value: "ELECTRONICS", label: "IT Hardware & Cables", icon: "💻" },
  { value: "CLASSROOM", label: "Classroom Aids", icon: "🏫" },
  { value: "BOOKS", label: "Books & Print", icon: "📚" },
  { value: "FURNITURE", label: "Furniture & Seating", icon: "🪑" },
  { value: "LAB", label: "Science & Lab", icon: "🔬" },
  { value: "MAINTENANCE", label: "Facility Maintenance", icon: "🛠️" },
  { value: "OTHER", label: "Miscellaneous", icon: "📦" },
];

export default function AdminProcurementPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState("ACTIVE");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Review & Fulfill Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [actionForm, setActionForm] = useState({
    status: "APPROVED",
    reviewerNotes: "",
    expectedDelivery: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [reqRes, statsRes] = await Promise.all([
        fetch(`/api/procurement/admin/all?limit=100`),
        fetch(`/api/procurement/admin/stats`),
      ]);

      const reqData = await reqRes.json().catch(() => null);
      const statsData = await statsRes.json().catch(() => null);

      if (!reqRes.ok || !reqData?.success) {
        throw new Error(reqData?.error || `Requisitions server responded with HTTP ${reqRes.status}`);
      }
      if (!statsRes.ok || !statsData?.success) {
        throw new Error(statsData?.error || `Stats server responded with HTTP ${statsRes.status}`);
      }

      setRequests(reqData.data.requests);
      setStats(statsData.data);
    } catch (err: any) {
      console.error("Admin procurement fetch error:", err);
      const msg = err?.message || "Could not fetch procurement requisitions.";
      setError(msg);
      toast({
        title: "Network Error",
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

  const openActionModal = (req: any, presetStatus?: string) => {
    setSelectedRequest(req);
    setActionForm({
      status: presetStatus || (req.status === "PENDING" ? "APPROVED" : req.status),
      reviewerNotes: req.reviewerNotes || "",
      expectedDelivery: req.expectedDelivery ? req.expectedDelivery.slice(0, 10) : "",
    });
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setSavingStatus(true);
      const res = await fetch(`/api/procurement/admin/${selectedRequest.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionForm),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Status Updated",
          description: data.message || "Requisition status updated successfully.",
          variant: "success",
        });
        setSelectedRequest(null);
        fetchData();
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Could not update requisition status.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to communicate with server.",
        variant: "destructive",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleExport = () => {
    window.open("/api/procurement/admin/export", "_blank");
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === "ACTIVE" && ["FULFILLED", "REJECTED"].includes(r.status)) return false;
      if (activeTab === "PENDING" && r.status !== "PENDING") return false;
      if (activeTab === "IN_PROGRESS" && !["APPROVED", "ORDERED"].includes(r.status)) return false;
      if (activeTab === "FULFILLED" && r.status !== "FULFILLED") return false;
      if (activeTab === "REJECTED" && r.status !== "REJECTED") return false;

      // Priority filter
      if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;

      // Category filter
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const requesterName = `${r.requester?.firstName || ""} ${r.requester?.lastName || ""}`.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchLoc = r.officeLocation.toLowerCase().includes(q);
        const matchRequester = requesterName.includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q) ?? false;
        return matchTitle || matchLoc || matchRequester || matchReason;
      }

      return true;
    });
  }, [requests, activeTab, priorityFilter, categoryFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-semibold"><Clock className="w-3 h-3" /> Pending Review</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-semibold"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
      case "ORDERED":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 font-semibold"><Truck className="w-3 h-3" /> In Procurement</Badge>;
      case "FULFILLED":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1 font-semibold"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fulfilled</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 font-semibold"><XCircle className="w-3 h-3" /> Declined</Badge>;
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

  const activeQueueCount = (stats?.pending ?? 0) + (stats?.approved ?? 0) + (stats?.ordered ?? 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold tracking-wider uppercase">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Administrative Fulfillment Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Procurement &amp; Supplies Management
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
            Review teacher and faculty supply requisitions, track office/classroom destinations, authorize orders, and fulfill requisitions.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <Button
            onClick={handleExport}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
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
                    Procurement Synchronization Notice
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

      {/* ── Executive KPI Metric Cards (Interactive Tabs) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card
          onClick={() => setActiveTab("ACTIVE")}
          className={`border-gray-200 cursor-pointer transition-all hover:shadow-md ${activeTab === "ACTIVE" ? "ring-2 ring-emerald-600 bg-emerald-50/40" : "bg-white"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Active Queue</p>
              <p className="text-xl font-bold text-gray-900">{activeQueueCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("PENDING")}
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeTab === "PENDING"
              ? "ring-2 ring-amber-500 bg-amber-100/70 border-amber-400"
              : stats?.urgentPending > 0
              ? "bg-amber-100/60 border-amber-300"
              : "bg-amber-50/50 border-amber-200"
          }`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Pending Review</p>
                {stats?.urgentPending > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-extrabold px-1 rounded-full animate-bounce">
                    {stats.urgentPending} Urgent
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-amber-950">{stats?.pending ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("IN_PROGRESS")}
          className={`border-blue-200 cursor-pointer transition-all hover:shadow-md ${activeTab === "IN_PROGRESS" ? "ring-2 ring-blue-600 bg-blue-100/60" : "bg-blue-50/50"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-blue-800 uppercase tracking-wide">In Procurement</p>
              <p className="text-xl font-bold text-blue-950">{(stats?.approved ?? 0) + (stats?.ordered ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("FULFILLED")}
          className={`border-emerald-300 cursor-pointer transition-all hover:shadow-md ${activeTab === "FULFILLED" ? "ring-2 ring-emerald-600 bg-emerald-100/80 shadow-emerald-500/10" : "bg-emerald-50/50"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200/80 flex items-center justify-center text-emerald-900 shrink-0 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">Fulfilled Total</p>
              <p className="text-xl font-bold text-emerald-950">{stats?.fulfilled ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        {/* Status Tabs */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl overflow-x-auto">
            {[
              { id: "ACTIVE", label: `Active Dashboard (${activeQueueCount})` },
              { id: "PENDING", label: `Pending Review (${stats?.pending ?? 0})` },
              { id: "IN_PROGRESS", label: `In Procurement (${(stats?.approved ?? 0) + (stats?.ordered ?? 0)})` },
              { id: "FULFILLED", label: `Fulfilled Total (${stats?.fulfilled ?? 0})` },
              { id: "REJECTED", label: `Declined (${stats?.rejected ?? 0})` },
              { id: "ALL", label: `All Archive (${requests.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-emerald-900 shadow-sm font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search item, room, teacher name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Priority & Category Dropdown row */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">🚨 Urgent Only</option>
              <option value="HIGH">High Priority</option>
              <option value="NORMAL">Normal Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          <span className="ml-auto text-[11px] text-gray-400">
            Showing <strong>{filteredRequests.length}</strong> requisition(s)
          </span>
        </div>
      </div>

      {/* ── Requisitions Table / Cards ── */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Loading school requisitions...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white/60 p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-gray-900 text-base">No Requisitions Match Filters</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Adjust search criteria or status filter to inspect past or current procurement orders.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const requester = req.requester;
            const teacherProfile = requester?.teacherProfile;
            const fullName = requester ? `${requester.firstName} ${requester.lastName}`.trim() : "Unknown";

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 shadow-sm hover:shadow transition-all p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Column 1: Requester Details */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <Avatar className="w-10 h-10 border border-emerald-200 shrink-0">
                    <AvatarFallback className="bg-emerald-100 text-emerald-900 font-bold text-xs">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{fullName}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {teacherProfile?.department ? `${teacherProfile.department} · ` : ""}
                      {teacherProfile?.employeeId || requester?.email || "Faculty"}
                    </p>
                  </div>
                </div>

                {/* Column 2: Requisition Item & Destination Location */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-bold text-gray-900 text-sm truncate">
                      {req.title}
                    </h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 shrink-0">
                      {req.quantity} {req.unit}
                    </span>
                    {getPriorityBadge(req.priority)}
                  </div>

                  {/* Destination Location Pill (Core Requirement) */}
                  <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Office Destination: <strong className="font-bold text-emerald-950">{req.officeLocation}</strong></span>
                  </div>

                  {req.reason && (
                    <p className="text-[11px] text-gray-500 italic line-clamp-1">
                      "{req.reason}"
                    </p>
                  )}
                </div>

                {/* Column 3: Status */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">
                      {new Date(req.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </p>
                  </div>

                  <div className="min-w-[130px] flex justify-end">
                    {getStatusBadge(req.status)}
                  </div>

                  {/* Quick Action Button */}
                  <div className="flex items-center gap-1.5">
                    {req.status === "PENDING" ? (
                      <Button
                        size="sm"
                        onClick={() => openActionModal(req, "FULFILLED")}
                        className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl h-8 px-3"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Fulfill
                      </Button>
                    ) : null}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openActionModal(req)}
                      className="border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl h-8 px-3"
                    >
                      <span>Review</span>
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Review, Fulfill & Status Transition ── */}
      {selectedRequest && (
        <Modal open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <ModalContent className="max-w-xl">
            <ModalHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  <span>Admin Fulfillment Console</span>
                </div>
                {getPriorityBadge(selectedRequest.priority)}
              </div>
              <ModalTitle className="text-xl font-display font-bold text-gray-900 mt-1">
                {selectedRequest.title}
              </ModalTitle>
            </ModalHeader>

            <form onSubmit={handleUpdateStatus} className="space-y-4 py-2">
              {/* Requester & Location Snapshot Card */}
              <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-semibold text-emerald-950">
                      Requested by: {selectedRequest.requester?.firstName} {selectedRequest.requester?.lastName}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-medium">
                    {selectedRequest.requester?.teacherProfile?.department || selectedRequest.requester?.email}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs pt-1 border-t border-emerald-200/60 text-emerald-900">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Delivery Office Place: <strong className="font-bold text-emerald-950">{selectedRequest.officeLocation}</strong></span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800 pt-1">
                  <div>Quantity: <strong>{selectedRequest.quantity} {selectedRequest.unit}</strong></div>
                  <div>Category: <strong>{selectedRequest.category}</strong></div>
                </div>

                {selectedRequest.reason && (
                  <div className="text-xs text-gray-700 bg-white/70 p-2 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-emerald-900">Purpose / Justification: </span>
                    {selectedRequest.reason}
                  </div>
                )}
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Update Fulfillment Status <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "APPROVED", label: "Approve Order", icon: CheckCircle2, color: "text-blue-700 border-blue-300 bg-blue-50" },
                    { id: "ORDERED", label: "In Procurement", icon: Truck, color: "text-indigo-700 border-indigo-300 bg-indigo-50" },
                    { id: "FULFILLED", label: "Fulfilled & Done", icon: Check, color: "text-emerald-700 border-emerald-400 bg-emerald-50" },
                    { id: "REJECTED", label: "Decline", icon: XCircle, color: "text-red-700 border-red-300 bg-red-50" },
                  ].map((s) => {
                    const isSelected = actionForm.status === s.id;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActionForm({ ...actionForm, status: s.id })}
                        className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? `${s.color} ring-2 ring-emerald-600 shadow-sm font-extrabold`
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expected Delivery Date (if approved/ordered) */}
              {(actionForm.status === "APPROVED" || actionForm.status === "ORDERED") && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={actionForm.expectedDelivery}
                    onChange={(e) => setActionForm({ ...actionForm, expectedDelivery: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              )}

              {/* Administration Remarks / Feedback */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Admin Remarks & Fulfillment Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. 'Delivered to Room 204 desk', or 'Ordered on Amazon, delivery expected Tuesday', or reason if declined..."
                  value={actionForm.reviewerNotes}
                  onChange={(e) => setActionForm({ ...actionForm, reviewerNotes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none resize-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  This note will be sent automatically to the teacher via in-app notification.
                </p>
              </div>

              <ModalFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
                  disabled={savingStatus}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingStatus}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold"
                >
                  {savingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving & Notifying...
                    </>
                  ) : (
                    "Save & Update Status"
                  )}
                </Button>
              </ModalFooter>
            </form>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}
