"use client";

import { useState, useEffect } from "react";
import { Brain, Users, Shield, Heart, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/student/PageHeader";

const skillCategories = [
  { key: "criticalThinking", label: "Critical Thinking", icon: Brain, color: "text-purple-600", bg: "bg-purple-100", barGradient: "from-purple-500 to-purple-400", glowColor: "shadow-purple-200" },
  { key: "collaboration", label: "Collaboration", icon: Users, color: "text-blue-600", bg: "bg-blue-100", barGradient: "from-blue-500 to-blue-400", glowColor: "shadow-blue-200" },
  { key: "leadership", label: "Leadership", icon: Shield, color: "text-amber-600", bg: "bg-amber-100", barGradient: "from-amber-500 to-[#d4af37]", glowColor: "shadow-amber-200" },
  { key: "resilience", label: "Resilience", icon: Heart, color: "text-rose-600", bg: "bg-rose-100", barGradient: "from-rose-500 to-rose-400", glowColor: "shadow-rose-200" },
];

export default function TalabatSkillTreePage() {
  const [skills, setSkills] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/talabat/skill-tree").then((r) => r.json()).then((res) => {
      if (res.success) setSkills(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <PageHeader icon={Sparkles} title="Skill Tree" subtitle="Your attribute progression" />

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-6">{Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="fatimi-card animate-pulse">
            <div className="fatimi-card-header" />
            <CardContent className="p-6"><div className="w-full h-32 bg-gray-200 rounded" /></CardContent>
          </Card>
        ))}</div>
      ) : skills ? (
        <div className="grid sm:grid-cols-2 gap-6">
          {skillCategories.map((skill, i) => {
            const value = skills[skill.key] || 0;
            const level = Math.floor(value / 10);
            return (
              <div key={skill.key} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <Card className="fatimi-card hover:shadow-lg transition-shadow">
                  <div className="fatimi-card-header" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${skill.bg} shadow-lg ${skill.glowColor}`}>
                          <skill.icon className={`w-6 h-6 ${skill.color}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{skill.label}</h3>
                          <p className="text-sm text-gray-500">Level {level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{value}<span className="text-sm text-gray-500">%</span></p>
                      </div>
                    </div>
                    <div className="w-full bg-emerald-100/60 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full bg-gradient-to-r ${skill.barGradient} animate-progress`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-gray-500">0</span>
                      <span className="text-[10px] text-gray-500">100</span>
                    </div>
                    {/* Level indicators */}
                    <div className="flex gap-1 mt-3">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <div
                          key={j}
                          className={`flex-1 h-1.5 rounded-full transition-all duration-300`}
                          style={{
                            background: j < level
                              ? j === level - 1
                                ? "linear-gradient(90deg, #059669, #d4af37)"
                                : "#059669"
                              : "#e5e7eb"
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="fatimi-card"><CardContent className="p-12 text-center text-gray-500">No skill data yet. Earn points to build your skills!</CardContent></Card>
      )}
    </div>
  );
}
