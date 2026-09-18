"use client";

import { useState } from "react";
import {
  BookOpen,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Eye,
  FileText,
  Calculator,
  Target,
  Award,
  TrendingUp,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MARHALA_LABELS: Record<string, string> = {
  MARHALA_1: "المرحلة الأولى (1-6 أجزاء)",
  MARHALA_2: "المرحلة الثانية (7-12 جزء)",
  MARHALA_3: "المرحلة الثالثة (13-18 جزء)",
  MARHALA_4: "المرحلة الرابعة (19-24 جزء)",
  MARHALA_5: "المرحلة الخامسة (25-30 جزء)",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: "مسودة", color: "text-gray-600", bgColor: "bg-gray-100", icon: FileText },
  SUBMITTED: { label: "مقدم", color: "text-blue-700", bgColor: "bg-blue-100", icon: ArrowLeft },
  REVIEWED: { label: "مراجع", color: "text-amber-700", bgColor: "bg-amber-100", icon: Eye },
  APPROVED: { label: "معتمد", color: "text-emerald-700", bgColor: "bg-emerald-100", icon: CheckCircle2 },
  REJECTED: { label: "مرفوض", color: "text-red-700", bgColor: "bg-red-100", icon: AlertCircle },
};

const MARKS_CONFIG = [
  { key: "murajaatMarks", label: "مراجعة (20)", max: 20, description: "علامة المراجعة - مراجعة الحفظ السابق" },
  { key: "juzhaliMarks", label: "جزئالي (20)", max: 20, description: "علامة الجزيء - حفظ الجزء الجديد" },
  { key: "jadeedMarks", label: "جديد (10)", max: 10, description: "علامة الجديد - الصفحات الجديدة المحفوظة" },
] as const;

export default function TeacherHifzMarhalaReportForm({
  student,
  marhala,
  academicYear,
  existingReport,
  onClose,
  onSave,
}: {
  student: { id: string; name: string; its?: string; grade?: string; section?: string };
  marhala: string;
  academicYear: string;
  existingReport?: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    its: student.its || "",
    name: student.name,
    currentJuz: existingReport?.currentJuz || "",
    currentSafah: existingReport?.currentSafah || "",
    totalJadeedPages: existingReport?.totalJadeedPages || "",
    ajzaMatruka: existingReport?.ajzaMatruka || "",
    weakAjza: existingReport?.weakAjza || "",
    murajaatMarks: existingReport?.murajaatMarks || 0,
    juzhaliMarks: existingReport?.juzhaliMarks || 0,
    jadeedMarks: existingReport?.jadeedMarks || 0,
    notes: existingReport?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalMarks, setTotalMarks] = useState(
    (existingReport?.murajaatMarks || 0) + (existingReport?.juzhaliMarks || 0) + (existingReport?.jadeedMarks || 0)
  );
  const [overallPerformance, setOverallPerformance] = useState(
    totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0
  );

  const validateField = (name: string, value: string | number) => {
    const numValue = typeof value === "string" ? parseInt(value) || 0 : value;
    switch (name) {
      case "murajaatMarks":
        if (numValue < 0 || numValue > 20) return "يجب أن تكون بين 0 و 20";
        break;
      case "juzhaliMarks":
        if (numValue < 0 || numValue > 20) return "يجب أن تكون بين 0 و 20";
        break;
      case "jadeedMarks":
        if (numValue < 0 || numValue > 10) return "يجب أن تكون بين 0 و 10";
        break;
      case "currentJuz":
        if (numValue < 0 || numValue > 30) return "يجب أن تكون بين 0 و 30";
        break;
      case "currentSafah":
        if (numValue < 0 || numValue > 20) return "يجب أن تكون بين 0 و 20";
        break;
    }
    return "";
  };

  const handleChange = (name: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));

    if (["murajaatMarks", "juzhaliMarks", "jadeedMarks"].includes(name)) {
      const numVal = parseInt(value as string) || 0;
      const marks = { ...formData, [name]: numVal };
      const total =
        (parseInt(marks.murajaatMarks as any) || 0) +
        (parseInt(marks.juzhaliMarks as any) || 0) +
        (parseInt(marks.jadeedMarks as any) || 0);
      setTotalMarks(total);
      setOverallPerformance(total > 0 ? Math.round((total / 50) * 100) : 0);
    }
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    MARKS_CONFIG.forEach((m) => {
      const error = validateField(m.key, formData[m.key as keyof typeof formData]);
      if (error) newErrors[m.key] = error;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: "خطأ في التحقق", description: "يرجى تصحيح الحقول المميزة", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        murajaatMarks: parseInt(formData.murajaatMarks as any) || 0,
        juzhaliMarks: parseInt(formData.juzhaliMarks as any) || 0,
        jadeedMarks: parseInt(formData.jadeedMarks as any) || 0,
        currentJuz: formData.currentJuz ? parseInt(formData.currentJuz as any) : null,
        currentSafah: formData.currentSafah ? parseInt(formData.currentSafah as any) : null,
        totalJadeedPages: formData.totalJadeedPages ? parseInt(formData.totalJadeedPages as any) : null,
        ajzaMatruka: formData.ajzaMatruka ? parseInt(formData.ajzaMatruka as any) : null,
        weakAjza: formData.weakAjza ? parseInt(formData.weakAjza as any) : null,
        totalMarks,
        overallPerformance,
      });
      toast({ title: "تم الحفظ", description: "تم حفظ تقرير الحفظ بنجاح", variant: "success" });
      onClose();
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حفظ التقرير", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getStatusInfo = (status?: string) => {
    return STATUS_CONFIG[status || "DRAFT"] || STATUS_CONFIG.DRAFT;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl animate-in slide-in-from-top-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-arabic">تقرير الحفظ - المرحلة</h2>
              <p className="text-sm text-gray-500 font-arabic">{MARHALA_LABELS[marhala] || marhala}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existingReport && (() => {
              const statusInfo = getStatusInfo(existingReport.status);
              const StatusIcon = statusInfo.icon;
              return (
                <Badge className={cn(existingReport.status === "APPROVED" && "bg-emerald-100 text-emerald-700")}>
                  <StatusIcon className="w-3 h-3 ml-1" />
                  {statusInfo.label}
                </Badge>
              );
            })()}
          </div>
        </div>

        <div className="p-6">
          {/* Student Info Card */}
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14 rounded-xl shadow-md shrink-0 ring-1 ring-black/5">
                  {((student as any).user?.avatarUrl || (student as any).avatarUrl) && (
                    <AvatarImage src={(student as any).user?.avatarUrl || (student as any).avatarUrl} alt={student.name} className="object-cover" />
                  )}
                  <AvatarFallback className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-xl font-arabic rounded-xl">
                    {student.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 font-arabic">{student.name}</h3>
                  <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-600 font-arabic">
                    {student.its && <span>ITS: {student.its}</span>}
                    {student.grade && <span>الصف: {student.grade}{student.section ? student.section : ""}</span>}
                    <span>المرحلة: {MARHALA_LABELS[marhala] || marhala}</span>
                    <span>السنة: {academicYear}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Summary */}
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-xl border border-blue-100">
                  <div className="text-3xl font-bold text-blue-600 font-arabic">{totalMarks}</div>
                  <div className="text-xs text-blue-700">المجموع (50)</div>
                </div>
                <div className="text-center p-3 bg-white rounded-xl border border-emerald-100">
                  <div className="text-3xl font-bold text-emerald-600 font-arabic">{overallPerformance}%</div>
                  <div className="text-xs text-emerald-700">الأداء الكلي</div>
                </div>
                <div className="text-center p-3 bg-white rounded-xl border border-amber-100">
                  <div className="text-3xl font-bold text-amber-600 font-arabic">{formData.currentJuz || 0}</div>
                  <div className="text-xs text-amber-700">الجزء الحالي</div>
                </div>
                <div className="text-center p-3 bg-white rounded-xl border border-purple-100">
                  <div className="text-3xl font-bold text-purple-600 font-arabic">{formData.totalJadeedPages || 0}</div>
                  <div className="text-xs text-purple-700">صفحات جديد</div>
                </div>
              </div>
              <div className="mt-4 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${overallPerformance}%`,
                    background: overallPerformance >= 80
                      ? "linear-gradient(90deg, #059669, #10b981)"
                      : overallPerformance >= 60
                      ? "linear-gradient(90deg, #0d9488, #14b8a6)"
                      : overallPerformance >= 40
                      ? "linear-gradient(90deg, #d97706, #f59e0b)"
                      : "linear-gradient(90deg, #dc2626, #ef4444)",
                  }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-2 font-arabic">
                {overallPerformance >= 80 ? "ممتاز - متفوق" : overallPerformance >= 60 ? "جيد جداً" : overallPerformance >= 40 ? "جيد" : "يحتاج تحسين"}
              </p>
            </CardContent>
          </Card>

          {/* Form Tabs */}
          <Tabs defaultValue="marks" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-gray-100 rounded-lg p-1">
              <TabsTrigger value="marks" className="font-arabic">
                <Calculator className="w-4 h-4 ml-1 inline" /> العلامات
              </TabsTrigger>
              <TabsTrigger value="progress" className="font-arabic">
                <Target className="w-4 h-4 ml-1 inline" /> التقدم
              </TabsTrigger>
              <TabsTrigger value="notes" className="font-arabic">
                <FileText className="w-4 h-4 ml-1 inline" /> ملاحظات
              </TabsTrigger>
            </TabsList>

            {/* Marks Tab */}
            <TabsContent value="marks" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {MARKS_CONFIG.map((mark) => (
                  <Card key={mark.key} className="border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-semibold text-gray-900 font-arabic">{mark.label}</Label>
                        <Badge variant="outline" className="text-xs font-arabic">
                          من {mark.max}
                        </Badge>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={mark.max}
                        value={formData[mark.key as keyof typeof formData]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(mark.key, e.target.value)}
                        className={cn(
                          "text-center text-2xl font-bold font-arabic",
                          errors[mark.key] && "border-red-500 focus:ring-red-500"
                        )}
                        disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                      />
                      {errors[mark.key] && (
                        <p className="mt-1 text-xs text-red-600 text-center font-arabic">{errors[mark.key]}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-500 text-center font-arabic">{mark.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Total Display */}
              <Card className="border-2 border-emerald-300 bg-emerald-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Award className="w-6 h-6 text-emerald-600" />
                      <div>
                        <p className="text-sm text-emerald-700 font-arabic">المجموع الكلي</p>
                        <p className="text-2xl font-bold text-emerald-800 font-arabic">{totalMarks} / 50</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-emerald-700 font-arabic">نسبة الأداء</p>
                      <p className="text-2xl font-bold text-emerald-800 font-arabic">{overallPerformance}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="progress" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-arabic">الجزء الحالي (1-30)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={formData.currentJuz}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("currentJuz", e.target.value)}
                    className="font-arabic text-lg text-center"
                    disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-arabic">الصفحة الحالية (1-20)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={formData.currentSafah}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("currentSafah", e.target.value)}
                    className="font-arabic text-lg text-center"
                    disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-arabic">إجمالي صفحات الجديد المحفوظة</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.totalJadeedPages}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("totalJadeedPages", e.target.value)}
                    className="font-arabic text-lg text-center"
                    disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-arabic">أجزاء متروكة (لم تكمل)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.ajzaMatruka}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("ajzaMatruka", e.target.value)}
                    className="font-arabic text-lg text-center"
                    disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-arabic">أجزاء ضعيفة (تحتاج مراجعة)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.weakAjza}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("weakAjza", e.target.value)}
                    className="font-arabic text-lg text-center"
                    disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                  />
                </div>
              </div>

              {/* Visual Progress Indicators */}
              <Card className="border-emerald-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 font-arabic">مؤشرات التقدم</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-xs text-gray-500 font-arabic">الأجزاء المنجزة</p>
                        <p className="text-lg font-bold text-gray-900 font-arabic">{formData.currentJuz || 0} / 30</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500 font-arabic">الصفحات الجديدة</p>
                        <p className="text-lg font-bold text-gray-900 font-arabic">{formData.totalJadeedPages || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-xs text-gray-500 font-arabic">أجزاء تحتاج مراجعة</p>
                        <p className="text-lg font-bold text-gray-900 font-arabic">
                          {(parseInt(formData.ajzaMatruka as string) || 0) + (parseInt(formData.weakAjza as string) || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Label className="font-arabic">ملاحظات المعلم</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("notes", e.target.value)}
                  rows={6}
                  className="w-full p-4 border border-gray-300 rounded-lg font-arabic resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="أضف ملاحظات حول أداء الطالب، نقاط القوة، المجالات التي تحتاج تحسين..."
                  disabled={existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}
                />
              </div>

              {existingReport && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-800 mb-2">
                      <Info className="w-5 h-5" />
                      <span className="font-medium font-arabic">تاريخ التقرير</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3 text-sm font-arabic">
                      <p>مقدم في: {existingReport.submittedAt ? new Date(existingReport.submittedAt).toLocaleDateString("ar-SA") : "—"}</p>
                      <p>مراجع في: {existingReport.reviewedAt ? new Date(existingReport.reviewedAt).toLocaleDateString("ar-SA") : "—"}</p>
                      <p>المصدر: {existingReport.source === "TALABAT_SELF" ? "الطالب ذاتياً" : existingReport.source === "FACULTY_ASSIGNED" ? "المعلم" : "الإدارة"}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <Separator className="my-6" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saving || existingReport?.status === "APPROVED" || existingReport?.status === "REJECTED"}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
              {existingReport ? "تحديث التقرير" : "حفظ التقرير"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProgressRing({
  progress = 0,
  size = 60,
  strokeWidth = 4,
}: {
  progress?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/20"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-white transition-all duration-500 ease-out"
          fill="none"
        />
      </svg>
      <span className="absolute text-xs font-bold text-white font-arabic">
        {Math.round(progress)}%
      </span>
    </div>
  );
}