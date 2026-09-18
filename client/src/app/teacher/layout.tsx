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
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

const rawNavItems = [
  { key: "dashboard", label: "Dashboard", href: "/teacher", icon: Activity, category: "Overview" },
  { key: "classes", label: "Classes", href: "/teacher/classes", icon: BookOpen, category: "Academics" },
  { key: "quran", label: "Quran (Hifz)", href: "/teacher/hifz", icon: Sparkles, category: "Academics" },
  { key: "takhteet", label: "Takhteet", href: "/teacher/takhteet", icon: Layers, category: "Academics" },
  { key: "attendance-logs", label: "Attendance Logs", href: "/admin/attendance-logs", icon: FileText, category: "Attendance" },
  { key: "attendance-schedule", label: "Attendance Schedule", href: "/admin/attendance-schedule", icon: Clock, category: "Attendance" },
  { key: "email-reports", label: "Email Reports", href: "/admin/attendance-emails", icon: Mail, category: "Attendance" },
  { key: "leave", label: "Leave Management", href: "/admin/leave", icon: CalendarCheck, category: "Operations" },
  { key: "procurement", label: "Procurement", href: "/admin/procurement", icon: ShoppingBag, category: "Operations" },
  { key: "makhzan", label: "Makhzan", href: "/admin/library", icon: Package, category: "Operations" },
  { key: "library", label: "Library", href: "/admin/library", icon: Library, category: "Library" },
  { key: "profile", label: "Profile & Settings", href: "/teacher/profile", icon: User, category: "Account" },
];

export default function TeacherLayout() {
  const { isModuleVisible } = usePortalAccess();

  const filteredNavItems = useMemo(() => {
    return rawNavItems.filter((item) => isModuleVisible(item.key, "TEACHER"));
  }, [isModuleVisible]);

  const showProfile = isModuleVisible("profile", "TEACHER");

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
