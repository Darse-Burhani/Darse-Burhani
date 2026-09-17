"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  Star,
  Target,
  Trophy,
  Award,
  Sparkles,
  RotateCcw,
  Clock,
  MapPin,
  CheckCircle2,
  BarChart3,
  Flame,
  Save,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PART_CHART_COLORS: Record<string, string> = {
  COMPLETED: "#059669",
  IN_PROGRESS: "#2563eb",
  WEAK: "#d97706",
  NOT_STARTED: "#d1d5db",
  NEEDS_REVIEW: "#dc2626",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  COMPLETED: { label: "Completed", color: "text-emerald-800", bgColor: "bg-emerald-50", borderColor: "border-emerald-300", dotColor: "#059669" },
  IN_PROGRESS: { label: "In Progress", color: "text-blue-800", bgColor: "bg-blue-50", borderColor: "border-blue-300", dotColor: "#2563eb" },
  WEAK: { label: "Weak", color: "text-amber-800", bgColor: "bg-amber-50", borderColor: "border-amber-300", dotColor: "#d97706" },
  NOT_STARTED: { label: "Not Started", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200", dotColor: "#9ca3af" },
  NEEDS_REVIEW: { label: "Needs Review", color: "text-red-800", bgColor: "bg-red-50", borderColor: "border-red-300", dotColor: "#dc2626" },
};

function FatimiProgressRing({ progress, size = 180, strokeWidth = 12 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius + 6} stroke="#d4af3720" strokeWidth={2} fill="none" strokeDasharray="4 4" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#d4af3720" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#fatimiGradient)"
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${offset} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="fatimiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold" style={{ color: "#047857" }}>{progress}%</span>
        <span className="text-sm mt-1" style={{ color: "#b8860b" }}>Completed</span>
      </div>
    </div>
  );
}

function GeometricPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <svg className="w-full h-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fatimiPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40 0L80 40L40 80L0 40Z" fill="none" stroke="#047857" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="15" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            <path d="M40 25L55 40L40 55L25 40Z" fill="none" stroke="#047857" strokeWidth="0.3" />
            <circle cx="40" cy="40" r="5" fill="none" stroke="#d4af37" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fatimiPattern)" />
      </svg>
    </div>
  );
}

function JourneyNode({ part, index, isExpanded, onToggle, isLast, isCurrent }: {
  part: any; index: number; isExpanded: boolean; onToggle: () => void; isLast: boolean; isCurrent: boolean;
}) {
  const config = STATUS_CONFIG[part.status] || STATUS_CONFIG.NOT_STARTED;
  const isCompleted = part.status === "COMPLETED";
  const isProgress = part.status === "IN_PROGRESS";

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all duration-300 ${
            isCurrent ? "ring-4 ring-offset-2" : ""
          }`}
          style={{
            background: isCompleted ? "linear-gradient(135deg, #059669, #047857)" :
              isProgress ? "linear-gradient(135deg, #2563eb, #1d4ed8)" :
              part.status === "WEAK" ? "linear-gradient(135deg, #d97706, #b45309)" :
              "linear-gradient(135deg, #9ca3af, #6b7280)",
            boxShadow: isCurrent ? `0 0 0 4px ${config.dotColor}20` : undefined,
          }}
        >
          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : part.partNumber}
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 min-h-[40px] transition-all duration-500"
            style={{
              background: isCompleted ?
                "linear-gradient(180deg, #059669, #047857)" :
                isProgress ? `linear-gradient(180deg, #2563eb, ${STATUS_CONFIG[part.status]?.dotColor || "#9ca3af"}40)` :
                `linear-gradient(180deg, #e5e7eb, #e5e7eb)`,
            }}
          />
        )}
      </div>

      {/* Content card */}
      <div className="flex-1 pb-6">
        <div
          className={`rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
            isExpanded ? "shadow-md" : "shadow-sm"
          }`}
          style={{
            borderColor: isCompleted ? "#a7f3d0" : isProgress ? "#bfdbfe" : "#e5e7eb",
            background: isExpanded ? "linear-gradient(135deg, #f0fdf4, #ffffff)" : "#ffffff",
          }}
          onClick={onToggle}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 text-base">Juz {part.partNumber}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}
                    >
                      {config.label}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Juz {part.partNumber} of the Holy Quran</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-lg font-bold" style={{ color: config.dotColor }}>{part.progress}%</p>
                  <div className="w-20 rounded-full h-1.5 mt-1" style={{ background: `${config.dotColor}20` }}>
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${part.progress}%`, background: config.dotColor }}
                    />
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="p-4 border-t" style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", borderColor: "#d1fae5" }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-white/60 border" style={{ borderColor: "#a7f3d0" }}>
                  <p className="text-xs mb-1" style={{ color: "#047857" }}>Pages</p>
                  <p className="text-lg font-bold text-gray-900">{part.currentPage}/{part.totalPages}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/60 border" style={{ borderColor: "#a7f3d0" }}>
                  <p className="text-xs mb-1" style={{ color: "#047857" }}>Firm Memorization</p>
                  <p className="text-lg font-bold text-gray-900">{part.firmProgress}/{part.firmTarget}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/60 border" style={{ borderColor: "#a7f3d0" }}>
                  <p className="text-xs mb-1" style={{ color: "#047857" }}>Sentences</p>
                  <p className="text-lg font-bold text-gray-900">{part.sentencesMemorized}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/60 border" style={{ borderColor: "#a7f3d0" }}>
                  <p className="text-xs mb-1" style={{ color: "#047857" }}>Reviews</p>
                  <p className="text-lg font-bold text-gray-900">{part.reviewCount}/{part.targetReviews}</p>
                </div>
              </div>
              {part.notes && (
                <div className="mt-3 p-3 rounded-lg bg-white/60 border" style={{ borderColor: "#a7f3d0" }}>
                  <p className="text-xs mb-1" style={{ color: "#047857" }}>Teacher Notes</p>
                  <p className="text-sm text-gray-700">{part.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TalabatHifzPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dailyPageGoal, setDailyPageGoal] = useState<number>(5);
  const [goalSaved, setGoalSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("talabat_hifz_daily_goal");
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) setDailyPageGoal(parsed);
    }
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const res = await fetch("/api/talabat/hifz");
      const data = await res.json();
      if (data.success) {
        setReport(data.data.report);
        setError(null);
      } else {
        setError(data.error || "Failed to load report");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const getAchievementLevel = (progress: number) => {
    if (progress >= 90) return { label: "Outstanding", color: "text-amber-700", bgColor: "bg-amber-50", icon: Star, border: "border-amber-300", message: "Amazing performance! Keep progressing" };
    if (progress >= 75) return { label: "Excellent", color: "text-emerald-700", bgColor: "bg-emerald-50", icon: Trophy, border: "border-emerald-300", message: "Excellent progress! You're on the right track" };
    if (progress >= 50) return { label: "Very Good", color: "text-blue-700", bgColor: "bg-blue-50", icon: TrendingUp, border: "border-blue-300", message: "Very good progress! Keep up the effort" };
    if (progress >= 25) return { label: "Good", color: "text-indigo-700", bgColor: "bg-indigo-50", icon: Target, border: "border-indigo-300", message: "Good start! Consistency is the key" };
    return { label: "Needs Support", color: "text-gray-600", bgColor: "bg-gray-50", icon: Clock, border: "border-gray-200", message: "Every step counts toward the top" };
  };

  const getMotivationalMessage = (completedCount: number, totalCount: number) => {
    const progress = Math.round((completedCount / totalCount) * 100);
    if (progress >= 100) return "Congratulations! You have completed your memorization - may Allah make you among the people of the Quran";
    if (progress >= 75) return "Great progress! You are close to completing - may Allah bless your effort";
    if (progress >= 50) return "Almost halfway there! Keep going - Allah is with those who persist";
    if (progress >= 25) return "Excellent start! Every day you learn something new - read and rise";
    return "Start today and you will reach the top - with hardship comes ease";
  };

  const getCurrentPart = () => {
    if (!report) return null;
    return report.parts.find((p: any) => p.status === "IN_PROGRESS") ||
      report.parts.find((p: any) => p.status === "COMPLETED" && p.progress < 100) ||
      report.parts[0];
  };

  const saveDailyGoal = () => {
    localStorage.setItem("talabat_hifz_daily_goal", String(dailyPageGoal));
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 2500);
  };

  // Chart data: progress % for every juz, colored by status
  const chartData = (report?.parts || []).map((p: any) => ({
    juz: `Juz ${p.partNumber}`,
    progress: p.progress,
    partNumber: p.partNumber,
    status: p.status,
  }));

  // Daily goal: focused on the current in-progress part
  const currentPart = getCurrentPart();
  const goalPagesToday = currentPart?.firmProgress ?? 0;
  const goalTotalPages = currentPart?.firmTarget ?? dailyPageGoal;
  const todayProgress = goalTotalPages > 0 ? Math.min(100, Math.round((goalPagesToday / goalTotalPages) * 100)) : 0;
  const remainingPages = Math.max(0, (currentPart?.totalPages ?? 0) - (currentPart?.currentPage ?? 0));
  const estimatedDays = dailyPageGoal > 0 ? Math.ceil(remainingPages / dailyPageGoal) : 0;

  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 30%, #f0fdf9 60%, #ecfdf5 100%)" }}>
      <GeometricPattern />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header */}
        <div className="animate-fade-in mb-8">
          <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8" style={{ background: "linear-gradient(135deg, #047857 0%, #065f46 50%, #064e3b 100%)" }}>
            <GeometricPattern />
            <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
                <circle cx="50" cy="50" r="25" fill="none" stroke="#d4af37" strokeWidth="0.5" />
              </svg>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 opacity-10 rotate-45">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
              </svg>
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-2">
                  Hifz Journey
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                </h1>
                <p className="text-emerald-100 text-base sm:text-lg">Track your journey in memorizing the Holy Quran</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-6">
            <Card className="animate-pulse border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="h-64 bg-gray-100 rounded-xl" />
              </CardContent>
            </Card>
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm" style={{ borderColor: "#d4af3730" }}>
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <p className="text-red-700 text-2xl font-medium">Failed to load data</p>
              <p className="text-gray-500 text-lg mt-2">{error}</p>
              <Button variant="outline" size="sm" className="mt-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => { setLoading(true); fetchReport(); }}>
                <RotateCcw className="w-4 h-4 ml-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !report ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-gray-200">
                <FileSpreadsheet className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-600 text-2xl">No hifz report yet</p>
              <p className="text-gray-500 text-lg mt-1">Your journey will appear here once your teacher publishes it</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Profile Card + Progress */}
            <Card className="border-0 shadow-lg overflow-hidden" style={{ borderColor: "#d4af3720" }}>
              <div className="h-1.5" style={{ background: "linear-gradient(90deg, #047857, #d4af37, #047857)" }} />
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col items-center gap-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-24 h-24 border-4" style={{ borderColor: "#d4af37" }}>
                          <AvatarFallback className="text-3xl font-bold" style={{ background: "linear-gradient(135deg, #047857, #065f46)", color: "#d4af37" }}>
                            {report.studentName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
                          <Award className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="text-center sm:text-right">
                        <h2 className="text-2xl font-bold text-gray-900">{report.studentName}</h2>
                        <p className="text-base text-gray-500">
                          Grade {report.studentGrade}{report.studentSection} • {report.academicYear}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <FatimiProgressRing progress={report.summary.overallProgress} size={180} strokeWidth={12} />
                    </div>
                  </div>

                  <div className="w-full text-center">
                    {(() => {
                      const achievement = getAchievementLevel(report.summary.overallProgress);
                      return (
                        <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl ${achievement.bgColor} border ${achievement.border}`}>
                          <achievement.icon className={`w-6 h-6 ${achievement.color}`} />
                          <span className={`text-lg font-semibold ${achievement.color}`}>{achievement.label}</span>
                        </div>
                      );
                    })()}
                    <p className="text-gray-600 text-base mt-3 px-4">{getMotivationalMessage(report.summary.completedParts, report.parts.length)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 w-full">
                    <div className="p-4 rounded-xl border text-center" style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderColor: "#a7f3d0" }}>
                      <p className="text-3xl font-bold" style={{ color: "#047857" }}>{report.summary.completedParts}</p>
                      <p className="text-sm" style={{ color: "#047857" }}>Completed</p>
                    </div>
                    <div className="p-4 rounded-xl border text-center" style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", borderColor: "#bfdbfe" }}>
                      <p className="text-3xl font-bold" style={{ color: "#1d4ed8" }}>{report.summary.inProgressParts}</p>
                      <p className="text-sm" style={{ color: "#1d4ed8" }}>In Progress</p>
                    </div>
                    <div className="p-4 rounded-xl border text-center" style={{ background: "linear-gradient(135deg, #fdf4ff, #fae8ff)", borderColor: "#e9d5ff" }}>
                      <p className="text-3xl font-bold" style={{ color: "#7c3aed" }}>{report.parts.length}</p>
                      <p className="text-sm" style={{ color: "#7c3aed" }}>Total</p>
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-center gap-6 py-4 px-5 rounded-xl border" style={{ background: "linear-gradient(135deg, #fffbeb, #fef9c3)", borderColor: "#fde68a" }}>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5" style={{ color: "#d4af37" }} />
                      <span className="text-base text-gray-600">Current Points:</span>
                      <span className="text-lg font-bold" style={{ color: "#b8860b" }}>{report.currentPoints}</span>
                    </div>
                    <div className="w-px h-5 bg-amber-300" />
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      <span className="text-base text-gray-600">Total Points:</span>
                      <span className="text-lg font-bold text-emerald-700">{report.totalPoints}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hifz Progress Chart + Daily Goal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="border-0 shadow-sm overflow-hidden lg:col-span-2">
                <div className="h-1" style={{ background: "linear-gradient(90deg, #047857, #d4af37)" }} />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-6">
                    <BarChart3 className="w-6 h-6" style={{ color: "#047857" }} />
                    Juz Memorization Progress
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="juz" tick={{ fontSize: 10 }} interval={chartData.length > 30 ? 2 : 0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(4,120,87,0.06)" }}
                        formatter={(value: any, name: any, item: any) => [`${value}%`, `Juz ${item.payload.partNumber}`]}
                      />
                      <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry: any) => (
                          <Cell key={entry.partNumber} fill={PART_CHART_COLORS[entry.status] || "#d1d5db"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
                    {Object.entries(PART_CHART_COLORS).slice(0, 4).map(([key, color]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="text-gray-500 text-xs">
                          {key === "COMPLETED" ? "Completed" : key === "IN_PROGRESS" ? "In Progress" : key === "WEAK" ? "Weak" : "Not Started"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="h-1" style={{ background: "linear-gradient(90deg, #d4af37, #b8860b)" }} />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-5">
                    <Flame className="w-6 h-6" style={{ color: "#d4af37" }} />
                    Daily Memorization Goal
                  </h3>

                  {/* Today's snapshot */}
                  <div className="p-4 rounded-xl border text-center" style={{ background: "linear-gradient(135deg, #fffbeb, #fef9c3)", borderColor: "#fde68a" }}>
                    <p className="text-sm text-gray-600">Today's progress in the current juz</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: "#047857" }}>
                      {goalPagesToday}<span className="text-base text-gray-500">/{goalTotalPages}</span>
                    </p>
                    <div className="w-full mt-3 h-2.5 rounded-full overflow-hidden" style={{ background: "#fde68a" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${todayProgress}%`, background: "linear-gradient(90deg, #059669, #047857, #d4af37)" }} />
                    </div>
                    <p className="text-sm mt-2" style={{ color: "#b8860b" }}>{todayProgress}%</p>
                  </div>

                  {/* Goal setting */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label htmlFor="dailyGoal" className="block text-sm font-semibold text-gray-700 mb-2">
                      Set your daily pages
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="dailyGoal"
                        name="dailyGoal"
                        type="number"
                        min={1}
                        max={20}
                        value={dailyPageGoal}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setDailyPageGoal(Number.isNaN(val) ? 1 : Math.min(20, Math.max(1, val)));
                        }}
                        className="w-full rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-center text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <Button
                        size="sm"
                        onClick={saveDailyGoal}
                        className="shrink-0 text-white"
                        style={{ background: "linear-gradient(135deg, #047857, #065f46)" }}
                      >
                        <Save className="w-4 h-4 ml-1" />
                        {goalSaved ? "Saved" : "Save"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-gray-500">Remaining in current juz</span>
                      <span className="font-semibold" style={{ color: "#047857" }}>{remainingPages} pages</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-sm">
                      <span className="text-gray-500">Estimated days to completion</span>
                      <span className="font-semibold text-gray-800">{estimatedDays} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Journey Map */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="h-1" style={{ background: "linear-gradient(90deg, #047857, #d4af37)" }} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-6 h-6" style={{ color: "#047857" }} />
                    Journey Map
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "#059669" }} />
                      <span className="text-gray-500">Completed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "#2563eb" }} />
                      <span className="text-gray-500">In Progress</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: "#9ca3af" }} />
                      <span className="text-gray-500">Not Started</span>
                    </div>
                  </div>
                </div>

                {/* Journey Timeline */}
                <div className="relative">
                  {report.parts.map((part: any, index: number) => {
                    const currentPart = getCurrentPart();
                    const isCurrent = currentPart && part.partNumber === currentPart.partNumber;

                    return (
                      <JourneyNode
                        key={part.partNumber}
                        part={part}
                        index={index}
                        isExpanded={expandedSection === `part-${part.partNumber}`}
                        onToggle={() => setExpandedSection(expandedSection === `part-${part.partNumber}` ? null : `part-${part.partNumber}`)}
                        isLast={index === report.parts.length - 1}
                        isCurrent={isCurrent}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center py-4">
              <p className="text-base" style={{ color: "#b8860b" }}>
                Last Updated: {new Date(report.updatedAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">In the name of Allah, the Most Gracious, the Most Merciful</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
