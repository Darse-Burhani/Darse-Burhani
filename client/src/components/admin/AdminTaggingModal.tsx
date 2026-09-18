"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Save,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

const MARHALA_OPTIONS = [
  { value: "MARHALA_1", label: "المرحلة الأولى (1 - 6 أجزاء)" },
  { value: "MARHALA_2", label: "المرحلة الثانية (7 - 12 جزء)" },
  { value: "MARHALA_3", label: "المرحلة الثالثة (13 - 18 جزء)" },
  { value: "MARHALA_4", label: "المرحلة الرابعة (19 - 24 جزء)" },
  { value: "MARHALA_5", label: "المرحلة الخامسة (25 - 30 جزء)" },
];

interface AdminTaggingModalProps {
  student: {
    id: string;
    studentId?: string;
    its?: string;
    grade?: string;
    section?: string;
    user?: { firstName?: string; lastName?: string; avatarUrl?: string };
  };
  currentAssignment?: {
    id?: string;
    marhala?: string;
    facultyId?: string;
    musaidId?: string | null;
    academicYear?: string;
  } | null;
  teachers: Array<{
    id: string;
    employeeId?: string;
    department?: string;
    user?: { firstName?: string; lastName?: string };
  }>;
  academicYear: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminTaggingModal({
  student,
  currentAssignment,
  teachers,
  academicYear,
  onClose,
  onSuccess,
}: AdminTaggingModalProps) {
  const [marhala, setMarhala] = useState(currentAssignment?.marhala || "MARHALA_1");
  const [facultyId, setFacultyId] = useState(currentAssignment?.facultyId || "");
  const [musaidId, setMusaidId] = useState(currentAssignment?.musaidId || "none");
  const [saving, setSaving] = useState(false);

  const studentName = student.user
    ? `${student.user.firstName || ""} ${student.user.lastName || ""}`.trim()
    : "الطالب";

  const handleSave = async () => {
    if (!facultyId) {
      toast({
        title: "تنبيه",
        description: "يرجى تحديد المحفظ الأساسي للطالب",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/hifz-marhala/quick-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          marhala,
          facultyId,
          musaidId: musaidId === "none" ? null : musaidId,
          academicYear,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "تم الحفظ بنجاح",
          description: `تم تعيين المحفظ والمساعد للطالب ${studentName}`,
          variant: "success",
        });
        onSuccess();
        onClose();
      } else {
        toast({
          title: "خطأ",
          description: data.error || "فشل في تحديث التعيين",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "خطأ في الشبكة",
        description: "تعذر الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-amber-200/50 overflow-hidden animate-in fade-in-90 zoom-in-95 duration-200">
        {/* Header with Fatimi aesthetic */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 px-6 py-5 text-white flex items-center justify-between border-b border-amber-400/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-arabic text-amber-100">
                تعيين المحفظ والمساعد وتصنيف المرحلة
              </h3>
              <p className="text-xs text-emerald-200/80 font-arabic">
                إدارة وسوم وتعيينات حلقات الحفظ القرآني
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Student Profile Card Preview */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/80 to-emerald-50/50 border border-amber-200/60 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold text-xl shadow-md font-arabic">
              {studentName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 font-arabic text-base truncate">
                {studentName}
              </h4>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {student.its && (
                  <Badge variant="outline" className="bg-white/80 text-xs font-mono border-amber-300/70 text-amber-900">
                    ITS: {student.its}
                  </Badge>
                )}
                {student.grade && (
                  <Badge variant="outline" className="bg-white/80 text-xs font-arabic border-emerald-300 text-emerald-900">
                    الصف: {student.grade} {student.section ? `(${student.section})` : ""}
                  </Badge>
                )}
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-arabic text-xs">
                  السنة: {academicYear}
                </Badge>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Marhala Selection */}
            <div className="space-y-1.5">
              <Label className="font-arabic text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-700" />
                المرحلة المستهدفة (Marhala)
              </Label>
              <Select value={marhala} onValueChange={setMarhala}>
                <SelectTrigger className="font-arabic border-gray-300 h-11">
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  {MARHALA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Primary Muhaffiz Tagging */}
            <div className="space-y-1.5">
              <Label className="font-arabic text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                المحفظ الأساسي (Muhaffiz Tag) <span className="text-red-500">*</span>
              </Label>
              <Select value={facultyId} onValueChange={setFacultyId}>
                <SelectTrigger className="font-arabic border-gray-300 h-11">
                  <SelectValue placeholder="اختر المحفظ الأساسي" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => {
                    const tName = `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim();
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {tName} {t.department ? `(${t.department})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500 font-arabic">
                المحفظ المسؤول عن متابعة الحفظ الجديد والتقييم الأساسي للطالب
              </p>
            </div>

            {/* Musa'id Tagging */}
            <div className="space-y-1.5">
              <Label className="font-arabic text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                المساعد / المراجع (Musa&apos;id Tag)
              </Label>
              <Select value={musaidId} onValueChange={setMusaidId}>
                <SelectTrigger className="font-arabic border-gray-300 h-11">
                  <SelectValue placeholder="اختر المساعد (اختياري)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مساعد (المحفظ الأساسي فقط)</SelectItem>
                  {teachers
                    .filter((t) => t.id !== facultyId)
                    .map((t) => {
                      const tName = `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim();
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {tName} {t.department ? `(${t.department})` : ""}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500 font-arabic">
                المساعد المعتمد لتسميع المراجعة الأسبوعية وإدخال الكشوفات
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={onClose} disabled={saving} className="font-arabic">
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !facultyId}
              className="btn-fatimi-primary font-arabic min-w-[130px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 ml-2" />
                  حفظ وتطبيق الوسوم
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
