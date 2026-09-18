"use client";


import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, MapPin, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TeacherClass {
  id: string;
  name: string;
  subject: string;
  isActive: boolean;
  studentCount: number;
  roomNumber?: string | null;
  academicYear: string;
  students?: { id: string; firstName: string }[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/classes").then((r) => r.json()).then((res) => {
      if (res.success) setClasses(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">My Classes</h1>
        <p className="text-gray-500 mt-1">{classes.length} classes assigned</p>
      </motion.div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="w-full h-20 bg-gray-200 rounded mb-4" /><div className="w-2/3 h-5 bg-gray-200 rounded mb-2" /></CardContent></Card>)}
        </div>
      ) : classes.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, i) => (
            <motion.div key={cls.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-lg transition-shadow h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className="text-xs">{cls.subject}</Badge>
                    <Badge variant={cls.isActive ? "success" : "secondary"} className="text-[10px]">{cls.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">{cls.name}</h3>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2"><Users className="w-4 h-4" /> {cls.studentCount} talabat enrolled</div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Room {cls.roomNumber || "TBA"}</div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {cls.academicYear}</div>
                  </div>
                  {cls.students && cls.students.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Talabat</p>
                      <div className="flex flex-wrap gap-1">
                        {cls.students.slice(0, 5).map((s: any) => (
                          <Badge key={s.id} variant="secondary" className="text-[10px]">{s.firstName}</Badge>
                        ))}
                        {cls.students.length > 5 && <Badge variant="secondary" className="text-[10px]">+{cls.students.length - 5}</Badge>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-12 text-center text-gray-500">No classes assigned yet</CardContent></Card>
      )}
    </div>
  );
}
