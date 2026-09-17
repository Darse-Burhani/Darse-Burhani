"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export const statusColors: Record<string, string> = {
  PRESENT: "#10b981",
  LATE: "#f59e0b",
  ABSENT: "#ef4444",
  EARLY_DEPARTURE: "#f97316",
};

interface TrendPoint {
  date: string;
  present: number;
  late: number;
  absent: number;
  earlyDeparture: number;
  total: number;
  rate: number;
}

export function AttendanceTrendChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    day: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} fill="url(#gradPresent)" stackId="1" />
          <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.15} stackId="1" />
          <Area type="monotone" dataKey="absent" name="Absent" stroke="#ef4444" strokeWidth={2} fill="#ef4444" fillOpacity={0.1} stackId="2" />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PointsTrendChart({ data }: { data: { date: string; positive: number; negative: number }[] }) {
  const chartData = data.map((d) => ({
    ...d,
    day: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 12 }}
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
          />
          <Bar dataKey="positive" name="Points earned" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="negative" name="Points deducted" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonutChart({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return (
    <div className="w-full" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={statusColors[entry.status] || "#94a3b8"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 12 }}
            formatter={(value: any, name: any) => [`${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
