"use client";

import {
  Activity,
  CalendarDays,
  Clock,
  BookOpen,
  Settings,
  GraduationCap,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";

const navItems = [
  { label: "Dashboard", href: "/parent", icon: Activity },
  { label: "Yearly Profile (Rabea)", href: "/parent/yearly-profile", icon: GraduationCap },
  { label: "Activity Log", href: "/parent/activity", icon: Clock },
  { label: "School Calendar", href: "/fatimi-calendar", icon: CalendarDays },
  { label: "Account Settings", href: "/parent/settings", icon: Settings },
];

export default function ParentLayout() {
  return (
    <PortalShell
      role="PARENT"
      portalName="Parent Portal"
      subtitle="Parent Portal"
      roleLabel="Parent"
      navItems={navItems}
    />
  );
}
