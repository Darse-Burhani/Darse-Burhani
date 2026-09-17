"use client";

import { useMemo } from "react";
import {
  Activity,
  BookOpen,
  Clock,
  CalendarDays,
  Heart,
  FileText,
  ClipboardCheck,
  ClipboardList,
  User,
  ShoppingBag,
  FileSpreadsheet,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

const rawNavItems = [
  { key: "dashboard", label: "Dashboard", href: "/teacher", icon: Activity },
  { key: "classes", label: "My Classes", href: "/teacher/classes", icon: BookOpen },
  { key: "takhteet", label: "Takhteet", href: "/teacher/takhteet", icon: ClipboardList },
  { key: "attendance", label: "Attendance", href: "/teacher/attendance", icon: Clock },
  { key: "attendance", label: "Leave Requests", href: "/teacher/leave", icon: CalendarDays },
  { key: "faculty", label: "Faculty Portal", href: "/faculty/attendance", icon: ClipboardCheck },
  { key: "calendar", label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
  { key: "hifz", label: "Hifz Reports", href: "/teacher/hifz", icon: FileText },
  { key: "hifz-weekly-slip", label: "Hifz Weekly Slips", href: "/teacher/hifz-weekly-slip", icon: FileSpreadsheet },
  { key: "procurement", label: "Procurement", href: "/teacher/procurement", icon: ShoppingBag },
  { key: "profile", label: "My Profile", href: "/teacher/profile", icon: User },
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
