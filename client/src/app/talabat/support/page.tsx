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
import { useFatimiTheme } from "@/context/FatimiThemeContext";
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
  const { theme } = useFatimiTheme();

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

  // Expanded ticket id & inline reply state per card
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
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

        // Auto-expand first active ticket if none expanded
        if (!expandedTicketId && json.data.tickets.length > 0) {
          const firstActive = json.data.tickets.find((t: any) => t.status !== "RESOLVED");
          if (firstActive) setExpandedTicketId(firstActive.id);
        }
      }
    } catch (err) {
      console.error("Failed to load support data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expandedTicketId]);

  useEffect(() => {
    fetchSupportData();
  }, [fetchSupportData]);

  // Real-time live polling every 4 seconds when focused
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
          if (json.data.id) setExpandedTicketId(json.data.id);
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

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ══════════════ Hero Header Card ══════════════ */}
      <div className="p-1 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
          style={{
            background: theme?.cardHeroGradient || "linear-gradient(135deg, #062b20 0%, #083c2c 50%, #031c15 100%)",
            boxShadow: `0 20px 50px ${theme?.accentGlow || "rgba(16, 185, 129, 0.18)"}`,
          }}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-amber-200 bg-emerald-950/70 px-3 py-1 rounded-full border border-amber-400/30">
                  Darse Burhani Galiakot
                </span>
                <span className="text-xs text-emerald-200 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Real-Time Live Helpdesk
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <LifeBuoy className="w-7 h-7 text-amber-300" />
                <span>Student IT Support & Communications</span>
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
                Direct official line to the IT administration team. Track inquiries, view administrative updates,
                and receive immediate resolutions for campus systems.
              </p>
            </div>

            {/* Student Institutional Email Badge Card */}
            {identity && (
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white space-y-2 shrink-0 md:max-w-xs shadow-lg">
                <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Mailflare Student Identity
                  </span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="font-mono text-xs sm:text-sm font-bold text-white break-all flex items-center justify-between gap-2 bg-emerald-950/60 px-3 py-2 rounded-xl border border-emerald-400/20">
                  <span>{identity.institutionalEmail}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 hover:bg-white/10 rounded transition text-amber-300 shrink-0 cursor-pointer"
                    title="Copy Mailflare institutional address"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[11px] text-emerald-200/90 flex items-center justify-between">
                  <span>@{identity.username || identity.its}</span>
                  <span>Grade {identity.grade}{identity.section} &middot; ITS {identity.its}</span>
                </div>
                <div className="text-[10px] text-amber-200/90 border-t border-white/10 pt-1.5 flex items-center gap-1.5">
                  <span className="font-bold">🔒 Protected Mailbox:</span>
                  <span>Internal campus network active.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ Metric Stack Ribbon ══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setStackView("ACTIVE")}
          className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
            stackView === "ACTIVE"
              ? "bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30"
              : "bg-white border-slate-200/80 hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-2">
            <Mail className="w-5 h-5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{activeTickets.length}</div>
          <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Active Threads Stack</div>
        </button>

        <button
          onClick={() => setStackView("RESOLVED")}
          className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
            stackView === "RESOLVED"
              ? "bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30"
              : "bg-white border-slate-200/80 hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold mb-2">
            <Archive className="w-5 h-5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{resolvedTickets.length}</div>
          <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Resolved Stack</div>
        </button>

        <button
          onClick={() => setStackView("NEW")}
          className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
            stackView === "NEW"
              ? "bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30"
              : "bg-white border-slate-200/80 hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold mb-2">
            <Plus className="w-5 h-5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">New</div>
          <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Compose Inquiry</div>
        </button>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold mb-2">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{notifications.length}</div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Campus Alerts</div>
          </div>
        </div>
      </div>

      {/* ══════════════ Main Navigation Stack Tabs ══════════════ */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4">
        <button
          onClick={() => setStackView("ACTIVE")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            stackView === "ACTIVE"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Active Threads Stack ({activeTickets.length})</span>
        </button>

        <button
          onClick={() => setStackView("RESOLVED")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            stackView === "RESOLVED"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Resolved Stack ({resolvedTickets.length})</span>
        </button>

        <button
          onClick={() => setStackView("NEW")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            stackView === "NEW"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Compose New Inquiry</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── STACK 1: ACTIVE THREADS & REPLIES ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {stackView === "ACTIVE" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>Active Support Threads</span>
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Live Synced
              </span>
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSupportData(true)}
              disabled={refreshing}
              className="text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh Desk</span>
            </Button>
          </div>

          {activeTickets.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 p-10 text-center bg-white space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-base">No Active Support Tickets</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                You have no unresolved inquiries pending with IT Support. Need help? Click "Compose New Inquiry".
              </p>
              <Button
                onClick={() => setStackView("NEW")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
              >
                Compose Inquiry
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeTickets.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                const isAdminOriginated = t.sender === "ADMIN";
                const isReplying = replyingMap[t.id] || false;

                return (
                  <Card
                    key={t.id}
                    className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden transition-all"
                  >
                    {/* Ticket Header Bar */}
                    <div
                      onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                      className="p-4 sm:p-5 cursor-pointer hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                            #{t.ticketId}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              t.status === "OPEN"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-sky-100 text-sky-900 border-sky-300"
                            }`}
                          >
                            {t.status.replace("_", " ")}
                          </Badge>
                          {isAdminOriginated && (
                            <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-bold text-[10px]">
                              🏛️ Official Notice
                            </Badge>
                          )}
                          <span className="text-[11px] font-bold text-slate-500">{t.category}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {timeAgo(t.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{t.title}</h4>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="text-xs text-slate-500 font-semibold">
                          {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expandable Conversation Thread */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="p-4 sm:p-5 bg-slate-50/50 space-y-4"
                        >
                          {/* Original Message Card */}
                          <div
                            className={`p-4 rounded-xl border space-y-1.5 ${
                              isAdminOriginated
                                ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold flex items-center gap-1.5">
                                {isAdminOriginated ? (
                                  <>
                                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                                    <span className="text-emerald-900">
                                      Official Communication from Administration
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <User className="w-4 h-4 text-slate-600" />
                                    <span className="text-slate-800">Your Support Inquiry</span>
                                  </>
                                )}
                              </span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                {new Date(t.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-slate-900 font-medium">
                              {t.message}
                            </p>
                          </div>

                          {/* Threaded Replies */}
                          {t.replies.map((r, idx) => {
                            const isAdmin = r.sender === "ADMIN";

                            return (
                              <div
                                key={idx}
                                className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-1.5 shadow-2xs ${
                                  isAdmin
                                    ? "bg-[#064e3b] text-white border-emerald-700 mr-4 sm:mr-8"
                                    : "bg-white text-slate-900 border-slate-200 ml-4 sm:ml-8"
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                                  <span
                                    className={`font-bold flex items-center gap-1.5 ${
                                      isAdmin ? "text-amber-300" : "text-emerald-800"
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
                                      isAdmin ? "text-emerald-200/80" : "text-slate-400"
                                    }`}
                                  >
                                    {timeAgo(r.timestamp)}
                                  </span>
                                </div>
                                <p
                                  className={`whitespace-pre-wrap leading-relaxed ${
                                    isAdmin ? "text-emerald-50 font-normal" : "text-slate-900"
                                  }`}
                                >
                                  {r.text}
                                </p>
                              </div>
                            );
                          })}

                          {/* Fast Inline Reply Box */}
                          <div className="pt-2 border-t border-slate-200 space-y-3">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                              Send Direct Follow-up to IT Support
                            </label>
                            <div className="flex gap-2">
                              <textarea
                                rows={2}
                                value={cardReplyText[t.id] || ""}
                                onChange={(e) =>
                                  setCardReplyText((prev) => ({ ...prev, [t.id]: e.target.value }))
                                }
                                placeholder="Type your response or clarification to IT administration..."
                                className="flex-1 text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(t.id, "RESOLVED")}
                                className="text-xs font-bold text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl"
                              >
                                Mark as Resolved & Stack
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handlePostReply(t.id)}
                                disabled={isReplying || !(cardReplyText[t.id] || "").trim()}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
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
                        </motion.div>
                      )}
                    </AnimatePresence>
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
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                <Archive className="w-4 h-4 text-emerald-800" />
                <span>Resolved Inquiry Archive ({resolvedTickets.length})</span>
              </h3>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                Completed inquiries are safely stacked here. You can reopen any inquiry if you need more help.
              </p>
            </div>
          </div>

          {resolvedTickets.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 p-10 text-center bg-white space-y-2">
              <Archive className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">No Resolved Inquiries in Stack</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When an issue is solved and marked resolved, it will appear here.
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
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">{t.title}</h4>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(t.id, "OPEN")}
                      className="text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 shrink-0 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reopen</span>
                    </Button>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {t.message}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold">{t.category}</span>
                    <span className="text-[11px] font-bold text-emerald-700">
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
          <Card className="rounded-2xl border-slate-200/90 shadow-sm overflow-hidden bg-white">
            <CardContent className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Submit New IT Helpdesk Inquiry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct dispatch to Darse Burhani IT Support ({itSupportEmail})
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 text-xs self-start">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-600">From (Your Email):</span>
                    <span className="font-mono text-emerald-800 font-bold ml-1.5">
                      {identity?.institutionalEmail || "firstname.lastname@darseburhani.galiakot"}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600">To (IT Helpdesk):</span>
                    <span className="font-mono text-slate-800 font-semibold ml-1.5">{itSupportEmail}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Urgency / Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    >
                      <option value="NORMAL">Normal Priority</option>
                      <option value="HIGH">High Priority (Exam / Attendance Block)</option>
                      <option value="URGENT">Urgent (Credential Lockout)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Briefly describe the issue..."
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Detailed Message
                  </label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide full details: What happened, which terminal or book, time of occurrence..."
                    className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">
                    Your inquiry will immediately appear in the IT administration dashboard.
                  </span>
                  <Button
                    type="submit"
                    disabled={sending}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
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
