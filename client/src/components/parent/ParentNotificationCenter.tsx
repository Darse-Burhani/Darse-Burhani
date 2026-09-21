"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  X,
  Clock,
  BookOpen,
  Award,
  Volume2,
  VolumeX,
  CheckCheck,
  Sparkles,
  Shield,
  Heart,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import { sendDesktopNotification } from "@/lib/notification-sound";

export interface ParentNotification {
  id: string;
  type: "ATTENDANCE" | "HIFZ" | "POINTS" | "SYSTEM" | "ANNOUNCEMENT";
  title: string;
  body: string;
  childName?: string;
  childId?: string;
  createdAt: string;
  isRead: boolean;
  meta?: any;
}

interface Props {
  childrenList?: any[];
  onChildSelect?: (childId: string) => void;
  onRefreshData?: () => void;
}

export function ParentNotificationCenter({ childrenList = [], onChildSelect, onRefreshData }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ATTENDANCE" | "HIFZ" | "POINTS" | "ANNOUNCEMENT">("ALL");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Play audio chime on arrival
  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch {}
  }, [soundEnabled]);

  // Fetch standard user notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success && json.data) {
        const fetched: ParentNotification[] = (json.data.notifications || []).map((n: any) => ({
          id: n.id,
          type: n.type || "SYSTEM",
          title: n.title,
          body: n.body,
          childName: n.metadata?.childName,
          childId: n.metadata?.childId,
          createdAt: n.createdAt,
          isRead: Boolean(n.isRead),
          meta: n.metadata,
        }));
        setNotifications(fetched);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time EventSource listener for biometric campus scans & live events
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/biometric/events/stream");

      es.onopen = () => {
        setIsLiveConnected(true);
      };

      es.onerror = () => {
        setIsLiveConnected(false);
      };

      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === "MATCHED" || ev.type === "DUPLICATE") {
            const studentId = ev.studentId || ev.personId;
            const studentName = ev.personName || ev.studentName || "Your child";

            // Check if this student belongs to this parent
            const matchedChild = childrenList.find(
              (c) => c.studentProfileId === studentId || c.id === studentId || c.its === ev.its
            );

            const displayChildName = matchedChild
              ? `${matchedChild.firstName} ${matchedChild.lastName}`
              : studentName;

            // Trigger real-time visual and audio notification (In-app + OS Desktop Push outside browser)
            sendDesktopNotification({
              title: `🎓 Campus Arrival: ${displayChildName}`,
              body: `${displayChildName} has scanned in at ${ev.gate || "Main Entrance MinMoe"} (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).`,
              link: "/parent/attendance",
              soundType: "arrival",
              tag: `arrival-${studentId}-${Date.now()}`,
              silent: !soundEnabled,
            });

            const newNotif: ParentNotification = {
              id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              type: "ATTENDANCE",
              title: "Campus Scan Verified",
              body: `${displayChildName} has scanned in at ${ev.gate || "Darse Burhani Main Gate"}.`,
              childName: displayChildName,
              childId: matchedChild?.id,
              createdAt: new Date().toISOString(),
              isRead: false,
              meta: ev,
            };

            setNotifications((prev) => [newNotif, ...prev]);

            toast({
              variant: "success",
              title: "🎓 Campus Arrival Confirmed",
              description: `${displayChildName} checked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            });

            // Trigger parent dashboard data refresh
            if (onRefreshData) {
              onRefreshData();
            }
          }
        } catch {}
      };
    } catch {}

    return () => {
      es?.close();
    };
  }, [childrenList, onRefreshData, playChime]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "ALL") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {}
  };

  const markSingleAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (!id.startsWith("live-")) {
      try {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: [id] }),
        });
      } catch {}
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ATTENDANCE":
        return <Clock className="w-4 h-4 text-emerald-600" />;
      case "HIFZ":
        return <BookOpen className="w-4 h-4 text-amber-600" />;
      case "POINTS":
        return <Award className="w-4 h-4 text-purple-600" />;
      case "ANNOUNCEMENT":
        return <Sparkles className="w-4 h-4 text-rose-600" />;
      default:
        return <Shield className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <>
      {/* Top Header Trigger Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative group p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm transition-all duration-200 flex items-center gap-2 cursor-pointer"
          title="Open Notifications & Real-Time Alerts"
        >
          <div className="relative">
            <Bell className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse shadow-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold hidden md:inline-block">Alerts</span>
          <span className={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-emerald-400 animate-ping" : "bg-gray-400"}`} />
        </button>
      </div>

      {/* Slide-in Notifications Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-emerald-100"
            >
              {/* Drawer Header with Fatimi Motif */}
              <div className="p-5 bg-gradient-to-r from-[#047857] via-[#065f46] to-[#064e3b] text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-base text-white">Parent Alerts & Updates</h2>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-100">
                        <span className={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-emerald-400" : "bg-gray-400"}`} />
                        <span>{isLiveConnected ? "Real-Time Biometric Stream Live" : "Connecting..."}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      title={soundEnabled ? "Mute Arrival Chimes" : "Unmute Arrival Chimes"}
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {[
                    { id: "ALL", label: `All (${notifications.length})` },
                    { id: "ATTENDANCE", label: "Attendance" },
                    { id: "HIFZ", label: "Hifz" },
                    { id: "POINTS", label: "Merits" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFilter(t.id as any)}
                      className={`px-2.5 py-1 rounded-full font-semibold transition-all shrink-0 text-[11px] ${
                        filter === t.id
                          ? "bg-amber-400 text-gray-950 shadow-xs"
                          : "bg-white/15 text-white/80 hover:bg-white/25"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">
                  {unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        markSingleAsRead(n.id);
                        if (n.childId && onChildSelect) {
                          onChildSelect(n.childId);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        !n.isRead
                          ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 shadow-xs"
                          : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-white shadow-xs border border-gray-100 shrink-0">
                          {getNotificationIcon(n.type)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-bold text-gray-900 truncate">
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-gray-400 font-medium shrink-0">
                              {timeAgo(new Date(n.createdAt))}
                            </span>
                          </div>

                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            {n.body}
                          </p>

                          {n.childName && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#047857]">
                                <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                                {n.childName}
                              </span>
                            </div>
                          )}
                        </div>

                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-16 px-4 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                      <Bell className="w-7 h-7" />
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm">All Caught Up</h4>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">
                      You will receive instant real-time alerts whenever your assigned talabat scan in or complete milestones.
                    </p>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1 font-medium">
                  <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Live Darse Burhani Network
                </span>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-xs h-7">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
