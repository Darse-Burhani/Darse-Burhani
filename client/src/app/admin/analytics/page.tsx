"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  School,
  BookOpen,
  FileCheck2,
  Loader2,
  RefreshCw,
  TrendingUp,
  Activity,
  Coins,
  CalendarDays,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import {
  AttendanceTrendChart,
  PointsTrendChart,
  StatusDonutChart,
  statusColors,
} from "@/components/admin/AnalyticsCharts";

interface AnalyticsData {
  attendanceTrend: {
    date: string;
    present: number;
    late: number;
    absent: number;
    earlyDeparture: number;
    total: number;
    rate: number;
  }[];
  pointsTrend: { date: string; positive: number; negative: number }[];
  statusDistribution: { status: string; count: number }[];
  classAttendance: { name: string; grade: string; section: string; total: number; present: number; rate: number }[];
  summary: {
    students: number;
    teachers: number;
    activeClasses: number;
    justifiedAbsences: number;
  };
}

function StatCard({ icon: Icon, label, value, sub, color, accent }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  accent: string;
}) {
  return (
    <Card className="fatimi-card">
      <div className="fatimi-card-header" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-xl ${accent}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const statusLabels: Record<string, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  EARLY_DEPARTURE: "Early Dep.",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = async (range: number = days) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${range}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const withRate = data ? data.attendanceTrend.filter((d) => d.total > 0) : [];
  const avgRate =
    withRate.length > 0
      ? Math.round(withRate.reduce((acc, d) => acc + d.rate, 0) / withRate.length)
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              Analytics Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              Attendance, points, and engagement trends across the school.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  days === d ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="admin" onClick={() => load()} loading={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </motion.div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            Failed to load analytics
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8"
          >
            <StatCard icon={Users} label="Talabat" value={data.summary.students} color="text-indigo-600" accent="bg-indigo-100" />
            <StatCard icon={School} label="Teachers" value={data.summary.teachers} color="text-blue-600" accent="bg-blue-100" />
            <StatCard icon={BookOpen} label="Active Classes" value={data.summary.activeClasses} color="text-emerald-600" accent="bg-emerald-100" />
            <StatCard icon={TrendingUp} label="Avg Attendance" value={`${avgRate}%`} sub={`last ${days} days`} color="text-teal-600" accent="bg-teal-100" />
            <StatCard icon={FileCheck2} label="Justified Absences" value={data.summary.justifiedAbsences} sub="all time" color="text-amber-600" accent="bg-amber-100" />
            <StatCard icon={Calendar} label="Justified Absences" value={data.summary.justifiedAbsences} sub="approved excuses" color="text-amber-600" accent="bg-amber-100" />
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Attendance trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-5 text-indigo-500" />
                    Attendance Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <AttendanceTrendChart data={data.attendanceTrend} />
                </CardContent>
              </Card>
            </motion.div>

            {/* Points trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-5 text-indigo-500" />
                    Points Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <PointsTrendChart data={data.pointsTrend} />
                </CardContent>
              </Card>
            </motion.div>

            {/* Status distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-5 text-indigo-500" />
                    Attendance by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <StatusDonutChart data={data.statusDistribution} />
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                    {data.statusDistribution.map((s) => (
                      <div key={s.status} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: statusColors[s.status] || "#94a3b8" }} />
                        <span className="text-xs text-gray-500">{statusLabels[s.status] || s.status}</span>
                        <span className="text-xs font-semibold text-gray-900">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Class attendance ranking */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-5 text-indigo-500" />
                    Class Attendance Rates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.classAttendance.length > 0 ? (
                    <div className="space-y-4">
                      {data.classAttendance.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"}`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {c.name} <span className="text-xs text-gray-500">G{c.grade}-{c.section}</span>
                              </p>
                              <span className="text-xs font-semibold text-gray-700 shrink-0">{c.rate}%</span>
                            </div>
                            <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${c.rate}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-8 text-center">No class attendance data yet</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </>
      )}
    </div>
  );
}

