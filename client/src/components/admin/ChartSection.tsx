"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartSectionProps {
  chartData: any[];
}

export default function ChartSection({ chartData }: ChartSectionProps) {
  if (chartData.length === 0) {
    return <p className="text-center text-gray-500 py-8">No point data in the last 30 days</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="positive" name="Positive" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="negative" name="Negative" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
