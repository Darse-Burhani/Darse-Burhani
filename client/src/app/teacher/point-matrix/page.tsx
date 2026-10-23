"use client";

import { Award, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeacherPointMatrixPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 space-y-6">
      <Card className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <CardContent className="p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center text-amber-600 shadow-inner">
            <Award className="w-8 h-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-900 border-amber-300 font-bold uppercase tracking-wider">
              Matrix Cleared
            </Badge>
            <h2 className="text-xl font-extrabold text-slate-900">Point Matrix Currently Inactive</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              The student point scoring matrix has been cleared and paused for this academic term. No rules or active metrics are currently in effect.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
