"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Award,
  Clock,
  Heart,
  Filter,
  RefreshCw,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Calendar,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { timeAgo } from "@/lib/utils";
import { isRabiAlAkhirDate } from "@/lib/fatimi-calendar";

const activityIcons: Record<string, any> = {
  POINTS: Award,
  ATTENDANCE: Clock,
  LIBRARY: BookOpen,
};

const activityColors: Record<string, string> = {
  POINTS: "text-amber-700 bg-amber-100/80 border border-amber-200",
  ATTENDANCE: "text-emerald-700 bg-emerald-100/80 border border-emerald-200",
  LIBRARY: "text-indigo-700 bg-indigo-100/80 border border-indigo-200",
};

export default function ParentActivityPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ATTENDANCE" | "LIBRARY" | "POINTS">("ALL");

  const fetchActivities = async () => {
    try {
      const url =
        selectedChildId !== "ALL"
          ? `/api/parent/activity?childId=${selectedChildId}`
          : `/api/parent/activity`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        if (Array.isArray(json.data)) {
          setActivities(json.data);
        } else {
          setActivities(json.data.activities || []);
          if (json.data.children) setChildren(json.data.children);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [selectedChildId]);

  const filteredActivities = useMemo(() => {
    const nonRabi = activities.filter(
      (a) => a.type !== "ATTENDANCE" || !isRabiAlAkhirDate(a.createdAt)
    );
    if (typeFilter === "ALL") return nonRabi;
    return nonRabi.filter((a) => a.type === typeFilter);
  }, [activities, typeFilter]);

  const counts = useMemo(() => {
    return {
      all: activities.length,
      attendance: activities.filter((a) => a.type === "ATTENDANCE").length,
      library: activities.filter((a) => a.type === "LIBRARY").length,
      points: activities.filter((a) => a.type === "POINTS").length,
    };
  }, [activities]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back Link */}
      <div>
        <Link href="/parent">
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-800 hover:bg-emerald-50 text-xs font-semibold gap-1.5 h-8 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Parent Dashboard
          </Button>
        </Link>
      </div>

      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 text-white shadow-xl relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #034430 0%, #047857 50%, #065f46 100%)" }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Talabat Activity History</h1>
              <p className="text-emerald-100 text-xs mt-0.5">
                Real-time timeline of biometric attendance, library book borrowings, and merit points.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchActivities}
              className="bg-white/10 hover:bg-white/20 text-white border-white/25 rounded-xl h-9 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs space-y-3">
        {/* Child Selector Chips */}
        {children.length > 1 && (
          <div className="space-y-1.5 pb-3 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Filter by Talabat Student:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedChildId("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedChildId === "ALL"
                    ? "bg-[#047857] text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All Assigned Children
              </button>
              {children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChildId(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedChildId === c.id
                      ? "bg-[#047857] text-white shadow-xs"
                      : "bg-emerald-50 text-[#047857] hover:bg-emerald-100 border border-emerald-200"
                  }`}
                >
                  {c.name} (Grade {c.grade})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Activity Type Chips */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium mr-1">Activity Type:</span>
            {[
              { id: "ALL", label: `All Events (${counts.all})` },
              { id: "ATTENDANCE", label: `Attendance Scans (${counts.attendance})` },
              { id: "LIBRARY", label: `Library Books (${counts.library})` },
              { id: "POINTS", label: `Merits & Points (${counts.points})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id as any)}
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                  typeFilter === t.id
                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-gray-400 font-medium">
            Showing {filteredActivities.length} logs
          </span>
        </div>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-white border border-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredActivities.length > 0 ? (
        <div className="space-y-3">
          {filteredActivities.map((activity, i) => {
            const Icon = activityIcons[activity.type] || Award;
            const isAttendance = activity.type === "ATTENDANCE";
            const isLibrary = activity.type === "LIBRARY";

            return (
              <motion.div
                key={activity.id || i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card className="rounded-2xl border border-emerald-100 bg-white hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-4 flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 ${
                        activityColors[activity.type] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {activity.title}
                          </h4>

                          {/* Event Name Pill for Attendance */}
                          {isAttendance && activity.eventName && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <Tag className="w-3 h-3 text-emerald-600" />
                              {activity.eventName}
                            </span>
                          )}

                          {/* Status Pill for Attendance */}
                          {isAttendance && activity.status && (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                activity.status === "PRESENT"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : activity.status === "LATE"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {activity.status}
                            </span>
                          )}

                          {/* Status Pill for Library Book */}
                          {isLibrary && activity.status && (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                activity.status === "ACTIVE"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : activity.status === "RETURNED"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {activity.status === "ACTIVE" ? "Borrowed / On Loan" : activity.status}
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-gray-400 font-medium shrink-0">
                          {timeAgo(new Date(activity.createdAt))}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 mt-1 font-medium">
                        {activity.detail}
                      </p>

                      <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs">
                        {activity.childName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                            {activity.childName}
                          </span>
                        )}

                        {isLibrary && activity.bookBarcode && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            Barcode: {activity.bookBarcode}
                          </span>
                        )}

                        {isAttendance && activity.method && (
                          <span className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
                            Verified via: {activity.method}
                          </span>
                        )}

                        <span className="text-[11px] text-gray-400">
                          {new Date(activity.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-3xl border border-gray-100 bg-white p-12 text-center text-gray-400 space-y-2">
          <Clock className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">No activity logs found for the selected filter.</p>
        </Card>
      )}
    </div>
  );
}
