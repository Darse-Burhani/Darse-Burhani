"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { monthName } from "@/lib/takhteet";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#9ca3af",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#047857",
};

interface TakhteetAnalyticsProps {
  plans: any[];
  teachers: any[];
}

export default function TakhteetAnalytics({ plans, teachers }: TakhteetAnalyticsProps) {
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
    plans.forEach((p) => {
      if (counts[p.status] !== undefined) counts[p.status] += 1;
    });
    return [
      { name: "Pending", value: counts.PENDING },
      { name: "In Progress", value: counts.IN_PROGRESS },
      { name: "Completed", value: counts.COMPLETED },
    ].filter((d) => d.value > 0);
  }, [plans]);

  const byTeacher = useMemo(() => {
    return teachers
      .map((t) => {
        const tp = plans.filter((p) => p.teacherId === t.id);
        if (tp.length === 0) return null;
        const completed = tp.filter((p) => p.status === "COMPLETED").length;
        const avg = Math.round(tp.reduce((a, p) => a + p.progress, 0) / tp.length);
        return {
          name: t.name.split(" ")[0],
          fullName: t.name,
          total: tp.length,
          completed,
          avg,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b as any).avg - (a as any).avg);
  }, [plans, teachers]);

  const byMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      name: monthName(i + 1).slice(0, 3),
      total: 0,
      completed: 0,
      progressSum: 0,
    }));
    plans.forEach((p) => {
      const m = p.month;
      if (m >= 1 && m <= 12) {
        months[m - 1].total++;
        months[m - 1].progressSum += p.progress;
        if (p.status === "COMPLETED") months[m - 1].completed++;
      }
    });
    return months
      .filter((m) => m.total > 0)
      .map((m) => ({
        ...m,
        avg: Math.round(m.progressSum / m.total),
      }));
  }, [plans]);

  const overall = useMemo(() => {
    if (plans.length === 0) return 0;
    return Math.round(plans.reduce((a, p) => a + p.progress, 0) / plans.length);
  }, [plans]);

  if (plans.length === 0) {
    return <Card><CardContent className="p-12 text-center text-gray-500">Assign some portions to see analytics</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <Card className="fatimi-card">
          <div className="fatimi-card-header" />
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Status Distribution</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-10">No plans</p>
            )}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50/60 border border-emerald-100 p-3">
              <span className="text-sm text-gray-600 font-medium">Overall completion</span>
              <span className="text-lg font-bold text-[#047857]">{overall}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Progress by teacher */}
        <Card className="fatimi-card">
          <div className="fatimi-card-header" />
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Average Progress by Teacher</h3>
            {byTeacher.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byTeacher} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any, _name: any, props: any) => [`${value}%`, props.payload.fullName]} />
                  <Bar dataKey="avg" name="Avg Progress %" fill="#047857" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-10">No teacher plans</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress by month */}
      <Card className="fatimi-card">
        <div className="fatimi-card-header" />
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Progress by Target Month</h3>
          {byMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any, name: any) => [name === "completed" ? `${value} completed` : `${value}%`, name === "completed" ? "Completed" : "Avg Progress"]} />
                <Legend />
                <Bar dataKey="avg" name="Avg Progress %" fill="#d4af37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-10">No month-specific plans</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
