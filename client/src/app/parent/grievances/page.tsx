"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareHeart,
  Home,
  UtensilsCrossed,
  HeartPulse,
  GraduationCap,
  HelpCircle,
  Send,
  Plus,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Loader2,
  MessageCircle,
  Star,
  AlertTriangle,
  Inbox,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

// ── Canonical grievance categories ──
const CATEGORIES = [
  { id: "Lodging & Accommodation", label: "Lodging & Accommodation", sub: "Rooms · Laundry Services", icon: Home, ar: "الإقامة والخدمات" },
  { id: "Food (Mawaid)", label: "Food (Mawaid)", sub: "Meals · Faiz · Dining", icon: UtensilsCrossed, ar: "الموائد" },
  { id: "Health & Well-being", label: "Health & Well-being", sub: "Medical · Clinic · Care", icon: HeartPulse, ar: "الصحة والعافية" },
  { id: "Academics & Hifz Progress", label: "Academics & Hifz Progress", sub: "Studies · Hifz · Teachers", icon: GraduationCap, ar: "التعليم والحفظ" },
  { id: "General Enquiries", label: "General Enquiries", sub: "Anything else", icon: HelpCircle, ar: "استفسارات عامة" },
];

type Ticket = {
  id: string;
  ticketId: string;
  title: string;
  category: string;
  kind: string;
  priority: string;
  status: string;
  message: string;
  replies: Array<{ sender: string; senderName?: string; text: string; timestamp: string }>;
  createdAt: string;
  isRead?: boolean;
  hasAdminReply?: boolean;
};

function categoryMeta(id: string) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[4];
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "IN_PROGRESS":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "RESOLVED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export default function ParentGrievances() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("ALL");

  // Composer state
  const [kind, setKind] = useState<"ISSUE" | "FEEDBACK">("ISSUE");
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/parent/support");
      const json = await res.json();
      if (json.success && json.data) {
        setTickets(json.data.tickets || []);
        setStats(json.data.stats || { total: 0, open: 0, inProgress: 0, resolved: 0 });
      }
    } catch {
      // silent — polling keeps UI resilient
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => fetchTickets(), 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  // Mark admin replies as read when the thread is opened
  useEffect(() => {
    if (!selectedTicket) return;
    const t = tickets.find((x) => x.ticketId === selectedTicket);
    if (t && t.hasAdminReply && !t.isRead) {
      fetch("/api/parent/support/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: t.id }),
      }).catch(() => {});
    }
  }, [selectedTicket, tickets]);

  // Auto-scroll chat to the latest message
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [selectedTicket, tickets.length]);

  const activeTicket = useMemo(
    () => tickets.find((t) => t.ticketId === selectedTicket) || null,
    [tickets, selectedTicket]
  );

  const filteredTickets = useMemo(
    () => (filter === "ALL" ? tickets : tickets.filter((t) => t.status === filter)),
    [tickets, filter]
  );

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Missing details", description: "Please fill in a subject and describe your matter.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/parent/support/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category, priority, kind }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: kind === "FEEDBACK" ? "Feedback Shared" : "Grievance Raised",
          description: `Ticket #${json.data.ticketCode} recorded. Idarah will respond shortly.`,
        });
        setSubject("");
        setMessage("");
        setComposerOpen(false);
        await fetchTickets();
        setSelectedTicket(json.data.ticketCode);
      } else {
        toast({ title: "Could not submit", description: json.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleReply = async () => {
    if (!activeTicket || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch("/api/parent/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: activeTicket.id, replyText }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyText("");
        await fetchTickets();
      } else {
        toast({ title: "Could not send", description: json.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setReplying(false);
    }
  };

  const handleStatus = async (status: "RESOLVED" | "OPEN") => {
    if (!activeTicket) return;
    try {
      const res = await fetch("/api/parent/support/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: activeTicket.id, status }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: status === "RESOLVED" ? "Ticket Closed" : "Ticket Reopened",
          description: status === "RESOLVED" ? "Glad we could help. Jazakumullah khair." : "The ticket is open again for Idarah.",
        });
        await fetchTickets();
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    }
  };

  // ── Chat thread rendering helper ──
  const renderBubble = (msg: { sender: string; senderName?: string; text: string; timestamp: string }, idx: number) => {
    const isParent = msg.sender === "PARENT";
    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
        className={`flex ${isParent ? "justify-end" : "justify-start"}`}
      >
        <div className={`max-w-[85%] sm:max-w-[75%] ${isParent ? "items-end" : "items-start"} flex flex-col gap-1`}>
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
              isParent
                ? "bg-emerald-700 text-white rounded-br-md"
                : "bg-white text-stone-800 border border-stone-200 rounded-bl-md"
            }`}
          >
            {!isParent && (
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-700 font-display">
                {msg.senderName || "Idarah"} · Administration
              </p>
            )}
            {msg.text}
          </div>
          <span className="px-1 text-[10px] font-medium text-stone-400">
            {timeAgo(msg.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
      </div>
    );
  }

  const ActiveCategoryIcon = activeTicket ? categoryMeta(activeTicket.category).icon : HelpCircle;

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-5 sm:p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
              <MessageSquareHeart className="h-3.5 w-3.5" />
              Idarah Connect
            </div>
            <h1 className="text-xl font-black font-display sm:text-2xl">Grievances &amp; Feedback</h1>
            <p className="max-w-md text-xs text-emerald-100/80">
              Raise an issue or share feedback about lodging, mawaid, health, academics — or ask anything. Idarah replies right here.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              onClick={() => { setComposerOpen(true); setSelectedTicket(null); }}
              className="h-10 cursor-pointer rounded-xl bg-amber-400 px-4 text-xs font-black text-stone-950 shadow-md hover:bg-amber-300"
            >
              <Plus className="mr-1.5 h-4 w-4" strokeWidth={2.5} />
              New Ticket
            </Button>
            <button
              onClick={() => fetchTickets(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-emerald-200/80 hover:text-white"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2.5">
          {[
            { label: "Open", value: stats.open, cls: "text-amber-300" },
            { label: "In Progress", value: stats.inProgress, cls: "text-sky-300" },
            { label: "Resolved", value: stats.resolved, cls: "text-emerald-300" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
              <p className={`text-lg font-black font-display ${s.cls}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Composer ── */}
      <AnimatePresence>
        {composerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-stone-900 font-display">
                  <Plus className="h-4 w-4 text-emerald-700" />
                  Raise a Ticket
                </h3>
                <button onClick={() => setComposerOpen(false)} className="cursor-pointer text-xs font-bold text-stone-400 hover:text-stone-700">
                  Cancel
                </button>
              </div>

              {/* Kind toggle */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  { id: "ISSUE", label: "Raise an Issue", icon: AlertTriangle, desc: "Something needs fixing" },
                  { id: "FEEDBACK", label: "Give Feedback", icon: Star, desc: "Appreciation or suggestion" },
                ] as const).map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 p-3 text-left transition-all ${
                      kind === k.id
                        ? "border-emerald-600 bg-emerald-50 shadow-xs"
                        : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
                    }`}
                  >
                    <k.icon className={`h-5 w-5 shrink-0 ${kind === k.id ? "text-emerald-700" : "text-stone-400"}`} />
                    <div>
                      <p className={`text-xs font-black ${kind === k.id ? "text-emerald-900" : "text-stone-700"}`}>{k.label}</p>
                      <p className="text-[10px] text-stone-500">{k.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Category grid */}
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-stone-500">Category</p>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 p-3 text-left transition-all ${
                      category === c.id
                        ? "border-amber-400 bg-amber-50/80 shadow-xs"
                        : "border-stone-200 hover:border-stone-300 bg-white"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      category === c.id ? "bg-amber-400 text-stone-950" : "bg-stone-100 text-stone-500"
                    }`}>
                      <c.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-black ${category === c.id ? "text-amber-900" : "text-stone-800"}`}>{c.label}</p>
                      <p className="truncate text-[10px] text-stone-500">{c.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Priority */}
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-stone-500">Priority</p>
              <div className="mb-3 flex gap-2">
                {(["NORMAL", "HIGH", "URGENT"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[11px] font-black transition-all ${
                      priority === p
                        ? p === "URGENT"
                          ? "border-rose-400 bg-rose-100 text-rose-800"
                          : p === "HIGH"
                          ? "border-amber-400 bg-amber-100 text-amber-800"
                          : "border-emerald-400 bg-emerald-100 text-emerald-800"
                        : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                    }`}
                  >
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Subject & Message */}
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                placeholder={kind === "FEEDBACK" ? "Feedback subject (e.g. Mawaid quality this week)" : "Issue subject (e.g. Laundry turnaround time)"}
                className="mb-2.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm font-semibold text-stone-900 placeholder:text-stone-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="Describe your matter in detail… (max 4000 characters)"
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] text-stone-400">{message.length}/4000 characters</p>
                <Button
                  onClick={handleSubmit}
                  disabled={sending}
                  className="h-10 cursor-pointer rounded-xl bg-emerald-700 px-5 text-xs font-black text-white shadow-md hover:bg-emerald-800"
                >
                  {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  {kind === "FEEDBACK" ? "Share Feedback" : "Submit Ticket"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Thread detail view ── */}
      {activeTicket ? (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {/* Thread header */}
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSelectedTicket(null)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-stone-900 font-display">{activeTicket.title}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
                  <span className="font-mono font-bold">#{activeTicket.ticketId}</span>
                  · <ActiveCategoryIcon className="h-3 w-3 shrink-0" /> {activeTicket.category}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`shrink-0 rounded-full border text-[10px] font-black ${statusBadgeClass(activeTicket.status)}`}>
              {activeTicket.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Messages */}
          <div ref={threadRef} className="max-h-[52vh] space-y-3 overflow-y-auto bg-[#faf9f5] px-4 py-4">
            {/* Original message as first bubble */}
            {renderBubble({ sender: "PARENT", text: activeTicket.message, timestamp: activeTicket.createdAt }, -1)}
            {activeTicket.replies.map((r, i) => renderBubble(r, i))}
            {activeTicket.replies.length === 0 && (
              <p className="pt-2 text-center text-[11px] font-medium text-stone-400">
                Your submission is with Idarah — a reply will appear here.
              </p>
            )}
          </div>

          {/* Reply composer */}
          {activeTicket.status !== "RESOLVED" ? (
            <div className="border-t border-stone-100 bg-white px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                  rows={1}
                  placeholder="Type your reply… (Enter to send)"
                  className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                />
                <Button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                  className="h-[42px] w-[42px] shrink-0 cursor-pointer rounded-2xl bg-emerald-700 p-0 text-white hover:bg-emerald-800"
                >
                  {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => handleStatus("RESOLVED")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-800 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Mark as Resolved
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-stone-100 bg-emerald-50/50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                This ticket is resolved.
              </p>
              <button
                onClick={() => handleStatus("OPEN")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-[10px] font-black text-stone-600 hover:bg-stone-100"
              >
                <RotateCcw className="h-3 w-3" />
                Reopen
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Ticket list ── */
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5">
            {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 cursor-pointer rounded-xl px-3.5 py-1.5 text-[11px] font-black transition-all ${
                  filter === f ? "bg-stone-900 text-amber-300" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {f === "ALL" ? "All" : f.replace("_", " ")}
              </button>
            ))}
          </div>

          {filteredTickets.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                <Inbox className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black text-stone-950 font-display">No tickets here yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500">
                Facing something at the hostel, mawaid, clinic or classes? Raise a ticket — Idarah replies right in this thread.
              </p>
              <Button
                onClick={() => setComposerOpen(true)}
                className="mt-4 h-10 cursor-pointer rounded-xl bg-emerald-700 px-5 text-xs font-black text-white hover:bg-emerald-800"
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Raise Your First Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTickets.map((t, idx) => {
                const meta = categoryMeta(t.category);
                const lastMsg = t.replies.length > 0 ? t.replies[t.replies.length - 1] : null;
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicket(t.ticketId)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.3) }}
                    whileHover={{ y: -2 }}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-xs transition-all hover:border-amber-300 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                      <meta.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black text-stone-900">{t.title}</p>
                        {t.hasAdminReply && !t.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">
                        {lastMsg ? lastMsg.text : t.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`rounded-full border text-[9px] font-black ${statusBadgeClass(t.status)}`}>
                          {t.status.replace("_", " ")}
                        </Badge>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-stone-600">
                          {t.kind === "FEEDBACK" ? "Feedback" : "Issue"}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-stone-400">#{t.ticketId}</span>
                        <span className="text-[10px] text-stone-400">· {timeAgo(t.createdAt)}</span>
                        {t.priority === "URGENT" && (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black text-rose-700 border border-rose-200">
                            Urgent
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}


