"use client";

import React from "react";
import { Award, Compass, TrendingUp, Sparkles, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TOTAL_QURAN_PAGES, TOTAL_QURAN_AJZA } from "@/lib/mahad-ikhtebaar";

interface Hifz30JuzProgressBarProps {
  completedPages: number;
  completedAjza?: number;
  fullQuranPercentage?: number;
  projection?: {
    weeklyPacePages?: number;
    weeksToKhatam?: number | null;
    estimatedMonthsToKhatam?: number | null;
  };
}

export default function Hifz30JuzProgressBar({
  completedPages = 0,
  completedAjza,
  fullQuranPercentage,
  projection,
}: Hifz30JuzProgressBarProps) {
  const percentage =
    fullQuranPercentage ??
    Number(Math.min(100, (completedPages / TOTAL_QURAN_PAGES) * 100).toFixed(1));
  const ajza = completedAjza ?? Number((completedPages / 20).toFixed(1));

  return (
    <Card className="border-emerald-200/60 shadow-sm bg-gradient-to-br from-white via-emerald-50/10 to-teal-50/20 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-700 rounded-lg">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                Annual & 30-Juz Quran Journey (ختم القرآن)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Track full Quran memorization milestone (604 pages · 30 Ajza)
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1">
            {percentage}% Complete
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Big Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>
              <strong className="text-emerald-700 text-sm">{completedPages}</strong> / {TOTAL_QURAN_PAGES} Pages Memorized
            </span>
            <span>
              <strong className="text-emerald-700 text-sm">{ajza}</strong> / {TOTAL_QURAN_AJZA} Ajza
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${Math.max(3, percentage)}%` }}
            />
          </div>
        </div>

        {/* 30-Juz Visual Grid Mini Preview */}
        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1 pt-1">
          {Array.from({ length: 30 }, (_, i) => {
            const juzNum = i + 1;
            const isCompleted = juzNum <= Math.floor(ajza);
            const isCurrent = juzNum === Math.ceil(ajza) && !isCompleted;
            return (
              <div
                key={juzNum}
                title={`Juz ${juzNum}`}
                className={`h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
                  isCompleted
                    ? "bg-emerald-600 text-white shadow-xs"
                    : isCurrent
                    ? "bg-amber-400 text-slate-900 animate-pulse"
                    : "bg-slate-100 text-slate-400 border border-slate-200/50"
                }`}
              >
                {juzNum}
              </div>
            );
          })}
        </div>

        {/* Projections & Pace */}
        {projection && projection.weeksToKhatam && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-slate-500">Weekly Pace: </span>
                <strong className="text-slate-800">{projection.weeklyPacePages} pages/wk</strong>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-teal-50/50 border border-teal-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
              <div>
                <span className="text-slate-500">Est. Quran Khatam: </span>
                <strong className="text-slate-800">
                  {projection.estimatedMonthsToKhatam} months ({projection.weeksToKhatam} weeks)
                </strong>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
