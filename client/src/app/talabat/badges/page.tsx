"use client";


import { useState, useEffect } from "react";
import { Award, CheckCircle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/student/PageHeader";

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  tier: string;
  isEarned: boolean;
  earnedAt?: string | null;
  progress?: number;
}

export default function TalabatBadgesPage() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/talabat/badges").then((r) => r.json()).then((res) => {
      if (res.success) setBadges(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const earned = badges.filter((b: BadgeItem) => b.isEarned);
  const locked = badges.filter((b: BadgeItem) => !b.isEarned);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <PageHeader
        icon={Award}
        title="Badges"
        subtitle={badges.length > 0 ? `${earned.length} of ${badges.length} badges earned` : "Collect achievements & milestones"}
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="fatimi-card animate-pulse">
            <div className="fatimi-card-header" />
            <CardContent className="p-6"><div className="w-full h-24 bg-gray-200 rounded-lg mb-4" /><div className="w-2/3 h-5 bg-gray-200 rounded" /></CardContent>
          </Card>
        ))}</div>
      ) : (
        <div className="space-y-8">
          {earned.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#047857]" /> Earned ({earned.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {earned.map((badge, i) => (
                  <div key={badge.id} className="animate-scale-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <Card className="fatimi-card hover:shadow-lg transition-shadow h-full">
                      <div className="fatimi-card-header" />
                      <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 rounded-full fatimi-emerald-gradient flex items-center justify-center text-3xl mx-auto mb-3 shadow-md">⭐</div>
                        <h3 className="font-semibold text-gray-900 mb-1">{badge.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">{badge.description}</p>
                        <Badge variant={badge.tier === "GOLD" ? "gold" : badge.tier === "SILVER" ? "silver" : badge.tier === "PLATINUM" ? "platinum" : badge.tier === "DIAMOND" ? "diamond" : "bronze"} className="text-xs">{badge.tier}</Badge>
                        {badge.earnedAt && <p className="text-[10px] text-gray-400 mt-2">Earned {new Date(badge.earnedAt).toLocaleDateString()}</p>}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" /> Locked ({locked.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {locked.map((badge, i) => (
                  <div key={badge.id} className="animate-scale-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <Card className="fatimi-card opacity-60 h-full">
                      <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-3xl mx-auto mb-3">🔒</div>
                        <h3 className="font-semibold text-gray-900 mb-1">{badge.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">{badge.description}</p>
                        <Badge variant="secondary" className="text-xs">{badge.tier}</Badge>
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2"><div className="h-2 rounded-full bg-gray-400" style={{ width: `${badge.progress}%` }} /></div>
                          <p className="text-[10px] text-gray-400 mt-1">{badge.progress}% complete</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}

          {badges.length === 0 && <Card className="fatimi-card"><CardContent className="p-12 text-center text-gray-400">No badges available yet. Start earning points!</CardContent></Card>}
        </div>
      )}
    </div>
  );
}
