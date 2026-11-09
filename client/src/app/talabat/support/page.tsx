"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Send,
  Inbox,
  LifeBuoy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ShieldCheck,
  BellRing,
  BookOpen,
  Archive,
  RotateCcw,
  User,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

interface SupportIdentity {
  name: string;
  username?: string;
  its: string;
  institutionalEmail: string;
  webmailAlias?: string;
  registeredEmail: string;
  grade: string;
  section: string;
  mobile: string;
}

interface TicketReply {
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface SupportTicket {
  id: string;
  ticketId: string;
  title: string;
  category: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  message: string;
  replies: TicketReply[];
  sender?: string;
  adminName?: string;
  createdAt: string;
  isRead: boolean;
}

const CATEGORIES = [
  { id: "Portal & Login", label: "🔑 Portal & Login Credentials" },
  { id: "Library & Barcodes", label: "📚 Library & Barcode Scanning" },
  { id: "Biometric Attendance", label: "⏱️ Biometric Attendance & Scans" },
  { id: "Timetable & Classes", label: "📅 Timetable & Class Schedule" },
  { id: "Campus Devices & Wi-Fi", label: "💻 Campus Hardware & Wi-Fi" },
  { id: "General Inquiry", label: "📩 General IT Support Inquiry" },
];

export default function TalabatSupportPage() {
  // Stack view: ACTIVE | RESOLVED | NEW
  const [stackView, setStackView] = useState<"ACTIVE" | "RESOLVED" | "NEW">("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [identity, setIdentity] = useState<SupportIdentity | null>(null);
  const [itSupportEmail, setItSupportEmail] = useState("support@darseburhani-galiakot.org");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // New Inquiry Form
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Card reply state & collapse toggle (default all open)
  const [collapsedTickets, setCollapsedTickets] = useState<{ [ticketId: string]: boolean }>({});
  const [cardReplyText, setCardReplyText] = useState<{ [ticketId: string]: string }>({});
  const [replyingMap, setReplyingMap] = useState<{ [ticketId: string]: boolean }>({});

  // Copy email feedback
  const [copied, setCopied] = useState(false);

  // Auto-polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSupportData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await fetch("/api/talabat/support", {
        credentials: "include",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setIdentity(json.data.identity);
        setItSupportEmail(json.data.itSupportEmail || "support@darseburhani-galiakot.org");
        setTickets(json.data.tickets || []);
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load support data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSupportData();
  }, [fetchSupportData]);

  // Real-time live polling every 4 seconds when window is focused
  useEffect(() => {
    const startPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hasFocus()) {
          fetchSupportData(true);
        }
      }, 4000);
    };

    startPolling();

    const handleFocus = () => fetchSupportData(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchSupportData]);

  // Active tickets (OPEN and IN_PROGRESS)
  const activeTickets = useMemo(() => {
    return tickets.filter((t) => t.status !== "RESOLVED");
  }, [tickets]);

  // Resolved tickets
  const resolvedTickets = useMemo(() => {
    return tickets.filter((t) => t.status === "RESOLVED");
  }, [tickets]);

  const handleCopyEmail = () => {
    if (!identity?.institutionalEmail) return;
    navigator.clipboard.writeText(identity.institutionalEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Submit new inquiry
  const handleSendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setSubmitError("Please provide both a subject and your inquiry message.");
      return;
    }

    setSending(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch("/api/talabat/support/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          message: message.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmitSuccess(
          `Ticket #${json.data.ticketCode} submitted! Synchronized to administration desk.`
        );
        setSubject("");
        setMessage("");
        await fetchSupportData(true);
        setTimeout(() => {
          setStackView("ACTIVE");
        }, 1200);
      } else {
        setSubmitError(json.error || "Failed to dispatch support request. Please try again.");
      }
    } catch {
      setSubmitError("Network error while sending support request. Please check your connection.");
    } finally {
      setSending(false);
    }
  };

  // Student posts reply to a ticket
  const handlePostReply = async (ticketRecordId: string) => {
    const text = (cardReplyText[ticketRecordId] || "").trim();
    if (!text) return;

    setReplyingMap((prev) => ({ ...prev, [ticketRecordId]: true }));

    try {
      const res = await fetch("/api/talabat/support/reply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticketRecordId,
          replyText: text,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setCardReplyText((prev) => ({ ...prev, [ticketRecordId]: "" }));
        await fetchSupportData(true);
      }
    } catch (err) {
      console.error("Failed to post reply:", err);
    } finally {
      setReplyingMap((prev) => ({ ...prev, [ticketRecordId]: false }));
    }
  };

  // Student toggles status (Resolve / Reopen)
  const handleUpdateStatus = async (ticketRecordId: string, newStatus: "OPEN" | "RESOLVED") => {
    try {
      const res = await fetch("/api/talabat/support/status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticketRecordId,
          status: newStatus,
        }),
      });

      const json = await res.json();
      if (json.success) {
        await fetchSupportData(true);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedTickets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 text-[#221c12]">
      {/* ══════════════ Hero Header Card (Fatimi Charcoal & Gold Cockpit) ══════════════ */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#191512] via-[#211c17] to-[#14100c] text-white shadow-xl border border-[#d4af37]/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-[#f3b833]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#f3b833] bg-[#29221b] px-3 py-1 rounded-full border border-[#d4af37]/40 shadow-inner">
                Darse Burhani Galiakot
              </span>
              <span className="text-xs text-[#e7dec8] font-medium flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-[#f3b833] animate-pulse" />
                Real-Time Live Helpdesk
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <LifeBuoy className="w-7 h-7 text-[#f3b833]" />
              <span>Student IT Support & Communications</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#e7dec8] max-w-2xl leading-relaxed">
              Official communications channel. Messages from IT administration and your submitted support inquiries synchronize here in real time.
            </p>
          </div>

          {/* Student Institutional Email Badge Card */}
          {identity && (
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white space-y-2 shrink-0 md:max-w-xs shadow-lg">
              <div className="flex items-center justify-between text-xs text-[#f3b833] font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Mailflare Student Mailbox
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-white break-all flex items-center justify-between gap-2 bg-[#12161f]/80 px-3 py-2 rounded-xl border border-[#d4af37]/30">
                <span>{identity.institutionalEmail}</span>
                <button
                  onClick={handleCopyEmail}
                  className="p-1 hover:bg-white/10 rounded transition text-[#f3b833] shrink-0 cursor-pointer"
                  title="Copy Mailflare institutional address"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[11px] text-[#e7dec8] flex items-center justify-between">
                <span>@{identity.username || identity.its}</span>
                <span>Grade {identity.grade}{identity.section} &middot; ITS {identity.its}</span>
              </div>
              <div className="text-[10px] text-[#fff4be] border-t border-white/10 pt-1.5 flex items-center gap-1.5">
                <span className="font-bold">🔒 Protected Mailbox:</span>
                <span>Campus institutional network active.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ Metric Stack Ribbon ══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setStackView("ACTIVE")}
          className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
            stackView === "ACTIVE"
              ? "bg-[#fdfbf7] border-2 border-[#d4af37] shadow-sm ring-2 ring-[#d4af37]/20"
              : "bg-white border-[#e7e0d0] hover:bg-[#faf7f0] shadow-2xs"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#f4efe5] text-[#9a7318] flex items-center justify-center font-bold mb-2 border border-[#e7e0d0]">
            <Mail className="w-5 h-5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#221c12] font-mono">{activeTickets.length}</div>
          <div className="text-[11px] text-[#6b5f4b] font-bold uppercase tracking-wider">Active Threads Stack</div>
        </button>

        <button
          onClick={() => setStackView("RESOLVED")}
          className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
            stackView === "RESOLVED"
              ? "bg-[#fdfbf7] border-2 border-[#d4af37] shadow-sm ring-2 ring-[#d4af37]/20"
              : "bg-white border-[#e7e0d0] hover:bg-[#faf7f0] shadow-2xs"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#f4efe5] text-[#221c12] flex items-center justify-center font-bold mb-2 border border-[#e7e0d0]">
            <Archive className="w-5 h-5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#221c12] font-mono">{resolvedTickets.length}</div>
          <div className="text-[11px] text-[#6b5f4b] font-bold uppercase tracking-wider">Resolved Stack</div>
        </button>

        <button
          onClick={() => setStackView("NEW")}
          className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
            stackView === "NEW"
              ? "bg-[#fdfbf7] border-2 border-[#d4af37] shadow-sm ring-2 ring-[#d4af37]/20"
              : "bg-white border-[#e7e0d0] hover:bg-[#faf7f0] shadow-2xs"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#fbf5e6] text-[#9a7318] flex items-center justify-center font-bold mb-2 border border-[#edd7a6]">
            <Plus className="w-5 h-5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#221c12]">New</div>
          <div className="text-[11px] text-[#6b5f4b] font-bold uppercase tracking-wider">Compose Inquiry</div>
        </button>

        <div className="p-4 rounded-2xl bg-white border border-[#e7e0d0] shadow-2xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center font-bold mb-2 border border-sky-200">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#221c12] font-mono">{notifications.length}</div>
            <div className="text-[11px] text-[#6b5f4b] font-bold uppercase tracking-wider">Campus Alerts</div>
          </div>
        </div>
      </div>

      {/* ══════════════ Main Navigation Stack Tabs ══════════════ */}
      <div className="flex border-b border-[#e7e0d0] gap-2 sm:gap-4">
        <button
          onClick={() => setStackView("ACTIVE")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            stackView === "ACTIVE"
              ? "border-[#d4af37] text-[#9a7318]"
              : "border-transparent text-[#6b5f4b] hover:text-[#221c12]"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Active Threads Stack ({activeTickets.length})</span>
        </button>

        <button
          onClick={() => setStackView("RESOLVED")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            stackView === "RESOLVED"
              ? "border-[#d4af37] text-[#9a7318]"
              : "border-transparent text-[#6b5f4b] hover:text-[#221c12]"
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Resolved Stack ({resolvedTickets.length})</span>
        </button>

        <button
          onClick={() => setStackView("NEW")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            stackView === "NEW"
              ? "border-[#d4af37] text-[#9a7318]"
              : "border-transparent text-[#6b5f4b] hover:text-[#221c12]"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Compose New Inquiry</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 1: ACTIVE THREADS & REPLIES (FULLY DISPLAYED) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "ACTIVE" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#221c12] flex items-center gap-2">
              <span>Active Communications & Inquiries</span>
              <span className="text-xs font-mono text-[#9a7318] bg-[#fbf5e6] px-2.5 py-0.5 rounded-full border border-[#edd7a6]">
                ● Real-Time Live Sync
              </span>
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSupportData(true)}
              disabled={refreshing}
              className="text-xs font-bold rounded-xl flex items-center gap-1.5 border-[#e7e0d0] text-[#3d3426] hover:bg-[#f4efe5]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh Desk</span>
            </Button>
          </div>

          {activeTickets.length === 0 ? (
            <Card className="rounded-3xl border border-[#e7e0d0] p-10 text-center bg-white space-y-3 shadow-2xs">
              <CheckCircle2 className="w-12 h-12 text-[#059669] mx-auto" />
              <h4 className="font-bold text-[#221c12] text-base">No Active Support Tickets</h4>
              <p className="text-xs text-[#6b5f4b] max-w-sm mx-auto leading-relaxed">
                You have no pending unresolved inquiries with IT Support. Need help with login, library or attendance?
              </p>
              <Button
                onClick={() => setStackView("NEW")}
                className="bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#191512] text-xs font-black rounded-xl shadow-xs"
              >
                Compose Inquiry
              </Button>
            </Card>
          ) : (
            <div className="space-y-5">
              {activeTickets.map((t) => {
                const isCollapsed = collapsedTickets[t.id] || false;
                const isAdminOriginated = t.sender === "ADMIN" || t.title.toLowerCase().includes("administration");
                const isReplying = replyingMap[t.id] || false;

                return (
                  <Card
                    key={t.id}
                    className="rounded-3xl border border-[#e7e0d0] shadow-sm bg-white overflow-hidden transition-all"
                  >
                    {/* Ticket Header Ribbon */}
                    <div
                      onClick={() => toggleCollapse(t.id)}
                      className="p-4 sm:p-5 cursor-pointer bg-[#fbf9f4] hover:bg-[#f4efe5] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e7e0d0]"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-[#221c12] bg-[#f4efe5] px-2.5 py-0.5 rounded-md border border-[#e7e0d0]">
                            #{t.ticketId}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              t.status === "OPEN"
                                ? "bg-[#fbf5e6] text-[#9a7318] border-[#edd7a6]"
                                : "bg-sky-50 text-sky-800 border-sky-200"
                            }`}
                          >
                            {t.status.replace("_", " ")}
                          </Badge>
                          {isAdminOriginated && (
                            <Badge className="bg-[#191512] text-[#f3b833] border border-[#d4af37]/40 font-bold text-[10px]">
                              🏛️ Official Notice
                            </Badge>
                          )}
                          <span className="text-[11px] font-bold text-[#6b5f4b]">{t.category}</span>
                          <span className="text-[11px] text-[#97896f] font-mono">
                            {timeAgo(t.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-[#221c12] truncate">{t.title}</h4>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="text-xs text-[#9a7318] font-bold">
                          {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                        </span>
                        {isCollapsed ? (
                          <ChevronDown className="w-5 h-5 text-[#97896f]" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-[#97896f]" />
                        )}
                      </div>
                    </div>

                    {/* Fully Displayed Conversation Content */}
                    {!isCollapsed && (
                      <div className="p-5 sm:p-6 bg-[#faf7f0] space-y-4">
                        {/* Original Message Card */}
                        <div
                          className={`p-4 rounded-2xl border space-y-2 shadow-2xs ${
                            isAdminOriginated
                              ? "bg-gradient-to-r from-[#191512] via-[#241d17] to-[#191512] text-white border-[#d4af37]/40"
                              : "bg-white border-[#e7e0d0] text-[#221c12]"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs pb-1.5 border-b border-white/10">
                            <span className="font-extrabold flex items-center gap-1.5">
                              {isAdminOriginated ? (
                                <>
                                  <ShieldCheck className="w-4 h-4 text-[#f3b833]" />
                                  <span className="text-[#f3b833]">
                                    Official Communication from Idarah Administration
                                  </span>
                                </>
                              ) : (
                                <>
                                  <User className="w-4 h-4 text-[#9a7318]" />
                                  <span className="text-[#221c12]">Your Support Inquiry</span>
                                </>
                              )}
                            </span>
                            <span className={`font-mono text-[11px] ${isAdminOriginated ? "text-[#e7dec8]" : "text-[#97896f]"}`}>
                              {new Date(t.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className={`text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-medium ${isAdminOriginated ? "text-[#fff8e7]" : "text-[#221c12]"}`}>
                            {t.message}
                          </p>
                        </div>

                        {/* Threaded Replies */}
                        {t.replies.map((r, idx) => {
                          const isAdmin = r.sender === "ADMIN";

                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-1.5 shadow-sm ${
                                isAdmin
                                  ? "bg-[#191512] text-[#faf7f0] border-[#d4af37]/40 mr-4 sm:mr-10"
                                  : "bg-white text-[#221c12] border-[#e7e0d0] ml-4 sm:ml-10"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                                <span
                                  className={`font-bold flex items-center gap-1.5 ${
                                    isAdmin ? "text-[#f3b833]" : "text-[#065f46]"
                                  }`}
                                >
                                  {isAdmin ? (
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <User className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isAdmin ? "Idarah IT Support (Official)" : "You (Talib)"}</span>
                                </span>
                                <span
                                  className={`font-mono text-[11px] ${
                                    isAdmin ? "text-[#e7dec8]" : "text-[#97896f]"
                                  }`}
                                >
                                  {timeAgo(r.timestamp)}
                                </span>
                              </div>
                              <p
                                className={`whitespace-pre-wrap leading-relaxed ${
                                  isAdmin ? "text-[#fff8e7]" : "text-[#221c12]"
                                }`}
                              >
                                {r.text}
                              </p>
                            </div>
                          );
                        })}

                        {/* Fast Inline Reply Box */}
                        <div className="pt-3 border-t border-[#e7e0d0] space-y-3 bg-white p-4 rounded-2xl border border-[#e7e0d0]">
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#3d3426]">
                            Send Direct Reply / Follow-up to Administration
                          </label>
                          <div className="flex gap-2">
                            <textarea
                              rows={2}
                              value={cardReplyText[t.id] || ""}
                              onChange={(e) =>
                                setCardReplyText((prev) => ({ ...prev, [t.id]: e.target.value }))
                              }
                              placeholder="Type your reply here..."
                              className="flex-1 text-xs sm:text-sm p-3 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-[#221c12] focus:bg-white focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 shadow-2xs"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(t.id, "RESOLVED")}
                              className="text-xs font-bold text-[#6b5f4b] hover:text-[#065f46] hover:bg-[#ecfdf5] rounded-xl border-[#e7e0d0]"
                            >
                              Mark as Resolved & Stack
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handlePostReply(t.id)}
                              disabled={isReplying || !(cardReplyText[t.id] || "").trim()}
                              className="bg-[#191512] hover:bg-[#29221b] text-[#f3b833] border border-[#d4af37]/40 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              {isReplying ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Send Reply</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 2: RESOLVED ARCHIVE STACK ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "RESOLVED" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-[#fbf9f4] p-4 rounded-2xl border border-[#e7e0d0] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[#221c12] flex items-center gap-2">
                <Archive className="w-4 h-4 text-[#9a7318]" />
                <span>Resolved Inquiry Archive ({resolvedTickets.length})</span>
              </h3>
              <p className="text-xs text-[#6b5f4b] mt-0.5">
                Completed inquiries are safely stacked here. You can reopen any inquiry if you need more help.
              </p>
            </div>
          </div>

          {resolvedTickets.length === 0 ? (
            <Card className="rounded-3xl border border-[#e7e0d0] p-10 text-center bg-white space-y-2">
              <Archive className="w-10 h-10 text-[#e7e0d0] mx-auto" />
              <h4 className="font-bold text-[#221c12] text-sm">No Resolved Inquiries in Stack</h4>
              <p className="text-xs text-[#6b5f4b] max-w-sm mx-auto">
                When an issue is solved and marked resolved, it will appear here.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resolvedTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl border border-[#e7e0d0] bg-white space-y-3 shadow-2xs hover:border-[#d4af37] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-[#221c12] bg-[#f4efe5] px-2 py-0.5 rounded-md border border-[#e7e0d0]">
                          #{t.ticketId}
                        </span>
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
                          RESOLVED
                        </Badge>
                        <span className="text-[11px] text-[#97896f] font-mono">
                          {timeAgo(t.createdAt)}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-[#221c12] truncate">{t.title}</h4>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(t.id, "OPEN")}
                      className="text-xs font-bold rounded-xl text-[#3d3426] hover:bg-[#f4efe5] border-[#e7e0d0] shrink-0 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reopen</span>
                    </Button>
                  </div>

                  <p className="text-xs text-[#6b5f4b] line-clamp-2 leading-relaxed bg-[#faf7f0] p-3 rounded-xl border border-[#f0eadb]">
                    {t.message}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[#f0eadb]">
                    <span className="text-[11px] text-[#6b5f4b] font-semibold">{t.category}</span>
                    <span className="text-[11px] font-bold text-[#9a7318]">
                      {t.replies.length} replies
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 3: COMPOSE NEW INQUIRY ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "NEW" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="rounded-3xl border border-[#e7e0d0] shadow-sm overflow-hidden bg-white">
            <CardContent className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e7e0d0] pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#221c12]">
                    Submit New IT Helpdesk Inquiry
                  </h3>
                  <p className="text-xs text-[#6b5f4b]">
                    Direct dispatch to Darse Burhani IT Support ({itSupportEmail})
                  </p>
                </div>
                <Badge variant="outline" className="border-[#edd7a6] text-[#9a7318] bg-[#fbf5e6] text-xs self-start font-bold">
                  ⚡ Real-Time Desk Sync
                </Badge>
              </div>

              {submitSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-bold">{submitSuccess}</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      You can track updates and replies in the "Active Threads Stack".
                    </p>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSendTicket} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#faf7f0] border border-[#e7e0d0] text-xs">
                  <div>
                    <span className="font-bold text-[#6b5f4b]">From (Your Email):</span>
                    <span className="font-mono text-[#9a7318] font-bold ml-1.5">
                      {identity?.institutionalEmail || "firstname.lastname@darseburhani.galiakot"}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-[#6b5f4b]">To (IT Helpdesk):</span>
                    <span className="font-mono text-[#221c12] font-semibold ml-1.5">{itSupportEmail}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3d3426] mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] font-medium text-[#221c12] focus:bg-white focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 shadow-2xs"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3d3426] mb-1.5">
                      Urgency / Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] font-medium text-[#221c12] focus:bg-white focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 shadow-2xs"
                    >
                      <option value="NORMAL">Normal Priority</option>
                      <option value="HIGH">High Priority (Exam / Attendance Block)</option>
                      <option value="URGENT">Urgent (Credential Lockout)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3d3426] mb-1.5">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Briefly describe the issue..."
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-[#221c12] focus:bg-white focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3d3426] mb-1.5">
                    Detailed Message
                  </label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide full details: What happened, which terminal or book, time of occurrence..."
                    className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-[#e7e0d0] bg-[#faf7f0] text-[#221c12] focus:bg-white focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 shadow-2xs"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-[#6b5f4b]">
                    Your inquiry will immediately appear in the IT administration dashboard.
                  </span>
                  <Button
                    type="submit"
                    disabled={sending}
                    className="bg-gradient-to-r from-[#d4af37] via-[#f3b833] to-[#c59b27] hover:from-[#c59b27] hover:to-[#b8860b] text-[#191512] font-black px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit IT Inquiry</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
