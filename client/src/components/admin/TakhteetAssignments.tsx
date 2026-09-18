"use client";


import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { Loader2, Pencil, BookOpen, User, CheckCircle2, AlertCircle } from "lucide-react";

interface TakhteetAssignmentsProps {
  classes: any[];
  teachers: any[];
  onChanged: () => void;
}

export default function TakhteetAssignments({ classes, teachers, onChanged }: TakhteetAssignmentsProps) {
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = (cls: any) => {
    setEditing(cls);
    setForm({
      teacherId: cls.teacherUserId || (teachers.length > 0 ? teachers[0].id : ""),
      subject: cls.subject,
      academicYear: cls.academicYear || "2026-2027",
    });
  };

  const handleSave = async () => {
    if (!editing || !form?.teacherId) {
      toast({ variant: "warning", title: "Select Teacher", description: "Please choose a teacher for this class." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/classes/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: form.teacherId, subject: form.subject, academicYear: form.academicYear }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Assignment Saved", description: `Teacher assigned to ${editing.name} successfully.` });
        setEditing(null);
        onChanged();
      } else {
        toast({ variant: "destructive", title: "Assignment Failed", description: data.error || "Failed to update class assignment." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Network Error", description: "Could not reach server to save assignment." });
    } finally {
      setSaving(false);
    }
  };

  const unassigned = classes.filter((c) => !c.teacherUserId);

  return (
    <div className="space-y-6">
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <p className="text-sm font-semibold text-amber-900">
              {unassigned.length} class{unassigned.length === 1 ? "" : "es"} without a teacher — assign below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((c) => (
              <Badge
                key={c.id}
                variant="outline"
                className="text-xs bg-white border-amber-300 text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => openEdit(c)}
              >
                {c.name} — {c.subject} (Click to assign)
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-4">
          <CardTitle className="flex items-center justify-between text-base font-bold text-gray-900">
            <span className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#047857]" /> Class & Subject Teacher Assignments
            </span>
            <Badge variant="secondary" className="text-xs">
              {classes.length} Total Classes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {classes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No classes created yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Class</th>
                    <th className="py-3 px-3">Subject</th>
                    <th className="py-3 px-3">Assigned Teacher</th>
                    <th className="py-3 px-3">Academic Year</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-gray-900">{c.name}</td>
                      <td className="py-3 px-3 text-gray-600 font-medium">{c.subject}</td>
                      <td className="py-3 px-3">
                        {c.teacherUserId ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-gray-800 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md text-xs border border-emerald-100">
                            <User className="w-3.5 h-3.5 text-[#047857]" /> {c.teacherName}
                          </span>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            Unassigned
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs">{c.academicYear}</td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" /> {c.teacherUserId ? "Change" : "Assign"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Assignment Modal */}
      <Modal open={!!editing} onOpenChange={() => setEditing(null)}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-[#047857] flex items-center justify-center text-white">
                <Pencil className="w-4 h-4" />
              </div>
              Assign Subject & Teacher
            </ModalTitle>
          </ModalHeader>
          {editing && form && (
            <div className="space-y-4 py-3">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5">
                <p className="font-bold text-gray-900 text-sm">{editing.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Grade: {editing.grade} • Section: {editing.section}
                </p>
              </div>

              <div>
                <label htmlFor="as-teacher" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Teacher *
                </label>
                <select
                  id="as-teacher"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  value={form.teacherId}
                  onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                >
                  <option value="">Select teacher...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="as-subject" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Subject *
                </label>
                <input
                  id="as-subject"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="as-year" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Academic Year
                </label>
                <select
                  id="as-year"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                >
                  {["2025-2026", "2026-2027", "2027-2028"].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              className="bg-[#047857] hover:bg-[#065f46] text-white font-medium shadow-sm"
              onClick={handleSave}
              disabled={saving || !form?.teacherId}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />} Save Assignment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
