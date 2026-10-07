"use client";

import { useMemo } from "react";
import {
  Activity,
  BookOpen,
  Clock,
  FileText,
  User,
  ShoppingBag,
  Sparkles,
  Layers,
  Package,
  Library,
  Mail,
  CalendarCheck,
  CalendarDays,
  Stethoscope,
  ClipboardCheck,
  GraduationCap,
  UserCheck,
  Heart,
  Fingerprint,
  KeyRound,
  Users,
  BarChart3,
  Award,
  Bell,
  Shield,
  Settings,
  ClipboardList,
  Palette,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

const rawNavItems = [
  // ── Overview & Academics ──
  { key: "dashboard", label: "Dashboard", href: "/teacher", icon: Activity, category: "Overview" },
  { key: "classes", label: "Classes", href: "/teacher/classes", icon: BookOpen, category: "Academics" },
  { key: "timetable", label: "Timetable Matrix", href: "/teacher/timetable", icon: CalendarDays, category: "Academics" },
  { key: "quran", label: "Quran (Hifz)", href: "/teacher/hifz", icon: Sparkles, category: "Academics" },
  { key: "hifz-marhala", label: "Hifz Marhala", href: "/teacher/hifz-marhala", icon: GraduationCap, category: "Academics" },
  { key: "takhteet", label: "Takhteet", href: "/teacher/takhteet", icon: Layers, category: "Academics" },
  { key: "student-assignments", label: "Assignments", href: "/teacher/assignments", icon: ClipboardList, category: "Academics" },
  { key: "talabat-skills", label: "Talabat Skills Records", href: "/teacher/skills", icon: Sparkles, category: "Academics" },

  // ── Attendance & Scanners ──
  { key: "manual-attendance", label: "Manual Attendance", href: "/teacher/attendance", icon: ClipboardCheck, category: "Attendance" },
  { key: "attendance-logs", label: "Manual Attendance Logs", href: "/teacher/attendance-logs", icon: FileText, category: "Attendance" },
  { key: "attendance-schedule", label: "Attendance Schedule", href: "/teacher/attendance-schedule", icon: Clock, category: "Attendance" },
  { key: "email-reports", label: "Email Reports", href: "/teacher/attendance-emails", icon: Mail, category: "Attendance" },
  { key: "biometric", label: "Biometric Scanners", href: "/teacher/biometric", icon: Fingerprint, category: "Attendance" },

  // ── Operations & Health ──
  { key: "medical-duty", label: "Medical Duty", href: "/teacher/medical-duty", icon: Stethoscope, category: "Operations" },
  { key: "leave", label: "Leave Management", href: "/teacher/leave", icon: CalendarCheck, category: "Operations" },
  { key: "tracking", label: "Individual Tracking", href: "/teacher/tracking", icon: BarChart3, category: "Operations" },
  { key: "procurement", label: "Procurement", href: "/teacher/procurement", icon: ShoppingBag, category: "Operations" },
  { key: "makhzan", label: "Makhzan", href: "/teacher/makhzn", icon: Package, category: "Operations" },
  { key: "library", label: "Library", href: "/teacher/library", icon: Library, category: "Operations" },

  // ── Community & Permissions ──
  { key: "students", label: "Talabat (Students)", href: "/teacher/students", icon: GraduationCap, category: "Community" },
  { key: "portal-assignments", label: "Portal Assignments", href: "/teacher/portal-assignments", icon: UserCheck, category: "Community" },
  { key: "parents", label: "Parents Directory", href: "/teacher/parents", icon: Heart, category: "Community" },
  { key: "hobbies", label: "Hobbies & Skills", href: "/teacher/hobbies", icon: Palette, category: "Community" },
  { key: "users", label: "Staff & Users", href: "/teacher/users", icon: Users, category: "Community" },
  { key: "passwords", label: "User Passwords", href: "/teacher/passwords", icon: KeyRound, category: "Community" },
  { key: "point-matrix", label: "Point Matrix", href: "/teacher/point-matrix", icon: Award, category: "Community" },
  { key: "notifications", label: "Notification Studio", href: "/teacher/notifications", icon: Bell, category: "Community" },

  // ── Account & Systems ──
  { key: "security", label: "Security & Logs", href: "/teacher/security", icon: Shield, category: "Account" },
  { key: "settings", label: "Portal Settings", href: "/teacher/settings", icon: Settings, category: "Account" },
  { key: "profile", label: "Profile & Settings", href: "/teacher/profile", icon: User, category: "Account" },
];

export default function TeacherLayout() {
  const { isPageAssigned } = usePortalAccess();

  const filteredNavItems = useMemo(() => {
    return rawNavItems.filter((item) => isPageAssigned(item.key));
  }, [isPageAssigned]);

  const showProfile = isPageAssigned("profile");

  return (
    <PortalShell
      role="TEACHER"
      portalName="Teacher Portal"
      subtitle="Teacher Dashboard"
      roleLabel="Teacher"
      navItems={filteredNavItems}
      profileLinks={showProfile ? [{ label: "My Profile", href: "/teacher/profile", icon: User }] : []}
    />
  );
}
