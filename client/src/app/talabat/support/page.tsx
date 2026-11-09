"use client";

import { useState, useEffect } from "react";
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
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  BellRing,
  BookOpen,
  Calendar,
  Zap,
} from "lucide-react";
import Link from "next/link";
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

interface SupportTicket {
  id: string;
  ticketId: string;
  title: string;
  category: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  message: string;
  replies: Array<{
    sender: string;
    senderName: string;
    text: string;
    timestamp: string;
  }>;
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

  const [activeTab, setActiveTab] = useState<"compose" | "tickets" | "notifications">("compose");
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<SupportIdentity | null>(null);
  const [itSupportEmail, setItSupportEmail] = useState("support@darseburhani-galiakot.org");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Form state
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Expanded ticket id
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  // Copy email feedback
  const [copied, setCopied] = useState(false);

  const fetchSupportData = async () => {
    try {
      setLoading(true);
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
    }
  };

  useEffect(() => {
    fetchSupportData();
  }, []);

  const handleCopyEmail = () => {
    if (!identity?.institutionalEmail) return;
    navigator.clipboard.writeText(identity.institutionalEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          `Ticket #${json.data.ticketCode} submitted! An email notification has been dispatched to IT Support.`
        );
        setSubject("");
        setMessage("");
        await fetchSupportData();
        // Switch to tickets tab after brief moment
        setTimeout(() => {
          setActiveTab("tickets");
          setExpandedTicketId(json.data.id);
        }, 1500);
      } else {
        setSubmitError(json.error || "Failed to dispatch support request. Please try again.");
      }
    } catch {
      setSubmitError("Network error while sending support request. Please check your connection.");
    } finally {
      setSending(false);
    }
  };

  const handlePostReply = async (ticketRecordId: string) => {
    if (!replyText.trim()) return;
    setReplying(true);

    try {
      const res = await fetch("/api/talabat/support/reply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticketRecordId,
          replyText: replyText.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setReplyText("");
        await fetchSupportData();
      }
    } catch (err) {
      console.error("Failed to post reply:", err);
    } finally {
      setReplying(false);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setUnreadCount(0);
      fetchSupportData();
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ══════════════ Hero Header Card ══════════════ */}
      <div className="p-1 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/15 shadow-sm">
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
          style={{
            background: theme?.cardHeroGradient || "linear-gradient(135deg, #1c1c1c 0%, #141414 45%, #241c12 100%)",
            boxShadow: `0 20px 50px ${theme?.accentGlow || "rgba(252, 212, 104, 0.18)"}`,
          }}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-amber-200 bg-emerald-950/70 px-3 py-1 rounded-full border border-amber-400/30">
                  Darse Burhani Galiakot
                </span>
                <span className="text-xs text-emerald-100 font-medium">Talabat IT & Mail Helpdesk</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <LifeBuoy className="w-7 h-7 text-amber-300" />
                <span>Student IT Support & Communications</span>
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
                Send inquiries directly to the IT administration team, receive official campus updates,
                and track resolution status for library, attendance, and account requests.
              </p>
            </div>

            {/* Student Institutional Email Badge Card */}
            {identity && (
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white space-y-2 shrink-0 md:max-w-xs shadow-lg">
                <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Mailflare Student Mailbox
                  </span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="font-mono text-xs sm:text-sm font-bold text-white break-all flex items-center justify-between gap-2 bg-emerald-950/60 px-3 py-2 rounded-xl border border-emerald-400/20">
                  <span>{identity.institutionalEmail}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 hover:bg-white/10 rounded transition text-amber-300 shrink-0 cursor-pointer"
                    title="Copy Mailflare institutional address (First Name.Last Name - No middle name)"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[11px] text-emerald-200/90 flex items-center justify-between">
                  <span>@{identity.username || identity.its} (No Middle Name)</span>
                  <span>Grade {identity.grade}{identity.section} • ITS {identity.its}</span>
                </div>
                <div className="text-[10px] text-amber-200/90 border-t border-white/10 pt-1.5 flex items-center gap-1.5">
                  <span className="font-bold">🔒 Walled Garden:</span>
                  <span>Internal campus network only. Outside mail (Gmail, Yahoo) blocked.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ Quick Metric Pills ══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black text-slate-900">{tickets.length}</div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">My Tickets</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black text-slate-900">
              {tickets.filter((t) => t.status === "OPEN").length}
            </div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">In Progress</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black text-slate-900">{notifications.length}</div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">Campus Notices</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black text-emerald-700 flex items-center gap-1">
              <span>Mailflare Connected</span>
            </div>
            <div className="text-[11px] text-slate-600 font-bold truncate">@darseburhani.galiakot</div>
          </div>
        </div>
      </div>

      {/* ══════════════ Tab Switcher ══════════════ */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4">
        <button
          onClick={() => setActiveTab("compose")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "compose"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Compose & Send Email</span>
        </button>

        <button
          onClick={() => setActiveTab("tickets")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "tickets"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>My Tickets & Threads ({tickets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "notifications"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Received Notices</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-black">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ Tab 1: Compose Form ══════════════ */}
      {activeTab === "compose" && (
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
                  ⚡ Real-Time SMTP Delivery
                </Badge>
              </div>

              {submitSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-bold">{submitSuccess}</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      You can track updates and replies in the "My Tickets & Threads" tab.
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
                {/* Meta details preview strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-600">From (Student Email):</span>
                    <span className="font-mono text-emerald-800 font-bold ml-1.5">
                      {identity?.institutionalEmail || "firstname.lastname@darseburhani.galiakot"}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600">To (IT Helpdesk):</span>
                    <span className="font-mono text-slate-800 font-semibold ml-1.5">{itSupportEmail}</span>
                  </div>
                </div>

                {/* Walled Garden Security Alert */}
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-[11.5px] text-amber-950 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-black text-amber-900">Mailflare Institutional Network Policy:</span>{" "}
                    All student communications, notifications, and inquiries are strictly confined to the campus internal system (<code>@darseburhani.galiakot</code>). External communication to public email providers (Gmail, Yahoo, Outlook, etc.) is prohibited.
                  </div>
                </div>

                {/* Category & Priority Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="support-inquiry-category" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      id="support-inquiry-category"
                      name="inquiryCategory"
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
                    <div className="grid grid-cols-3 gap-2">
                      {(["NORMAL", "HIGH", "URGENT"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`py-2 text-xs font-bold rounded-xl border transition ${
                            priority === p
                              ? p === "URGENT"
                                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                : p === "HIGH"
                                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                : "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="support-inquiry-subject" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Subject / Short Summary
                  </label>
                  <input
                    id="support-inquiry-subject"
                    name="inquirySubject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="E.g. Unable to scan book barcode at Express Terminal DB-042"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    required
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label htmlFor="support-inquiry-message" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Detailed Message
                  </label>
                  <textarea
                    id="support-inquiry-message"
                    name="inquiryMessage"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide full details: What happened, which terminal, time of occurrence, or book accession number..."
                    className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-600">
                    A copy will be registered under your Talabat profile.
                  </span>
                  <Button
                    type="submit"
                    disabled={sending}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Email...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send IT Support Email</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Quick FAQ info callout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-black text-amber-900">
                <BookOpen className="w-4 h-4" />
                <span>Library Book Barcode Issues?</span>
              </div>
              <p className="text-amber-900/80 leading-relaxed">
                If the Express Checkout Scanner does not recognize a book code, mention the barcode label (e.g.
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950 ml-1">DB-FIQH-014</code>)
                so the librarian can re-index it.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-black text-emerald-900">
                <Clock className="w-4 h-4" />
                <span>Biometric MinMoe Terminal Questions?</span>
              </div>
              <p className="text-emerald-900/80 leading-relaxed">
                Biometric gate check-in syncs in real-time. If your attendance status shows missing or late, submit an
                attendance inquiry with the exact scan gate.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ══════════════ Tab 2: My Tickets & Threads ══════════════ */}
      {activeTab === "tickets" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800">
              Submitted Inquiries ({tickets.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSupportData}
              className="text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>

          {tickets.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 p-8 text-center bg-white space-y-3">
              <LifeBuoy className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">No Support Inquiries Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Have an issue with your account, library borrowing, or class schedule? Click "Compose & Send Email" to get help.
              </p>
              <Button
                onClick={() => setActiveTab("compose")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
              >
                Compose Inquiry
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                const statusColor =
                  t.status === "RESOLVED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : t.status === "IN_PROGRESS"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-sky-100 text-sky-800 border-sky-300";

                return (
                  <Card
                    key={t.id}
                    className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                      className="p-4 sm:p-5 cursor-pointer hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{t.ticketId}
                          </span>
                          <Badge variant="outline" className={`text-[10px] font-bold ${statusColor}`}>
                            {t.status}
                          </Badge>
                          <span className="text-[11px] font-bold text-slate-500">{t.category}</span>
                          <span className="text-[11px] text-slate-600 font-mono">
                            {timeAgo(t.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate">{t.title}</h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <span className="text-xs text-slate-500 font-semibold">
                          {t.replies.length} replies
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
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
                          className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50 space-y-4"
                        >
                          {/* Original Student Inquiry */}
                          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-emerald-800">
                                Original Inquiry (Sent by You)
                              </span>
                              <span className="text-slate-600 font-mono">
                                {new Date(t.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                              {t.message}
                            </p>
                          </div>

                          {/* Replies Thread */}
                          {t.replies.map((r, idx) => (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                                r.sender === "STUDENT"
                                  ? "bg-emerald-50/60 border-emerald-200 ml-4 sm:ml-8"
                                  : "bg-blue-50/60 border-blue-200 mr-4 sm:mr-8"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span
                                  className={`font-bold ${
                                    r.sender === "STUDENT" ? "text-emerald-900" : "text-blue-900"
                                  }`}
                                >
                                  {r.sender === "STUDENT" ? "You" : "IT Support Desk"}
                                </span>
                                <span className="text-slate-600 font-mono">
                                  {timeAgo(r.timestamp)}
                                </span>
                              </div>
                              <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">{r.text}</p>
                            </div>
                          ))}

                          {/* Quick Reply Box */}
                          <div className="pt-2 flex gap-2">
                            <input
                              id={`support-reply-${t.id}`}
                              name="replyMessage"
                              aria-label="Write a follow-up reply"
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a follow-up reply..."
                              className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handlePostReply(t.id);
                              }}
                            />
                            <Button
                              size="sm"
                              disabled={replying || !replyText.trim()}
                              onClick={() => handlePostReply(t.id)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
                            >
                              Reply
                            </Button>
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

      {/* ══════════════ Tab 3: Received Campus Notices ══════════════ */}
      {activeTab === "notifications" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-800">
                Received Campus Notices & Feed ({notifications.length})
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                className="text-xs font-bold rounded-xl text-slate-700"
              >
                Mark all as read
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 p-8 text-center bg-white space-y-2">
              <Inbox className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">Inbox is Clear!</h4>
              <p className="text-xs text-slate-500">
                You have no pending campus alerts or automated notices at this time.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notif) => {
                const isAtt = notif.type === "ATTENDANCE" || notif.title?.includes("Attendance");
                const isLeave = notif.type === "LEAVE" || notif.title?.includes("Leave");
                const isLibrary = notif.type === "LIBRARY" || notif.title?.includes("Book") || notif.title?.includes("Library");

                const iconBg = isAtt
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isLeave
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : isLibrary
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

                const targetLink =
                  notif.link ||
                  (isAtt
                    ? "/talabat/attendance"
                    : isLeave
                    ? "/talabat/leave-request"
                    : isLibrary
                    ? "/talabat/library"
                    : "/talabat");

                return (
                  <Link
                    key={notif.id}
                    href={targetLink}
                    className={`block p-4 rounded-2xl border transition-all ${
                      !notif.isRead
                        ? "bg-white border-amber-300 ring-1 ring-amber-300/40 shadow-xs"
                        : "bg-slate-50/70 border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
                        {isAtt ? (
                          <Zap className="w-4 h-4" />
                        ) : isLeave ? (
                          <Calendar className="w-4 h-4" />
                        ) : isLibrary ? (
                          <BookOpen className="w-4 h-4" />
                        ) : (
                          <BellRing className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[11px] text-slate-600 font-mono shrink-0">
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {notif.body}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

    </div>
  );
}

