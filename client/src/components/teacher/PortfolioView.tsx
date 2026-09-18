"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Users,
  Award,
  Zap,
  AlertTriangle,
  TrendingUp,
  Check,
  X,
  Undo2,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatPoints } from "@/lib/utils";

const quickActions = [
  { id: "leadership", label: "Leadership", points: 15, type: "POSITIVE" as const, color: "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200", icon: Award },
  { id: "teamwork", label: "Teamwork", points: 10, type: "POSITIVE" as const, color: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200", icon: Users },
  { id: "critical", label: "Critical Thinking", points: 20, type: "POSITIVE" as const, color: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200", icon: TrendingUp },
  { id: "distracting", label: "Distracting Peer", points: -5, type: "NEGATIVE" as const, color: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200", icon: X },
  { id: "offtask", label: "Off-Task", points: -3, type: "NEGATIVE" as const, color: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200", icon: AlertTriangle },
];

function getTierBadge(tier: string) {
  const variants: Record<string, "bronze" | "silver" | "gold" | "platinum" | "diamond"> = {
    BRONZE: "bronze", SILVER: "silver", GOLD: "gold", PLATINUM: "platinum", DIAMOND: "diamond",
  };
  return variants[tier] ?? "bronze";
}

type Tab = "overview" | "students" | "classes";

interface PortfolioViewProps {
  data: {
    stats: any;
    classes: any[];
    students: any[];
  };
}

export default function PortfolioView({ data }: PortfolioViewProps) {
  const { stats, classes, students } = data;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastLogIds, setLastLogIds] = useState<string[]>([]);
  const [awarding, setAwarding] = useState(false);

  const filteredStudents = students.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const handleQuickAction = async (action: typeof quickActions[0]) => {
    if (selectedStudents.size === 0 || awarding) return;
    setAwarding(true);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudents),
          actionType: action.type,
          category: action.label,
          pointsChanged: Math.abs(action.points),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setLastLogIds(result.data.map((l: any) => l.id));
        setLastAction(`${action.points > 0 ? "+" : ""}${action.points} ${action.label} awarded to ${selectedStudents.size} talabat(s)`);
        setShowUndo(true);
        setTimeout(() => setShowUndo(false), 8000);
      }
    } finally {
      setAwarding(false);
      setSelectedStudents(new Set());
    }
  };

  const handleUndo = async () => {
    if (lastLogIds.length === 0) return;
    await fetch("/api/points", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointLogIds: lastLogIds }),
    });
    setShowUndo(false);
    setLastAction(null);
    setLastLogIds([]);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Zap },
    { id: "students", label: "Talabat", icon: Users },
    { id: "classes", label: "Classes", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600"><BookOpen className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-gray-500">Classes</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalClasses}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-gray-500">Talabat</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><Zap className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-gray-500">Points Today</p>
              <p className="text-lg font-bold text-gray-900">+{stats.pointsToday}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* Quick Actions Preview */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-600" /> Quick Actions</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">Go to Talabat tab to select students and award points.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {quickActions.map((a) => (
                    <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl border ${a.color}`}>
                      <span className="text-sm font-medium">{a.label}</span>
                      <Badge variant="outline" className={a.type === "POSITIVE" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}>
                        {a.points > 0 ? "+" : ""}{a.points}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "students" && (
          <motion.div key="students" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Talabat */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-600" /> Talabat
                      <Badge variant="secondary" className="ml-2">{selectedStudents.size} selected</Badge>
                    </CardTitle>
                    {selectedStudents.size > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedStudents(new Set())} className="text-red-500 hover:text-red-700">
                        <X className="w-4 h-4 mr-1" /> Clear
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <label htmlFor="search-talabat" className="sr-only">Search talabat</label>
                      <input type="text" id="search-talabat" name="search-talabat" placeholder="Search talabat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {filteredStudents.map((student) => (
                        <motion.button key={student.id} onClick={() => toggleStudent(student.id)}
                          className={`relative flex flex-col items-center p-4 rounded-xl border-2 text-center transition-all ${
                            selectedStudents.has(student.id)
                              ? "border-amber-500 bg-amber-50 shadow-md"
                              : "border-gray-100 bg-white hover:border-amber-200 hover:shadow-md"
                          }`} whileTap={{ scale: 0.97 }}>
                          <Avatar className="w-12 h-12 mb-2 ring-2 ring-offset-2 ring-gray-100">
                            {student.avatarUrl && (
                              <AvatarImage
                                src={student.avatarUrl}
                                alt={`${student.firstName} ${student.lastName}`}
                                className="object-cover"
                              />
                            )}
                            <AvatarFallback className={`${selectedStudents.has(student.id) ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-amber-300 to-orange-400"}`}>
                              {getInitials(student.firstName, student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium text-gray-900 leading-tight">{student.firstName}</p>
                          <p className="text-xs text-gray-500">{student.lastName}</p>
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-xs font-bold text-gray-700">{formatPoints(student.currentPoints)}</span>
                            <Badge variant={getTierBadge(student.tier)} className="text-[10px] px-1.5 py-0">{student.tier}</Badge>
                          </div>
                          {selectedStudents.has(student.id) && <div className="absolute inset-0 rounded-xl ring-2 ring-amber-500 ring-offset-1 pointer-events-none" />}
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick-Point Modifier Sidebar */}
              <div>
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-600" /> Quick-Point Modifier</CardTitle>
                    <p className="text-xs text-gray-500">Select students on the left, then tap an action</p>
                  </CardHeader>
                  <CardContent>
                    <AnimatePresence>
                      {!selectedStudents.size && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center py-8 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Tap student cards to select them</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Positive Actions</p>
                      {quickActions.filter((a) => a.type === "POSITIVE").map((action) => (
                        <Button key={action.id} variant="outline" className={`w-full justify-between h-auto py-3 px-4 ${!selectedStudents.size ? "opacity-50 cursor-not-allowed" : action.color}`} onClick={() => handleQuickAction(action)} disabled={!selectedStudents.size || awarding}>
                          <span className="flex items-center gap-2"><action.icon className="w-4 h-4" /><span className="text-sm">{action.label}</span></span>
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">+{action.points}</Badge>
                        </Button>
                      ))}
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-4 mb-2">Negative Actions</p>
                      {quickActions.filter((a) => a.type === "NEGATIVE").map((action) => (
                        <Button key={action.id} variant="outline" className={`w-full justify-between h-auto py-3 px-4 ${!selectedStudents.size ? "opacity-50 cursor-not-allowed" : action.color}`} onClick={() => handleQuickAction(action)} disabled={!selectedStudents.size || awarding}>
                          <span className="flex items-center gap-2"><action.icon className="w-4 h-4" /><span className="text-sm">{action.label}</span></span>
                          <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">{action.points}</Badge>
                        </Button>
                      ))}
                    </div>

                    {selectedStudents.size > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                        <p className="text-sm font-medium text-amber-800">{selectedStudents.size} student{selectedStudents.size > 1 ? "s" : ""} selected</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "classes" && (
          <motion.div key="classes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {classes.map((cls) => (
              <motion.div key={cls.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-shadow flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{cls.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Grade {cls.grade}{cls.section} &bull; {cls.studentCount} talabat enrolled</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{cls.studentCount} Talabat</Badge>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Toast */}
      <AnimatePresence>
        {showUndo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-4">
            <Check className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium">{lastAction}</p>
              <p className="text-xs text-gray-500">Tap Undo to revert</p>
            </div>
            <button onClick={handleUndo} className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors">
              <Undo2 className="w-4 h-4" /> Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
