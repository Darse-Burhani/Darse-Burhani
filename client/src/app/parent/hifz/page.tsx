"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Star,
  Award,
  RotateCcw,
  Sparkles,
  Calendar,
  RefreshCw,
  Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const MARHALA_LABELS: Record<string, string> = {
  MARHALA_4: "Marhala 4 · Juz 19-24",
  MARHALA_5: "Marhala 5 · Juz 25-30",
  MARHALA_6: "Marhala 6",
  MARHALA_7: "Marhala 7",
  MARHALA_8: "Marhala 8",
};

function FatimiProgressRing({ progress, size = 120, strokeWidth = 8 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius + 4} stroke="#d4af3720" strokeWidth={1} fill="none" strokeDasharray="3 3" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#d4af3715" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#parentFatimiGradient)"
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${offset} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="parentFatimiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: "#047857" }}>{progress}%</span>
        <span className="text-xs" style={{ color: "#b8860b" }}>Completed</span>
      </div>
    </div>
  );
}

function GeometricPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <svg className="w-full h-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="parentFatimiPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40 0L80 40L40 80L0 40Z" fill="none" stroke="#047857" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="15" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            <path d="M40 25L55 40L40 55L25 40Z" fill="none" stroke="#047857" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#parentFatimiPattern)" />
      </svg>
    </div>
  );
}

export default function ParentHifzPage() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    fetchHifzData();
  }, []);

  const fetchHifzData = async () => {
    try {
      const res = await fetch("/api/parent/hifz");
      const data = await res.json();
      if (data.success) {
        setChildren(data.data.children);
        setError(null);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const copyStudentLink = async (studentId: string) => {
    const url = `${window.location.origin}/talabat/hifz?studentId=${studentId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(studentId);
    setTimeout(() => setCopiedLink(null), 2000);
  };
  const getAchievementLevel = (progress: number) => {
    if (progress >= 90) return { label: "Outstanding", color: "text-amber-700", bgColor: "bg-amber-50", icon: Star, border: "border-amber-300" };
    if (progress >= 75) return { label: "Excellent", color: "text-emerald-700", bgColor: "bg-emerald-50", icon: TrendingUp, border: "border-emerald-300" };
    if (progress >= 50) return { label: "Very Good", color: "text-blue-700", bgColor: "bg-blue-50", icon: CheckCircle, border: "border-blue-300" };
    if (progress >= 25) return { label: "Good", color: "text-indigo-700", bgColor: "bg-indigo-50", icon: Clock, border: "border-indigo-300" };
    return { label: "Needs Support", color: "text-gray-600", bgColor: "bg-gray-50", icon: AlertTriangle, border: "border-gray-200" };
  };

  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #ffffff 30%, #f0fdf4 60%, #ecfdf5 100%)" }}>
      <GeometricPattern />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Fatimi Header */}
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

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-2">
                    Hifz Reports
                    <Sparkles className="w-6 h-6 text-yellow-300" />
                  </h1>
                  <p className="text-emerald-100 text-base sm:text-lg">Track your children's Quran memorization progress</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-100 hover:text-white hover:bg-white/10 hidden sm:flex"
                onClick={() => { setLoading(true); fetchHifzData(); }}
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                Refresh
              </Button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="h-48 bg-gray-100 rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <p className="text-red-700 text-2xl font-medium">Failed to load data</p>
              <p className="text-gray-500 text-lg mt-2">{error}</p>
              <Button variant="outline" size="sm" className="mt-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => { setLoading(true); fetchHifzData(); }}>
                <RotateCcw className="w-4 h-4 ml-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : children.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-gray-200">
                <FileSpreadsheet className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-600 text-2xl">No published hifz reports yet</p>
              <p className="text-gray-500 text-lg mt-1">Your children's progress will appear here when the school publishes reports</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {children.map((child) => {
              const isExpanded = expandedChild === child.reportId;
              const summary = child.summary;
              const progress = summary.overallProgress;
              const achievement = getAchievementLevel(progress);

              return (
                <Card
                  key={child.reportId}
                  className="animate-fade-in border-0 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
                  style={{ borderColor: "#d4af3715" }}
                >
                  {/* Card Header with Fatimi gradient */}
                  <div className="h-1.5" style={{
                    background: progress >= 75 ? "linear-gradient(90deg, #059669, #d4af37)" :
                      progress >= 50 ? "linear-gradient(90deg, #2563eb, #d4af37)" :
                      progress >= 25 ? "linear-gradient(90deg, #6366f1, #d4af37)" :
                      "linear-gradient(90deg, #9ca3af, #d4af37)"
                  }} />

                  <CardContent className="p-6">
                    {/* Profile Section */}
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedChild(isExpanded ? null : child.reportId)}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Avatar + Name */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="relative flex-shrink-0">
                            <Avatar className="w-20 h-20 border-3" style={{ borderColor: "#d4af37" }}>
                              <AvatarFallback className="text-2xl font-bold" style={{ background: "linear-gradient(135deg, #047857, #065f46)", color: "#d4af37" }}>
                                {child.studentName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
                              <Award className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-xl truncate">{child.studentName}</h3>
                            <p className="text-base text-gray-500">
                              Grade {child.studentGrade}{child.studentSection} • {child.academicYear}
                            </p>
                            <span className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(child.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Progress + Stats */}
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <FatimiProgressRing progress={progress} size={120} strokeWidth={8} />
                          <div className="flex flex-col gap-2 flex-1 sm:flex-none">
                            <Badge className={`${achievement.color} ${achievement.bgColor} border ${achievement.border} text-sm w-fit`}>
                              <achievement.icon className="w-4 h-4 ml-1" />
                              {achievement.label}
                            </Badge>
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm w-fit">
                              <CheckCircle className="w-4 h-4 ml-1" />
                              {summary.completedParts} Completed
                            </Badge>
                            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-sm w-fit">
                              <Clock className="w-4 h-4 ml-1" />
                              {summary.inProgressParts} In Progress
                            </Badge>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-6 h-6 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-6 h-6 text-gray-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Points Bar */}
                      <div className="mt-3 flex items-center gap-4 py-3 px-4 rounded-lg" style={{ background: "linear-gradient(135deg, #fffbeb, #fef9c3)", border: "1px solid #fde68a" }}>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4" style={{ color: "#d4af37" }} />
                          <span className="text-sm text-gray-600">{child.currentPoints} Points</span>
                        </div>
                        <div className="w-px h-4 bg-amber-300" />
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm text-gray-600">{child.totalPoints} Total</span>
                        </div>
                      </div>
                    </div>

                    {/* Portal Links */}
                    <div className="mt-4 p-4 rounded-xl border" style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", borderColor: "#a7f3d0" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium" style={{ color: "#047857" }}>Portal Links</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/talabat/hifz?studentId=${child.studentId}`}
                          target="_blank"
                          className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-lg text-sm transition-colors border"
                          style={{ color: "#047857", borderColor: "#a7f3d0" }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Student Portal
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-3 text-sm"
                          style={{ color: "#b8860b" }}
                          onClick={() => copyStudentLink(child.studentId)}
                        >
                          {copiedLink === child.studentId ? (
                            <Check className="w-4 h-4 ml-1" />
                          ) : (
                            <Copy className="w-4 h-4 ml-1" />
                          )}
                          {copiedLink === child.studentId ? "Copied" : "Copy Link"}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Data Table */}
                    {isExpanded && child.parts.length > 0 && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: "#d1fae5" }}>
                        <h4 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: "#047857" }}>
                          <Calendar className="w-5 h-5" />
                          Part Details
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr style={{ background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)" }}>
                                <th className="py-3 px-4 text-right font-semibold border-b" style={{ color: "#047857", borderColor: "#a7f3d0" }}>Part</th>
                                <th className="py-3 px-4 text-right font-semibold border-b" style={{ color: "#047857", borderColor: "#a7f3d0" }}>Progress</th>
                                <th className="py-3 px-4 text-right font-semibold border-b" style={{ color: "#047857", borderColor: "#a7f3d0" }}>Pages</th>
                              </tr>
                            </thead>
                            <tbody>
                              {child.parts.map((part: any) => (
                                <tr key={part.partNumber} className="border-b hover:bg-gray-50/50" style={{ borderColor: "#f0fdf4" }}>
                                  <td className="py-3 px-4 font-medium">{part.partNumber}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 rounded-full h-1.5" style={{ background: "#d4af3720" }}>
                                        <div
                                          className="h-1.5 rounded-full"
                                          style={{
                                            width: `${part.progress}%`,
                                            background: "linear-gradient(90deg, #047857, #d4af37)"
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-600">{part.progress}%</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">{part.currentPage}/{part.totalPages}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 mt-4">
          <p className="text-sm text-gray-500">In the name of Allah, the Most Gracious, the Most Merciful</p>
        </div>
      </div>
    </div>
  );
}
