"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Plus,
  Clock,
  BookOpen,
  MapPin,
  Trash2,
  Loader2,
  Edit2,
  Download,
  CalendarDays,
  ClipboardList,
  Coffee,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const periods = Array.from({ length: 12 }, (_, i) => i + 1);

const timeSlots = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
];

export default function AdminTimetablePage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    classId: "",
    dayOfWeek: 0,
    period: 1,
    startTime: "08:00",
    endTime: "08:45",
    subject: "",
    roomNumber: "",
    isBreak: false,
    breakName: "",
  });

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    try {
      const res = await fetch("/api/admin/timetable");
      const data = await res.json();
      if (data.success) {
        setSlots(data.data.slots);
        setClasses(data.data.classes);
      }
    } finally {
      setLoading(false);
    }
  };

  const getSlotsForDay = (day: number) => {
    return slots.filter((s) => s.dayOfWeek === day);
  };

  const handleOpenModal = (slot?: any) => {
    if (slot) {
      setEditingSlot(slot);
      setForm({
        classId: slot.classId || "",
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject || "",
        roomNumber: slot.roomNumber || "",
        isBreak: slot.isBreak,
        breakName: slot.breakName || "",
      });
    } else {
      setEditingSlot(null);
      setForm({
        classId: "",
        dayOfWeek: selectedDay,
        period: 1,
        startTime: "08:00",
        endTime: "08:45",
        subject: "",
        roomNumber: "",
        isBreak: false,
        breakName: "",
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editingSlot?.id }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchTimetable();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this slot?")) return;
    await fetch(`/api/admin/timetable?id=${id}`, { method: "DELETE" });
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const getClassColor = (className: string) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-emerald-500 to-emerald-600",
      "from-amber-500 to-amber-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
      "from-cyan-500 to-cyan-600",
      "from-rose-500 to-rose-600",
      "from-indigo-500 to-indigo-600",
    ];
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const daySlots = getSlotsForDay(selectedDay);
  const currentPeriod = Math.max(...daySlots.map((s) => s.period), 0) + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Academics Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Academics & Curriculum"
        hubDescription="Class management, weekly master timetable matrix, and Takhteet curriculum portion tracking."
        tabs={[
          { label: "Classes", href: "/admin/classes", icon: BookOpen },
          { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
        ]}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
            Takhteet - Timetable
          </h1>
          <p className="text-gray-500 mt-1">
            Manage weekly class schedules
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/attendance/schedule/export?type=CLASSES"
            download
            className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
            Download Excel (.csv)
          </a>
          <Button variant="admin" onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-1" /> Add Slot
          </Button>
        </div>
      </motion.div>

      {/* Day Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {days.map((day, index) => (
          <Button
            key={day}
            variant={selectedDay === index ? "admin" : "outline"}
            size="sm"
            onClick={() => setSelectedDay(index)}
            className="whitespace-nowrap"
          >
            {day.slice(0, 3)}
          </Button>
        ))}
      </div>

      {/* Timetable Grid */}
      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-20 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : daySlots.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              No classes scheduled for {days[selectedDay]}
            </p>
            <Button variant="outline" onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-1" /> Add First Slot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {daySlots.map((slot, i) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`hover:shadow-md transition-shadow ${slot.isBreak ? "border-dashed border-gray-300" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Period Number */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                      slot.isBreak
                        ? "bg-gradient-to-br from-gray-400 to-gray-500"
                        : `bg-gradient-to-br ${getClassColor(slot.className)}`
                    }`}>
                      {slot.isBreak ? <Coffee className="w-5 h-5" /> : slot.period}
                    </div>

                    {/* Slot Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {slot.isBreak ? slot.breakName || "Break" : slot.subject}
                        </h3>
                        {slot.isBreak && (
                          <Badge variant="secondary" className="text-[10px]">Break</Badge>
                        )}
                      </div>
                      {!slot.isBreak && (
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {slot.className}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {slot.startTime} - {slot.endTime}
                          </span>
                          {slot.roomNumber && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {slot.roomNumber}
                            </span>
                          )}
                        </div>
                      )}
                      {slot.isBreak && (
                        <p className="text-sm text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" /> {slot.startTime} - {slot.endTime}
                        </p>
                      )}
                    </div>

                    {/* Teacher Name */}
                    {!slot.isBreak && (
                      <div className="hidden sm:block text-right">
                        <p className="text-sm font-medium text-gray-700">{slot.teacherName}</p>
                        <p className="text-xs text-gray-400">Period {slot.period}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal(slot)}
                        className="text-gray-500 hover:text-indigo-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(slot.id)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onOpenChange={setShowModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              {editingSlot ? "Edit Slot" : "Add Timetable Slot"}
            </ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isBreak"
                name="isBreak"
                checked={form.isBreak}
                onChange={(e) => setForm({ ...form, isBreak: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="isBreak" className="text-sm font-medium text-gray-700">
                Break / Free Period
              </label>
            </div>

            {form.isBreak ? (
              <div>
                <label htmlFor="breakName" className="text-sm font-medium text-gray-700">Break Name</label>
                <input
                  id="breakName"
                  name="breakName"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-indigo-400 outline-none"
                  placeholder="e.g. Morning Break, Lunch"
                  value={form.breakName}
                  onChange={(e) => setForm({ ...form, breakName: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="classId" className="text-sm font-medium text-gray-700">Class</label>
                  <select
                    id="classId"
                    name="classId"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                    value={form.classId}
                    onChange={(e) => {
                      const cls = classes.find((c) => c.id === e.target.value);
                      setForm({
                        ...form,
                        classId: e.target.value,
                        subject: cls?.subject || form.subject,
                      });
                    }}
                  >
                    <option value="">Select class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.teacherName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="subject" className="text-sm font-medium text-gray-700">Subject</label>
                  <input
                    id="subject"
                    name="subject"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="roomNumber" className="text-sm font-medium text-gray-700">Room Number</label>
                  <input
                    id="roomNumber"
                    name="roomNumber"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                    placeholder="e.g. Room 101"
                    value={form.roomNumber}
                    onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="dayOfWeek" className="text-sm font-medium text-gray-700">Day</label>
                <select
                  id="dayOfWeek"
                  name="dayOfWeek"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                >
                  {days.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="period" className="text-sm font-medium text-gray-700">Period</label>
                <select
                  id="period"
                  name="period"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: parseInt(e.target.value) })}
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="text-sm font-medium text-gray-700">Start Time</label>
                <select
                  id="startTime"
                  name="startTime"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="endTime" className="text-sm font-medium text-gray-700">End Time</label>
                <select
                  id="endTime"
                  name="endTime"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </ModalClose>
            <Button
              variant="admin"
              size="sm"
              onClick={handleSave}
              disabled={saving || (!form.isBreak && !form.classId)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingSlot ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
