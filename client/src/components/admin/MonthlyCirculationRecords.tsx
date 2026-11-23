"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  Layers,
  BookOpen,
  Check,
  AlertTriangle,
  Phone,
  Mail,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { HIJRI_MONTHS } from "@/lib/fatimi-calendar";

export interface StackingRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  bookBarcode: string;
  category: string;
  location: string;
  coverImage: string | null;
  borrowerName: string;
  borrowerId: string;
  borrowerRole: "STUDENT" | "FACULTY";
  darjah: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  contactPhone: string | null;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
  borrowedAt: string;
  borrowedDateEn: string;
  borrowedDateHijri: string;
  dueAt: string;
  dueDateEn: string;
  dueDateHijri: string;
  returnedAt: string | null;
  returnedDateEn: string | null;
  returnedDateHijri: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  garamat: {
    isLate: boolean;
    daysLate: number;
    ratePerDay: number;
    calculatedAmount: number;
    status: "COLLECTED" | "WAIVED" | "PENDING";
    paidAmount?: number;
    notes?: string;
  } | null;
  whatsAppUrl: string | null;
}

interface MonthlyCirculationRecordsProps {
  onDeleteLoan?: (loanId: string, bookTitle: string) => void;
  onLogAction?: (type: "checkout" | "return" | "error" | "reminder", message: string) => void;
}

export default function MonthlyCirculationRecords({
  onDeleteLoan,
  onLogAction,
}: MonthlyCirculationRecordsProps) {
  const [currentHijriMonthIndex, setCurrentHijriMonthIndex] = useState(5); // Jumada al-Ula default
  const [currentHijriYear, setCurrentHijriYear] = useState(1448);
  const [stackingViewMode, setStackingViewMode] = useState<"borrowers" | "records">("borrowers");
  const [stackingFilterRole, setStackingFilterRole] = useState("ALL");
  const [stackingFilterStatus, setStackingFilterStatus] = useState("ALL");
  const [stackingSearch, setStackingSearch] = useState("");
  const [loadingStacking, setLoadingStacking] = useState(false);
  const [stackingData, setStackingData] = useState<{
    month: any;
    stats: any;
    borrowerStack?: Array<{
      borrowerId: string;
      borrowerName: string;
      borrowerRole: "STUDENT" | "FACULTY";
      darjah: string;
      parentName: string;
      parentPhone: string | null;
      parentEmail: string | null;
      issuedCount: number;
      returnedCount: number;
      overdueCount: number;
      totalGaramat: number;
      books: Array<{
        id: string;
        bookTitle: string;
        bookBarcode: string;
        borrowedDateHijri: string;
        dueDateHijri: string;
        status: string;
        isReturned?: boolean;
        returnedAt?: string | null;
        isOverdue: boolean;
        garamatAmount: number;
      }>;
    }>;
    data: StackingRecord[];
  } | null>(null);

  const fetchRecords = useCallback(
    async (hijriM = currentHijriMonthIndex, hijriY = currentHijriYear) => {
      setLoadingStacking(true);
      try {
        const params = new URLSearchParams();
        params.set("hijriMonth", String(hijriM));
        params.set("hijriYear", String(hijriY));
        if (stackingFilterRole !== "ALL") params.set("role", stackingFilterRole);
        if (stackingFilterStatus !== "ALL") params.set("status", stackingFilterStatus);
        if (stackingSearch.trim()) params.set("search", stackingSearch.trim());

        const res = await fetch(`/api/admin/library/stacking-records?${params}`);
        const data = await res.json();
        if (data.success) {
          setStackingData(data);
        }
      } catch {
        toast({
          title: "Error",
          description: "Could not load monthly circulation records",
          variant: "destructive",
        });
      } finally {
        setLoadingStacking(false);
      }
    },
    [currentHijriMonthIndex, currentHijriYear, stackingFilterRole, stackingFilterStatus, stackingSearch],
  );

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleTriggerReminder = async (
    record: StackingRecord,
    type: "ONE_DAY_BEFORE" | "DAY_OF_DUE" | "OVERDUE",
    channel: "whatsapp" | "email",
  ) => {
    try {
      const res = await fetch("/api/admin/library/stacking-records/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: record.id,
          reminderType: type,
          channels: [channel],
        }),
      });

      const data = await res.json();
      if (data.success) {
        onLogAction?.("reminder", `Reminder (${channel.toUpperCase()}) sent to ${record.borrowerName}`);
        toast({
          title: "Reminder Sent",
          description: `${channel.toUpperCase()} message sent to ${data.recipient?.name || record.borrowerName}`,
          variant: "success",
        });

        if (channel === "whatsapp" && data.whatsAppLink) {
          window.open(data.whatsAppLink, "_blank");
        }
      } else {
        toast({
          title: "Reminder Error",
          description: data.error || "Failed to send reminder",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error triggering reminder",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (loanId: string, bookTitle: string) => {
    if (onDeleteLoan) {
      onDeleteLoan(loanId, bookTitle);
    } else {
      if (!confirm(`Cancel and delete loan for "${bookTitle}"?`)) return;
      fetch(`/api/admin/library/checkout/loan/${loanId}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            toast({ title: "Loan Deleted", description: `Record for "${bookTitle}" removed.` });
            fetchRecords();
          } else {
            toast({ title: "Error", description: data.error, variant: "destructive" });
          }
        })
        .catch(() => toast({ title: "Error", description: "Failed to delete loan", variant: "destructive" }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Month Selector Bar */}
      <Card className="fatimi-card overflow-hidden">
        <div className="fatimi-card-header" />
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Month Navigation */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  let nextM = currentHijriMonthIndex - 1;
                  let nextY = currentHijriYear;
                  if (nextM < 1) {
                    nextM = 12;
                    nextY -= 1;
                  }
                  setCurrentHijriMonthIndex(nextM);
                  setCurrentHijriYear(nextY);
                }}
                className="h-8 rounded-xl border-slate-200 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                Previous
              </Button>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Monthly Focus
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {HIJRI_MONTHS[currentHijriMonthIndex - 1]?.en} {currentHijriYear} H
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {stackingData?.month?.gregorianLabel || "English Month"}
                  </span>
                </h2>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  let nextM = currentHijriMonthIndex + 1;
                  let nextY = currentHijriYear;
                  if (nextM > 12) {
                    nextM = 1;
                    nextY += 1;
                  }
                  setCurrentHijriMonthIndex(nextM);
                  setCurrentHijriYear(nextY);
                }}
                className="h-8 rounded-xl border-slate-200 text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>

            {/* Direct Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={currentHijriMonthIndex}
                onChange={(e) => setCurrentHijriMonthIndex(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {HIJRI_MONTHS.map((m) => (
                  <option key={m.index} value={m.index}>
                    {m.index}. {m.en} ({m.ar})
                  </option>
                ))}
              </select>

              <select
                value={stackingFilterRole}
                onChange={(e) => setStackingFilterRole(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">All Borrowers</option>
                <option value="STUDENT">Talabat Only</option>
                <option value="FACULTY">Faculty Only</option>
              </select>

              <select
                value={stackingFilterStatus}
                onChange={(e) => setStackingFilterStatus(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Loans</option>
                <option value="RETURNED">Returned</option>
                <option value="OVERDUE">Overdue Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Card className="fatimi-card p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Total Issued</span>
          <p className="text-xl font-black text-slate-900 mt-0.5">{stackingData?.stats?.totalIssued ?? 0}</p>
          <span className="text-[10px] text-slate-400">This month</span>
        </Card>

        <Card className="fatimi-card p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Total Returned</span>
          <p className="text-xl font-black text-emerald-700 mt-0.5">{stackingData?.stats?.totalReturned ?? 0}</p>
          <span className="text-[10px] text-emerald-600">Restocked</span>
        </Card>

        <Card className="fatimi-card p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Active Loans</span>
          <p className="text-xl font-black text-blue-700 mt-0.5">{stackingData?.stats?.totalActive ?? 0}</p>
          <span className="text-[10px] text-blue-600">Currently out</span>
        </Card>

        <Card className="fatimi-card p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Overdue</span>
          <p className="text-xl font-black text-rose-700 mt-0.5">{stackingData?.stats?.totalOverdue ?? 0}</p>
          <span className="text-[10px] text-rose-600">Action needed</span>
        </Card>

        <Card className="fatimi-card p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Fines Assessed</span>
          <p className="text-xl font-black text-amber-700 mt-0.5">₹{stackingData?.stats?.totalGaramatAssessed ?? 0}</p>
          <span className="text-[10px] text-amber-600">Total fees</span>
        </Card>

        <Card className="fatimi-card p-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Fines Collected</span>
          <p className="text-xl font-black text-emerald-800 mt-0.5">₹{stackingData?.stats?.totalGaramatCollected ?? 0}</p>
          <span className="text-[10px] text-emerald-600">Realized</span>
        </Card>
      </div>

      {/* Circulation Ledger */}
      <Card className="fatimi-card overflow-hidden">
        <div className="fatimi-card-header" />
        <CardHeader className="p-3.5 sm:p-4 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm text-slate-800 font-bold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
                <span>Monthly Records &bull; {HIJRI_MONTHS[currentHijriMonthIndex - 1]?.en}</span>
              </CardTitle>

              {/* View Switcher */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl ml-2">
                <button
                  type="button"
                  onClick={() => setStackingViewMode("borrowers")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    stackingViewMode === "borrowers"
                      ? "bg-white text-emerald-900 shadow-xs border border-emerald-300"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>By Borrower ({stackingData?.borrowerStack?.length ?? 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStackingViewMode("records")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    stackingViewMode === "records"
                      ? "bg-white text-emerald-900 shadow-xs border border-emerald-300"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Loans ({stackingData?.stats?.totalRecords ?? 0})</span>
                </button>
              </div>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={stackingSearch}
                onChange={(e) => setStackingSearch(e.target.value)}
                placeholder="Search borrower, book or barcode..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </CardHeader>

        {stackingViewMode === "borrowers" ? (
          <div className="p-3.5 sm:p-4 space-y-3">
            {!stackingData?.borrowerStack?.length ? (
              <p className="text-center py-10 text-slate-400 text-xs font-medium">
                No borrower circulation records found for this month.
              </p>
            ) : (
              stackingData.borrowerStack.map((b) => (
                <div
                  key={b.borrowerId}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                        {b.borrowerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-sm text-slate-900">{b.borrowerName}</h4>
                          <span
                            className={cn(
                              "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded",
                              b.borrowerRole === "FACULTY"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-emerald-100 text-emerald-800",
                            )}
                          >
                            {b.borrowerRole === "FACULTY" ? "Faculty" : "Talabat"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Darjah: <strong className="text-slate-700">{b.darjah}</strong>
                          {b.parentName ? ` · Parent: ${b.parentName}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {b.issuedCount} Issued
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        {b.returnedCount} Returned
                      </span>
                      {b.overdueCount > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                          {b.overdueCount} Overdue
                        </span>
                      )}
                      {b.totalGaramat > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                          ₹{b.totalGaramat} Fine
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {b.books.map((book, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{book.bookTitle}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {book.bookBarcode || "N/A"}
                          </p>
                          <p className="text-[9.5px] text-slate-400">Due: {book.dueDateHijri}</p>
                        </div>
                        <span
                          className={cn(
                            "text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0",
                            book.status === "RETURNED"
                              ? "bg-blue-100 text-blue-700"
                              : book.isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800",
                          )}
                        >
                          {book.status === "RETURNED" ? "Returned" : book.isOverdue ? "Overdue" : "Active"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-emerald-100 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Book &amp; Barcode</th>
                  <th className="px-4 py-2.5">Borrower</th>
                  <th className="px-4 py-2.5">Parent</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Fine</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingStacking ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-medium">
                      Loading circulation records...
                    </td>
                  </tr>
                ) : !stackingData?.data?.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-medium">
                      No circulation records found for this month
                    </td>
                  </tr>
                ) : (
                  stackingData.data.map((record) => {
                    const isOverdue = record.status === "OVERDUE";
                    return (
                      <tr key={record.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-900">{record.borrowedDateHijri}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{record.borrowedDateEn}</p>
                        </td>

                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-900 line-clamp-1">{record.bookTitle}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                              {record.bookBarcode}
                            </span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800">
                              {record.category}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-900">{record.borrowerName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-slate-500">{record.darjah}</span>
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-800">{record.parentName || "—"}</p>
                          {record.parentPhone && (
                            <p className="text-[10px] text-emerald-700 font-mono">{record.parentPhone}</p>
                          )}
                        </td>

                        <td className="px-4 py-2.5">
                          <p className={`font-bold ${isOverdue ? "text-rose-700" : "text-slate-800"}`}>
                            {record.dueDateHijri}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{record.dueDateEn}</p>
                        </td>

                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              record.status === "RETURNED"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : record.status === "OVERDUE"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200",
                            )}
                          >
                            {record.status === "RETURNED"
                              ? "Returned"
                              : record.status === "OVERDUE"
                              ? `Overdue (${record.daysOverdue}d)`
                              : "Active"}
                          </span>
                        </td>

                        <td className="px-4 py-2.5">
                          {record.garamat ? (
                            <div>
                              <span className="font-mono font-black text-rose-700 text-xs">
                                ₹{record.garamat.calculatedAmount}
                              </span>
                              <span
                                className={cn(
                                  "ml-1 text-[9px] font-bold uppercase px-1 py-0.2 rounded",
                                  record.garamat.status === "COLLECTED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800",
                                )}
                              >
                                {record.garamat.status}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {record.parentPhone || record.contactPhone ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTriggerReminder(
                                    record,
                                    isOverdue ? "OVERDUE" : "ONE_DAY_BEFORE",
                                    "whatsapp",
                                  )
                                }
                                className="p-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Send WhatsApp reminder"
                              >
                                <Phone className="w-3 h-3" />
                              </button>
                            ) : null}

                            {record.parentEmail ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTriggerReminder(
                                    record,
                                    isOverdue ? "OVERDUE" : "ONE_DAY_BEFORE",
                                    "email",
                                  )
                                }
                                className="p-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                title="Send Email reminder"
                              >
                                <Mail className="w-3 h-3" />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleDelete(record.id, record.bookTitle)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete loan record"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
