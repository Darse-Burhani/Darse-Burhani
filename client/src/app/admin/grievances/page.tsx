"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Inbox,
  Send,
  Loader2,
  RefreshCw,
  Search,
  Home,
  UtensilsCrossed,
  HeartPulse,
  GraduationCap,
  HelpCircle,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Zap,
  Star,
  MessageSquareHeart,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { cn, getInitials, timeAgo } from "@/lib/utils";

const CATEGORIES = [
  { id: "ALL", label: "All Categories", icon: Inbox },
  { id: "Lodging & Accommodation", label: "Lodging & Accommodation", icon: Home },
  { id: "Food (Mawaid)", label: "Food (Mawaid)", icon: UtensilsCrossed },
  { id: "Health & Well-being", label: "Health & Well-being", icon: HeartPulse },
  { id: "Academics & Hifz Progress", label: "Academics & Hifz", icon: GraduationCap },
  { id: "General Enquiries", label: "General Enquiries", icon: HelpCircle },
];

/**
 * Recommended quick replies per category — Idarah can fire them with one tap,
 * then edit before sending.
 */
const RECOMMENDED_REPLIES: Record<string, string[]> = {
  "Lodging & Accommodation": [
    "Walaikum salaam! We have noted your concern regarding the hostel. The Moawin-e-Khususi will inspect the room today and update you by maghrib.",
    "The laundry pickup for your son's hostel block is scheduled tomorrow after subah. Please label all items with his ITS number.",
    "A maintenance request has been raised with the hostel department. We will confirm the fix within 24 hours, InshaAllah.",
  ],
  "Food (Mawaid)": [
    "Shukran for the feedback on mawaid. We have shared it with the Faiz kitchen supervisor for tomorrow's menu planning.",
    "Special dietary needs have been recorded for your son — the mawaid in-charge will ensure it is followed from the next meal.",
    "Your concern regarding meal timings has been forwarded to the Mawaid committee. Changes will be announced this week.",
  ],
  "Health & Well-being": [
    "The clinic has been informed. Your son will be seen by the medical officer today, and we will update you after the check-up.",
    "Your son is resting in the sick bay and is being monitored. We will call you if anything changes, InshaAllah.",
    "Medicine has been administered as per the clinic protocol. Kindly also share any prescription from home for our records.",
  ],
  "Academics & Hifz Progress": [
    "We have discussed this with the class masool. Extra attention will be given in the coming week and progress shared here.",
    "Your son's hifz target for this month has been reviewed with his ustad. A revised sabaq plan will be shared shortly.",
    "A parent-teacher discussion can be arranged — please share a preferred day and we will confirm the slot.",
  ],
  "General Enquiries": [
    "Walaikum salaam! Thank you for reaching out. We are checking the details and will revert with a complete answer shortly.",
    "Your request has been recorded and assigned to the concerned department. Expected response time is 1–2 working days.",
    "This has been escalated to the Aamilsaheb's office for review. We will keep you updated in this thread.",
  ],
};

type Reply = { sender: string; senderName?: string; text: string; timestamp: string };
type Ticket = {
  id: string;
  ticketId: string;
  title: string;
  category: string;
  kind: string;
  priority: string;
  status: string;
  message: string;
  replies: Reply[];
  createdAt: string;
  parent: { userId?: string; name: string; email?: string | null; avatarUrl?: string | null; its?: string | null };
};

function categoryIcon(id: string) {
  return (CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]).icon;
}

function statusChip(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "IN_PROGRESS":
      return "bg-sky-100 text-sky-900 border-sky-300";
    case "RESOLVED":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

export default function AdminGrievancesPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);

  const threadRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/grievances");
      const json = await res.json();
      if (json.success && json.data) {
        setTickets(json.data.tickets || []);
        setStats(json.data.stats || stats);
      }
    } catch {
      // silent — polling keeps the inbox resilient
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => fetchTickets(), 25000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [selectedId, tickets.length]);

  const selected = useMemo(() => tickets.find((t) => t.ticketId === selectedId) || null, [tickets, selectedId]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (statusFilter !== "ALL") list = list.filter((t) => t.status === statusFilter);
    if (categoryFilter !== "ALL") list = list.filter((t) => t.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.parent.name.toLowerCase().includes(q) ||
          t.ticketId.toLowerCase().includes(q) ||
          t.message.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, statusFilter, categoryFilter, search]);

  const sendReply = async (status?: string) => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/grievances/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selected.id, replyText, status }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyText("");
        setShowRecommendations(false);
        await fetchTickets();
      } else {
        toast({ title: "Could not send", description: json.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    try {
      const res = await fetch("/api/admin/grievances/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selected.id, status }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `Marked ${status.replace("_", " ")}`, description: `Ticket #${selected.ticketId} updated.` });
        await fetchTickets();
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-stone-950 via-emerald-950 to-stone-950 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/50 bg-[#d4af37]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#fff4be]">
              <MessageSquareHeart className="h-3.5 w-3.5" />
              Idarah Connect · Parent Grievance Desk
            </div>
            <h1 className="text-xl font-black font-display sm:text-2xl">Grievances &amp; Feedback</h1>
            <p className="text-xs text-emerald-100/70">
              Answer parents directly in the thread — every reply reaches their portal in real time.
            </p>
          </div>
          <Button
            onClick={() => fetchTickets(true)}
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5 text-[#f3b833]", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            { label: "Total", value: stats.total, icon: Inbox, cls: "text-white" },
            { label: "Open", value: stats.open, icon: FolderOpen, cls: "text-amber-300" },
            { label: "In Progress", value: stats.inProgress, icon: Clock3, cls: "text-sky-300" },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2, cls: "text-emerald-300" },
            { label: "Urgent Live", value: stats.urgent, icon: Zap, cls: "text-rose-300" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
              <p className={cn("flex items-center gap-1.5 text-lg font-black font-display", s.cls)}>
                <s.icon className="h-4 w-4" />
                {s.value}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-pane inbox ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* Left: conversation list */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="space-y-2.5 border-b border-stone-100 p-3.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets, parents, ITS…"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-black transition-all",
                    statusFilter === f ? "bg-stone-900 text-amber-300" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  )}
                >
                  {f === "ALL" ? "All" : f.replace("_", " ")}
                </button>
              ))}
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-bold text-stone-700 outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[62vh] min-h-[300px] divide-y divide-stone-100 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-xs font-medium text-stone-400">No tickets match this view.</p>
            ) : (
              filtered.map((t) => {
                const CatIcon = categoryIcon(t.category);
                const lastMsg = t.replies.length > 0 ? t.replies[t.replies.length - 1] : null;
                const isActive = selected?.ticketId === t.ticketId;
                const unreadFromParent = lastMsg && lastMsg.sender === "PARENT" && t.status !== "RESOLVED";
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.ticketId)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 p-3.5 text-left transition-colors",
                      isActive ? "bg-emerald-50/80" : "hover:bg-stone-50"
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0 rounded-xl border border-stone-200">
                      {t.parent.avatarUrl ? <AvatarImage src={t.parent.avatarUrl} alt={t.parent.name} loading="lazy" /> : null}
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 text-xs font-bold text-amber-300">
                        {getInitials(t.parent.name, "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-black text-stone-900">{t.parent.name}</p>
                        <span className="shrink-0 text-[10px] text-stone-400">{timeAgo(t.createdAt)}</span>
                      </div>
                      <p className="truncate text-[11px] font-bold text-stone-700">{t.title}</p>
                      <p className={cn("truncate text-[11px]", unreadFromParent ? "font-semibold text-stone-800" : "text-stone-500")}>
                        {lastMsg ? `${lastMsg.sender === "ADMIN" ? "You: " : ""}${lastMsg.text}` : t.message}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={cn("rounded-full border text-[9px] font-black", statusChip(t.status))}>
                          {t.status.replace("_", " ")}
                        </Badge>
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold text-stone-600">
                          <CatIcon className="h-2.5 w-2.5" />
                          {t.category}
                        </span>
                        {t.kind === "FEEDBACK" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800">
                            <Star className="h-2.5 w-2.5" />
                            Feedback
                          </span>
                        )}
                        {t.priority === "URGENT" && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700">Urgent</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: chat pane */}
        <div className="flex min-h-[480px] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-800">
                <MessageSquareHeart className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-black text-stone-900 font-display">Select a conversation</h3>
              <p className="max-w-xs text-xs text-stone-500">
                Pick a parent thread on the left to read their grievance or feedback and reply in chat form.
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9 rounded-xl border border-stone-200">
                    {selected.parent.avatarUrl ? <AvatarImage src={selected.parent.avatarUrl} alt={selected.parent.name} loading="lazy" /> : null}
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 text-xs font-bold text-amber-300">
                      {getInitials(selected.parent.name, "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-stone-900 font-display">{selected.parent.name}</p>
                    <p className="flex items-center gap-1.5 truncate text-[11px] text-stone-500">
                      <span className="font-mono font-bold">#{selected.ticketId}</span>
                      · {selected.category}
                      {selected.parent.its ? ` · ITS ${selected.parent.its}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={cn(
                        "cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-black transition-all",
                        selected.status === s ? statusChip(s) : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                      )}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread */}
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto bg-[#faf9f5] px-4 py-4" style={{ maxHeight: "55vh" }}>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-2.5 shadow-xs">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 font-display">
                      <User className="h-3 w-3" />
                      {selected.parent.name} · Parent
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{selected.message}</p>
                    <p className="mt-1 text-[10px] font-medium text-stone-400">{timeAgo(selected.createdAt)}</p>
                  </div>
                </motion.div>
                {selected.replies.map((r, i) => {
                  const isAdmin = r.sender === "ADMIN";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                      className={cn("flex", isAdmin ? "justify-end" : "justify-start")}
                    >
                      <div className={cn("flex max-w-[80%] flex-col gap-1", isAdmin ? "items-end" : "items-start")}>
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs",
                            isAdmin
                              ? "rounded-br-md bg-emerald-800 text-white"
                              : "rounded-bl-md border border-stone-200 bg-white text-stone-800"
                          )}
                        >
                          {!isAdmin && (
                            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 font-display">
                              {r.senderName || "Parent"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap">{r.text}</p>
                        </div>
                        <span className="px-1 text-[10px] font-medium text-stone-400">
                          {isAdmin ? `${r.senderName || "Administration"} · ` : ""}
                          {timeAgo(r.timestamp)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Recommended quick replies */}
              {showRecommendations && selected.status !== "RESOLVED" && (
                <div className="border-t border-stone-100 bg-amber-50/50 px-4 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                    <Sparkles className="h-3 w-3" />
                    Recommended Replies · {selected.category}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-3">
                    {(RECOMMENDED_REPLIES[selected.category] || RECOMMENDED_REPLIES["General Enquiries"]).map((rec, i) => (
                      <button
                        key={i}
                        onClick={() => setReplyText(rec)}
                        className="w-64 shrink-0 cursor-pointer rounded-xl border border-amber-200 bg-white p-2.5 text-left text-[11px] leading-snug text-stone-700 shadow-xs transition-all hover:border-amber-400 hover:shadow-md"
                      >
                        <span className="line-clamp-3">{rec}</span>
                        <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-amber-700">
                          Tap to use &amp; edit
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reply composer */}
              <div className="border-t border-stone-100 bg-white px-4 py-3">
                {selected.status === "RESOLVED" ? (
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      This ticket is resolved. Reopen it to continue the conversation.
                    </p>
                    <button
                      onClick={() => setStatus("IN_PROGRESS")}
                      className="cursor-pointer rounded-full border border-emerald-300 bg-white px-3 py-1 text-[10px] font-black text-emerald-800 hover:bg-emerald-100"
                    >
                      Reopen
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                      rows={2}
                      placeholder="Write your answer to the parent… (Enter to send, Shift+Enter for a new line)"
                      className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                    <Button
                      onClick={() => sendReply()}
                      disabled={sending || !replyText.trim()}
                      className="h-[48px] shrink-0 cursor-pointer rounded-2xl bg-emerald-800 px-5 text-xs font-black text-white hover:bg-emerald-900"
                    >
                      {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                      Send
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
