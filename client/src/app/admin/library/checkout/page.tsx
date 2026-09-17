"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Barcode,
  User,
  BookOpen,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Clock,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Scan,
  RotateCcw,
  ShoppingCart,
  History,
  BookMarked,
  Search,
  ChevronRight,
  BookX,
  CheckCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Layers, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

// ── Types ──
interface StudentInfo {
  id: string;
  studentId: string;
  its: string | null;
  trNo: string | null;
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  className: string | null;
  activeLoans: number;
}

interface BookInfo {
  id: string;
  title: string;
  author: string | null;
  barcode: string | null;
  coverImage: string | null;
  status: string;
  availableCopies: number;
}

interface LoanInfo {
  id: string;
  studentName: string;
  bookTitle: string;
  dueAt: string;
}

// ── Scanned Item Display ──
function ScannedItem({ type, label, value, onClear }: {
  type: "student" | "book";
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
        type === "student"
          ? "bg-emerald-50 border-emerald-300"
          : "bg-blue-50 border-blue-300"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        type === "student" ? "bg-emerald-200" : "bg-blue-200"
      }`}>
        {type === "student" ? (
          <User className="w-5 h-5 text-emerald-700" />
        ) : (
          <BookOpen className="w-5 h-5 text-blue-700" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
      <button
        onClick={onClear}
        className="p-1.5 rounded-lg hover:bg-white/80 text-gray-400 hover:text-red-500 transition-colors"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ── Action Log ──
function ActionLog({ items }: { items: { type: "checkout" | "return" | "error"; message: string; time: string }[] }) {
  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {items.length === 0 ? (
        <p className="text-center text-gray-400 py-6 text-sm">No transactions yet</p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50/50">
            {item.type === "checkout" && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
            {item.type === "return" && <RotateCcw className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
            {item.type === "error" && <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700">{item.message}</p>
              <p className="text-[10px] text-gray-400">{item.time}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main Checkout Page ──
export default function CheckoutPage() {
  const [mode, setMode] = useState<"checkout" | "return">("checkout");
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [scannedBooks, setScannedBooks] = useState<BookInfo[]>([]);
  const [actionLog, setActionLog] = useState<{ type: "checkout" | "return" | "error"; message: string; time: string }[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanInfo[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [showStudentSearch, setShowStudentSearch] = useState(false);
  const [dueDateDays, setDueDateDays] = useState(14);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // ── Log Action ──
  const logAction = useCallback((type: "checkout" | "return" | "error", message: string) => {
    setActionLog((prev) => [{
      type,
      message,
      time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 50));
  }, []);

  // ── Search Talabat ──
  const searchStudent = useCallback(async (query: string) => {
    if (query.length < 2) {
      setStudentResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/library/students?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setStudentResults(data.data);
        setShowStudentSearch(true);
      }
    } catch {
      // Ignore
    } finally {
      setSearching(false);
    }
  }, []);

  const selectStudent = useCallback((s: StudentInfo) => {
    setStudent(s);
    setShowStudentSearch(false);
    setStudentSearchQuery(`${s.firstName} ${s.lastName} (${s.trNo || s.its || s.studentId})`);
    // Check for active loans
    fetchActiveLoans(s.id);
    toast({ title: "Talabat Loaded", description: `${s.firstName} ${s.lastName} - ${s.activeLoans} active loan(s)`, variant: "success" });
    barcodeInputRef.current?.focus();
  }, []);

  const fetchActiveLoans = async (studentId: string) => {
    try {
      const res = await fetch(`/api/admin/library?search=${studentId}&status=BORROWED`);
      const data = await res.json();
      if (data.success) {
        setActiveLoans(
          data.data
            .filter((b: any) => b.currentBorrower)
            .map((b: any) => ({
              id: b.currentLoanId || b.id,
              studentName: b.currentBorrower,
              bookTitle: b.title,
              dueAt: b.dueDate,
            }))
        );
      }
    } catch {
      // Ignore
    }
  };

  // ── Handle Barcode Scan ──
  const handleBarcodeScan = useCallback(async () => {
    const barcode = scannedBarcode.trim();
    if (!barcode) return;

    setScannedBarcode("");
    setProcessing(true);

    try {
      if (mode === "checkout") {
        await handleCheckout(barcode);
      } else {
        await handleReturn(barcode);
      }
    } catch (error) {
      logAction("error", `Error: ${(error as Error).message}`);
    } finally {
      setProcessing(false);
      barcodeInputRef.current?.focus();
    }
  }, [scannedBarcode, mode, student]);

  // ── Handle Checkout ──
  const handleCheckout = async (barcode: string) => {
    if (!student) {
      logAction("error", "No talabat selected. Scan or search for a talabat first.");
      toast({ title: "Checkout Error", description: "Please select a talabat first", variant: "destructive" });
      return;
    }

    const res = await fetch("/api/admin/library/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode,
        studentId: student.trNo || student.its || student.studentId,
        dueDate: new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const data = await res.json();
    if (data.success) {
      const msg = `Checked out "${data.data.book.title}" → ${data.data.student.name}`;
      logAction("checkout", msg);
      toast({ title: "Checkout Successful", description: msg, variant: "success" });
      
      // Update student info
      setStudent((prev) => prev ? { ...prev, activeLoans: prev.activeLoans + 1 } : null);
      setScannedBooks((prev) => [...prev, data.data.book]);
      
      // Play success beep (for barcode scanner)
      if ("beep" in window) {
        // Most barcode scanners emit beep automatically
      }
    } else {
      logAction("error", data.error || "Checkout failed");
      toast({ title: "Checkout Failed", description: data.error || "Unknown error", variant: "destructive" });
    }
  };

  // ── Handle Return ──
  const handleReturn = async (barcode: string) => {
    const res = await fetch("/api/admin/library/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode, confirmRestock: false }),
    });

    const data = await res.json();
    if (data.success) {
      const msg = `Returned "${data.data.book.title}" - ${data.data.restockRequired ? "In Restock Queue" : "Restocked"}`;
      logAction("return", msg);
      toast({ title: "Return Successful", description: msg, variant: "success" });
      
      // Remove from active loans
      setActiveLoans((prev) => prev.filter((l) => l.bookTitle !== data.data.book.title));
    } else {
      logAction("error", data.error || "Return failed");
      toast({ title: "Return Failed", description: data.error || "Unknown error", variant: "destructive" });
    }
  };

  // ── Handle Restock Confirm ──
  const handleRestockConfirm = async (barcode: string) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/library/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, confirmRestock: true }),
      });

      const data = await res.json();
      if (data.success) {
        logAction("return", `Restocked "${data.data.book.title}" → Shelf ready`);
        toast({ title: "Restock Confirmed", description: "Book has been returned to shelf", variant: "success" });
      } else {
        logAction("error", data.error || "Restock failed");
        toast({ title: "Restock Error", description: data.error || "Unknown error", variant: "destructive" });
      }
    } finally {
      setProcessing(false);
    }
  };

  // ── Handle Barcode Input Keydown ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeScan();
    }
  };

  // ── Clear Talabat ──
  const clearStudent = () => {
    setStudent(null);
    setStudentSearchQuery("");
    setStudentResults([]);
    setScannedBooks([]);
    setActiveLoans([]);
    searchInputRef.current?.focus();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Library Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Library & Circulation"
        hubDescription="Book catalog, smart color-coded shelves, circulation desk, and overdue tracking."
        tabs={[
          { label: "Book Catalog", href: "/admin/library", icon: BookOpen },
          { label: "Shelves & Racks", href: "/admin/library/shelves", icon: Layers },
          { label: "Quick Checkout", href: "/admin/library/checkout", icon: ArrowRight },
          { label: "Overdue Monitor", href: "/admin/library/overdue", icon: Clock },
          { label: "Inventory Auditor", href: "/admin/library/auditor", icon: ShieldCheck },
        ]}
      />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="fatimi-header-banner">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent">
                <Barcode className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white">Express Checkout Terminal</h1>
                <p className="text-emerald-100 text-sm">Scan talabat TR No. &rarr; Scan books &rarr; Auto-confirm</p>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => { setMode("checkout"); setScannedBooks([]); }}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  mode === "checkout"
                    ? "bg-white text-emerald-800 shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <BookOpen className="w-4 h-4 inline mr-1.5" />
                Issue Book
              </button>
              <button
                onClick={() => { setMode("return"); setScannedBooks([]); }}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  mode === "return"
                    ? "bg-white text-emerald-800 shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <RotateCcw className="w-4 h-4 inline mr-1.5" />
                Return Book
              </button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Checkout Area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-6">
          {/* Talabat Selection */}
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                {mode === "checkout" ? "Talabat / Borrower" : "Returning Talabat"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-gray-500">
                        {student.className || `Grade ${student.grade}-${student.section}`} &middot; TR No.: {student.trNo || student.its || student.studentId}
                      </p>
                      <Badge variant={student.activeLoans >= 3 ? "warning" : "secondary"} className="mt-1">
                        {student.activeLoans} / 5 active loans
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearStudent} className="text-red-500 hover:bg-red-50">
                    <XCircle className="w-4 h-4 mr-1" /> Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <label htmlFor="student-search" className="sr-only">Search student</label>
                    <input
                      ref={searchInputRef}
                      type="text"
                      id="student-search"
                      name="student-search"
                      value={studentSearchQuery}
                      onChange={(e) => { setStudentSearchQuery(e.target.value); searchStudent(e.target.value); }}
                      placeholder="Scan talabat TR No. barcode or search by name..."
                      className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <AnimatePresence>
                    {showStudentSearch && studentResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                      >
                        {studentResults.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => selectStudent(s)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                              {s.firstName[0]}{s.lastName[0]}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</p>
                              <p className="text-xs text-gray-500">{s.className || `Grade ${s.grade}-${s.section}`} &middot; TR No.: {s.trNo || s.its || s.studentId}</p>
                            </div>
                            <Badge variant={s.activeLoans > 0 ? "warning" : "secondary"} className="text-xs">
                              {s.activeLoans} loans
                            </Badge>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {searching && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Barcode Scanner Input */}
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-600" />
                {mode === "checkout" ? "Scan Book Barcode" : "Scan Book Barcode to Return"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <label htmlFor="barcode-scan" className="sr-only">Scan barcode</label>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    id="barcode-scan"
                    name="barcode-scan"
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === "checkout" ? "Scan book barcode..." : "Scan returned book barcode..."}
                    className="w-full rounded-xl border-2 border-emerald-200 pl-11 pr-4 py-3 text-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    autoFocus
                    disabled={!student && mode === "checkout"}
                  />
                </div>
                <Button
                  onClick={handleBarcodeScan}
                  disabled={!scannedBarcode.trim() || processing || (!student && mode === "checkout")}
                  variant={mode === "checkout" ? "admin" : "secondary"}
                  size="lg"
                  className="px-6"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>{mode === "checkout" ? "Issue" : "Return"}</>
                  )}
                </Button>
              </div>

              {mode === "checkout" && (
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Due in:</span>
                  </div>
                  {[7, 14, 21, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => setDueDateDays(days)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        dueDateDays === days
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                  <span className="text-xs text-gray-400 ml-auto">
                    Due: {new Date(Date.now() + dueDateDays * 86400000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanned Books Queue (Checkout Mode) */}
          {mode === "checkout" && scannedBooks.length > 0 && (
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  Scanned Books ({scannedBooks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scannedBooks.map((book, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      {/* Book Cover Thumbnail */}
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                        {book.coverImage ? (
                          <img
                            src={book.coverImage}
                            alt={`Cover of ${book.title}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=059669&color=fff&size=60`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-100">
                            <BookOpen className="w-4 h-4 text-emerald-400" />
                          </div>
                        )}
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.author || "—"} &middot; {book.barcode}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Talabat Loans (Return Mode) */}
          {mode === "return" && student && activeLoans.length > 0 && (
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <BookMarked className="w-5 h-5" />
                  Active Loans for {student.firstName} {student.lastName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeLoans.map((loan, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <BookX className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{loan.bookTitle}</p>
                        <p className={`text-xs ${new Date(loan.dueAt) < new Date() ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          Due: {new Date(loan.dueAt).toLocaleDateString()}
                          {new Date(loan.dueAt) < new Date() && " (OVERDUE)"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Restock Confirmation Hint */}
          {mode === "return" && (
            <Card className="fatimi-card border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <RotateCcw className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Restock Queue Protocol Active</p>
                    <p className="text-xs text-blue-700 mt-1">
                      When a book is returned, its status changes to <strong>Restock Queue</strong>. 
                      Scan the book barcode again at its shelf location and use &ldquo;Restock Confirm&rdquo; 
                      to mark it as available.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Sidebar: Action Log & Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
          {/* Action Log */}
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                Transaction Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionLog items={actionLog} />
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-gray-600">
              <p>1. <strong>Scan Talabat TR No.</strong> barcode to auto-load profile</p>
              <p>2. <strong>Scan Book Barcode</strong> to add to checkout</p>
              <p>3. System auto-confirms issue in under 3 seconds</p>
              <p>4. For <strong>returns</strong>, just scan the book barcode</p>
              <p>5. Returned books enter <strong>Restock Queue</strong> until shelved</p>
              <p className="text-[10px] text-gray-400 mt-2">Max 5 books per student. Overdue restrictions apply.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
