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
  const [viewMode, setViewMode] = useState<"3D_TREE" | "HIERARCHY_GRID">("3D_TREE");
  const [collapsedMuhaffiz, setCollapsedMuhaffiz] = useState<Record<string, boolean>>({});
  const [selectedMarhala, setSelectedMarhala] = useState<string | null>(null);
  const [selectedLeaf, setSelectedLeaf] = useState<StudentLeaf | null>(null);
  const [webglOK, setWebglOK] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // WebGL is required for the 3D tree — fall back to selectable branches otherwise.
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

  // Modal ergonomics: Esc closes, background scroll locks while open.
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

  // The revealed marhala: explicit selection, else the first visible branch.
  const revealed = treeData.find((m) => m.marhala === selectedMarhala) ?? treeData[0] ?? null;
  const revealedUnassigned =
    revealed?.nodes.find((n) => n.facultyId === "__unassigned__")?.leaves.length ?? 0;

  // Branches for the real 3D tree (trunk = Darse Burhani, fruits = marhalas).
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
    setSelectedMarhala(null);
    setCollapsedMuhaffiz({});
    setActiveMarhalaFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-6">
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
              Click a marhala fruit on the tree to reveal its muhaffiz mentors and talabat leaves.
            </p>
          </div>

          {/* Quick Metrics & View Mode Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-xs font-semibold text-emerald-200">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>{MARHALA_ORDER.length} Stages</span>
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
                <span>Tree View</span>
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
                <span>Grid View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Row */}
        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          {/* Marhala Branch Filter Pills */}
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
              <span className="font-arabic">(كل المراحل)</span>
            </button>
            {MARHALA_ORDER.map((m) => {
              const color = marhalaColor(m);
              const isActive = activeMarhalaFilter === m;
              return (
                <button
                  key={m}
                  onClick={() => selectPill(m)}
                  aria-pressed={isActive}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5",
                    isActive
                      ? `bg-gradient-to-r ${color.grad} text-white ring-2 ring-white/40 shadow-md [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]`
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
            <Search className="w-3.5 h-3.5 text-emerald-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search talabat, ITS, muhaffiz..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search talabat, ITS or muhaffiz"
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-emerald-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-200/60 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Living Tree Canvas + Reveal Panel ── */}
      {viewMode === "3D_TREE" ? (
        <div className="space-y-5">
          <div className="relative bg-gradient-to-b from-sky-50 via-emerald-50/70 to-stone-100 rounded-3xl border border-emerald-900/15 shadow-xl overflow-hidden">
            {/* Ambient light wash */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-emerald-200/40 blur-[100px] pointer-events-none rounded-full" />
            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-amber-200/40 blur-[120px] pointer-events-none rounded-full" />

            {/* Reset */}
            <div className="absolute top-4 right-4 z-30">
              <button
                type="button"
                onClick={clearAll}
                aria-label="Reset tree view"
                className="p-2 rounded-xl bg-white/85 backdrop-blur-md border border-gray-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 shadow-sm transition-colors"
                title="Reset tree view"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div
              ref={containerRef}
              role="img"
              aria-label={`Interactive 3D Hifz tree, ${totalLeavesCount} students across ${treeData.length} marhala stages. Use the marhala pills above to explore each stage.`}
              className="relative z-10 h-[440px] sm:h-[500px] select-none"
            >
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" aria-label="Loading tree">
                  <div className="flex items-end gap-3">
                    {[10, 20, 13, 24, 35].map((h, i) => (
                      <div
                        key={i}
                        className="w-10 rounded-t-xl bg-emerald-200/70 animate-pulse"
                        style={{ height: `${h * 6}px`, animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-slate-500">Growing your tree…</p>
                </div>
              ) : !webglOK ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <p className="text-sm font-bold text-gray-900">3D view unavailable on this device</p>
                    <p className="text-xs text-gray-500 mt-1 mb-4">
                      Your browser could not start WebGL. Pick a marhala below — or switch to Grid View above.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {treeData.map(({ marhala, totalStudents }) => {
                        const color = marhalaColor(marhala);
                        const isSel = revealed?.marhala === marhala;
                        return (
                          <button
                            key={marhala}
                            type="button"
                            onClick={() => setSelectedMarhala(marhala)}
                            aria-pressed={isSel}
                            className={cn(
                              "px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2",
                              isSel
                                ? "text-white shadow-md"
                                : "bg-gray-50 text-gray-800 border-gray-200 hover:border-emerald-400"
                            )}
                            style={isSel ? { background: color.gradCss, borderColor: "transparent" } : undefined}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
                            {MARHALA_LABELS_SHORT[marhala]} · {totalStudents}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Real 3D tree: Darse Burhani trunk, marhala branches + fruits */}
                  <MarhalaTree3D
                    branches={tree3DBranches}
                    selected={revealed?.marhala ?? null}
                    onSelect={setSelectedMarhala}
                    academicYear={academicYear}
                  />

                  {treeData.length === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <p className="text-sm text-slate-500 bg-white/90 px-5 py-3 rounded-2xl border border-gray-200 shadow-sm">
                        No branches match your search — clear it to regrow the tree.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Reveal panel: talabat inside the selected marhala ── */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden"
                aria-label="Loading marhala details"
              >
                <div className="h-24 bg-gray-100 animate-pulse" />
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 p-3.5 space-y-2">
                      <div className="h-9 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-16 rounded-xl bg-gray-50 animate-pulse" />
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : revealed ? (
              <motion.div
                key={revealed.marhala}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden"
              >
                {/* Reveal header */}
                <div
                  className="px-5 sm:px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ background: marhalaColor(revealed.marhala).gradCss }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-lg leading-tight truncate [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
                        {MARHALA_LABELS[revealed.marhala]}
                        <span className="font-arabic font-bold text-sm opacity-90"> ({MARHALA_LABELS_AR[revealed.marhala]})</span>
                      </h3>
                      <p className="text-xs text-white/90 font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                        {revealed.nodes.length} mentors · {revealed.totalStudents} huffaz
                      </p>
                    </div>
                  </div>
                  {revealedUnassigned > 0 && (
                    <span className="inline-flex items-center gap-1.5 bg-black/30 text-amber-200 border border-amber-300/50 text-xs font-bold px-3 py-1.5 rounded-xl shrink-0">
                      <Info className="w-3.5 h-3.5" />
                      {revealedUnassigned} awaiting muhafiz
                    </span>
                  )}
                </div>

                {/* Mentors + leaves */}
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {revealed.nodes.length === 0 ? (
                    <p className="text-sm text-gray-500 col-span-full text-center py-8">
                      No mentors or talabat in this marhala yet.
                    </p>
                  ) : (
                    revealed.nodes.map((node) => {
                      const isUnassigned = node.facultyId === "__unassigned__";
                      const muKey = `${revealed.marhala}::${node.facultyId}`;
                      const muCollapsed = collapsedMuhaffiz[muKey];
                      return (
                        <div
                          key={muKey}
                          className={cn(
                            "rounded-2xl border overflow-hidden",
                            isUnassigned ? "border-amber-300 bg-amber-50/50" : "border-gray-200 bg-gray-50/60"
                          )}
                        >
<button
                            type="button"
                            onClick={() => toggleMuhaffiz(muKey)}
                            aria-label={`View muhaffiz details for ${node.name}`}
                            className="w-full flex items-center gap-2.5 p-3.5 text-left hover:bg-white/60 transition-colors"
                          >
                            <Avatar className="w-9 h-9 rounded-xl ring-2 ring-emerald-400/40 shrink-0">
                              {node.avatarUrl && <AvatarImage src={node.avatarUrl} alt={node.name} className="object-cover" />}
                              <AvatarFallback
                                className={cn(
                                  "w-full h-full font-bold text-white text-xs flex items-center justify-center",
                                  isUnassigned ? "bg-amber-500" : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                )}
                              >
                                {isUnassigned ? ( <Info className="w-4 h-4 text-white" /> ) : node.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold text-sm text-gray-900 truncate">
                                {node.name}
                                {!isUnassigned && (
                                  <span className="font-arabic text-[11px] text-emerald-600 font-bold"> (المُحَفِّظ)</span>
                                )}
                              </span>
                              <span className="block text-[11px] text-gray-500 truncate">
                                {node.department || (isUnassigned ? "Awaiting Mentor" : "Faculty Mentor")}
                              </span>
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                              {node.leaves.length}
                            </span>
                            {muCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                          </button>

                          {!muCollapsed && (
                            <div className="px-3.5 pb-3.5">
                              <div className="ml-[18px] border-l-2 border-emerald-200 space-y-0.5 max-h-72 overflow-y-auto pr-1">
{node.leaves.map((leaf) => (
<button
                               key={leaf.assignment.id}
                               type="button"
                               onClick={() => setSelectedLeaf(leaf)}
                               className="px-2 py-1 rounded-lg bg-white border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-[11px] font-semibold text-gray-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                               >
                                      <span className="absolute left-0 top-1/2 h-px w-4 bg-emerald-300" />
                                      <Avatar className="w-7 h-7 rounded-lg shrink-0 ring-1 ring-gray-200 group-hover/leaf:ring-emerald-400 transition-all">
                                        {leaf.avatarUrl && <AvatarImage src={leaf.avatarUrl} alt={leaf.name} className="object-cover" />}
                                        <AvatarFallback className="bg-emerald-700 text-white font-bold text-[11px]">
                                          {leaf.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] font-semibold text-gray-900 group-hover/leaf:text-emerald-800">
                                          {leaf.name}
                                        </span>
                                        {leaf.its && (
                                          <span className="block font-mono text-[10px] text-gray-400">ITS {leaf.its}</span>
                                        )}
                                      </span>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover/leaf:text-emerald-500 shrink-0 transition-colors" />
</button>
                     ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white/60 rounded-3xl border border-dashed border-gray-300 px-6 py-10 text-center"
              >
                <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">Click a marhala fruit on the tree to reveal its talabat.</p>
              </motion.div>
            )}
          </AnimatePresence>
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
                        <h3 className="font-bold text-base text-white leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
                          {MARHALA_LABELS[marhala]}
                        </h3>
                        <p className="text-xs text-white/90 font-semibold font-arabic [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{MARHALA_LABELS_AR[marhala]}</p>
                      </div>
                    </div>
                    <Badge className="bg-white text-gray-900 border-0 text-xs font-bold px-2.5 py-1">
                      {totalStudents} Huffaz
                    </Badge>
                  </div>

                  {/* Muhaffiz List with Profile Pictures */}
                  <div className="p-4 space-y-4">
                    {nodes.map((node) => {
                      const isUnassignedNode = node.facultyId === "__unassigned__";
                      return (
                        <div key={node.facultyId} className={cn("p-3 rounded-2xl border space-y-2", isUnassignedNode ? "bg-amber-50/70 border-amber-300" : "bg-gray-50 border-gray-200/80")}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="w-7 h-7 rounded-lg shrink-0">
                                {node.avatarUrl && <AvatarImage src={node.avatarUrl} alt={node.name} className="object-cover" />}
                                <AvatarFallback className={cn("font-bold text-[10px]", isUnassignedNode ? "bg-amber-500 text-white" : "bg-emerald-100 text-emerald-800")}>
                                  {isUnassignedNode ? <Info className="w-3.5 h-3.5" /> : node.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-gray-900 truncate">{node.name}</p>
                                {isUnassignedNode && (
                                  <p className="text-[10px] font-bold text-amber-700">Awaiting mentor</p>
                                )}
                              </div>
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
                      );
                    })}
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
