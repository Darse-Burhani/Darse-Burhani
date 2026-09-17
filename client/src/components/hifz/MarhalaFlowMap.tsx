"use client";

import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Users,
  UserCheck,
  Search,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  BookOpen,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Compass,
  CheckCircle2,
  Award,
  Eye,
  Info,
  X,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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
  facultyId: string;
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
}

interface StudentLeaf {
  assignment: FlowMapAssignment;
  name: string;
  arabicName?: string | null;
  its?: string | null;
  grade?: string | null;
  section?: string | null;
  avatarUrl?: string | null;
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
}: MarhalaFlowMapProps) {
  const [search, setSearch] = useState("");
  const [activeMarhalaFilter, setActiveMarhalaFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"3D_TREE" | "HIERARCHY_GRID">("3D_TREE");
  const [is3DTilted, setIs3DTilted] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [selectedLeaf, setSelectedLeaf] = useState<StudentLeaf | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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
                n.name.toLowerCase().includes(q)
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

  const toggleBranch = (key: string) => {
    setCollapsedBranches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => setCollapsedBranches({});
  const collapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    for (const m of MARHALA_ORDER) {
      collapsed[m] = true;
    }
    setCollapsedBranches(collapsed);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(0.65, prev + delta), 1.4));
  };

  const resetView = () => {
    setZoomLevel(1);
    setIs3DTilted(true);
    setActiveMarhalaFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-6 select-none">
      {/* ── Top Control & View Bar ── */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-4 sm:p-5 rounded-3xl text-white shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full opacity-15 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-300 via-emerald-400 to-transparent blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Title & Metadata */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>3D Sacred Tree of Quran Memorization</span>
              <span className="font-arabic text-amber-300/90 text-sm mr-1">شجرة الحفظ المباركة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Hifz Marhala Flow Tree</span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
                AY {academicYear}
              </Badge>
            </h2>
            <p className="text-xs text-emerald-100/70 max-w-xl">
              Interactive 3D tree visualizing the hierarchy from Marhala stage branches down to faculty Muhaffiz mentors and assigned Talabat huffaz leaves.
            </p>
          </div>

          {/* Quick Metrics & View Mode Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-xs font-semibold text-emerald-200">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>5 Stages</span>
              <span className="text-white/30">|</span>
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{totalMuhaffizCount} Mentors</span>
              <span className="text-white/30">|</span>
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{totalLeavesCount} Huffaz</span>
            </div>

            <div className="flex items-center gap-1 bg-white/10 backdrop-blur p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("3D_TREE")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                  viewMode === "3D_TREE"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>3D Tree Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("HIERARCHY_GRID")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                  viewMode === "HIERARCHY_GRID"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Hierarchy Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Row */}
        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          {/* Marhala Branch Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveMarhalaFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1",
                activeMarhalaFilter === "all"
                  ? "bg-amber-400 text-emerald-950 shadow-sm font-extrabold"
                  : "bg-white/10 text-emerald-100 hover:bg-white/15"
              )}
            >
              <span>Whole Tree</span>
              <span className="font-arabic">(كل المراحل)</span>
            </button>
            {MARHALA_ORDER.map((m) => {
              const color = marhalaColor(m);
              const isActive = activeMarhalaFilter === m;
              return (
                <button
                  key={m}
                  onClick={() => setActiveMarhalaFilter(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5",
                    isActive
                      ? `bg-gradient-to-r ${color.grad} text-white ring-2 ring-white/40 shadow-md`
                      : "bg-white/10 text-emerald-100 hover:bg-white/15"
                  )}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
                  <span>{MARHALA_LABELS_SHORT[m]}</span>
                  <span className="font-arabic text-[11px] opacity-80">{MARHALA_LABELS_AR[m]}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-emerald-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search talabat, ITS, muhaffiz..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-emerald-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* ── 3D Tree Canvas & Visual Interactive Space ── */}
      {viewMode === "3D_TREE" ? (
        <div className="relative bg-gradient-to-b from-slate-950 via-emerald-950/40 to-slate-950 rounded-3xl p-4 sm:p-8 border border-emerald-900/50 shadow-2xl overflow-hidden min-h-[700px] flex flex-col justify-between">
          {/* Atmospheric Ambient Glows */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/10 blur-[140px] pointer-events-none rounded-full" />

          {/* Canvas Floating Tools Overlay */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg text-white">
            <button
              type="button"
              onClick={() => setIs3DTilted(!is3DTilted)}
              className={cn(
                "p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all",
                is3DTilted
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white/10 text-slate-300 hover:text-white"
              )}
              title="Toggle 3D Isometric View"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">3D Angle</span>
            </button>
            <div className="w-px h-5 bg-white/20 mx-0.5" />
            <button
              type="button"
              onClick={() => handleZoom(0.1)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-200 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.1)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-200 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-200 hover:text-white"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/20 mx-0.5" />
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-slate-200"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-slate-200"
            >
              Collapse
            </button>
          </div>

          {/* ── 3D Viewport Transform Wrapper ── */}
          <div
            ref={containerRef}
            className="w-full flex-1 flex flex-col items-center justify-start py-8 transition-transform duration-500 ease-out"
            style={{
              perspective: "1400px",
              transform: `scale(${zoomLevel})`,
              transformOrigin: "top center",
            }}
          >
            {/* Inner 3D Pitch Container */}
            <div
              className={cn(
                "w-full max-w-6xl space-y-12 transition-all duration-700 ease-out",
                is3DTilted ? "rotate-x-[12deg] translate-y-4" : ""
              )}
              style={{
                transformStyle: "preserve-3d",
                transform: is3DTilted
                  ? "rotateX(14deg) rotateY(0deg) translateZ(10px)"
                  : "rotateX(0deg) rotateY(0deg)",
              }}
            >
              {/* ── ROOT NODE: Sacred Central Quranic Hifz Trunk ── */}
              <div className="flex flex-col items-center justify-center relative z-20">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative group cursor-pointer"
                >
                  {/* Glowing 3D Base Disk */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/30 via-emerald-500/40 to-teal-500/30 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500 animate-pulse" />

                  {/* 3D Root Podium Card */}
                  <div className="relative px-8 py-5 rounded-3xl bg-gradient-to-br from-emerald-900 via-[#034431] to-teal-950 border-2 border-amber-400/80 shadow-[0_25px_60px_-15px_rgba(4,120,87,0.7)] text-center text-white flex flex-col items-center gap-2 backdrop-blur-xl">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center text-emerald-950 shadow-lg shadow-amber-400/30 ring-4 ring-emerald-600/50">
                      <GraduationCap className="w-8 h-8 stroke-[2.2]" />
                    </div>

                    <div>
                      <span className="font-arabic text-amber-300 font-extrabold text-base tracking-wide">
                        شجرة حفظ القرآن الكريم المباركة
                      </span>
                      <h3 className="font-display font-extrabold text-xl text-white tracking-tight">
                        Holy Hifz Marhala Foundation Tree
                      </h3>
                      <p className="text-[11px] text-emerald-200/80 font-medium mt-0.5">
                        Academic Year {academicYear} · Complete Institutional Registry
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {totalLeavesCount} Registered Huffaz
                      </span>
                      <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {totalMuhaffizCount} Mentors
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Central Trunk Stem Connecting to Marhalas */}
                <div className="w-1 h-12 bg-gradient-to-b from-amber-400 via-emerald-400 to-emerald-600/70 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              </div>

              {/* ── 5 MARHALA BRANCHES (Tiered 3D Branch Architecture) ── */}
              <div className="space-y-10">
                {treeData.map(({ marhala, nodes, totalStudents }) => {
                  const color = marhalaColor(marhala);
                  const isCollapsed = collapsedBranches[marhala];

                  return (
                    <motion.div
                      key={marhala}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300"
                      style={{
                        boxShadow: `0 15px 35px -10px ${color.hex}25`,
                      }}
                    >
                      {/* Branch Header Bar (3D Marhala Plate) */}
                      <div
                        onClick={() => toggleBranch(marhala)}
                        className="px-6 py-4 flex items-center justify-between gap-4 cursor-pointer select-none text-white relative overflow-hidden transition-all hover:brightness-110"
                        style={{ background: color.gradCss }}
                      >
                        <div className="absolute right-0 top-0 w-64 h-full bg-white/10 blur-xl pointer-events-none" />

                        {/* Stage Info */}
                        <div className="flex items-center gap-3.5 min-w-0 z-10">
                          <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 backdrop-blur flex items-center justify-center shrink-0 shadow-inner">
                            <BookOpen className="w-6 h-6 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-display font-bold text-lg text-white tracking-tight">
                                {MARHALA_LABELS[marhala]}
                              </h4>
                              <span className="font-arabic font-bold text-sm text-white/90">
                                ({MARHALA_LABELS_AR[marhala]})
                              </span>
                            </div>
                            <p className="text-xs text-white/80 font-medium">
                              {nodes.length} Muhaffiz Mentors · {totalStudents} Assigned Hafiz Talabat
                            </p>
                          </div>
                        </div>

                        {/* Status Pills & Toggle */}
                        <div className="flex items-center gap-3 z-10 shrink-0">
                          <Badge className="bg-black/30 text-white border-0 text-xs font-bold px-3 py-1">
                            {totalStudents} Huffaz
                          </Badge>
                          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white">
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* ── Muhaffiz Pods & Student Leaves Area ── */}
                      {!isCollapsed && (
                        <div className="p-6 bg-slate-950/60 space-y-6">
                          {nodes.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs">
                              No students or muhaffiz faculty assigned under this marhala stage yet.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                              {nodes.map((node) => {
                                const isUnassigned = node.facultyId === "__unassigned__";

                                return (
                                  <div
                                    key={`${marhala}-${node.facultyId}`}
                                    className="rounded-2xl bg-slate-900/90 border border-emerald-900/40 hover:border-emerald-500/50 shadow-lg p-4 space-y-3 transition-all duration-300 hover:shadow-emerald-900/20"
                                  >
                                    {/* Muhaffiz Mentor Capsule Header with Profile Picture */}
                                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <Avatar className="w-10 h-10 rounded-xl ring-2 ring-emerald-400/40 shrink-0 shadow-md">
                                          {node.avatarUrl && <AvatarImage src={node.avatarUrl} alt={node.name} className="object-cover" />}
                                          <AvatarFallback
                                            className={cn(
                                              "w-full h-full font-bold text-white text-xs flex items-center justify-center",
                                              isUnassigned ? "bg-amber-600/80" : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                            )}
                                          >
                                            {isUnassigned ? <Info className="w-5 h-5 text-white" /> : node.name.charAt(0)}
                                          </AvatarFallback>
                                        </Avatar>

                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <p className="font-bold text-sm text-white truncate">
                                              {node.name}
                                            </p>
                                            <span className="font-arabic text-[11px] text-emerald-400 font-bold shrink-0">
                                              (المُحَفِّظ)
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-400 truncate">
                                            {node.department || (isUnassigned ? "Awaiting Mentor" : "Faculty Mentor")}
                                          </p>
                                        </div>
                                      </div>

                                      <Badge
                                        variant="outline"
                                        className="bg-emerald-950/60 text-emerald-300 border-emerald-700/50 text-[10px] font-bold px-2 py-0.5 shrink-0"
                                      >
                                        {node.leaves.length} Talabat
                                      </Badge>
                                    </div>

                                    {/* Assigned Talabat Leaves Container with Profile Pictures */}
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-emerald-900">
                                      {node.leaves.map((leaf) => (
                                        <div
                                          key={leaf.assignment.id}
                                          onClick={() => setSelectedLeaf(leaf)}
                                          className="group/leaf cursor-pointer p-2.5 rounded-xl bg-slate-800/70 hover:bg-emerald-950/80 border border-white/5 hover:border-emerald-500/40 transition-all duration-200 flex items-center justify-between gap-2.5"
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            {/* Talabat Leaf Profile Picture */}
                                            <Avatar className="w-8 h-8 rounded-lg shrink-0 ring-1 ring-white/10 group-hover/leaf:ring-amber-400/50 transition-all">
                                              {leaf.avatarUrl && <AvatarImage src={leaf.avatarUrl} alt={leaf.name} className="object-cover" />}
                                              <AvatarFallback
                                                className={cn(
                                                  "w-full h-full text-white font-extrabold text-xs flex items-center justify-center",
                                                  color.solid
                                                )}
                                              >
                                                {leaf.name.charAt(0)}
                                              </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                              <p className="font-semibold text-xs text-slate-100 group-hover/leaf:text-amber-300 transition-colors truncate">
                                                {leaf.name}
                                              </p>
                                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                {leaf.its && (
                                                  <span className="font-mono text-emerald-300/80">
                                                    ITS {leaf.its}
                                                  </span>
                                                )}
                                                {leaf.grade && (
                                                  <span>· Gr. {leaf.grade}{leaf.section || ""}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-bold text-amber-400 group-hover/leaf:underline flex items-center gap-0.5">
                                              <span>View</span>
                                              <ChevronRight className="w-3 h-3" />
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── HIERARCHY GRID VIEW (Dense 3D Stage Cards with Profile Pictures) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {treeData.map(({ marhala, nodes, totalStudents }) => {
            const color = marhalaColor(marhala);

            return (
              <div
                key={marhala}
                className="bg-white rounded-3xl border border-gray-200 hover:border-emerald-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div
                    className="p-5 text-white flex items-center justify-between"
                    style={{ background: color.gradCss }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white leading-tight">
                          {MARHALA_LABELS[marhala]}
                        </h3>
                        <p className="text-xs text-white/80 font-arabic">{MARHALA_LABELS_AR[marhala]}</p>
                      </div>
                    </div>
                    <Badge className="bg-white text-gray-900 border-0 text-xs font-bold px-2.5 py-1">
                      {totalStudents} Huffaz
                    </Badge>
                  </div>

                  {/* Muhaffiz List with Profile Pictures */}
                  <div className="p-4 space-y-4">
                    {nodes.map((node) => (
                      <div key={node.facultyId} className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-7 h-7 rounded-lg shrink-0">
                              {node.avatarUrl && <AvatarImage src={node.avatarUrl} alt={node.name} className="object-cover" />}
                              <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                {node.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <p className="font-bold text-xs text-gray-900 truncate">{node.name}</p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                            {node.leaves.length} students
                          </span>
                        </div>

                        {/* Student Chips with Mini Avatars */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {node.leaves.map((leaf) => (
                            <button
                              key={leaf.assignment.id}
                              onClick={() => setSelectedLeaf(leaf)}
                              className="px-2 py-1 rounded-lg bg-white border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-[11px] font-semibold text-gray-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                            >
                              <Avatar className="w-4 h-4 rounded-full shrink-0">
                                {leaf.avatarUrl && <AvatarImage src={leaf.avatarUrl} alt={leaf.name} className="object-cover" />}
                                <AvatarFallback className="bg-emerald-700 text-white font-bold text-[8px]">
                                  {leaf.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{leaf.name}</span>
                              {leaf.its && <span className="text-[9px] text-gray-400 font-mono">{leaf.its}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                  <span>Mentors: <strong>{nodes.length}</strong></span>
                  <span>Total Talabat: <strong>{totalStudents}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Student Leaf Inspection Drawer / Modal with Profile Picture ── */}
      {selectedLeaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header with Talabat Profile Photo */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <Avatar className="w-14 h-14 rounded-2xl ring-2 ring-amber-400/60 shadow-lg shrink-0">
                  {selectedLeaf.avatarUrl && <AvatarImage src={selectedLeaf.avatarUrl} alt={selectedLeaf.name} className="object-cover" />}
                  <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-200 text-emerald-950 font-extrabold text-xl">
                    {selectedLeaf.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-base text-white">{selectedLeaf.name}</h3>
                  <p className="text-xs text-emerald-200">Hafiz Talib · Dar-e-Burhani Hifz Tree</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaf(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200 text-gray-700">
                <div>
                  <span className="text-gray-400 font-semibold block uppercase text-[10px]">Assigned Marhala</span>
                  <p className="font-bold text-emerald-900 text-sm mt-0.5">
                    {MARHALA_LABELS_SHORT[selectedLeaf.assignment.marhala]}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block uppercase text-[10px]">ITS Number</span>
                  <p className="font-bold text-gray-900 text-sm mt-0.5 font-mono">
                    {selectedLeaf.its || "—"}
                  </p>
                </div>
              </div>

              {/* Muhaffiz Mentor Profile Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <span className="text-emerald-800 font-semibold text-[10px] uppercase tracking-wide">
                  Assigned Muhaffiz (Mentor)
                </span>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 rounded-xl ring-1 ring-emerald-300 shrink-0">
                    {(selectedLeaf.assignment.faculty?.user?.avatarUrl || selectedLeaf.assignment.faculty?.photoUrl) && (
                      <AvatarImage
                        src={selectedLeaf.assignment.faculty?.user?.avatarUrl || selectedLeaf.assignment.faculty?.photoUrl}
                        alt="Teacher"
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-emerald-200 text-emerald-900 font-bold text-xs">
                      {fullName(selectedLeaf.assignment.faculty?.user)?.charAt(0) || "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-950 text-sm truncate">
                      {fullName(selectedLeaf.assignment.faculty?.user) || "Primary Teacher"}
                    </p>
                    <p className="text-[11px] text-emerald-700 truncate">
                      {selectedLeaf.assignment.faculty?.department || "Hifz Faculty Department"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                <span className="text-amber-800 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Quran Memorization Stage Scope
                </span>
                <p className="font-semibold text-amber-950 text-xs">
                  {MARHALA_LABELS[selectedLeaf.assignment.marhala]}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLeaf(null)}
                className="rounded-xl text-xs font-bold"
              >
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
