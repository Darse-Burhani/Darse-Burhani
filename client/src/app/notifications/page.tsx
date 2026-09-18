"use client";

import { useState, useEffect, useCallback } from "react";
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
  CheckCheck,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

const typeIconMap: Record<string, React.ElementType> = {
  LIBRARY: BookOpen,
  ANNOUNCEMENT: Megaphone,
  WELCOME: Sparkles,
  POINTS: Award,
  ALERT: AlertTriangle,
  PROCUREMENT: ShoppingBag,
};

function getTypeIcon(type: string) {
  return typeIconMap[type] ?? Bell;
}

const typeColorMap: Record<string, string> = {
  LIBRARY: "text-indigo-500 bg-indigo-50",
  ANNOUNCEMENT: "text-amber-600 bg-amber-50",
  WELCOME: "text-emerald-500 bg-emerald-50",
  POINTS: "text-yellow-700 bg-yellow-50",
  ALERT: "text-red-500 bg-red-50",
  PROCUREMENT: "text-emerald-700 bg-emerald-100",
};

function getTypeColor(type: string) {
  return typeColorMap[type] ?? "text-gray-500 bg-gray-100";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications);
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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

  const markRead = async (notification: NotificationItem) => {
    if (notification.isRead) {
      if (notification.link) router.push(notification.link);
      return;
    }
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
    if (notification.link) router.push(notification.link);
  };

  const visible = filter === "UNREAD" ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-indigo-500" />
            Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm w-fit mb-5">
        {(["ALL", "UNREAD"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === f
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50",
            )}
          >
            {f === "ALL" ? "All" : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
            <p className="text-sm text-gray-500">Loading notifications...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Inbox className="w-10 h-10 text-gray-400 mb-3" />
            <p className="text-sm text-gray-500 font-medium">No notifications</p>
            <p className="text-xs text-gray-500 mt-1">
              {filter === "UNREAD" ? "You've read everything" : "Check back soon"}
            </p>
          </div>
        ) : (
          visible.map((notification) => {
            const TypeIcon = getTypeIcon(notification.type);
            return (
              <button
                key={notification.id}
                onClick={() => markRead(notification)}
                className={cn(
                  "w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-gray-200 transition-all flex items-start gap-4",
                  !notification.isRead && "border-indigo-200 bg-indigo-50/30",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center",
                    getTypeColor(notification.type),
                  )}
                >
                  <TypeIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={cn(
                        "text-sm text-gray-900",
                        notification.isRead ? "font-medium" : "font-semibold",
                      )}
                    >
                      {notification.title}
                    </p>
                    <span className="text-xs text-gray-500 shrink-0">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{notification.body}</p>
                  {notification.link && (
                    <p className="text-xs text-indigo-600 mt-2 font-medium">
                      View details →
                    </p>
                  )}
                </div>
                {!notification.isRead && (
                  <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-indigo-500 mt-2" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
