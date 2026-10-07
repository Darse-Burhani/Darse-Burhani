"use client";

import React from "react";
import { BookOpen, Sparkles, CheckCircle, Clock, Calendar, Award, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RATING_BADGES } from "@/lib/mahad-ikhtebaar";

interface DailyEvaluationProps {
  evaluation: any | null;
  weeklySummary?: {
    daysRecited: number;
    totalLinesRecited: number;
    totalPagesRecited: number;
    averageMarks?: number;
  };
}

export default function DailyEvaluationCard({ evaluation, weeklySummary }: DailyEvaluationProps) {
  if (!evaluation) {
    return (
      <Card className="border-dashed border-slate-200 bg-slate-50/50">
        <CardContent className="py-8 text-center text-slate-500">
          <Calendar className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          <p className="font-medium text-slate-700">No Daily Evaluation Logged Yet Today</p>
          <p className="text-xs text-slate-500 mt-1">
            Data will reflect automatically once tasmee' evaluation is synced.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ratingKey = evaluation.performanceRating || "GOOD";
  const ratingCfg = RATING_BADGES[ratingKey] || RATING_BADGES.JAYYID;

  return (
    <Card className="overflow-hidden border-amber-200/60 shadow-sm bg-gradient-to-b from-white to-amber-50/20">
      <CardHeader className="bg-gradient-to-r from-amber-600/10 via-amber-500/5 to-transparent border-b border-amber-100 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                Today's Daily Evaluation (اليومية)
              </CardTitle>
              <p className="text-xs text-slate-500">
                {new Date(evaluation.evaluationDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${ratingCfg.bg} ${ratingCfg.color} border font-semibold text-xs`}>
              {ratingCfg.labelAr} · {ratingCfg.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Sabaq, Sabqi, Muraja'at 3-Column Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Sabaq */}
          <div className="p-3 rounded-xl bg-white border border-amber-100 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Sabaq (سبق جديد)
              </span>
              <span className="text-xs font-semibold text-amber-600">
                {evaluation.sabaqMarks ?? "-"}/10
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {evaluation.sabaqSurah ? evaluation.sabaqSurah : "Regular Sabaq"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {evaluation.sabaqLines ? `${evaluation.sabaqLines} Lines` : ""}
              {evaluation.currentSafah ? ` · Safah ${evaluation.currentSafah}` : ""}
            </p>
          </div>

          {/* Sabqi */}
          <div className="p-3 rounded-xl bg-white border border-blue-100 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                Sabqi (سبقي)
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {evaluation.sabqiMarks ?? "-"}/10
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {evaluation.sabqiJuz ? `Juz ${evaluation.sabqiJuz}` : "Sabqi Revision"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {evaluation.sabqiSafah ? `Safah ${evaluation.sabqiSafah}` : "Recited smoothly"}
            </p>
          </div>

          {/* Muraja'at */}
          <div className="p-3 rounded-xl bg-white border border-emerald-100 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                Muraja'at (مراجعة / دور)
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {evaluation.murajaatMarks ?? "-"}/10
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {evaluation.murajaatJuz ? `Juz ${evaluation.murajaatJuz}` : "Dhor"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {evaluation.murajaatSafah ? `Safah ${evaluation.murajaatSafah}` : "Dhor complete"}
            </p>
          </div>
        </div>

        {/* Teacher Notes */}
        {evaluation.teacherRemarks && (
          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/50 text-xs text-amber-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Muhaffiz Remarks: </span>
              {evaluation.teacherRemarks}
            </div>
          </div>
        )}

        {/* Weekly Progress Bar */}
        {weeklySummary && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              This Week: <strong className="text-slate-800">{weeklySummary.totalPagesRecited} pages</strong> ({weeklySummary.totalLinesRecited} lines across {weeklySummary.daysRecited} days)
            </span>
            {weeklySummary.averageMarks !== undefined && (
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                Avg: {weeklySummary.averageMarks}/10
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
