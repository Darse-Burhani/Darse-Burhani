"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Printer,
  Users,
  GraduationCap,
  Sparkles,
  Barcode,
  Layers,
  ChevronRight,
  RefreshCw,
  X,
  Scan,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export interface ReturnedBookRecord {
  id: string;
  loanId: string;
  bookId: string;
  bookTitle: string;
  barcode: string;
  author: string | null;
  category: string | null;
  coverImage: string | null;
  rackNumber?: string | null;
  borrowerName: string;
  borrowerId: string;
  borrowerDarjah?: string | null;
  borrowerRole?: string | null;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string;
  returnHijri?: string | null;
  isLate: boolean;
  garamat?: {
    isLate: boolean;
    daysLate: number;
    ratePerDay: number;
    calculatedAmount: number;
    status: "COLLECTED" | "WAIVED" | "PENDING";
    paidAmount?: number;
    notes?: string;
  } | null;
}

interface ReturnStats {
  totalReturnedToday: number;
  uniqueBorrowersCount: number;
  onTimeCount: number;
  lateCount: number;
  totalGaramat: number;
}

interface ReturnBooksLogProps {
  onReturnAnother?: () => void;
  className?: string;
  defaultFilter?: "today" | "all";
}

export default function ReturnBooksLog({
  onReturnAnother,
  className = "",
  defaultFilter = "today",
}: ReturnBooksLogProps) {
  // State
  const [records, setRecords] = useState<ReturnedBookRecord[]>([]);
  const [stats, setStats] = useState<ReturnStats>({
    totalReturnedToday: 0,
    uniqueBorrowersCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    totalGaramat: 0,
  });
  const [todaysBorrowers, setTodaysBorrowers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"today" | "all" | "late" | "ontime">(defaultFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBorrowerFilter, setSelectedBorrowerFilter] = useState<string | null>(null);

  // Quick return input inside the log
  const [quickBarcode, setQuickBarcode] = useState("");
  const [quickProcessing, setQuickProcessing] = useState(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReturnedBookRecord | null>(null);

  // Fetch today's summary & names
  const fetchTodayData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/library/return/today");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data.stats || {
            totalReturnedToday: 0,
            uniqueBorrowersCount: 0,
            onTimeCount: 0,
            lateCount: 0,
            totalGaramat: 0,
          });
          setTodaysBorrowers(json.data.todaysBorrowerNames || []);
        }
      }
    } catch {
      // background fetch fail-safe
    }
  }, []);

  // Fetch return logs
  const fetchReturnLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const isToday = activeTab === "today";
      const url = `/api/admin/library/return/logs?limit=100${isToday ? "&today=true" : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRecords(json.data);
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load returned books log", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTodayData();
    fetchReturnLogs();
  }, [fetchTodayData, fetchReturnLogs]);

  // Quick return trigger
  const handleQuickReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = quickBarcode.trim();
    if (!term) return;

    setQuickProcessing(true);
    try {
      const res = await fetch("/api/admin/library/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: term,
          confirmRestock: true,
          garamatAction: "COLLECTED",
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Book Returned Successfully",
          description: `"${json.data.book?.title || term}" checked back into Maktabat catalog.`,
          variant: "success",
        });
        setQuickBarcode("");
        // Instantly refresh today's names & log
        fetchTodayData();
        fetchReturnLogs(true);
      } else {
        toast({
          title: "Return Unsuccessful",
          description: json.error || "No active loan found for this barcode",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network Error", description: "Failed to communicate with library server", variant: "destructive" });
    } finally {
      setQuickProcessing(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      toast({ title: "No Records", description: "No return records to export", variant: "default" });
      return;
    }

    const headers = [
      "Return Timestamp (IST)",
      "Return Date (Hijri)",
      "Book Title",
      "Barcode",
      "Borrower Name",
      "Borrower ID / ITS",
      "Darajah / Role",
      "Borrowed Date",
      "Due Date",
      "Return Status",
      "Days Late",
      "Garamat Amount (INR)",
      "Garamat Status",
    ];

    const rows = records.map((r) => [
      `"${new Date(r.returnedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}"`,
      `"${r.returnHijri || "—"}"`,
      `"${(r.bookTitle || "").replace(/"/g, '""')}"`,
      `"${r.barcode || ""}"`,
      `"${(r.borrowerName || "").replace(/"/g, '""')}"`,
      `"${r.borrowerId || ""}"`,
      `"${r.borrowerDarjah || r.borrowerRole || "—"}"`,
      `"${new Date(r.borrowedAt).toLocaleDateString("en-IN")}"`,
      `"${new Date(r.dueAt).toLocaleDateString("en-IN")}"`,
      `"${r.isLate ? "LATE" : "ON TIME"}"`,
      r.garamat?.daysLate || 0,
      r.garamat?.calculatedAmount || 0,
      `"${r.garamat?.status || "NONE"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Maktabat_Returns_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Complete", description: "Return books ledger saved as CSV file.", variant: "success" });
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Tab filter
      if (activeTab === "late" && !r.isLate) return false;
      if (activeTab === "ontime" && r.isLate) return false;

      // Borrower name filter
      if (selectedBorrowerFilter && r.borrowerName !== selectedBorrowerFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.bookTitle.toLowerCase().includes(q) ||
          r.barcode.toLowerCase().includes(q) ||
          r.borrowerName.toLowerCase().includes(q) ||
          r.borrowerId.toLowerCase().includes(q) ||
          (r.category && r.category.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [records, activeTab, selectedBorrowerFilter, searchQuery]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── Today's Returns Cockpit & Names Ticker ── */}
      <div className="fatimi-header-banner relative overflow-hidden rounded-3xl border border-[#d4af37]/40 p-5 sm:p-7 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-12 -bottom-12 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-64 h-64 rounded-full bg-[#c59b27]/10 blur-3xl" />

        <div className="relative z-10 space-y-5">
          {/* Header & Quick Stats Strip */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  Maktabat Circulation
                </span>
                <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-300 text-xs font-mono font-bold">
                  Live Log
                </Badge>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Returned Books Log &amp; Today&apos;s Return Names</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Dynamic ledger of books returned to the Maktabat library, borrower names, on-time status, and fine settlements.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
              {onReturnAnother && (
                <Button
                  onClick={onReturnAnother}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl px-4 py-2 flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Return Another Book</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs rounded-xl px-3 py-2 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Export CSV</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  fetchTodayData();
                  fetchReturnLogs();
                }}
                disabled={refreshing}
                className="border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs rounded-xl px-3 py-2 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${refreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Quick Metrics 4-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block">Today&apos;s Returns</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white font-mono">{stats.totalReturnedToday}</span>
                <span className="text-xs text-amber-200/80 font-medium">volumes</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block">Active Borrowers</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-300 font-mono">{stats.uniqueBorrowersCount}</span>
                <span className="text-xs text-amber-200/80 font-medium">returned today</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block">On-Time Rate</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-300 font-mono">
                  {stats.totalReturnedToday > 0
                    ? `${Math.round((stats.onTimeCount / stats.totalReturnedToday) * 100)}%`
                    : "100%"}
                </span>
                <span className="text-xs text-emerald-200 font-medium">({stats.onTimeCount} on time)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider block">Garamat Collected</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-300 font-mono">₹{stats.totalGaramat}</span>
                <span className="text-xs text-rose-300 font-medium">({stats.lateCount} late)</span>
              </div>
            </div>
          </div>

          {/* ── Today's Return Names (Borrowers Ticker / Pill Chips) ── */}
          <div className="pt-3 border-t border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Today&apos;s Return Names ({todaysBorrowers.length} Students &amp; Faculty):
              </span>
              {selectedBorrowerFilter && (
                <button
                  onClick={() => setSelectedBorrowerFilter(null)}
                  className="text-emerald-400 hover:text-emerald-300 underline font-semibold cursor-pointer"
                >
                  Clear Borrower Filter (Showing {selectedBorrowerFilter})
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedBorrowerFilter(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedBorrowerFilter === null
                    ? "bg-amber-400 text-slate-950 font-black shadow-sm"
                    : "bg-white/10 text-slate-300 hover:bg-white/20"
                }`}
              >
                <span>All Names</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 border-current bg-transparent">
                  {stats.totalReturnedToday}
                </Badge>
              </button>

              {todaysBorrowers.length === 0 ? (
                <span className="text-xs text-slate-400 italic py-1">
                  No books returned yet today. Scanned returns will appear here dynamically.
                </span>
              ) : (
                todaysBorrowers.map((name) => {
                  const isSelected = selectedBorrowerFilter === name;
                  return (
                    <motion.button
                      key={name}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedBorrowerFilter(isSelected ? null : name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? "bg-emerald-400 text-slate-950 font-black shadow-md"
                          : "bg-white/10 text-slate-200 hover:bg-white/20 border border-white/10"
                      }`}
                    >
                      <Avatar className="w-4 h-4 text-[9px] border border-current">
                        <AvatarFallback className="bg-emerald-900 text-white">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{name}</span>
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Return Desk Quick Input Strip ── */}
      <Card className="fatimi-card p-4 sm:p-5">
        <form onSubmit={handleQuickReturn} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Scan className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Scan Barcode or Type Book Title for instant 1-click return (e.g. 04-AL-KITAAB)..."
              value={quickBarcode}
              onChange={(e) => setQuickBarcode(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <Button
            type="submit"
            disabled={quickProcessing || !quickBarcode.trim()}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-2xl px-6 py-2.5 shadow-sm active:scale-95 transition-all"
          >
            {quickProcessing ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
            <span>Process Instant Return</span>
          </Button>
        </form>
      </Card>

      {/* ── Return Books Log Ledger Table ── */}
      <div className="space-y-4">
        {/* Filter Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 max-w-full overflow-x-auto">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                activeTab === "today"
                  ? "bg-white dark:bg-slate-700 text-emerald-950 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Today&apos;s Returns ({stats.totalReturnedToday})
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-700 text-emerald-950 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Time Returns
            </button>

            <button
              onClick={() => setActiveTab("late")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                activeTab === "late"
                  ? "bg-white dark:bg-slate-700 text-amber-900 dark:text-amber-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Late / Overdue ({stats.lateCount})
            </button>

            <button
              onClick={() => setActiveTab("ontime")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                activeTab === "ontime"
                  ? "bg-white dark:bg-slate-700 text-emerald-900 dark:text-emerald-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              On-Time Only ({stats.onTimeCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by book, borrower, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Results Count & Filter Pill */}
        {selectedBorrowerFilter && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>Filtered by borrower:</span>
            <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold flex items-center gap-1">
              {selectedBorrowerFilter}
              <button
                onClick={() => setSelectedBorrowerFilter(null)}
                className="hover:text-rose-600 ml-1 cursor-pointer"
              >
                &times;
              </button>
            </Badge>
          </div>
        )}

        {/* Table Container */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Loading Maktabat return records...
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Return Records Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || selectedBorrowerFilter
                  ? "No returned books match your current search or borrower filter."
                  : activeTab === "today"
                  ? "No books have been returned yet today. Use the search bar above or scan barcodes to process returns."
                  : "No return logs found in library history."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Return Time &amp; Date</th>
                    <th className="py-3.5 px-4">Book Title &amp; Barcode</th>
                    <th className="py-3.5 px-4">Borrower Name &amp; Role</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Status &amp; Garamat</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  <AnimatePresence>
                    {filteredRecords.map((r, i) => {
                      const returnTime = new Date(r.returnedAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "Asia/Kolkata",
                      });
                      const returnDate = new Date(r.returnedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      });

                      const dueDate = new Date(r.dueAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      });

                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Return Timestamp */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{returnTime}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {returnDate}
                            </div>
                            {r.returnHijri && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                {r.returnHijri}
                              </div>
                            )}
                          </td>

                          {/* Book Title & Barcode */}
                          <td className="py-3.5 px-4 min-w-[200px] max-w-[280px]">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {r.bookTitle}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {r.barcode || "N/A"}
                              </span>
                              {r.category && <span>&bull; {r.category}</span>}
                              {r.rackNumber && <span>&bull; Rack {r.rackNumber}</span>}
                            </div>
                          </td>

                          {/* Borrower Name & Role */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7 text-[10px] border border-slate-200 dark:border-slate-700 shrink-0">
                                <AvatarFallback className="bg-slate-800 text-white font-bold">
                                  {getInitials(r.borrowerName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                                  <span>{r.borrowerName}</span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-black uppercase px-1.5 py-0 border-emerald-400/40 text-emerald-800 dark:text-emerald-300"
                                  >
                                    {r.borrowerRole || "Member"}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  ITS: {r.borrowerId} {r.borrowerDarjah ? `&bull; ${r.borrowerDarjah}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Due Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono">
                            {dueDate}
                          </td>

                          {/* Status & Garamat Fine */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {!r.isLate ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                On Time
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Late {r.garamat?.daysLate ? `(${r.garamat.daysLate}d)` : ""}
                                </span>
                                {r.garamat && (
                                  <div className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400">
                                    ₹{r.garamat.calculatedAmount} ({r.garamat.status})
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedReceipt(r)}
                              className="h-7 text-xs px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                            >
                              <Printer className="w-3 h-3 mr-1 text-slate-500" />
                              Receipt
                            </Button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Printable Return Slip Modal ── */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-[#d4af37]/60 p-6 text-slate-900 dark:text-white shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-bold font-display">Maktabat Book Return Receipt</h3>
                </div>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipt Content */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3 font-mono text-xs">
                <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
                  <h4 className="font-bold text-sm font-display tracking-tight text-slate-900 dark:text-white">MAHAD AL-ZAHRA &bull; MAKTABAT</h4>
                  <p className="text-[10px] text-slate-500 font-sans">Official Circulation Desk &bull; Galiakot Campus</p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Book Title:</span>
                    <span className="font-bold text-right truncate max-w-[200px]">{selectedReceipt.bookTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Barcode:</span>
                    <span className="font-bold">{selectedReceipt.barcode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Borrower:</span>
                    <span className="font-bold">{selectedReceipt.borrowerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ITS / Member ID:</span>
                    <span className="font-bold">{selectedReceipt.borrowerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Due Date:</span>
                    <span>{new Date(selectedReceipt.dueAt).toLocaleDateString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Returned Date:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {new Date(selectedReceipt.returnedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                  </div>
                  {selectedReceipt.returnHijri && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hijri Date:</span>
                      <span className="text-amber-700 dark:text-amber-400">{selectedReceipt.returnHijri}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={`font-black ${selectedReceipt.isLate ? "text-rose-600" : "text-emerald-600"}`}>
                      {selectedReceipt.isLate ? "RETURNED LATE" : "RETURNED ON TIME"}
                    </span>
                  </div>

                  {selectedReceipt.garamat && (
                    <div className="flex justify-between text-rose-700 dark:text-rose-400 font-bold">
                      <span>Garamat Fine:</span>
                      <span>₹{selectedReceipt.garamat.calculatedAmount} ({selectedReceipt.garamat.status})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedReceipt(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold text-xs active:scale-95 transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print Receipt
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
