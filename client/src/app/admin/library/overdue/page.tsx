"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Printer,
  AlertTriangle,
  Clock,
  BookOpen,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Mail,
  Phone,
  Send,
  ChevronDown,
  ChevronUp,
  Bell,
  CheckCheck,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Barcode, Layers, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

// ── Types ──
interface OverdueItem {
  loanId: string;
  studentName: string;
  bookTitle: string;
  bookBarcode: string | null;
  borrowedAt: string;
  dueAt: string;
  daysOverdue: number;
}

interface StudentOverdueGroup {
  studentId: string;
  studentName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  className: string;
  items: OverdueItem[];
  maxDaysOverdue: number;
}

interface ReminderResult {
  studentName: string;
  emailSent: boolean;
  smsSent: boolean;
  error?: string;
}

// ── Severity Helpers ──
function getSeverity(days: number): { label: string; color: string; bg: string; icon: React.ElementType } {
  if (days > 30) return { label: "Critical", color: "text-red-800", bg: "bg-red-100", icon: AlertTriangle };
  if (days > 14) return { label: "High", color: "text-orange-800", bg: "bg-orange-100", icon: AlertTriangle };
  if (days > 7) return { label: "Medium", color: "text-amber-800", bg: "bg-amber-100", icon: Clock };
  return { label: "Low", color: "text-yellow-800", bg: "bg-yellow-100", icon: Clock };
}

// ── Main Overdue Page ──
export default function OverduePage() {
  const [groupedData, setGroupedData] = useState<Map<string, StudentOverdueGroup>>(new Map());
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [reminderResults, setReminderResults] = useState<ReminderResult[] | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [reminderChannels, setReminderChannels] = useState<("email" | "sms")[]>(["email"]);
  const [contactInfoMap, setContactInfoMap] = useState<Map<string, { parentEmail: string | null; parentPhone: string | null }>>(new Map());
  const [contactInfoLoading, setContactInfoLoading] = useState(false);

  // ── Fetch Overdues ──
  const fetchOverdues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/overdue?groupBy=class");
      const data = await res.json();
      if (data.success) {
        // Transform grouped data into student groups
        const byClass = data.data || {};
        const studentMap = new Map<string, StudentOverdueGroup>();

        for (const [className, items] of Object.entries(byClass)) {
          for (const item of (items as OverdueItem[])) {
            if (!studentMap.has(item.studentName)) {
              studentMap.set(item.studentName, {
                studentId: item.loanId, // best effort; we use loan data
                studentName: item.studentName,
                parentEmail: null,
                parentPhone: null,
                className,
                items: [],
                maxDaysOverdue: 0,
              });
            }
            const group = studentMap.get(item.studentName)!;
            group.items.push(item);
            if (item.daysOverdue > group.maxDaysOverdue) group.maxDaysOverdue = item.daysOverdue;
          }
        }
        setGroupedData(studentMap);
        setTotalOverdue(data.totalOverdue || 0);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load overdue data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Contact Info ──
  const fetchContactInfo = useCallback(async () => {
    setContactInfoLoading(true);
    try {
      const res = await fetch("/api/admin/library/overdue/send-reminders");
      const data = await res.json();
      if (data.success && data.data) {
        const map = new Map<string, { parentEmail: string | null; parentPhone: string | null }>();
        for (const item of data.data) {
          map.set(item.studentName, {
            parentEmail: item.parentEmail,
            parentPhone: item.parentPhone,
          });
        }
        setContactInfoMap(map);
      }
    } catch {
      // Non-critical - contact info is optional
    } finally {
      setContactInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdues();
    fetchContactInfo();
  }, [fetchOverdues, fetchContactInfo]);

  // ── Toggle Talabat Expansion ──
  const toggleStudent = (name: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── Send Reminders (Bulk) ──
  const sendBulkReminders = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/admin/library/overdue/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: reminderChannels }),
      });
      const data = await res.json();
      if (data.success) {
        setReminderResults(data.results || []);
        setShowResultsModal(true);
        toast({ title: "Reminders Sent", description: data.message, variant: "success" });
      } else {
        toast({ title: "Error", description: data.error || "Failed to send reminders", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send reminders", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ── Print Handler ──
  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => { window.print(); }, 300);
  };

  useEffect(() => {
    const afterPrint = () => setPrintMode(false);
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  // ── Stats ──
  const studentCount = groupedData.size;
  const criticalCount = Array.from(groupedData.values()).filter((g) => g.maxDaysOverdue > 30).length;
  const highCount = Array.from(groupedData.values()).filter((g) => g.maxDaysOverdue > 14 && g.maxDaysOverdue <= 30).length;
  const mediumCount = Array.from(groupedData.values()).filter((g) => g.maxDaysOverdue > 7 && g.maxDaysOverdue <= 14).length;

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
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-400/30">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white">Overdue Books Dashboard</h1>
                <p className="text-emerald-100 text-sm">
                  {totalOverdue > 0
                    ? `${totalOverdue} overdue book${totalOverdue !== 1 ? "s" : ""} across ${studentCount} student${studentCount !== 1 ? "s" : ""}`
                    : "No overdue books — all clear!"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Channel Toggle */}
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
                <button
                  onClick={() => setReminderChannels((prev) =>
                    prev.includes("email") && prev.includes("sms")
                      ? ["email"]
                      : prev.includes("email") && !prev.includes("sms")
                        ? ["sms"]
                        : ["email"]
                  )}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    reminderChannels.includes("email")
                      ? "bg-white text-emerald-800 shadow-sm"
                      : "text-white/85 hover:text-white"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button
                  onClick={() => setReminderChannels((prev) =>
                    prev.includes("sms") && prev.includes("email")
                      ? ["sms"]
                      : prev.includes("sms") && !prev.includes("email")
                        ? ["email"]
                        : [...prev, "sms"]
                  )}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    reminderChannels.includes("sms")
                      ? "bg-white text-emerald-800 shadow-sm"
                      : "text-white/85 hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> SMS
                </button>
              </div>

              <Button
                size="sm"
                variant="admin"
                onClick={sendBulkReminders}
                disabled={totalOverdue === 0 || sending}
                className="shadow-lg"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-1.5" />
                )}
                {sending ? "Sending..." : `Send ${reminderChannels.length > 1 ? "Email + SMS" : reminderChannels[0] === "email" ? "Email" : "SMS"} Reminders`}
              </Button>

              <Button
                size="sm"
                className="bg-white text-red-700 hover:bg-red-50 shadow-lg"
                onClick={handlePrint}
                disabled={totalOverdue === 0}
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={fetchOverdues}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #fca5a5, transparent)" }} />
        </div>
      </motion.div>

      {/* Severity Summary Cards */}
      {totalOverdue > 0 && !loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="fatimi-card border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-xs text-gray-500">Critical (&gt;30 days)</p>
            </CardContent>
          </Card>
          <Card className="fatimi-card border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-orange-600">{highCount}</p>
              <p className="text-xs text-gray-500">High (15-30 days)</p>
            </CardContent>
          </Card>
          <Card className="fatimi-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-600">{mediumCount}</p>
              <p className="text-xs text-gray-500">Medium (8-14 days)</p>
            </CardContent>
          </Card>
          <Card className="fatimi-card border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-yellow-600">{totalOverdue - criticalCount - highCount - mediumCount}</p>
              <p className="text-xs text-gray-500">Low (≤7 days)</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* No overdue state */}
      {!loading && totalOverdue === 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" style={{ background: "linear-gradient(90deg, #047857, #d4af37, #047857)" }} />
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No Overdue Books</h3>
              <p className="text-sm text-gray-500">All books have been returned on time. Great work!</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Talabat-Grouped Overdue List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="fatimi-card animate-pulse">
              <div className="fatimi-card-header" />
              <CardContent className="p-5">
                <div className="h-6 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="h-10 bg-gray-50 rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {Array.from(groupedData.entries())
              .sort(([, a], [, b]) => b.maxDaysOverdue - a.maxDaysOverdue)
              .map(([studentName, group], idx) => {
                const isExpanded = expandedStudents.has(studentName);
                const severity = getSeverity(group.maxDaysOverdue);
                const SeverityIcon = severity.icon;

                return (
                  <motion.div
                    key={studentName}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className={`fatimi-card transition-all ${isExpanded ? "ring-2 ring-red-200" : ""} ${printMode ? "print:border-2 print:border-red-300 print:shadow-none print:break-inside-avoid" : ""}`}>
                      <div className="fatimi-card-header" style={{ background: "linear-gradient(90deg, #dc2626, #fca5a5)" }} />
                      
                      {/* Talabat Header (clickable) */}
                      <button
                        onClick={() => toggleStudent(studentName)}
                        className="w-full text-left"
                      >
                        <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors rounded-t-xl">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${severity.bg} shrink-0`}>
                                <SeverityIcon className={`w-5 h-5 ${severity.color}`} />
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base">{studentName}</span>
                                  <Badge variant={severity.label === "Critical" ? "destructive" : severity.label === "High" ? "warning" : severity.label === "Medium" ? "default" : "secondary"} className="text-[10px]">
                                    {severity.label}
                                  </Badge>
                                </CardTitle>
                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>{group.className}</span>
                                  <span>&middot;</span>
                                  <span className="font-semibold text-red-600">{group.items.length} book{group.items.length !== 1 ? "s" : ""}</span>
                                  <span>&middot;</span>
                                  <span>Max {group.maxDaysOverdue} day{group.maxDaysOverdue !== 1 ? "s" : ""} overdue</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </div>
                        </CardHeader>
                      </button>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <CardContent className="pt-0 pb-4">
                              {/* Book List */}
                              <div className="overflow-x-auto mb-3">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Book</th>
                                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Barcode</th>
                                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Borrowed</th>
                                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due</th>
                                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Overdue</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {group.items
                                      .sort((a, b) => b.daysOverdue - a.daysOverdue)
                                      .map((item) => {
                                        const sev = getSeverity(item.daysOverdue);
                                        return (
                                          <tr key={item.loanId} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-3 py-2.5">
                                              <div className="flex items-center gap-2">
                                                <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span className="text-sm text-gray-700">{item.bookTitle}</span>
                                              </div>
                                            </td>
                                            <td className="px-3 py-2.5 hidden sm:table-cell">
                                              <span className="text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{item.bookBarcode || "—"}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-sm text-gray-600 hidden md:table-cell">
                                              {new Date(item.borrowedAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              <span className="text-sm font-medium text-red-700">
                                                {new Date(item.dueAt).toLocaleDateString()}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${sev.bg} ${sev.color}`}>
                                                <Clock className="w-3 h-3 mr-1" />
                                                {item.daysOverdue}d
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Talabat Action Bar (always visible) */}
                      {!printMode && (() => {
                        const contact = contactInfoMap.get(studentName);
                        const email = contact?.parentEmail || null;
                        const phone = contact?.parentPhone || null;
                        return (
                          <div className="px-6 pb-4 flex items-center gap-3 border-t border-gray-100 pt-3 flex-wrap">
                            {email && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-gray-400" /> {email}
                              </span>
                            )}
                            {phone && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-gray-400" /> {phone}
                              </span>
                            )}
                            {!email && !phone && !contactInfoLoading && (
                              <span className="text-xs text-gray-400 italic">No contact info available</span>
                            )}
                            {contactInfoLoading && (
                              <span className="text-xs text-gray-400 italic flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Loading contact info...
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </Card>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}

      {/* Reminder Results Modal */}
      <Modal open={showResultsModal} onOpenChange={setShowResultsModal}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Reminder Results
            </ModalTitle>
            <ModalDescription>
              Summary of sent reminders
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {reminderResults?.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div>
                  {r.emailSent || r.smsSent ? (
                    <CheckCheck className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{r.studentName}</p>
                  <div className="flex gap-2 text-xs text-gray-500">
                    {r.emailSent && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" /> Email ✓</span>}
                    {r.smsSent && <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> SMS ✓</span>}
                    {!r.emailSent && !r.smsSent && <span className="text-red-500">{r.error || "Failed"}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowResultsModal(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; }
          .fatimi-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #fca5a5 !important; box-shadow: none !important; }
          .fatimi-card-header { height: 4px !important; }
        }
      `}</style>
    </div>
  );
}
