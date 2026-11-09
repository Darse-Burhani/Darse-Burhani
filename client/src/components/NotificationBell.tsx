"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BookOpen,
  Megaphone,
  Sparkles,
  Check,
  Inbox,
  Award,
  AlertTriangle,
  ShoppingBag,
  Zap,
  X,
  ExternalLink,
  ShieldCheck,
  CalendarDays,
  FileText,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn, timeAgo } from "@/lib/utils";
import { sendDesktopNotification, updatePwaBadge } from "@/lib/notification-sound";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

const VIEWED_NOTIF_STORAGE_KEY = "darse_viewed_notifications_v1";

function getViewedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(VIEWED_NOTIF_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function recordNotificationViewed(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = getViewedIds();
    set.add(id);
    const arr = Array.from(set).slice(-300);
    localStorage.setItem(VIEWED_NOTIF_STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

const typeIconMap: Record<string, React.ElementType> = {
  ATTENDANCE: Zap,
  LIBRARY: BookOpen,
  ANNOUNCEMENT: Megaphone,
  WELCOME: Sparkles,
  POINTS: Award,
  ALERT: AlertTriangle,
  PROCUREMENT: ShoppingBag,
  PORTAL_ACCESS: ShieldCheck,
  LEAVE: CalendarDays,
  REMARKS: Sparkles,
  PROFILE: FileText,
};

function getTypeIcon(type: string) {
  return typeIconMap[type] ?? Bell;
}

const typeColorMap: Record<string, string> = {
  ATTENDANCE: "text-emerald-600 bg-emerald-50 border-emerald-200",
  LIBRARY: "text-indigo-500 bg-indigo-50",
  ANNOUNCEMENT: "text-amber-600 bg-amber-50",
  WELCOME: "text-emerald-500 bg-emerald-50",
  POINTS: "text-yellow-700 bg-yellow-50",
  ALERT: "text-red-500 bg-red-50",
  PROCUREMENT: "text-emerald-700 bg-emerald-100",
  PORTAL_ACCESS: "text-emerald-700 bg-emerald-50 border-emerald-200",
  LEAVE: "text-blue-600 bg-blue-50 border-blue-200",
  REMARKS: "text-purple-600 bg-purple-50 border-purple-200",
  PROFILE: "text-teal-600 bg-teal-50 border-teal-200",
};

function getTypeColor(type: string) {
  return typeColorMap[type] ?? "text-gray-500 bg-gray-100";
}

export function NotificationBell() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bannerNotification, setBannerNotification] = useState<NotificationItem | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Request browser desktop notification permission on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
      window.removeEventListener("click", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction);
    return () => window.removeEventListener("click", handleFirstInteraction);
  }, []);

  // Synchronize PWA Badging API with live unread notification count
  useEffect(() => {
    updatePwaBadge(unreadCount);
  }, [unreadCount]);

  const fetchNotifications = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) return;
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.notifications)) {
        const freshList: NotificationItem[] = json.data.notifications;
        setNotifications(freshList);
        setUnreadCount(json.data.unreadCount ?? 0);

        if (isInitialLoadRef.current) {
          // On initial page load: all existing notifications are registered as known and viewed.
          // This guarantees notifications NEVER pop up repeatedly or play sounds on refresh/navigation!
          const viewedSet = getViewedIds();
          freshList.forEach((n) => {
            knownIdsRef.current.add(n.id);
            viewedSet.add(n.id);
          });
          try {
            const arr = Array.from(viewedSet).slice(-300);
            localStorage.setItem(VIEWED_NOTIF_STORAGE_KEY, JSON.stringify(arr));
          } catch {}
          isInitialLoadRef.current = false;
        } else {
          // Find only brand-new notifications that arrived live during the active session
          const viewedSet = getViewedIds();
          const brandNew = freshList.filter((n) => !n.isRead && !knownIdsRef.current.has(n.id) && !viewedSet.has(n.id));

          if (brandNew.length > 0) {
            const latest = brandNew[0];
            brandNew.forEach((n) => {
              knownIdsRef.current.add(n.id);
              recordNotificationViewed(n.id);
            });

            // 1. Show in-app floating notification bar
            setBannerNotification(latest);

            // 2. Play smooth subtle Fatimi harmonic chime and dispatch OS/Desktop System Notification
            sendDesktopNotification({
              title: latest.title,
              body: latest.body,
              link: latest.link || undefined,
              soundType: latest.type === "ALERT" ? "alert" : "arrival",
              tag: latest.id,
            });
          }
        }
      }
    } catch {
      // silent
    }
  }, [status, session]);

  // Poll notifications every 10 seconds for rapid updates (only when authenticated)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [status, session, fetchNotifications]);

  // Auto-dismiss top banner notification after 8 seconds and mark as viewed so it never appears again
  useEffect(() => {
    if (bannerNotification) {
      recordNotificationViewed(bannerNotification.id);
      const timer = setTimeout(() => {
        // Mark as read in backend so it won't appear next time
        fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: [bannerNotification.id] }),
        }).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === bannerNotification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        setBannerNotification(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [bannerNotification]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleClick = async (notification: NotificationItem) => {
    setOpen(false);
    if (!notification.isRead) {
      try {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: [notification.id] }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silent
      }
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <>
      {/* ── Real-time Top Notification Bar Banner ── */}
      {bannerNotification && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[99999] w-[94vw] max-w-xl animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-start gap-3 backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center shrink-0 shadow-md">
              {bannerNotification.type === "PROCUREMENT" ? (
                <ShoppingBag className="w-5 h-5" />
              ) : (
                <BellRing className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                  {bannerNotification.type === "PROCUREMENT" ? "Procurement Alert" : "Notification"}
                </span>
                <p className="text-xs sm:text-sm font-bold truncate text-white">
                  {bannerNotification.title}
                </p>
              </div>
              <p className="text-xs text-emerald-100/90 mt-1 line-clamp-2">
                {bannerNotification.body}
              </p>
              {bannerNotification.link && (
                <button
                  onClick={() => {
                    const link = bannerNotification.link!;
                    recordNotificationViewed(bannerNotification.id);
                    fetch("/api/notifications", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ notificationIds: [bannerNotification.id] }),
                    }).catch(() => {});
                    setNotifications((prev) =>
                      prev.map((n) => (n.id === bannerNotification.id ? { ...n, isRead: true } : n))
                    );
                    setUnreadCount((c) => Math.max(0, c - 1));
                    setBannerNotification(null);
                    router.push(link);
                  }}
                  className="mt-2 text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 hover:underline"
                >
                  <span>
                    {bannerNotification.type === "ATTENDANCE"
                      ? "View Campus Activity"
                      : bannerNotification.type === "PROCUREMENT"
                      ? "Review in Procurement Console"
                      : "View Details"}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                recordNotificationViewed(bannerNotification.id);
                fetch("/api/notifications", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ notificationIds: [bannerNotification.id] }),
                }).catch(() => {});
                setNotifications((prev) =>
                  prev.map((n) => (n.id === bannerNotification.id ? { ...n, isRead: true } : n))
                );
                setUnreadCount((c) => Math.max(0, c - 1));
                setBannerNotification(null);
              }}
              className="text-white/75 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss notification bar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bell Icon & Dropdown in Portal Header ── */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => {
            const nextOpen = !open;
            setOpen(nextOpen);
            if (nextOpen) {
              fetchNotifications();
              if (unreadCount > 0) {
                markAllRead();
              }
              // Request desktop permission if still default
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                Notification.requestPermission().catch(() => {});
              }
            }
          }}
          className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-emerald-800" />
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                {unreadCount > 0 && (
                  <span className="text-xs text-emerald-700 font-bold">({unreadCount} new)</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Inbox className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((notification) => {
                  const TypeIcon = getTypeIcon(notification.type);
                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleClick(notification)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors",
                        !notification.isRead && "bg-emerald-50/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 shrink-0 rounded-lg flex items-center justify-center",
                            getTypeColor(notification.type),
                          )}
                        >
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-gray-500 shrink-0">
                              {timeAgo(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.body}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-600 mt-1.5" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/30">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="w-full text-center text-xs font-semibold text-emerald-800 hover:text-emerald-950"
              >
                View all notifications &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
