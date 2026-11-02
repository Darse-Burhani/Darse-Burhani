"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  History,
  BookOpen,
  Calendar,
  Layers,
  Minus,
  Plus,
  Loader2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Award,
} from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { monthName } from "@/lib/takhteet";

export interface TakhteetPlanItem {
  id: string;
  title: string;
  subject?: string;
  className?: string;
  description?: string | null;
  academicYear?: string;
  month?: number | null;
  progress: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  logs?: Array<{
    id: string;
    createdAt: string;
    progressBefore: number;
    progressAfter: number;
    status: string;
    note?: string | null;
    teacher?: {
      user?: {
        firstName?: string;
        lastName?: string;
      };
    };
  }>;
}

interface TakhteetUpdateModalProps {
  plan: TakhteetPlanItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { progress: number; status: string; note: string }) => Promise<void>;
  saving?: boolean;
}

const PRESET_STEPS = [0, 25, 50, 75, 100];

const SMART_NOTE_CHIPS = [
  "📖 Chapter completed",
  "📝 Exercises solved",
  "🎒 Homework assigned",
  "🎯 Oral quiz conducted",
  "🔍 Exam revision done",
  "⏳ Extra session needed",
];

export function TakhteetUpdateModal({
  plan,
  open,
  onOpenChange,
  onSave,
  saving = false,
}: TakhteetUpdateModalProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // Sync state when plan opens
  useEffect(() => {
    if (plan) {
      const currentProg = Math.max(0, Math.min(100, plan.progress || 0));
      setProgress(currentProg);
      setStatus(plan.status || (currentProg >= 100 ? "COMPLETED" : currentProg > 0 ? "IN_PROGRESS" : "PENDING"));
      setNote("");
      setShowHistory(false);
      setHasCelebrated(false);
    }
  }, [plan, open]);

  // Handle setting progress with status synchronization
  const handleSetProgress = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setProgress(clamped);

    if (clamped === 100) {
      setStatus("COMPLETED");
      setHasCelebrated(true);
    } else if (clamped > 0) {
      setStatus("IN_PROGRESS");
    } else {
      setStatus("PENDING");
    }
  };

  // Handle setting status directly
  const handleSetStatus = (newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED") => {
    setStatus(newStatus);
    if (newStatus === "COMPLETED") {
      setProgress(100);
      setHasCelebrated(true);
    } else if (newStatus === "PENDING") {
      setProgress(0);
    } else if (newStatus === "IN_PROGRESS" && progress === 0) {
      setProgress(25);
    }
  };

  // Add smart chip note
  const handleAddChip = (chipText: string) => {
    setNote((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chipText;
      if (trimmed.includes(chipText)) return trimmed;
      return `${trimmed}, ${chipText}`;
    });
  };

  const delta = useMemo(() => {
    if (!plan) return 0;
    return progress - (plan.progress || 0);
  }, [plan, progress]);

  const handleSubmit = async () => {
    await onSave({
      progress,
      status,
      note: note.trim(),
    });
  };

  if (!plan) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
        {/* ── Top Header Bar ── */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/70 p-5 sm:p-6 text-white border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider border border-amber-400/30">
                <Sparkles className="w-3 h-3" />
                Curriculum Progress Updater
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white line-clamp-2">
                {plan.title}
              </h2>
            </div>
            <div className="shrink-0">
              <span className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 font-bold border border-white/10 shadow-inner">
                <BookOpen className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Portion Meta Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            {plan.className && (
              <Badge className="bg-white/15 text-white border-white/20 font-semibold px-2.5 py-0.5 rounded-lg backdrop-blur-xs">
                {plan.className}
              </Badge>
            )}
            {plan.subject && (
              <Badge className="bg-amber-400/20 text-amber-200 border-amber-400/30 font-semibold px-2.5 py-0.5 rounded-lg">
                {plan.subject}
              </Badge>
            )}
            {plan.month ? (
              <Badge className="bg-slate-800/80 text-slate-300 border-slate-700 font-medium px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Target: {monthName(plan.month)}
              </Badge>
            ) : (
              <Badge className="bg-slate-800/80 text-slate-300 border-slate-700 font-medium px-2.5 py-0.5 rounded-lg">
                Full Year
              </Badge>
            )}
          </div>
        </div>

        {/* ── Main Form Body ── */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[72vh] overflow-y-auto scrollbar-thin">
          {/* 1. Large Friendly Progress Gauge Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50/80 to-slate-100/40 dark:from-slate-900/80 dark:to-slate-950 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current Coverage
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                    {progress}%
                  </span>
                  {delta !== 0 && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
                        delta > 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      <TrendingUp className={`w-3 h-3 ${delta < 0 ? "rotate-180" : ""}`} />
                      {delta > 0 ? `+${delta}%` : `${delta}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Pill Indicator */}
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                    progress >= 100
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700 shadow-sm shadow-emerald-500/20"
                      : progress > 0
                        ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700"
                        : "bg-slate-200/80 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                  }`}
                >
                  {progress >= 100 ? (
                    <>
                      <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Completed
                    </>
                  ) : progress > 0 ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      In Progress
                    </>
                  ) : (
                    <>
                      <Minus className="w-3.5 h-3.5" />
                      Pending (0%)
                    </>
                  )}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Baseline: <strong>{plan.progress}%</strong>
                </p>
              </div>
            </div>

            {/* Smooth Animated Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3.5 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300/60 dark:border-slate-700">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress >= 100
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50"
                      : progress >= 50
                        ? "bg-gradient-to-r from-teal-500 to-emerald-500"
                        : progress > 0
                          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                          : "bg-slate-400"
                  }`}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>

              {/* Slider for fine adjustment */}
              <div className="pt-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => handleSetProgress(Number(e.target.value))}
                  className="w-full h-2 bg-transparent appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                  aria-label="Progress percentage slider"
                />
              </div>
            </div>

            {/* Micro Stepper & Quick Milestone Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetProgress(progress - 5)}
                  disabled={progress <= 0}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                  title="Decrease 5%"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetProgress(progress + 5)}
                  disabled={progress >= 100}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                  title="Increase 5%"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1-Tap Milestone Pills */}
              <div className="flex items-center gap-1.5">
                {PRESET_STEPS.map((step) => {
                  const isSelected = progress === step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => handleSetProgress(step)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {step === 100 ? "100% ✓" : `${step}%`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 100% Completion Celebration Banner */}
          <AnimatePresence>
            {progress === 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 border border-emerald-400/40 p-3.5 flex items-center gap-3 text-emerald-950 dark:text-emerald-200 shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <strong className="block font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    Syllabus Portion Completed! 🎉
                  </strong>
                  <span>Marked for full student coverage. Completed timestamp will be recorded.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 2. Status Segmented Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Curriculum Milestone Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "PENDING", label: "Pending", icon: Minus },
                { id: "IN_PROGRESS", label: "In Progress", icon: Clock },
                { id: "COMPLETED", label: "Completed", icon: CheckCircle2 },
              ].map((s) => {
                const isSelected = status === s.id;
                const IconComponent = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSetStatus(s.id as any)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? s.id === "COMPLETED"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                          : s.id === "IN_PROGRESS"
                            ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                            : "bg-slate-800 text-white border-slate-800 dark:bg-slate-700"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Teaching Notes & Smart Quick Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="modal-note-area" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                Teaching Note / Remarks (Optional)
              </label>
              <span className="text-[11px] text-slate-400">
                1-tap chips below to insert
              </span>
            </div>

            {/* Smart Chips */}
            <div className="flex flex-wrap gap-1.5">
              {SMART_NOTE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAddChip(chip)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 hover:text-amber-900 dark:hover:text-amber-200 border border-slate-200/80 dark:border-slate-700 transition active:scale-95 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            <textarea
              id="modal-note-area"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Completed initial 2 chapters, homework assigned for Monday, revision in next session…"
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none transition shadow-2xs"
            />
          </div>

          {/* 4. Expandable Telemetry History */}
          {plan.logs && plan.logs.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="w-full p-3 px-4 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-amber-600" />
                  View Progress Telemetry History ({plan.logs.length} logged)
                </span>
                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2 max-h-48 overflow-y-auto scrollbar-thin text-xs"
                  >
                    {plan.logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {new Date(log.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                            {log.progressBefore}% → {log.progressAfter}%
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-slate-600 dark:text-slate-300 italic">
                            "{log.note}"
                          </p>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Modal Actions Footer ── */}
        <ModalFooter className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <ModalClose asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancel
            </Button>
          </ModalClose>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 active:scale-95 transition cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Save Progress ({progress}%)
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

