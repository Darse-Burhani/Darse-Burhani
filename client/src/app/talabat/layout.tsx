"use client";

import { useMemo } from "react";
import {
  Activity,
  Clock,
  CalendarDays,
  BookMarked,
  BookOpen,
  Shield,
  BarChart3,
  User,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

const rawNavItems = [
  { key: "dashboard", label: "Dashboard", href: "/talabat", icon: Activity },
  { key: "attendance", label: "Attendance", href: "/talabat/attendance", icon: Clock },
  { key: "attendance", label: "Leave Requests", href: "/talabat/leave-request", icon: CalendarDays },
  { key: "calendar", label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
  { key: "hifz", label: "Hifz Journey", href: "/talabat/hifz", icon: BookMarked },
  { key: "hifz", label: "Hifz Marhala", href: "/talabat/hifz-marhala", icon: BookOpen },
  { key: "library", label: "Library", href: "/talabat/library", icon: BookOpen },
  { key: "skillTree", label: "Skill Tree", href: "/talabat/skill-tree", icon: BarChart3 },
  { key: "badges", label: "Badges", href: "/talabat/badges", icon: Shield },
  { key: "profile", label: "My Profile", href: "/talabat/profile", icon: User },
];

export default function TalabatLayout() {
  const { isModuleVisible } = usePortalAccess();

  const filteredNavItems = useMemo(() => {
    return rawNavItems.filter((item) => isModuleVisible(item.key, "STUDENT"));
  }, [isModuleVisible]);

  const showProfile = isModuleVisible("profile", "STUDENT");

  return (
    <PortalShell
      role="STUDENT"
      portalName="Talabat Portal"
      subtitle="Student Portal"
      roleLabel="Student"
      navItems={filteredNavItems}
      profileLinks={showProfile ? [{ label: "My Profile", href: "/talabat/profile", icon: User }] : []}
    />
  );
}
