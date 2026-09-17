"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Bell,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  Shield,
  Send,
  Users,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Copy,
  RefreshCw,
  Clock,
  Layers,
  Search,
  Filter,
  Mail,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

type NotificationType =
  | "ANNOUNCEMENT"
  | "ALERT"
  | "POINTS"
  | "LIBRARY"
  | "EVENT"
  | "WELCOME"
  | "SYSTEM";

type TargetAudience = "ALL" | "STUDENTS" | "TEACHERS" | "PARENTS" | "CLASS" | "SPECIFIC_USERS";

interface NotificationTemplate {
  name: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  targetType: TargetAudience;
}

const NOTIFICATION_TYPES: {
  id: NotificationType;
  label: string;
  icon: React.ElementType;
  color: string;
  badgeColor: string;
  accentBorder: string;
}[] = [
  {
    id: "ANNOUNCEMENT",
    label: "Announcement",
    icon: Megaphone,
    color: "text-amber-700 bg-amber-50",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    accentBorder: "border-amber-400",
  },
  {
    id: "ALERT",
    label: "Important Alert",
    icon: AlertTriangle,
    color: "text-rose-600 bg-rose-50",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
    accentBorder: "border-rose-400",
  },
  {
    id: "EVENT",
    label: "Miqaat / Event",
    icon: Calendar,
    color: "text-emerald-600 bg-emerald-50",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    accentBorder: "border-emerald-400",
  },
  {
    id: "POINTS",
    label: "Points & Badges",
    icon: Award,
    color: "text-yellow-600 bg-yellow-50",
    badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-300",
    accentBorder: "border-yellow-400",
  },
  {
    id: "LIBRARY",
    label: "Library Book",
    icon: BookOpen,
    color: "text-indigo-600 bg-indigo-50",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
    accentBorder: "border-indigo-400",
  },
  {
    id: "WELCOME",
    label: "Welcome / Intro",
    icon: Sparkles,
    color: "text-teal-600 bg-teal-50",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
    accentBorder: "border-teal-400",
  },
  {
    id: "SYSTEM",
    label: "System Notice",
    icon: Shield,
    color: "text-slate-600 bg-slate-100",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    accentBorder: "border-slate-400",
  },
];

const PREMADE_TEMPLATES: NotificationTemplate[] = [
  {
    name: "🕌 Miqaat & Holiday Announcement",
    type: "EVENT",
    title: "Mubarak Miqaat Holiday Schedule",
    body: "Tahsildar office announces a holiday on the auspicious occasion of Milad Mubarak. Normal classes resume on Monday.",
    link: "/fatimi-calendar",
    targetType: "ALL",
  },
  {
    name: "🏆 Top Points Achievers",
    type: "POINTS",
    title: "Weekly Talabat Honours & Points Awarded!",
    body: "Mubarak to all Talabat who earned positive points for exemplary adab and tajweed this week. Keep up the high standard!",
    link: "/talabat",
    targetType: "STUDENTS",
  },
  {
    name: "📖 Takhteet & Curriculum Advisory",
    type: "ANNOUNCEMENT",
    title: "Monthly Takhteet Portions Updated",
    body: "Asatizah are requested to update portion completion and student progress logs in the Takhteet planner before Friday.",
    link: "/teacher/takhteet",
    targetType: "TEACHERS",
  },
  {
    name: "⏰ Attendance & Biometric Reminder",
    type: "ALERT",
    title: "Punctuality Notice: Morning Tilawat al-Dua",
    body: "Please ensure timely arrival by 08:00 AM for biometric attendance and Tilawat al-Dua in the central courtyard.",
    link: "/parent/activity",
    targetType: "PARENTS",
  },
  {
    name: "📚 New Library Arrivals",
    type: "LIBRARY",
    title: "New Books Added to Darse Burhani Library",
    body: "Over 40 new authentic texts and historical volumes have arrived on Shelf B. Check them out at the library desk today.",
    link: "/library",
    targetType: "STUDENTS",
  },
];

const QUICK_LINKS = [
  { label: "Talabat Portal", url: "/talabat" },
  { label: "Parent Activity", url: "/parent/activity" },
  { label: "Fatimi Calendar", url: "/fatimi-calendar" },
  { label: "Teacher Takhteet", url: "/teacher/takhteet" },
  { label: "Library Catalog", url: "/library" },
];

const COMMUNICATION_TABS = [
  { label: "Broadcast Studio", href: "/admin/notifications", icon: Megaphone, shortcutNumber: 1 },
  { label: "Attendance Schedule", href: "/admin/attendance-schedule", icon: Clock, shortcutNumber: 2 },
  { label: "Email Dispatches", href: "/admin/attendance-emails", icon: Mail, shortcutNumber: 3 },
  { label: "Individual Tracking", href: "/admin/tracking", icon: BarChart3, shortcutNumber: 4 },
];

export default function AdminNotificationStudio() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [audiences, setAudiences] = useState<any>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationType>("ANNOUNCEMENT");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [link, setLink] = useState("");
  const [targetType, setTargetType] = useState<TargetAudience>("ALL");
  const [targetClassId, setTargetClassId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      const [resData, resAudience] = await Promise.all([
        fetch("/api/admin/notifications").then((r) => r.json()),
        fetch("/api/admin/notifications/audiences").then((r) => r.json()),
      ]);

      if (resData.success) {
        setBroadcasts(resData.data.broadcasts || []);
        setStats(resData.data.stats || null);
      }

      if (resAudience.success) {
        setAudiences(resAudience.data || null);
        if (resAudience.data.classes?.length > 0 && !targetClassId) {
          setTargetClassId(resAudience.data.classes[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyTemplate = (t: NotificationTemplate) => {
    setTitle(t.title);
    setBody(t.body);
    setType(t.type);
    setLink(t.link || "");
    setTargetType(t.targetType);
    toast({
      variant: "success",
      title: "Template Loaded",
      description: `Loaded "${t.name}". You can now customize and broadcast.`,
    });
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter both a title and message body.",
      });
      return;
    }

    if (targetType === "SPECIFIC_USERS" && selectedUserIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Recipients Selected",
        description: "Please select at least one individual user.",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          type,
          link: link || undefined,
          targetType,
          targetClassId: targetType === "CLASS" ? targetClassId : undefined,
          targetUserIds: targetType === "SPECIFIC_USERS" ? selectedUserIds : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          variant: "success",
          title: "Broadcast Dispatched! 🚀",
          description: `Successfully delivered notification to ${json.data.sentCount} recipients.`,
        });
        setTitle("");
        setBody("");
        setLink("");
        setSelectedUserIds([]);
        fetchData();
      } else {
        toast({
          variant: "destructive",
          title: "Broadcast Failed",
          description: json.error || "Failed to send notification.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while sending.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({
          variant: "success",
          title: "Notification Removed",
          description: "Notification removed from database.",
        });
        fetchData();
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete notification.",
      });
    }
  };

  const activeTypeConfig = NOTIFICATION_TYPES.find((t) => t.id === type) || NOTIFICATION_TYPES[0];
  const IconComp = activeTypeConfig.icon;

  const estimatedRecipientCount = () => {
    if (!audiences) return 0;
    if (targetType === "ALL") return audiences.counts.all || 0;
    if (targetType === "STUDENTS") return audiences.counts.students || 0;
    if (targetType === "TEACHERS") return audiences.counts.teachers || 0;
    if (targetType === "PARENTS") return audiences.counts.parents || 0;
    if (targetType === "CLASS") {
      const found = audiences.classes?.find((c: any) => c.id === targetClassId);
      return found?.studentCount || 0;
    }
    if (targetType === "SPECIFIC_USERS") return selectedUserIds.length;
    return 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <Megaphone className="w-6 h-6" />
              </div>
              Notification & Broadcast Studio
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Compose custom alerts, announcements, and push notifications to students, parents, and faculty.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="self-start sm:self-auto gap-2 border-gray-200 hover:border-amber-400"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Admin Subtabs */}
      <AdminHubTabs
        hubTitle="Communications & Notifications"
        hubDescription="Compose and dispatch instant notifications, scheduled reminders, and automated email reports."
        tabs={COMMUNICATION_TABS}
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Sent Today</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{stats?.sentToday || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Users Reachable</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{audiences?.counts.all || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Broadcasts</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{stats?.totalBroadcasts || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Unread Notifications</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{stats?.unreadCount || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Studio Area */}
      <div className="grid lg:grid-cols-12 gap-8 mb-10">
        {/* Left Column: Composer Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-gray-200/90 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-600" />
                <h2 className="font-display font-bold text-base text-gray-900">Custom Notification Generator</h2>
              </div>
              <Badge variant="outline" className="text-xs font-semibold bg-white border-amber-300 text-amber-900">
                Audience: ~{estimatedRecipientCount()} recipients
              </Badge>
            </div>

            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleSendBroadcast} className="space-y-6">
                {/* 1. Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    1. Notification Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {NOTIFICATION_TYPES.map((t) => {
                      const isSelected = type === t.id;
                      const Icon = t.icon;
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setType(t.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                            isSelected
                              ? `${t.color} ${t.accentBorder} shadow-xs ring-2 ring-offset-1 ring-amber-400`
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Priority & Target Audience */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      2. Priority Level
                    </label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-medium"
                    >
                      <option value="NORMAL">Normal (Standard Delivery)</option>
                      <option value="HIGH">High (Highlighted in Bell)</option>
                      <option value="URGENT">Urgent (Red Alert Badge 🚨)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      3. Target Audience
                    </label>
                    <select
                      value={targetType}
                      onChange={(e: any) => setTargetType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-medium"
                    >
                      <option value="ALL">🌐 All Users ({audiences?.counts.all || 0})</option>
                      <option value="STUDENTS">🎓 All Talabat / Students ({audiences?.counts.students || 0})</option>
                      <option value="TEACHERS">👨‍🏫 All Asatizah / Teachers ({audiences?.counts.teachers || 0})</option>
                      <option value="PARENTS">👨‍👩‍👧 All Parents ({audiences?.counts.parents || 0})</option>
                      <option value="CLASS">🏫 Specific Class / Section</option>
                      <option value="SPECIFIC_USERS">👤 Individual Specific Users</option>
                    </select>
                  </div>
                </div>

                {/* Specific Class Selector */}
                {targetType === "CLASS" && (
                  <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Select Class
                    </label>
                    <select
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm font-medium focus:outline-none"
                    >
                      {audiences?.classes?.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — Grade {c.grade} ({c.section}) • {c.studentCount} Talabat
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Specific Users Selector */}
                {targetType === "SPECIFIC_USERS" && (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Select Individual Recipients ({selectedUserIds.length} chosen)
                      </label>
                      {selectedUserIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedUserIds([])}
                          className="text-xs text-rose-600 hover:underline font-medium"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Search students & teachers..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {[...(audiences?.sampleStudents || []), ...(audiences?.sampleTeachers || [])]
                        .filter((u) =>
                          `${u.firstName} ${u.lastName} ${u.email}`
                            .toLowerCase()
                            .includes(userSearchQuery.toLowerCase())
                        )
                        .map((u) => {
                          const isChecked = selectedUserIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                                  else setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                                }}
                                className="rounded text-amber-600 focus:ring-amber-400"
                              />
                              <span className="font-medium text-gray-900">
                                {u.firstName} {u.lastName}
                              </span>
                              <span className="text-[11px] text-gray-400 truncate">({u.email})</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 4. Title & Body Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      4. Notification Headline / Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Mubarak Miqaat Holiday Schedule"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      5. Message Details
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Type your clear announcement details here..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-none"
                    />
                  </div>

                  {/* 6. Action Deep-link (Optional) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        6. Action Link (Optional)
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {QUICK_LINKS.map((ql) => (
                          <button
                            type="button"
                            key={ql.label}
                            onClick={() => setLink(ql.url)}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium"
                          >
                            {ql.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g., /talabat or /fatimi-calendar"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-mono focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                    />
                  </div>
                </div>

                {/* Dispatch Button */}
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full py-6 text-base font-bold bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-amber-500 text-white shadow-lg shadow-amber-500/25 rounded-xl gap-2"
                >
                  <Send className="w-5 h-5" />
                  {sending ? "Delivering Broadcast..." : `Send Notification to ~${estimatedRecipientCount()} Users`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Device Preview & Templates (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Realistic Preview Card */}
          <Card className="border-gray-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                Live Bell & Toast Preview
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                Real-Time
              </span>
            </div>

            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-gray-500">
                This is exactly how recipients will see the alert inside their top notification bell & popups:
              </p>

              {/* Notification Item Box */}
              <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white shadow-md relative overflow-hidden transition-all">
                {priority === "URGENT" && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500 animate-pulse" />
                )}

                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl shrink-0 ${activeTypeConfig.color}`}>
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-sm text-gray-900 truncate">
                        {title || "Notification Title"}
                      </h4>
                      <span className="text-[10px] text-gray-400 shrink-0">Just now</span>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed break-words">
                      {body || "Your broadcast message text will appear here with instant clarity."}
                    </p>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                      <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${activeTypeConfig.badgeColor}`}>
                        {activeTypeConfig.label}
                      </span>

                      {link && (
                        <span className="flex items-center gap-1 text-indigo-600 font-semibold text-xs">
                          Open link <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick-Fill Presets / Templates */}
          <Card className="border-gray-200/90 shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Smart Quick Templates
              </span>
            </div>

            <CardContent className="p-4 space-y-2">
              {PREMADE_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(tmpl)}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-amber-300 hover:bg-amber-50/40 transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-gray-900 group-hover:text-amber-900 truncate">
                      {tmpl.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{tmpl.title}</p>
                  </div>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-600 shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Broadcast History Table */}
      <Card className="border-gray-200/90 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Broadcast History & Sent Log
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Review and manage recent broadcast announcements delivered to portal users.
            </p>
          </div>
          <Badge variant="secondary" className="self-start sm:self-auto">
            {broadcasts.length} Recorded Broadcasts
          </Badge>
        </div>

        <CardContent className="p-0">
          {broadcasts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No broadcast notifications sent yet</p>
              <p className="text-xs mt-1">Compose your first broadcast using the studio above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Message & Title</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-center">Delivered</th>
                    <th className="py-3.5 px-4">Sent Time</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {broadcasts.map((b) => {
                    const typeCfg =
                      NOTIFICATION_TYPES.find((t) => t.id === b.type) || NOTIFICATION_TYPES[0];
                    const Icon = typeCfg.icon;
                    return (
                      <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-4 px-6 max-w-sm">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${typeCfg.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{b.title}</p>
                              <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{b.body}</p>
                              {b.link && (
                                <a
                                  href={b.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1 font-mono"
                                >
                                  {b.link} <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${typeCfg.badgeColor}`}
                          >
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <Badge variant="secondary" className="font-mono text-xs font-bold">
                            {b.recipientCount} users
                          </Badge>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-gray-500">
                          {timeAgo(b.createdAt)}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBroadcast(b.id)}
                            className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1.5"
                            title="Delete notification"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
