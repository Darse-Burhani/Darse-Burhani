"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MONTH_NAMES, statusMeta } from "@/lib/takhteet";

interface TakhteetMonthlyViewProps {
  plans: any[];
}

export default function TakhteetMonthlyView({ plans }: TakhteetMonthlyViewProps) {
  const months = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      name: MONTH_NAMES[i],
      items: [] as any[],
    }));
    plans.forEach((p) => {
      if (p.month >= 1 && p.month <= 12) {
        arr[p.month - 1].items.push(p);
      }
    });
    return arr;
  }, [plans]);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {months.map((m) => {
        const completed = m.items.filter((p) => p.status === "COMPLETED").length;
        const avg = m.items.length
          ? Math.round(m.items.reduce((a, p) => a + p.progress, 0) / m.items.length)
          : 0;
        return (
          <Card key={m.month} className={`fatimi-card h-full ${m.items.length === 0 ? "opacity-50" : ""}`}>
            <div className="fatimi-card-header" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">{m.name}</h3>
                {m.items.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {completed}/{m.items.length} done • {avg}%
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] text-gray-400">No plans</Badge>
                )}
              </div>

              {m.items.length > 0 ? (
                <div className="space-y-2">
                  {m.items.map((p) => {
                    const meta = statusMeta(p.status);
                    return (
                      <div key={p.id} className="rounded-lg border border-gray-100 bg-white p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="outline" className="text-[9px] shrink-0">{p.subject}</Badge>
                          <Badge className={`text-[9px] border ml-auto shrink-0 ${meta.badge}`}>{meta.label}</Badge>
                        </div>
                        <p className="text-xs font-medium text-gray-900 leading-snug">{p.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{p.teacherName}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-emerald-100/60 overflow-hidden">
                            <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-600">{p.progress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-6">—</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
