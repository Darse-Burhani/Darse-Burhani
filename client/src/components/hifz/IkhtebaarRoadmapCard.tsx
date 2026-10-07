"use client";

import React from "react";
import { ShieldCheck, Flag, Clock, CheckCircle2, ChevronRight, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MAHAD_IKHTEBAAR_MILESTONES } from "@/lib/mahad-ikhtebaar";

interface IkhtebaarRoadmapCardProps {
  nextMilestone: any;
  currentMilestone?: any;
  ikhtebaarTarget?: any;
}

export default function IkhtebaarRoadmapCard({
  nextMilestone,
  currentMilestone,
  ikhtebaarTarget,
}: IkhtebaarRoadmapCardProps) {
  const milestoneName =
    ikhtebaarTarget?.targetName || nextMilestone?.name || "Next Ikhtebaar";
  const progressPercent =
    ikhtebaarTarget?.readinessPercentage ?? nextMilestone?.progressPercentage ?? 0;
  const pagesCompleted =
    ikhtebaarTarget?.pagesCompleted ?? nextMilestone?.pagesCompleted ?? 0;
  const totalPagesRequired =
    ikhtebaarTarget?.totalPagesRequired ?? nextMilestone?.totalPagesRequired ?? 20;
  const pagesRemaining =
    nextMilestone?.pagesRemaining ?? Math.max(0, totalPagesRequired - pagesCompleted);

  const isReady = progressPercent >= 100;
  const isFinalReview = progressPercent >= 80 && !isReady;

  return (
    <Card className="border-purple-200/70 shadow-sm bg-gradient-to-br from-white via-purple-50/15 to-indigo-50/20 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-600/10 via-indigo-500/5 to-transparent border-b border-purple-100 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-500/10 text-purple-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                Mahad Al-Zahra Ikhtebaar Milestone (اختبار معهد الزهراء)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Next scheduled exam criteria, readiness & clearance
              </p>
            </div>
          </div>
          <Badge
            className={`font-semibold text-xs px-2.5 py-1 ${
              isReady
                ? "bg-emerald-600 text-white animate-bounce"
                : isFinalReview
                ? "bg-amber-500 text-white"
                : "bg-purple-100 text-purple-800 border-purple-200"
            }`}
          >
            {isReady ? "Ready For Ikhtebaar!" : isFinalReview ? "Final Review Stage" : "In Preparation"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Next Ikhtebaar Banner */}
        <div className="p-3.5 rounded-xl bg-white border border-purple-100 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                Target Ikhtebaar
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <Flag className="w-4 h-4 text-purple-600" />
                {milestoneName}
              </h3>
              {nextMilestone?.juzRange && (
                <p className="text-xs text-slate-500">
                  Range: <strong>{nextMilestone.juzRange}</strong> · {nextMilestone.nameAr}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-purple-700">{progressPercent}%</span>
              <p className="text-[10px] text-slate-400">Readiness</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500"
                style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>{pagesCompleted} pages memorized</span>
              <span>
                {pagesRemaining > 0 ? `${pagesRemaining} pages remaining` : "Target achieved!"}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Ladder (Mahad Al-Zahra) */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Mahad Al-Zahra Ikhtebaar Ladder
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {MAHAD_IKHTEBAAR_MILESTONES.slice(0, 8).map((m) => {
              const isCurrent = nextMilestone?.key === m.key;
              return (
                <div
                  key={m.key}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    isCurrent
                      ? "bg-purple-600 text-white border-purple-600 font-bold shadow-sm"
                      : "bg-white text-slate-600 border-slate-200/70"
                  }`}
                >
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className={`text-[10px] ${isCurrent ? "text-purple-100" : "text-slate-400"}`}>
                    {m.juzRange}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
