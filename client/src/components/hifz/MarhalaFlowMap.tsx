"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserCheck,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Sparkles,
  Layers,
  RotateCcw,
  Compass,
  Award,
  Info,
  X,
  Flame,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Route,
  TreeDeciduous,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import MarhalaTree3D from "@/components/hifz/MarhalaTree3D";
import {
  MARHALA_ORDER,
  MARHALA_LABELS,
  MARHALA_LABELS_AR,
  MARHALA_LABELS_SHORT,
  marhalaColor,
  fullName,
  defaultAcademicYear,
} from "@/lib/hifz-marhala";

export interface FlowMapAssignment {
  id: string;
  studentId: string;
  marhala: string;
  facultyId: string | null;
  musaidId?: string | null;
  musaidStudentId?: string | null;
  isActive?: boolean;
  student?: any; // StudentProfile incl. user
  faculty?: any; // TeacherProfile incl. user
  musaid?: any;
  musaidStudent?: any;
}

interface MarhalaFlowMapProps {
  assignments: FlowMapAssignment[];
  teacherProfileId?: string;
  academicYear?: string;
  loading?: boolean;
}

interface StudentLeaf {
  assignment: FlowMapAssignment;
  name: string;
  arabicName?: string | null;
  its?: string | null;
  grade?: string | null;
  section?: string | null;
  avatarUrl?: string | null;
  currentPoints?: number;
  tier?: string;
}

interface MuhaffizNode {
  facultyId: string;
  name: string;
  department?: string | null;
  employeeId?: string | null;
  avatarUrl?: string | null;
  leaves: StudentLeaf[];
}

export default function MarhalaFlowMap({
  assignments,
  teacherProfileId,
  academicYear = defaultAcademicYear(),
  loading = false,
}: MarhalaFlowMapProps) {
  const [search, setSearch] = useState("");
  const [activeMarhalaFilter, setActiveMarhalaFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"INTERACTIVE_TREE" | "3D_TREE" | "HIERARCHY_GRID">("INTERACTIVE_TREE");
  const [collapsedMuhaffiz, setCollapsedMuhaffiz] = useState<Record<string, boolean>>({});
  const [selectedMarhala, setSelectedMarhala] = useState<string | null>("MARHALA_4");
  const [selectedLeaf, setSelectedLeaf] = useState<StudentLeaf | null>(null);
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);
  const [webglOK, setWebglOK] = useState(true);

  // Check WebGL support for 3D Tree
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const ok = !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl"))
      );
      setWebglOK(ok);
    } catch {
      setWebglOK(false);
    }
  }, []);

  // Modal ergonomics: Esc closes, locks scroll
  useEffect(() => {
    if (!selectedLeaf) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedLeaf(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selectedLeaf]);

  const active = useMemo(() => assignments.filter((a) => a.isActive !== false), [assignments]);

  // Build the hierarchical tree data structure
  const treeData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byMarhala = new Map<string, Map<string, MuhaffizNode>>();

    for (const marhala of MARHALA_ORDER) {
      byMarhala.set(marhala, new Map());
    }

    for (const a of active) {
      const marhala = a.marhala;
      if (!byMarhala.has(marhala)) byMarhala.set(marhala, new Map());
      const muhaffizMap = byMarhala.get(marhala)!;

      const facultyId = a.facultyId || "__unassigned__";
      if (!muhaffizMap.has(facultyId)) {
        const f = a.faculty;
        muhaffizMap.set(facultyId, {
          facultyId,
          name: fullName(f?.user) || (facultyId === "__unassigned__" ? "Unassigned Pool" : "Muhaffiz Faculty"),
          department: f?.department || null,
          employeeId: f?.employeeId || null,
          avatarUrl: f?.user?.avatarUrl || f?.photoUrl || null,
          leaves: [],
        });
      }
      const node = muhaffizMap.get(facultyId)!;
      node.leaves.push({
        assignment: a,
        name: fullName(a.student?.user) || "Talib",
        arabicName: (a.student as any)?.nameAr || null,
        its: a.student?.its || a.student?.studentId || null,
        grade: a.student?.grade || null,
        section: a.student?.section || null,
        avatarUrl: a.student?.user?.avatarUrl || null,
        currentPoints: a.student?.currentPoints || 0,
        tier: a.student?.tier || "BRONZE",
      });
    }

    const result: { marhala: string; nodes: MuhaffizNode[]; totalStudents: number }[] = [];
    for (const marhala of MARHALA_ORDER) {
      let nodes = [...(byMarhala.get(marhala)?.values() || [])];
      if (teacherProfileId) {
        nodes = nodes.filter((n) => n.facultyId === teacherProfileId);
      }
      if (activeMarhalaFilter !== "all" && marhala !== activeMarhalaFilter) continue;

      if (q) {
        nodes = nodes
          .map((n) => ({
            ...n,
            leaves: n.leaves.filter(
              (l) =>
                l.name.toLowerCase().includes(q) ||
                (l.its || "").toLowerCase().includes(q) ||
                n.name.toLowerCase().includes(q) ||
                (l.arabicName || "").includes(q)
            ),
          }))
          .filter((n) => n.leaves.length > 0 || n.name.toLowerCase().includes(q));
      }

      nodes.sort((a, b) => a.name.localeCompare(b.name));
      const totalStudents = nodes.reduce((sum, n) => sum + n.leaves.length, 0);
      result.push({ marhala, nodes, totalStudents });
    }

    return result;
  }, [active, search, activeMarhalaFilter, teacherProfileId]);

  const totalLeavesCount = useMemo(
    () => treeData.reduce((sum, m) => sum + m.nodes.reduce((s, n) => s + n.leaves.length, 0), 0),
    [treeData]
  );
  const totalMuhaffizCount = useMemo(
    () => treeData.reduce((sum, m) => sum + m.nodes.length, 0),
    [treeData]
  );

  // Revealed active Marhala branch
  const revealed = treeData.find((m) => m.marhala === selectedMarhala) ?? treeData[0] ?? null;
  const revealedUnassigned =
    revealed?.nodes.find((n) => n.facultyId === "__unassigned__")?.leaves.length ?? 0;

  // Branches for 3D View
  const tree3DBranches = useMemo(
    () =>
      treeData.map(({ marhala, nodes, totalStudents }) => ({
        marhala,
        shortLabel: MARHALA_LABELS_SHORT[marhala] ?? marhala,
        totalStudents,
        unassigned: nodes.find((n) => n.facultyId === "__unassigned__")?.leaves.length ?? 0,
        colorHex: marhalaColor(marhala).hex,
      })),
    [treeData]
  );

  const toggleMuhaffiz = (key: string) => {
    setCollapsedMuhaffiz((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectPill = (m: string) => {
    setActiveMarhalaFilter(m);
    if (m !== "all") setSelectedMarhala(m);
  };

  const clearAll = () => {
    setSelectedMarhala("MARHALA_4");
    setCollapsedMuhaffiz({});
    setActiveMarhalaFilter("all");
    setSearch("");
  };

  // Branch layout coordinates for interactive 2.5D SVG Tree
  const branchCoords: Record<string, { x: number; y: number; angle: string; label: string; juz: string }> = {
    MARHALA_4: { x: 180, y: 190, angle: "-35deg", label: "Marhala 4", juz: "Juz 19–24" },
    MARHALA_5: { x: 300, y: 110, angle: "-18deg", label: "Marhala 5", juz: "Juz 25–30" },
    MARHALA_6: { x: 500, y: 80, angle: "0deg", label: "Marhala 6", juz: "Juz 1–10" },
    MARHALA_7: { x: 700, y: 110, angle: "18deg", label: "Marhala 7", juz: "Juz 11–18" },
    MARHALA_8: { x: 820, y: 190, angle: "35deg", label: "Marhala 8", juz: "Khatam Al-Quran" },
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Controller ── */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-5 sm:p-6 rounded-3xl text-white shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full opacity-20 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-300 via-emerald-400 to-transparent blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Title & Quranic Banner */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Sacred Quran Memorization Tree</span>
              <span className="font-arabic text-amber-300/90 text-sm mr-1">شجرة الحفظ المباركة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Hifz Marhala Tree</span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
                AY {academicYear}
              </Badge>
            </h2>
            <p className="text-xs text-emerald-100/70 max-w-xl">
              Explore the living Quran tree from root to bough. Click any Marhala branch to inspect muhaffiz mentors and talabat.
            </p>
          </div>

          {/* Quick Metrics & View Mode Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/10 text-xs font-semibold text-emerald-200">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>5 Stages</span>
              <span className="text-white/30">|</span>
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{totalMuhaffizCount} Mentors</span>
              <span className="text-white/30">|</span>
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{totalLeavesCount} Huffaz</span>
            </div>

            <div className="flex items-center gap-1 bg-white/10 backdrop-blur p-1 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("INTERACTIVE_TREE")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                  viewMode === "INTERACTIVE_TREE"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                <TreeDeciduous className="w-3.5 h-3.5 text-amber-300" />
                <span>Living Tree</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("3D_TREE")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                  viewMode === "3D_TREE"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>3D Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("HIERARCHY_GRID")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                  viewMode === "HIERARCHY_GRID"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bento Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          {/* Marhala Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => selectPill("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1",
                activeMarhalaFilter === "all"
                  ? "bg-amber-400 text-emerald-950 shadow-sm font-extrabold"
                  : "bg-white/10 text-emerald-100 hover:bg-white/15"
              )}
            >
              <span>Whole Tree</span>
              <span className="font-arabic">(شجرة الحفظ)</span>
            </button>
            {MARHALA_ORDER.map((m) => {
              const color = marhalaColor(m);
              const isActive = activeMarhalaFilter === m || selectedMarhala === m;
              const count = treeData.find((t) => t.marhala === m)?.totalStudents || 0;
              return (
                <button
                  key={m}
                  onClick={() => selectPill(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5",
                    isActive
                      ? `bg-gradient-to-r ${color.grad} text-white ring-2 ring-white/40 shadow-md`
                      : "bg-white/10 text-emerald-100 hover:bg-white/15"
                  )}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
                  <span>{MARHALA_LABELS_SHORT[m]}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-emerald-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search huffaz, ITS, muhaffiz..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-emerald-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-200/60 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================= VIEW MODE 1: INTERACTIVE LIVING TREE ======================= */}
      {viewMode === "INTERACTIVE_TREE" && (
        <div className="space-y-6">
          {/* Tree Visualization Stage */}
          <div className="relative bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 rounded-3xl border border-emerald-900/40 shadow-2xl overflow-hidden p-6 text-white min-h-[460px] flex flex-col justify-between">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[260px] bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

            {/* Tree Stage Top Bar */}
            <div className="relative z-20 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-emerald-300 uppercase tracking-wider text-[11px]">
                  Interactive Canopy Display
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-8 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Canopy
              </Button>
            </div>

            {/* Interactive SVG Tree Canvas */}
            <div className="relative z-10 w-full max-w-5xl mx-auto my-4 py-4 select-none">
              <svg viewBox="0 0 1000 420" className="w-full h-auto overflow-visible drop-shadow-2xl">
                <defs>
                  {/* Gradients */}
                  <linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#451a03" />
                    <stop offset="60%" stopColor="#78350f" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <linearGradient id="branchGold" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Roots & Base */}
                <path
                  d="M 460 410 C 480 390, 500 370, 500 330 C 500 370, 520 390, 540 410 Z"
                  fill="url(#trunkGrad)"
                  opacity="0.8"
                />

                {/* Central Trunk */}
                <path
                  d="M 475 350 C 475 280, 485 240, 500 190 C 515 240, 525 280, 525 350 Z"
                  fill="url(#trunkGrad)"
                />

                {/* Tree Boughs (Connecting to each Marhala) */}
                {/* Branch 4 (Far Left) */}
                <path
                  d="M 500 230 C 420 230, 280 230, 180 190"
                  fill="none"
                  stroke={selectedMarhala === "MARHALA_4" ? "#38bdf8" : "#059669"}
                  strokeWidth={selectedMarhala === "MARHALA_4" ? 6 : 3.5}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                {/* Branch 5 (Mid Left) */}
                <path
                  d="M 500 210 C 440 180, 360 140, 300 110"
                  fill="none"
                  stroke={selectedMarhala === "MARHALA_5" ? "#34d399" : "#059669"}
                  strokeWidth={selectedMarhala === "MARHALA_5" ? 6 : 3.5}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                {/* Branch 6 (Center Apex) */}
                <path
                  d="M 500 190 C 500 150, 500 120, 500 80"
                  fill="none"
                  stroke={selectedMarhala === "MARHALA_6" ? "#fbbf24" : "#059669"}
                  strokeWidth={selectedMarhala === "MARHALA_6" ? 6 : 3.5}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                {/* Branch 7 (Mid Right) */}
                <path
                  d="M 500 210 C 560 180, 640 140, 700 110"
                  fill="none"
                  stroke={selectedMarhala === "MARHALA_7" ? "#a855f7" : "#059669"}
                  strokeWidth={selectedMarhala === "MARHALA_7" ? 6 : 3.5}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                {/* Branch 8 (Far Right) */}
                <path
                  d="M 500 230 C 580 230, 720 230, 820 190"
                  fill="none"
                  stroke={selectedMarhala === "MARHALA_8" ? "#f59e0b" : "#059669"}
                  strokeWidth={selectedMarhala === "MARHALA_8" ? 6 : 3.5}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />

                {/* Trunk Sacred Seal */}
                <g transform="translate(500, 320)">
                  <rect
                    x="-80"
                    y="-25"
                    width="160"
                    height="50"
                    rx="16"
                    fill="#1e293b"
                    stroke="#d97706"
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="-3"
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="serif"
                  >
                    DARSE BURHANI
                  </text>
                  <text
                    x="0"
                    y="14"
                    textAnchor="middle"
                    fill="#a7f3d0"
                    fontSize="10"
                    fontFamily="sans-serif"
                  >
                    شجرة الحفظ المباركة
                  </text>
                </g>
              </svg>

              {/* Interactive Marhala Bough Nodes (HTML Overlaid on SVG Coords) */}
              <div className="absolute inset-0 pointer-events-none">
                {MARHALA_ORDER.map((m) => {
                  const coords = branchCoords[m];
                  if (!coords) return null;
                  const color = marhalaColor(m);
                  const isSelected = selectedMarhala === m;
                  const isHovered = hoveredBranch === m;
                  const branchData = treeData.find((t) => t.marhala === m);
                  const studentsCount = branchData?.totalStudents || 0;
                  const mentorsCount = branchData?.nodes.length || 0;

                  // Convert SVG 1000x420 to percentage
                  const leftPercent = (coords.x / 1000) * 100;
                  const topPercent = (coords.y / 420) * 100;

                  return (
                    <div
                      key={m}
                      style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedMarhala(m)}
                        onMouseEnter={() => setHoveredBranch(m)}
                        onMouseLeave={() => setHoveredBranch(null)}
                        className={`group relative flex flex-col items-center p-3 sm:p-4 rounded-3xl backdrop-blur-xl border transition-all duration-300 ${
                          isSelected
                            ? "bg-slate-900/90 border-amber-400 ring-4 ring-amber-400/30 shadow-2xl scale-110 z-30"
                            : "bg-slate-900/70 border-white/20 hover:border-emerald-400 hover:scale-105 z-20"
                        }`}
                      >
                        {/* Glow indicator */}
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg mb-2 transition-transform duration-300 ${
                            isSelected ? "scale-110" : "group-hover:scale-105"
                          }`}
                          style={{ background: color.gradCss }}
                        >
                          <BookOpen className="w-5 h-5" />
                        </div>

                        {/* Stage Name */}
                        <p className="text-xs font-bold text-white whitespace-nowrap">{coords.label}</p>
                        <p className="text-[10px] text-amber-300/90 font-mono font-medium">{coords.juz}</p>

                        {/* Counts Pill */}
                        <div className="flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] text-emerald-300 font-semibold">
                          <span>{studentsCount} Huffaz</span>
                          <span className="text-white/30">•</span>
                          <span>{mentorsCount} Mentors</span>
                        </div>

                        {/* Active Selection Pulse */}
                        {isSelected && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tree Bottom Legend */}
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-[11px] text-emerald-200/80">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Stage Progression:</span>
                <span>Juz 19–24 $\rightarrow$ Juz 25–30 $\rightarrow$ Juz 1–10 $\rightarrow$ Juz 11–18 $\rightarrow$ Complete Quran 👑</span>
              </div>
              <div>
                Click a Marhala bough above to reveal assigned muhaffiz mentors & talabat below.
              </div>
            </div>
          </div>

          {/* ── Revealed Marhala Foliage (Mentors & Talabat Leaves) ── */}
          <AnimatePresence mode="wait">
            {revealed && (
              <motion.div
                key={revealed.marhala}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
              >
                {/* Stage Header Banner */}
                <div
                  className="p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  style={{ background: marhalaColor(revealed.marhala).gradCss }}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                      <BookOpen className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg sm:text-xl text-white flex items-center gap-2">
                        {MARHALA_LABELS[revealed.marhala]}
                        <span className="font-arabic text-base opacity-90">({MARHALA_LABELS_AR[revealed.marhala]})</span>
                      </h3>
                      <p className="text-xs text-white/90 font-medium mt-0.5">
                        {revealed.nodes.length} Muhaffiz Mentors • {revealed.totalStudents} Active Huffaz
                      </p>
                    </div>
                  </div>

                  {revealedUnassigned > 0 && (
                    <Badge className="bg-amber-400 text-slate-950 font-bold px-3 py-1 text-xs border-0 self-start sm:self-auto">
                      <Info className="w-3.5 h-3.5 mr-1" /> {revealedUnassigned} Awaiting Mentor Assignment
                    </Badge>
                  )}
                </div>

                {/* Mentors Deck & Talabat Leaves */}
                <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {revealed.nodes.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400">
                      <p className="text-sm font-semibold">No students currently assigned to this stage.</p>
                    </div>
                  ) : (
                    revealed.nodes.map((node) => {
                      const isUnassigned = node.facultyId === "__unassigned__";
                      const muKey = `${revealed.marhala}::${node.facultyId}`;
                      const muCollapsed = collapsedMuhaffiz[muKey];

                      return (
                        <div
                          key={muKey}
                          className={`rounded-2xl border transition-all overflow-hidden ${
                            isUnassigned
                              ? "border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
                          }`}
                        >
                          {/* Mentor Node Header */}
                          <button
                            type="button"
                            onClick={() => toggleMuhaffiz(muKey)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/80 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="w-10 h-10 rounded-xl ring-2 ring-emerald-500/30 shrink-0">
                                {node.avatarUrl && <AvatarImage src={node.avatarUrl} alt={node.name} className="object-cover" />}
                                <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">
                                  {node.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {node.name}
                                  {!isUnassigned && (
                                    <span className="font-arabic text-xs text-emerald-600 dark:text-emerald-400 ml-1.5">
                                      (المُحَفِّظ)
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {node.department || (isUnassigned ? "Unassigned Roster" : "Faculty Mentor")}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-xs font-bold bg-white dark:bg-slate-900">
                                {node.leaves.length} Huffaz
                              </Badge>
                              {muCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* Talabat Leaf Clusters */}
                          {!muCollapsed && (
                            <div className="p-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                              {node.leaves.map((leaf) => (
                                <button
                                  key={leaf.assignment.id}
                                  type="button"
                                  onClick={() => setSelectedLeaf(leaf)}
                                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 hover:shadow-sm transition-all text-left group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar className="w-8 h-8 rounded-lg shrink-0 ring-1 ring-slate-200 dark:ring-slate-700">
                                      {leaf.avatarUrl && <AvatarImage src={leaf.avatarUrl} alt={leaf.name} className="object-cover" />}
                                      <AvatarFallback className="bg-emerald-700 text-white font-bold text-xs">
                                        {leaf.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                        {leaf.name}
                                        {leaf.arabicName && (
                                          <span className="font-arabic font-normal text-slate-400 ml-1.5 text-[11px]">
                                            {leaf.arabicName}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        ITS {leaf.its || "—"} • Grade {leaf.grade || "—"} ({leaf.section || "—"})
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                      {leaf.currentPoints} pts
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ======================= VIEW MODE 2: 3D CANVAS ======================= */}
      {viewMode === "3D_TREE" && (
        <div className="relative bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 rounded-3xl border border-emerald-900/40 shadow-2xl overflow-hidden p-4 min-h-[500px]">
          {webglOK ? (
            <div className="h-[480px] w-full select-none">
              <MarhalaTree3D
                branches={tree3DBranches}
                selected={revealed?.marhala ?? null}
                onSelect={setSelectedMarhala}
                academicYear={academicYear}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-white text-center">
              <p className="text-base font-bold">3D Canvas Unavailable</p>
              <p className="text-xs text-slate-400 mt-1">Please use the Living Tree view on this device.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================= VIEW MODE 3: BENTO GRID ======================= */}
      {viewMode === "HIERARCHY_GRID" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {treeData.map(({ marhala, nodes, totalStudents }) => {
            const color = marhalaColor(marhala);
            return (
              <div
                key={marhala}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="p-5 text-white flex items-center justify-between" style={{ background: color.gradCss }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white">{MARHALA_LABELS[marhala]}</h3>
                        <p className="text-xs text-white/80">{totalStudents} Huffaz Enrolled</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {nodes.map((node) => (
                      <div key={node.facultyId} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                        <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                          <span>{node.name}</span>
                          <span className="text-emerald-600 font-normal">{node.leaves.length} students</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {node.leaves.slice(0, 5).map((l) => (
                            <span key={l.assignment.id} className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                              {l.name}
                            </span>
                          ))}
                          {node.leaves.length > 5 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-slate-400 font-bold">
                              +{node.leaves.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================= MODAL: TALIB HIFZ DOSSIER ======================= */}
      <AnimatePresence>
        {selectedLeaf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white"
            >
              {/* Dossier Header */}
              <div
                className="p-6 text-white relative"
                style={{ background: marhalaColor(selectedLeaf.assignment.marhala).gradCss }}
              >
                <button
                  onClick={() => setSelectedLeaf(null)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full bg-black/20"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 rounded-2xl border-2 border-white/40 shadow-lg shrink-0">
                    {selectedLeaf.avatarUrl && (
                      <AvatarImage src={selectedLeaf.avatarUrl} alt={selectedLeaf.name} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-emerald-800 text-white font-bold text-lg">
                      {selectedLeaf.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight">{selectedLeaf.name}</h3>
                    {selectedLeaf.arabicName && (
                      <p className="font-arabic text-sm text-emerald-100 font-semibold">{selectedLeaf.arabicName}</p>
                    )}
                    <p className="text-xs text-white/80 font-mono mt-0.5">
                      ITS: {selectedLeaf.its || "—"} • Grade {selectedLeaf.grade} ({selectedLeaf.section})
                    </p>
                  </div>
                </div>
              </div>

              {/* Dossier Content */}
              <div className="p-6 space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-[11px] text-slate-500">Current Stage</p>
                    <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {MARHALA_LABELS_SHORT[selectedLeaf.assignment.marhala] || selectedLeaf.assignment.marhala}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-[11px] text-slate-500">Point Score</p>
                    <p className="font-bold text-sm text-amber-500 mt-0.5">
                      {selectedLeaf.currentPoints} pts ({selectedLeaf.tier})
                    </p>
                  </div>
                </div>

                {/* Muhaffiz Mentor */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-slate-400">Assigned Muhaffiz</p>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                      {fullName(selectedLeaf.assignment.faculty?.user) || "Awaiting Assignment"}
                    </p>
                  </div>
                  <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => setSelectedLeaf(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
