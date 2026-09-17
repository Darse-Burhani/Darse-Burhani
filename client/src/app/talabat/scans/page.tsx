"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint,
  Clock,
  CalendarDays,
  History,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";

export default function TalabatScansPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/talabat/scans");
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const stats = data?.stats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        icon={Fingerprint}
        title="My Scans"
        subtitle={stats ? `Grade ${data.grade}${data.section} · ${stats.total} biometric check-ins` : "Your biometric attendance history"}
      />

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : data ? (
        <>
          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    Today
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Scans Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.today}</p>
              </CardContent>
            </Card>

            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    This Month
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Scans This Month</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.month}</p>
              </CardContent>
            </Card>

            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <History className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    Lifetime
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Total Scans</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Scan history list */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="w-4 h-5 text-emerald-500" />
                  Scan History
                  <span className="text-xs font-normal text-gray-500">
                    (last {data.scans.length} scans)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.scans.length === 0 ? (
                  <div className="text-center py-12">
                    <Fingerprint className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm text-gray-500">
                      No biometric scans yet. Check in with your fingerprint to build your history.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {data.scans.map((scan: any) => (
                      <div key={scan.id} className="py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Fingerprint className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {scan.className || "General check-in"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(scan.checkInTime || scan.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {scan.subject ? ` · ${scan.subject}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant={scan.status === "PRESENT" ? "success" : "warning"}
                          className="text-[10px]"
                        >
                          {scan.status === "PRESENT" ? "Present" : "Late"}
                        </Badge>
                        <span className="text-xs text-gray-500 shrink-0">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {scan.checkInTime
                            ? new Date(scan.checkInTime).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : (
        <Card className="fatimi-card">
          <CardContent className="p-12 text-center text-gray-500">
            Failed to load scan history
          </CardContent>
        </Card>
      )}
    </div>
  );
}
