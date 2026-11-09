"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Mail,
  Send,
  Inbox,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  User,
  Copy,
  Check,
  ShieldCheck,
  ChevronRight,
  Reply,
  Globe,
  Radio,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
  Archive,
  RotateCcw,
  MessageSquare,
  Plus,
  UserCheck,
  GraduationCap,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { timeAgo } from "@/lib/utils";

interface TicketSender {
  id: string;
  name: string;
  email: string;
  role: string;
  its: string;
  grade: string;
  mobile: string;
  photo: string | null;
}

interface TicketReply {
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface MailflareTicket {
  id: string;
  ticketId: string;
  title: string;
  subject: string;
  category: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  message: string;
  replies: TicketReply[];
  isRead: boolean;
  createdAt: string;
  outbound?: boolean;
  sender: TicketSender;
}

interface MailflareData {
  config: {
    supportEmail: string;
    institutionalDomain: string;
    activeTransporter: string;
    isSmtpConfigured: boolean;
    status: string;
  };
  counts: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    unread: number;
  };
  tickets: MailflareTicket[];
}

interface StudentOption {
  id: string;
  name: string;
  its: string;
  grade: string;
  email: string;
  institutionalEmail: string;
  avatarUrl?: string | null;
  mobile?: string;
}

const CANNED_RESPONSES = [
  {
    title: "Credentials Reset",
    text: "Afzalus Salam. Your portal credentials and login identity have been securely verified and updated. You may now sign in using your ITS and institutional email.",
  },
  {
    title: "Visit IT Lab",
    text: "Afzalus Salam. Please visit the Maktab IT Support Lab (Room 102) with your device during break hours for hardware and network diagnostics.",
  },
  {
    title: "Biometric Re-sync",
    text: "Afzalus Salam. Your biometric profile and RFID card have been resynchronized across the MinMoe campus check-in gates.",
  },
  {
    title: "Inquiry Rectified",
    text: "Afzalus Salam. Your inquiry has been thoroughly investigated and resolved on the institutional network. Please verify in your student portal.",
  },
];

export default function AdminMailflarePage() {
  const [data, setData] = useState<MailflareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Stacks and Tabs
  const [stackView, setStackView] = useState<"ACTIVE" | "RESOLVED" | "COMPOSE">("ACTIVE");
  const [activeSubFilter, setActiveSubFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Reply Form
  const [replyText, setReplyText] = useState("");
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Compose Form
  const [studentsList, setStudentsList] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composePriority, setComposePriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [composeCategory, setComposeCategory] = useState("Administrative Notice");
  const [submittingCompose, setSubmittingCompose] = useState(false);

  // Copy feedback
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Real-time polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/admin/mailflare", {
        credentials: "include",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        if (!selectedTicketId && json.data.tickets.length > 0) {
          // Select first active ticket by default
          const firstActive = json.data.tickets.find((t: any) => t.status !== "RESOLVED");
          setSelectedTicketId(firstActive ? firstActive.id : json.data.tickets[0].id);
        }
      }
    } catch {
      if (!isSilent) {
        toast({ title: "Failed to load Mailflare", description: "Network error", variant: "destructive" });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTicketId]);

  // Load students list once for Compose picker
  const fetchStudents = useCallback(async () => {
    try {
      setLoadingStudents(true);
      const res = await fetch("/api/admin/mailflare/students", {
        credentials: "include",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setStudentsList(json.data);
      }
    } catch (err) {
      console.warn("Could not load students for mailflare compose:", err);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchStudents();
  }, [fetchData, fetchStudents]);

  // Real-time live polling every 4 seconds when tab is focused
  useEffect(() => {
    const startPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hasFocus()) {
          fetchData(true);
        }
      }, 4000);
    };

    startPolling();

    const handleFocus = () => fetchData(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchData]);

  // Selected ticket
  const selectedTicket = useMemo(() => {
    if (!data?.tickets) return null;
    return data.tickets.find((t) => t.id === selectedTicketId) || null;
  }, [data?.tickets, selectedTicketId]);

  // Active stack tickets
  const activeTickets = useMemo(() => {
    if (!data?.tickets) return [];
    return data.tickets.filter((t) => {
      if (t.status === "RESOLVED") return false;
      if (activeSubFilter !== "ALL" && t.status !== activeSubFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketId.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.sender.name.toLowerCase().includes(q) ||
        t.sender.its.toLowerCase().includes(q) ||
        t.sender.email.toLowerCase().includes(q)
      );
    });
  }, [data?.tickets, activeSubFilter, searchQuery]);

  // Resolved stack tickets
  const resolvedTickets = useMemo(() => {
    if (!data?.tickets) return [];
    return data.tickets.filter((t) => {
      if (t.status !== "RESOLVED") return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketId.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.sender.name.toLowerCase().includes(q) ||
        t.sender.its.toLowerCase().includes(q) ||
        t.sender.email.toLowerCase().includes(q)
      );
    });
  }, [data?.tickets, searchQuery]);

  // Filtered students for picker
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsList.slice(0, 8);
    const q = studentSearch.toLowerCase().trim();
    return studentsList
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.its.includes(q) ||
          s.grade.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [studentsList, studentSearch]);

  // Send reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSubmittingReply(true);

    try {
      const res = await fetch("/api/admin/mailflare/reply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          replyText: replyText.trim(),
          notifyEmail: notifyByEmail,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Official Response Dispatched ✉️",
          description: json.data?.emailDispatched
            ? `Synchronized to Talabat portal and sent to ${selectedTicket.sender.email}`
            : "Saved and synchronized directly into Talabat student portal.",
          variant: "success",
        });
        setReplyText("");
        fetchData(true);
      } else {
        toast({ title: "Failed to send reply", description: json.error || "Server error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network Error", description: err?.message, variant: "destructive" });
    } finally {
      setSubmittingReply(false);
    }
  };

  // Update status (e.g. RESOLVE -> auto-stacks)
  const handleUpdateStatus = async (
    targetTicketId: string,
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED"
  ) => {
    try {
      const res = await fetch("/api/admin/mailflare/status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: targetTicketId, status }),
      });

      const json = await res.json();
      if (json.success) {
        if (status === "RESOLVED") {
          toast({
            title: "Inquiry Resolved & Stacked 📂",
            description: "Ticket automatically archived into the Resolved Stack.",
            variant: "success",
          });
        } else {
          toast({
            title: "Status Updated",
            description: `Thread marked as ${status.replace("_", " ")}`,
            variant: "success",
          });
        }
        fetchData(true);
      }
    } catch {
      toast({ title: "Status update failed", variant: "destructive" });
    }
  };

  // Dispatch Direct Outbound Compose
  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipient = selectedStudent ? selectedStudent.email : composeTo.trim();

    if (!recipient || !composeSubject.trim() || !composeMessage.trim()) {
      toast({
        title: "Incomplete details",
        description: "Please select a recipient, subject, and message.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingCompose(true);
    try {
      const res = await fetch("/api/admin/mailflare/compose", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUserId: selectedStudent?.id || null,
          to: recipient,
          subject: composeSubject.trim(),
          message: composeMessage.trim(),
          priority: composePriority,
          category: composeCategory,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Official Message Dispatched 🚀",
          description:
            json.data?.message ||
            `Synchronized to Talabat portal and dispatched to ${recipient}`,
          variant: "success",
        });

        // Reset form
        setSelectedStudent(null);
        setComposeTo("");
        setComposeSubject("");
        setComposeMessage("");
        setStudentSearch("");

        // Switch to Active stack to view the new inquiry
        setStackView("ACTIVE");
        fetchData(true);
      } else {
        toast({ title: "Dispatch Failed", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err?.message, variant: "destructive" });
    } finally {
      setSubmittingCompose(false);
    }
  };

  const handleSelectStudent = (student: StudentOption) => {
    setSelectedStudent(student);
    setComposeTo(student.institutionalEmail || student.email);
    setStudentSearch("");
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* ── Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Systems & Institutional Communications"
        hubDescription="Manage official communications, Mailflare webmail, broadcast alerts, and real-time student support synchronization."
        tabs={[
          { label: "Mailflare Webmail", href: "/admin/mailflare", icon: Mail },
          { label: "Broadcast Studio", href: "/admin/notifications", icon: Radio },
          { label: "Cloud WhatsApp", href: "/admin/whatsapp", icon: Globe },
        ]}
      />

      {/* ── Top Header / Status Banner ── */}
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#06241b] via-[#093527] to-[#041a13] text-white shadow-xl border border-emerald-600/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync Desk
              </span>
              <span className="text-xs text-emerald-200/90 font-mono font-medium">
                Real-Time Two-Way Sync Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Mail className="w-6 h-6 text-emerald-400" />
              <span>{data?.config.supportEmail || "support@darseburhani-galiakot.org"}</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/70 max-w-2xl leading-relaxed">
              Unified administration webmail. Inquiries and replies synchronize automatically with the Talabat student portal with instant resolved auto-stacking.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                if (data?.config.supportEmail) {
                  navigator.clipboard.writeText(data.config.supportEmail);
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 flex items-center gap-2 transition cursor-pointer"
            >
              {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEmail ? "Copied" : "Copy Desk Email"}</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black border-none text-xs rounded-xl shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Sync Now</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-5 pt-5 border-t border-emerald-800/60">
          <button
            onClick={() => {
              setStackView("ACTIVE");
              setActiveSubFilter("ALL");
            }}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              stackView === "ACTIVE"
                ? "bg-emerald-400/15 border-emerald-400/40"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <p className="text-[11px] text-emerald-200/80 font-semibold">Active Inquiries</p>
            <p className="text-xl sm:text-2xl font-black mt-0.5 text-white">
              {(data?.counts.open ?? 0) + (data?.counts.inProgress ?? 0)}
            </p>
          </button>

          <button
            onClick={() => {
              setStackView("ACTIVE");
              setActiveSubFilter("OPEN");
            }}
            className="p-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-left hover:bg-amber-500/20 transition cursor-pointer"
          >
            <p className="text-[11px] text-amber-300 font-semibold">Needs Attention (Open)</p>
            <p className="text-xl sm:text-2xl font-black mt-0.5 text-amber-300">
              {data?.counts.open ?? 0}
            </p>
          </button>

          <button
            onClick={() => {
              setStackView("ACTIVE");
              setActiveSubFilter("IN_PROGRESS");
            }}
            className="p-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 text-left hover:bg-sky-500/20 transition cursor-pointer"
          >
            <p className="text-[11px] text-sky-300 font-semibold">In Progress</p>
            <p className="text-xl sm:text-2xl font-black mt-0.5 text-sky-300">
              {data?.counts.inProgress ?? 0}
            </p>
          </button>

          <button
            onClick={() => setStackView("RESOLVED")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              stackView === "RESOLVED"
                ? "bg-emerald-500/25 border-emerald-400"
                : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
            }`}
          >
            <p className="text-[11px] text-emerald-300 font-semibold flex items-center justify-between">
              <span>Resolved Stack</span>
              <Archive className="w-3.5 h-3.5" />
            </p>
            <p className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-300">
              {data?.counts.resolved ?? 0}
            </p>
          </button>
        </div>
      </div>

      {/* ── Main Navigation Stack Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStackView("ACTIVE")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              stackView === "ACTIVE"
                ? "bg-emerald-800 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Active Threads Stack</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-extrabold">
              {activeTickets.length}
            </span>
          </button>

          <button
            onClick={() => setStackView("RESOLVED")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              stackView === "RESOLVED"
                ? "bg-emerald-800 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Resolved Stack (Auto-Stacked)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800 font-extrabold">
              {resolvedTickets.length}
            </span>
          </button>

          <button
            onClick={() => setStackView("COMPOSE")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              stackView === "COMPOSE"
                ? "bg-emerald-800 text-white shadow-sm"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Student Dispatch</span>
          </button>
        </div>

        {/* Search Input across current stack */}
        {stackView !== "COMPOSE" && (
          <div className="relative sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ITS, name, or subject..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-1.5 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 1: ACTIVE INQUIRIES VIEW ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "ACTIVE" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Active List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 pb-1">
              {(["ALL", "OPEN", "IN_PROGRESS"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveSubFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    activeSubFilter === filter
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {filter === "ALL" ? "All Active" : filter === "OPEN" ? "Open Only" : "In Progress"}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {activeTickets.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">No active inquiries</p>
                  <p className="text-xs text-slate-500">
                    All support threads have been investigated and moved into the Resolved Stack.
                  </p>
                </div>
              ) : (
                activeTickets.map((t) => {
                  const isSelected = selectedTicketId === t.id;
                  const isOutbound = t.outbound;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-emerald-50/70 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
                          : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                              #{t.ticketId}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold px-1.5 py-0 ${
                                t.status === "OPEN"
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-sky-100 text-sky-900 border-sky-300"
                              }`}
                            >
                              {t.status.replace("_", " ")}
                            </Badge>
                            {isOutbound && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-purple-50 text-purple-800 border-purple-200 font-bold"
                              >
                                Outbound
                              </Badge>
                            )}
                            <span className="text-[10.5px] text-slate-400 font-mono">
                              {timeAgo(t.createdAt)}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-slate-900 truncate">{t.subject}</h3>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {t.message}
                          </p>
                        </div>
                      </div>

                      {/* Student Footer Tag */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[9px] text-slate-700 shrink-0 overflow-hidden">
                            {t.sender.photo ? (
                              <img src={t.sender.photo} alt={t.sender.name} className="w-full h-full object-cover" />
                            ) : (
                              t.sender.name.slice(0, 1)
                            )}
                          </div>
                          <span className="font-bold text-slate-800 truncate">{t.sender.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">ITS: {t.sender.its}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Full Thread Deep-Dive (7 cols) */}
          <div className="lg:col-span-7">
            {selectedTicket ? (
              <Card className="rounded-2xl border-slate-200/90 shadow-sm bg-white overflow-hidden flex flex-col h-full min-h-[600px]">
                {/* Thread Header Bar */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md">
                        #{selectedTicket.ticketId}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs font-bold ${
                          selectedTicket.status === "OPEN"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : selectedTicket.status === "IN_PROGRESS"
                            ? "bg-sky-100 text-sky-900 border-sky-300"
                            : "bg-emerald-100 text-emerald-900 border-emerald-300"
                        }`}
                      >
                        {selectedTicket.status.replace("_", " ")}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-500">
                        {selectedTicket.category}
                      </span>
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      {selectedTicket.subject}
                    </h2>
                  </div>

                  {/* Status Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {selectedTicket.status !== "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedTicket.id, "IN_PROGRESS")}
                        className="text-xs font-bold rounded-xl border-sky-300 text-sky-800 hover:bg-sky-50"
                      >
                        Mark In Progress
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedTicket.id, "RESOLVED")}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve & Stack</span>
                    </Button>
                  </div>
                </div>

                {/* Student Profile Card Ribbon */}
                <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-800 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                      {selectedTicket.sender.photo ? (
                        <img
                          src={selectedTicket.sender.photo}
                          alt={selectedTicket.sender.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        selectedTicket.sender.name.slice(0, 1)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          {selectedTicket.sender.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-800 bg-emerald-50">
                          {selectedTicket.sender.grade}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ITS: <strong className="text-slate-800">{selectedTicket.sender.its}</strong> &middot; {selectedTicket.sender.email}
                      </div>
                    </div>
                  </div>

                  {selectedTicket.sender.mobile && selectedTicket.sender.mobile !== "N/A" && (
                    <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                      📞 {selectedTicket.sender.mobile}
                    </span>
                  )}
                </div>

                {/* Conversation Body & Thread */}
                <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[460px] bg-slate-50/40">
                  {/* Initial Inquiry / Message */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {selectedTicket.outbound ? "Administration Dispatch" : selectedTicket.sender.name}
                        </span>
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.message}
                    </p>
                  </div>

                  {/* Threaded Replies */}
                  {selectedTicket.replies.map((reply, idx) => {
                    const isAdmin = reply.sender === "ADMIN";

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-1.5 shadow-2xs ${
                          isAdmin
                            ? "bg-[#064e3b] text-white border-emerald-700 ml-6 sm:ml-12"
                            : "bg-white text-slate-900 border-slate-200 mr-6 sm:mr-12"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                          <span className={`font-bold flex items-center gap-1.5 ${isAdmin ? "text-amber-300" : "text-emerald-800"}`}>
                            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            <span>{reply.senderName}</span>
                          </span>
                          <span className={`font-mono text-[11px] ${isAdmin ? "text-emerald-200/80" : "text-slate-400"}`}>
                            {timeAgo(reply.timestamp)}
                          </span>
                        </div>
                        <p className={`whitespace-pre-wrap leading-relaxed ${isAdmin ? "text-emerald-50" : "text-slate-800"}`}>
                          {reply.text}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Composer Box */}
                <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Reply className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Post Official Reply (Synchronizes with Student Portal)</span>
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyByEmail}
                        onChange={(e) => setNotifyByEmail(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      />
                      <span>Also send email notification</span>
                    </label>
                  </div>

                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleSendReply();
                      }
                    }}
                    placeholder="Type official IT Support response... (Ctrl+Enter to send)"
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-slate-50 text-slate-900"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Shortcut: <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Ctrl+Enter</kbd>
                    </span>
                    <Button
                      onClick={handleSendReply}
                      disabled={submittingReply || !replyText.trim()}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs"
                    >
                      {submittingReply ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          <span>Send Official Response</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 h-full flex flex-col items-center justify-center space-y-3">
                <Mail className="w-12 h-12 text-slate-300" />
                <h3 className="font-bold text-slate-800 text-sm">Select an inquiry to view thread</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click on any ticket in the active stack to read replies, change status, or dispatch direct answers.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 2: RESOLVED ARCHIVE STACK ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "RESOLVED" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80">
            <div>
              <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                <Archive className="w-4 h-4 text-emerald-800" />
                <span>Resolved Stack Archive ({resolvedTickets.length})</span>
              </h3>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                Inquiries are automatically moved here when marked resolved. You can reopen any inquiry at any time.
              </p>
            </div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-xs">
              🔒 Automated Archive
            </Badge>
          </div>

          {resolvedTickets.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 p-12 text-center bg-white space-y-2">
              <Archive className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">No Resolved Inquiries In Stack</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When you click "Resolve & Stack" on an active inquiry, it will neatly archive here.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resolvedTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs hover:border-emerald-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          #{t.ticketId}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-[10px]">
                          RESOLVED
                        </Badge>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {timeAgo(t.createdAt)}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">{t.subject}</h4>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(t.id, "OPEN")}
                      className="text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 shrink-0 flex items-center gap-1"
                      title="Reopen inquiry and return to Active Stack"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reopen</span>
                    </Button>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {t.message}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-[9px]">
                        {t.sender.name.slice(0, 1)}
                      </div>
                      <span className="font-bold text-slate-800">{t.sender.name}</span>
                      <span className="text-slate-400 text-[10.5px] font-mono">ITS: {t.sender.its}</span>
                    </div>

                    <span className="text-[11px] font-bold text-emerald-700">
                      {t.replies.length} replies logged
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 3: DIRECT STUDENT DISPATCH (COMPOSE) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "COMPOSE" && (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200/90 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5">
              <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-700" />
                <span>Dispatch Official Communication to Student</span>
              </CardTitle>
              <p className="text-xs text-slate-500">
                Dispatches directly to the student's Talabat portal and sends an email notification.
              </p>
            </CardHeader>

            <CardContent className="p-5 sm:p-7 space-y-6">
              {/* Quick Student Picker */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Recipient Student (Instant Talabat Synchronization)
                </label>

                {selectedStudent ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-800 text-white flex items-center justify-center font-black text-sm overflow-hidden shrink-0 shadow-xs">
                        {selectedStudent.avatarUrl ? (
                          <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-full h-full object-cover" />
                        ) : (
                          selectedStudent.name.slice(0, 1)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {selectedStudent.name}
                          </span>
                          <Badge className="bg-emerald-700 text-white text-[10px] font-bold">
                            {selectedStudent.grade}
                          </Badge>
                        </div>
                        <div className="text-xs text-emerald-800 font-mono mt-0.5">
                          ITS: <strong>{selectedStudent.its}</strong> &middot; {selectedStudent.institutionalEmail}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedStudent(null);
                        setComposeTo("");
                      }}
                      className="text-xs font-bold rounded-xl"
                    >
                      Change Student
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student by Name, ITS Number, or Grade..."
                        className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    {/* Quick Student Selection Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition flex items-center gap-2.5 cursor-pointer bg-slate-50/50"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {s.avatarUrl ? (
                              <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              s.name.slice(0, 1)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">ITS: {s.its}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Canned Response Chips */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Insert One-Click Canned Response</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {CANNED_RESPONSES.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setComposeSubject(`Administrative Notice: ${chip.title}`);
                        setComposeMessage(chip.text);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 transition text-slate-700 cursor-pointer"
                    >
                      + {chip.title}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendCompose} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="e.g. Portal Credentials Update & Maktab Guidelines"
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Priority
                    </label>
                    <select
                      value={composePriority}
                      onChange={(e: any) => setComposePriority(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="NORMAL">Normal Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent Action Required</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Official Message Body
                  </label>
                  <textarea
                    rows={6}
                    value={composeMessage}
                    onChange={(e) => setComposeMessage(e.target.value)}
                    placeholder="Compose official institutional message to the student..."
                    className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    A synchronized record will be created in the student's portal immediately.
                  </span>
                  <Button
                    type="submit"
                    disabled={submittingCompose}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md transition"
                  >
                    {submittingCompose ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        <span>Dispatch Message to Student</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
