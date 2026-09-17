"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scan,
  Barcode,
  BookOpen,
  X,
  Search,
  Loader2,
  BookMarked,
  CheckCircle2,
  RotateCcw,
  BookX,
  AlertTriangle,
  CalendarDays,
  User,
  Printer,
  Clock,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import BarcodeDisplay from "@/components/admin/BarcodeDisplay";

// ── Types ──
interface ScannedBook {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category: string;
  barcode: string | null;
  coverImage: string | null;
  status: string;
  availableCopies: number;
  totalCopies: number;
  rackNumber: string | null;
  shelfNumber: string | null;
}

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

interface BookScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookIssued: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  AVAILABLE: { label: "On Shelf", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  BORROWED: { label: "Issued", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: BookMarked },
  RESTOCK_QUEUE: { label: "In Sorting", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: RotateCcw },
  DAMAGED: { label: "Damaged", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: BookX },
  LOST: { label: "Lost", color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: AlertTriangle },
};

// ── Main Component ──
export default function BookScanModal({ open, onOpenChange, onBookIssued }: BookScanModalProps) {
  const [step, setStep] = useState<"scan" | "details" | "issue" | "receipt">("scan");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [book, setBook] = useState<ScannedBook | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Issue state
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentInfo[]>([]);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [showStudentSearch, setShowStudentSearch] = useState(false);
  const [dueDays, setDueDays] = useState(14);
  const [issuing, setIssuing] = useState(false);

  // Receipt state
  const [issueData, setIssueData] = useState<{
    bookTitle: string;
    bookBarcode: string;
    studentName: string;
    trNo: string;
    darajah: string;
    issueDate: string;
    issueTime: string;
    dueDate: string;
    loanId: string;
  } | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const studentSearchRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep("scan");
      setBarcodeInput("");
      setBook(null);
      setNotFound(false);
      setSelectedStudent(null);
      setStudentQuery("");
      setStudentResults([]);
      setIssueData(null);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-focus on step change
  useEffect(() => {
    if (step === "scan") barcodeRef.current?.focus();
    if (step === "issue") setTimeout(() => studentSearchRef.current?.focus(), 200);
  }, [step]);

  // ── Lookup Book by Barcode ──
  const lookUpBook = async (barcode: string) => {
    if (!barcode.trim()) return;
    setSearching(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/library?search=${encodeURIComponent(barcode)}&pageSize=1`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setBook(data.data[0]);
        setStep("details");
      } else {
        setNotFound(true);
        toast({ title: "Book Not Found", description: `No book found with barcode: ${barcode}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to look up book", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookUpBook(barcodeInput);
  };

  // ── Search Talabat ──
  const searchStudent = async (query: string) => {
    if (query.length < 2) {
      setStudentResults([]);
      setShowStudentSearch(false);
      return;
    }
    setSearchingStudent(true);
    try {
      const res = await fetch(`/api/admin/library/students?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setStudentResults(data.data);
        setShowStudentSearch(true);
      }
    } catch {
      // ignore
    } finally {
      setSearchingStudent(false);
    }
  };

  const selectStudent = (s: StudentInfo) => {
    setSelectedStudent(s);
    setShowStudentSearch(false);
    setStudentQuery(`${s.firstName} ${s.lastName} (${s.trNo || s.its || s.studentId})`);
  };

  // ── Issue Book (Checkout) ──
  const handleIssueBook = async () => {
    if (!book || !selectedStudent) return;
    setIssuing(true);
    try {
      const res = await fetch("/api/admin/library/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: book.barcode || book.id,
          studentId: selectedStudent.trNo || selectedStudent.its || selectedStudent.studentId,
          dueDate: new Date(Date.now() + dueDays * 86400000).toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const now = new Date();
        setIssueData({
          bookTitle: book.title,
          bookBarcode: book.barcode || "",
          studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
          trNo: selectedStudent.trNo || selectedStudent.its || selectedStudent.studentId,
          darajah: selectedStudent.className || `Grade ${selectedStudent.grade}-${selectedStudent.section}`,
          issueDate: now.toLocaleDateString(),
          issueTime: now.toLocaleTimeString(),
          dueDate: new Date(Date.now() + dueDays * 86400000).toLocaleDateString(),
          loanId: data.data.loan.id,
        });
        setStep("receipt");
        toast({ title: "Book Issued", description: `"${book.title}" issued to ${selectedStudent.firstName} ${selectedStudent.lastName}`, variant: "success" });
        onBookIssued();
      } else {
        toast({ title: "Issue Failed", description: data.error || "Failed to issue book", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to issue book", variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  // ── Print Talabt Receipt ──
  const printTalabt = () => {
    if (!issueData) return;
    const printWindow = window.open("", "_blank", "width=500,height=700");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print", variant: "destructive" });
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Talabt - Issue Slip</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            padding: 40px 20px;
          }
          .receipt {
            background: white;
            border-radius: 12px;
            padding: 32px;
            max-width: 380px;
            width: 100%;
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #333;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .header h1 { font-size: 18px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
          .header p { font-size: 10px; color: #666; margin-top: 4px; }
          .barcode-wrap { display: flex; justify-content: center; margin: 12px 0; }
          .barcode-wrap svg { max-width: 100%; height: 40px; }
          .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #ddd; font-size: 12px; }
          .field .label { color: #888; font-weight: 500; }
          .field .value { font-weight: bold; color: #222; text-align: right; }
          .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin: 12px 0; text-align: center; font-size: 11px; color: #166534; }
          .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 2px dashed #333; font-size: 9px; color: #999; }
          @media print {
            body { background: white; padding: 0; }
            .receipt { box-shadow: none; border: none; padding: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>📖 Library Talabt</h1>
            <p>Book Issue Receipt</p>
          </div>

          <div class="barcode-wrap">
            <svg class="barcode-svg" data-barcode="${issueData.bookBarcode}"></svg>
          </div>
          <div style="text-align:center;font-size:10px;font-weight:bold;letter-spacing:1px;margin-bottom:12px;">${issueData.bookBarcode}</div>

          <div class="info-box">
            <strong>${escapeHtml(issueData.bookTitle)}</strong>
          </div>

          <div class="field"><span class="label">Talabat Name</span><span class="value">${escapeHtml(issueData.studentName)}</span></div>
          <div class="field"><span class="label">TR No.</span><span class="value">${issueData.trNo}</span></div>
          <div class="field"><span class="label">Darajah</span><span class="value">${escapeHtml(issueData.darajah)}</span></div>
          <div class="field"><span class="label">Issue Date</span><span class="value">${issueData.issueDate}</span></div>
          <div class="field"><span class="label">Issue Time</span><span class="value">${issueData.issueTime}</span></div>
          <div class="field"><span class="label">Due Date</span><span class="value">${issueData.dueDate}</span></div>
          <div class="field"><span class="label">Loan ID</span><span class="value" style="font-size:10px;">#${issueData.loanId.slice(0, 8)}</span></div>

          <div class="footer">
            <p>Return the book by the due date</p>
            <p style="margin-top:4px;">Thank you • Library Management System</p>
          </div>
        </div>
        <script>
          document.querySelectorAll('.barcode-svg').forEach(function(svg) {
            try {
              JsBarcode(svg, svg.dataset.barcode, { format: 'CODE128', width: 1.2, height: 30, displayValue: false, margin: 0 });
            } catch(e) {}
          });
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDone = () => {
    setStep("scan");
    setBarcodeInput("");
    setBook(null);
    setNotFound(false);
    setSelectedStudent(null);
    setStudentQuery("");
    setIssueData(null);
    onOpenChange(false);
  };

  // ── Render Scan Step ──
  const renderScanStep = () => (
    <>
      <ModalHeader>
        <ModalTitle className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-emerald-600" />
          Scan Book Barcode
        </ModalTitle>
        <ModalDescription>
          Scan or type the barcode to look up the book
        </ModalDescription>
      </ModalHeader>

      <form onSubmit={handleBarcodeSubmit} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <label htmlFor="book-barcode" className="sr-only">Book barcode</label>
            <input
              ref={barcodeRef}
              type="text"
              id="book-barcode"
              name="book-barcode"
              value={barcodeInput}
              onChange={(e) => { setBarcodeInput(e.target.value); setNotFound(false); }}
              placeholder="Scan or type barcode..."
              className="w-full rounded-xl border-2 border-emerald-200 pl-11 pr-4 py-3 text-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={!barcodeInput.trim() || searching} variant="admin" size="lg">
            {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </Button>
        </div>

        {notFound && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-sm text-center">
            No book found with this barcode. Please check and try again.
          </motion.p>
        )}

        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
          <p className="font-medium text-gray-700 flex items-center gap-1.5"><Scan className="w-3.5 h-3.5" /> Quick Scan Tips</p>
          <p>• Use a barcode scanner or type the code manually </p>
          <p>• Barcode format: <span className="font-mono bg-gray-200 px-1 rounded">XX-0000</span></p>
          <p>• Only <strong>Available</strong> books can be issued</p>
        </div>
      </form>

      <ModalFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
      </ModalFooter>
    </>
  );

  // ── Render Book Details Step ──
  const renderDetailsStep = () => {
    if (!book) return null;
    const statusInfo = statusConfig[book.status] || statusConfig.AVAILABLE;
    const StatusIcon = statusInfo.icon;
    const location = [book.rackNumber, book.shelfNumber].filter(Boolean).join("-");

    return (
      <>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Book Details
          </ModalTitle>
          <ModalDescription>
            Review book information and proceed to issue
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          {/* Cover + Status */}
          <div className="flex gap-4">
            {/* Cover Image */}
            <div className="w-28 h-40 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 shadow-md">
              {book.coverImage ? (
                <img
                  src={book.coverImage}
                  alt={`Cover of ${book.title}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=059669&color=fff&size=160&font-size=0.33`;
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-200">
                  <BookOpen className="w-10 h-10 text-emerald-400 mb-1" />
                  <span className="text-[10px] text-emerald-500 font-medium px-2 text-center">No Cover</span>
                </div>
              )}
            </div>

            {/* Book Info */}
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-gray-900 text-base leading-tight">{book.title}</h3>
              {book.author && <p className="text-sm text-gray-500">by {book.author}</p>}
              {book.publisher && <p className="text-xs text-gray-500">{book.publisher}</p>}

              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{book.category}</span>
                {location && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{location}</span>
                )}
              </div>
            </div>
          </div>

          {/* Barcode */}
          {book.barcode && (
            <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center">
              <BarcodeDisplay value={book.barcode} scale="md" showText={true} />
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-3">
            <div><span className="text-gray-500">Category:</span> <span className="font-medium">{book.category}</span></div>
            <div><span className="text-gray-500">Copies:</span> <span className="font-medium">{book.availableCopies}/{book.totalCopies}</span></div>
            {book.rackNumber && <div><span className="text-gray-500">Rack:</span> <span className="font-medium">{book.rackNumber}</span></div>}
            {book.shelfNumber && <div><span className="text-gray-500">Shelf:</span> <span className="font-medium">{book.shelfNumber}</span></div>}
          </div>

          {/* Availability Warning */}
          {book.status !== "AVAILABLE" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">This book is not available for checkout (Status: {statusInfo.label})</p>
            </div>
          )}

          {/* Issue Button */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("scan")} className="flex-1">
              <Scan className="w-4 h-4 mr-1" /> Scan Another
            </Button>
            <Button
              variant="student"
              onClick={() => setStep("issue")}
              disabled={book.status !== "AVAILABLE"}
              className="flex-1"
            >
              <BookMarked className="w-4 h-4 mr-1" /> Issue Book
            </Button>
          </div>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={handleDone}>Close</Button>
        </ModalFooter>
      </>
    );
  };

  // ── Render Issue Talabt Step ──
  const renderIssueStep = () => (
    <>
      <ModalHeader>
        <ModalTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" />
          Issue Talabt — {book?.title}
        </ModalTitle>
        <ModalDescription>
          Select student and set return date to complete the issue
        </ModalDescription>
      </ModalHeader>

      <div className="space-y-4">
        {/* Book Summary */}
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-10 h-14 rounded-lg overflow-hidden bg-gray-100 border shrink-0">
            {book?.coverImage ? (
              <img src={book.coverImage} alt={`Cover thumbnail for ${book?.title || "book"}`} className="w-full h-full object-cover" loading="lazy" decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book?.title || "")}&background=059669&color=fff&size=60`; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-emerald-100">
                <BookOpen className="w-4 h-4 text-emerald-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{book?.title}</p>
            <p className="text-xs text-gray-500">{book?.author} · {book?.barcode}</p>
          </div>
          <Badge variant="success">Issuing</Badge>
        </div>

        {/* Talabat Selection */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="block text-sm font-medium text-gray-700 mb-1.5">
            <User className="w-4 h-4 inline mr-1" />
            Select Talabat
          </legend>
          {selectedStudent ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 border border-indigo-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-xs text-gray-500">
                    {selectedStudent.className || `Grade ${selectedStudent.grade}-${selectedStudent.section}`} · TR No.: {selectedStudent.trNo || selectedStudent.its || selectedStudent.studentId}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setStudentQuery(""); }} className="text-red-500">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <label htmlFor="student-search" className="sr-only">Search student</label>
                <input
                  ref={studentSearchRef}
                  type="text"
                  id="student-search"
                  name="student-search"
                  value={studentQuery}
                  onChange={(e) => { setStudentQuery(e.target.value); searchStudent(e.target.value); }}
                  placeholder="Search by name or TR No..."
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <AnimatePresence>
                {showStudentSearch && studentResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto"
                  >
                    {studentResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => selectStudent(s)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</p>
                          <p className="text-xs text-gray-500">{s.className || `Grade ${s.grade}-${s.section}`}</p>
                        </div>
                        <Badge variant={s.activeLoans > 0 ? "warning" : "secondary"} className="text-[10px]">
                          {s.activeLoans} loans
                        </Badge>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {searchingStudent && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              )}
            </div>
          )}
        </fieldset>

        {/* Auto Date & Time */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Auto-filled Date & Time
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <span className="text-[10px] text-gray-500 block">Issue Date</span>
              <span className="font-semibold text-gray-800">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <span className="text-[10px] text-gray-500 block">Issue Time</span>
              <span className="font-semibold text-gray-800">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Return Date Selector */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            Return Due Date
          </legend>
          <div className="flex gap-2 flex-wrap">
            {[7, 14, 21, 30, 45, 60].map((days) => (
              <button
                key={days}
                onClick={() => setDueDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dueDays === days
                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300 shadow-sm"
                    : "bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
            <CalendarDays className="w-4 h-4 text-amber-600" />
            <span>
              Due by: <strong className="text-amber-800">{new Date(Date.now() + dueDays * 86400000).toLocaleDateString()}</strong>
            </span>
          </div>
        </fieldset>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={() => setStep("details")}>
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Back
        </Button>
        <Button
          variant="student"
          onClick={handleIssueBook}
          disabled={!selectedStudent || issuing}
        >
          {issuing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
          Confirm Issue
        </Button>
      </ModalFooter>
    </>
  );

  // ── Render Receipt Step ──
  const renderReceiptStep = () => {
    if (!issueData) return null;
    return (
      <>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Book Issued Successfully
          </ModalTitle>
          <ModalDescription>
            Talabt receipt generated for {issueData.studentName}
          </ModalDescription>
        </ModalHeader>

        {/* Printable Receipt Preview */}
        <div className="border-2 border-emerald-100 rounded-2xl p-5 bg-white shadow-sm">
          <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
            <h3 className="text-sm font-bold uppercase tracking-widest">📖 Talabt</h3>
            <p className="text-[10px] text-gray-500">Book Issue Receipt</p>
          </div>

          {issueData.bookBarcode && (
            <div className="flex justify-center mb-2">
              <BarcodeDisplay value={issueData.bookBarcode} scale="sm" showText={true} />
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">Talabat</span>
              <span className="font-semibold text-gray-900">{issueData.studentName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">TR No.</span>
              <span className="font-mono font-semibold">{issueData.trNo}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">Darajah</span>
              <span className="font-semibold">{issueData.darajah}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">Book</span>
              <span className="font-semibold text-right max-w-[50%]">{issueData.bookTitle}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">Issue Date</span>
              <span className="font-semibold">{issueData.issueDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">Issue Time</span>
              <span className="font-semibold">{issueData.issueTime}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
              <span className="text-gray-500">Due Date</span>
              <span className="font-semibold text-amber-700">{issueData.dueDate}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Loan ID</span>
              <span className="font-mono text-[10px] text-gray-500">#{issueData.loanId.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setStep("scan"); setBarcodeInput(""); setBook(null); setSelectedStudent(null); }} className="flex-1">
            Issue Another Book
          </Button>
          <Button variant="admin" onClick={printTalabt} className="flex-1">
            <Printer className="w-4 h-4 mr-1" /> Print Talabt
          </Button>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={handleDone}>Done</Button>
        </ModalFooter>
      </>
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => {
      if (!o) {
        // Reset all state when modal closes
        setStep("scan");
        setBarcodeInput("");
        setBook(null);
        setNotFound(false);
        setSelectedStudent(null);
        setStudentQuery("");
        setIssueData(null);
      }
      onOpenChange(o);
    }}>
      <ModalContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {step === "scan" && renderScanStep()}
        {step === "details" && renderDetailsStep()}
        {step === "issue" && renderIssueStep()}
        {step === "receipt" && renderReceiptStep()}
      </ModalContent>
    </Modal>
  );
}

// ── Helper ──
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
