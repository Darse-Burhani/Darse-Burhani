"use client";

import { Award, Sparkles, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeacherPointMatrixPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 space-y-6">
      <Card className="rounded-3xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center text-emerald-700 shadow-xs">
            <Award className="w-8 h-8 text-emerald-700" />
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-900 border-amber-300 font-bold uppercase tracking-wider">
              Term Standby Mode
            </Badge>
            <h2 className="text-xl font-extrabold text-slate-900">Talabat Point Matrix Active</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Points flow dynamically from monthly assignments and curricular evaluation. Custom action rules and administrative allocations can be reviewed through the main administrative point matrix.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
