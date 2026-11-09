"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Mail,
  Send,
  Inbox,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  User,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ChevronRight,
  Reply,
  Globe,
  Radio,
  Sparkles,
  FileText,
  Lock,
  ArrowRight,
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

export default function AdminMailflarePage() {
  const [data, setData] = useState<MailflareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [activeTab, setActiveTab] = useState<"inbox" | "compose" | "cloudflare">("inbox");

  // Reply Form
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Compose Form
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composePriority, setComposePriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [submittingCompose, setSubmittingCompose] = useState(false);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/mailflare");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        if (!selectedTicketId && json.data.tickets.length > 0) {
          setSelectedTicketId(json.data.tickets[0].id);
        }
      }
    } catch {
      toast({ title: "Failed to load Mailflare", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedTicket = useMemo(() => {
    if (!data?.tickets) return null;
    return data.tickets.find((t) => t.id === selectedTicketId) || null;
  }, [data?.tickets, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    if (!data?.tickets) return [];
    return data.tickets.filter((t) => {
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        t.subject.toLowerCase().includes(q) ||
        t.ticketId.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.sender.name.toLowerCase().includes(q) ||
        t.sender.its.toLowerCase().includes(q) ||
        t.sender.email.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [data?.tickets, statusFilter, searchQuery]);

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch("/api/admin/mailflare/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          replyText: replyText.trim(),
          notifyEmail: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Reply Sent Successfully ✉️",
          description: json.data?.emailDispatched
            ? `Delivered to student portal and dispatched to ${selectedTicket.sender.email}`
            : "Saved and delivered to student portal.",
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

  const handleUpdateStatus = async (status: "OPEN" | "IN_PROGRESS" | "RESOLVED") => {
    if (!selectedTicket) return;
    try {
      const res = await fetch("/api/admin/mailflare/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedTicket.id, status }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Status Updated", description: `Marked as ${status}`, variant: "success" });
        fetchData(true);
      }
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeMessage.trim()) {
      toast({ title: "Missing fields", description: "Please complete recipient, subject, and message.", variant: "destructive" });
      return;
    }

    setSubmittingCompose(true);
    try {
      const res = await fetch("/api/admin/mailflare/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          message: composeMessage.trim(),
          priority: composePriority,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Official Email Sent 🚀",
          description: json.data?.message || `Dispatched to ${composeTo}`,
          variant: "success",
        });
        setComposeTo("");
        setComposeSubject("");
        setComposeMessage("");
        setActiveTab("inbox");
        fetchData(true);
      } else {
        toast({ title: "Failed to send", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err?.message, variant: "destructive" });
    } finally {
      setSubmittingCompose(false);
    }
  };

  const cloudflareWorkerCode = `/**
 * Cloudflare Email Worker for Mailflare / Darse Burhani
 * Automatically pipes inbound emails for support@darseburhani-galiakot.org
 * into your Darse Burhani Admin Mailflare Inbox!
 */
export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).text();
    const payload = {
      from: message.from,
      to: message.to,
      headers: Object.fromEntries(message.headers.entries()),
      subject: message.headers.get("subject") || "(No Subject)",
      text: raw,
    };

    // Forward inbound message to your active server webhook
    await fetch("https://${typeof window !== "undefined" ? window.location.host : "darseburhani-galiakot.org"}/api/public/mailflare/inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
};`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Systems & Institutional Communications"
        hubDescription="Manage official communications, Mailflare webmail, broadcast alerts, and cloud WhatsApp messaging."
        tabs={[
          { label: "Mailflare Webmail", href: "/admin/mailflare", icon: Mail },
          { label: "Broadcast Studio", href: "/admin/notifications", icon: Radio },
          { label: "Cloud WhatsApp", href: "/admin/whatsapp", icon: Globe },
        ]}
      />

      {/* ── Mailflare Status Header Card ── */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white shadow-xl border border-emerald-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Mailflare Institutional Webmail
              </span>
              <span className="text-xs text-emerald-200/80 font-mono">
                Active &middot; Receiving
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {data?.config.supportEmail || "support@darseburhani-galiakot.org"}
            </h1>
            <p className="text-sm text-emerald-100/70 max-w-2xl">
              Official institutional helpdesk and inbound mail center for Talabat, Faculty, and Parents. Direct inbox receipt and SMTP dispatch without requiring forwarding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (data?.config.supportEmail) {
                  navigator.clipboard.writeText(data.config.supportEmail);
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 flex items-center gap-2 transition-all cursor-pointer"
            >
              {copiedEmail ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedEmail ? "Copied" : "Copy Email"}</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="bg-white text-emerald-950 font-bold border-white hover:bg-emerald-50 hover:text-emerald-950"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Sync Inbox
            </Button>
          </div>
        </div>

        {/* Quick Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-emerald-800/60">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <p className="text-xs text-emerald-200/70">Total Inquiries</p>
            <p className="text-2xl font-black mt-0.5">{data?.counts.total ?? 0}</p>
          </div>
          <div className="bg-amber-500/10 rounded-2xl p-3.5 border border-amber-500/20">
            <p className="text-xs text-amber-300 font-semibold">Open Tickets</p>
            <p className="text-2xl font-black text-amber-300 mt-0.5">{data?.counts.open ?? 0}</p>
          </div>
          <div className="bg-sky-500/10 rounded-2xl p-3.5 border border-sky-500/20">
            <p className="text-xs text-sky-300 font-semibold">In Progress</p>
            <p className="text-2xl font-black text-sky-300 mt-0.5">{data?.counts.inProgress ?? 0}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-3.5 border border-emerald-500/20">
            <p className="text-xs text-emerald-300 font-semibold">Resolved</p>
            <p className="text-2xl font-black text-emerald-300 mt-0.5">{data?.counts.resolved ?? 0}</p>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "inbox"
                ? "bg-emerald-800 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Support Inbox</span>
            {data && data.counts.open > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-900 font-black">
                {data.counts.open}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("compose")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "compose"
                ? "bg-emerald-800 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Compose Official Email</span>
          </button>

          <button
            onClick={() => setActiveTab("cloudflare")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "cloudflare"
                ? "bg-emerald-800 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Cloudflare Inbound Setup</span>
          </button>
        </div>
      </div>

      {/* ── Tab 1: Inbox Split View ── */}
      {activeTab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Messages List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {/* Search and Status Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subject, ITS, or sender..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer border ${
                      statusFilter === st
                        ? "bg-emerald-800 text-white border-emerald-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {st === "ALL" ? "All Messages" : st === "OPEN" ? "Open" : st === "IN_PROGRESS" ? "In Progress" : "Resolved"}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No inquiries found</p>
                  <p className="text-[11px] text-slate-400 mt-1">All tickets matching this filter have been answered.</p>
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = t.id === selectedTicketId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/70 shadow-xs"
                          : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/70 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-extrabold text-slate-500 uppercase">
                            #{t.ticketId}
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 truncate">
                            {t.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {timeAgo(t.createdAt)}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 line-clamp-1 mb-1">
                        {t.subject}
                      </h4>

                      <p className="text-[11px] text-slate-600 line-clamp-2 mb-2 font-normal">
                        {t.message}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                          <span className="font-bold truncate">{t.sender.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({t.sender.its})</span>
                        </div>

                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            t.status === "RESOLVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "IN_PROGRESS"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Full Thread View (7 cols) */}
          <div className="lg:col-span-7">
            {selectedTicket ? (
              <Card className="fatimi-card h-full flex flex-col shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-extrabold text-emerald-800">
                          Ticket #{selectedTicket.ticketId}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            selectedTicket.priority === "URGENT"
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : selectedTicket.priority === "HIGH"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-slate-50 text-slate-700 border-slate-300"
                          }
                        >
                          {selectedTicket.priority}
                        </Badge>
                        <Badge variant="outline" className="bg-slate-100 text-slate-700">
                          {selectedTicket.category}
                        </Badge>
                      </div>
                      <CardTitle className="text-base sm:text-lg font-extrabold text-slate-900">
                        {selectedTicket.subject}
                      </CardTitle>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleUpdateStatus("OPEN")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border ${
                          selectedTicket.status === "OPEN"
                            ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleUpdateStatus("IN_PROGRESS")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border ${
                          selectedTicket.status === "IN_PROGRESS"
                            ? "bg-sky-600 text-white border-sky-700 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => handleUpdateStatus("RESOLVED")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border ${
                          selectedTicket.status === "RESOLVED"
                            ? "bg-emerald-700 text-white border-emerald-800 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        Resolved
                      </button>
                    </div>
                  </div>

                  {/* Sender Profile Strip */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 mt-3">
                    {selectedTicket.sender.photo ? (
                      <img
                        src={selectedTicket.sender.photo}
                        alt={selectedTicket.sender.name}
                        className="w-11 h-11 rounded-xl object-cover border border-emerald-600/40 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm shrink-0">
                        {selectedTicket.sender.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-xs text-slate-900 truncate">
                          {selectedTicket.sender.name}
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-800 text-white">
                          {selectedTicket.sender.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {selectedTicket.sender.grade} &middot; ITS: <span className="font-mono font-bold text-slate-700">{selectedTicket.sender.its}</span> &middot; Email: <span className="text-emerald-700 font-mono">{selectedTicket.sender.email}</span>
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4 flex-1 flex flex-col justify-between">
                  {/* Messages Scroll Area */}
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                    {/* Original Message Bubble */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="font-bold text-slate-700">{selectedTicket.sender.name} wrote:</span>
                        <span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.message}
                      </p>
                    </div>

                    {/* Replies */}
                    {selectedTicket.replies.map((r, idx) => {
                      const isAdmin = r.sender === "ADMIN";
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border text-xs sm:text-sm ${
                            isAdmin
                              ? "bg-emerald-50/80 border-emerald-300 ml-6 text-slate-900"
                              : "bg-slate-50 border-slate-200 mr-6 text-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                            <span className={`font-bold ${isAdmin ? "text-emerald-900" : "text-slate-700"}`}>
                              {r.senderName}
                            </span>
                            <span>{new Date(r.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{r.text}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Input Box */}
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Reply className="w-3.5 h-3.5 text-emerald-700" />
                        Reply officially from {data?.config.supportEmail}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Will deliver in-portal + dispatch SMTP email
                      </span>
                    </label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Type your official reply or resolution details..."
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50 text-slate-900 placeholder:text-slate-400 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-400">
                        Student will be notified instantly in their portal.
                      </p>
                      <Button
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || submittingReply}
                        size="sm"
                        className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-5 rounded-xl"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {submittingReply ? "Dispatching..." : "Send Official Reply"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 h-full flex flex-col items-center justify-center">
                <Mail className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No inquiry selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Click any ticket or inquiry on the left to read the full conversation and dispatch official responses.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Compose Official Email ── */}
      {activeTab === "compose" && (
        <Card className="fatimi-card max-w-3xl mx-auto shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Send className="w-5 h-5 text-emerald-700" />
              <span>Compose Official Mailflare Email</span>
            </CardTitle>
            <p className="text-xs text-slate-500">
              Dispatch an official communication from <strong>{data?.config.supportEmail}</strong> to any student, faculty member, parent, or outside organization.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendCompose} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="e.g. abdeali.calcuttawala@darseburhani-galiakot.org or parent@gmail.com"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="e.g. Maktab Taalim Instructions / Portal Intimation"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Priority
                  </label>
                  <select
                    value={composePriority}
                    onChange={(e) => setComposePriority(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 outline-none bg-slate-50 text-slate-900 font-medium"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Intimation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Message Body (Official Text) *
                </label>
                <textarea
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  rows={8}
                  placeholder="Afzalus Salam,&#10;&#10;Kindly note the following official institutional notice..."
                  required
                  className="w-full rounded-xl border border-slate-200 p-3.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50 text-slate-900 leading-relaxed resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  Sender Header: <span className="font-mono text-emerald-800 font-bold">{data?.config.supportEmail}</span>
                </p>
                <Button
                  type="submit"
                  disabled={submittingCompose}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-6 rounded-xl"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submittingCompose ? "Dispatching..." : "Dispatch Official Email"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 3: Cloudflare Email Routing / Worker Activation ── */}
      {activeTab === "cloudflare" && (
        <Card className="fatimi-card max-w-4xl mx-auto shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-700" />
              <CardTitle className="text-base sm:text-lg">
                Activate Inbound Cloudflare Email Worker for Mailflare
              </CardTitle>
            </div>
            <p className="text-xs text-slate-500">
              When outside/outsource emails hit <strong>support@darseburhani-galiakot.org</strong>, Cloudflare can pipe them straight into your Darse Burhani Mailflare desk without forwarding to third-party consumer inboxes.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <h4 className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Webhook Endpoint Already Active &amp; Ready
              </h4>
              <p className="text-xs text-emerald-800/80">
                Your Darse Burhani server is actively listening for inbound emails at:
              </p>
              <div className="p-2.5 rounded-xl bg-white border border-emerald-300 font-mono text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>/api/public/mailflare/inbound</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Ready
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900">
                How to activate in Cloudflare (Takes 2 minutes):
              </h4>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Go to <strong>dash.cloudflare.com</strong> &rarr; Click <strong>Workers &amp; Pages</strong> &rarr; Click <strong>Create Application</strong> &rarr; <strong>Create Worker</strong>.
                </li>
                <li>
                  Name the worker (e.g. <code>mailflare-inbound</code>) and click <strong>Deploy</strong>.
                </li>
                <li>
                  Click <strong>Edit Code</strong>, paste the worker snippet below, and click <strong>Deploy</strong>:
                </li>
              </ol>

              {/* Code Box */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-300">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(cloudflareWorkerCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? "Copied" : "Copy Worker Code"}</span>
                </button>
                <pre className="overflow-x-auto pr-24 whitespace-pre-wrap">{cloudflareWorkerCode}</pre>
              </div>

              <ol start={4} className="text-xs text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Now go to your domain <strong>darseburhani-galiakot.org</strong> in Cloudflare &rarr; <strong>Email Routing</strong> &rarr; <strong>Routing Rules</strong>.
                </li>
                <li>
                  Set custom address <code>support@darseburhani-galiakot.org</code> action to: <strong>Send to a Worker</strong> &rarr; Select <code>mailflare-inbound</code>.
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

