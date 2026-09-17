"use client";

import {
  Activity,
  CalendarDays,
  Clock,
  BookOpen,
  Settings,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";

const navItems = [
  { label: "Dashboard", href: "/parent", icon: Activity },
  { label: "Activity Log", href: "/parent/activity", icon: Clock },
  { label: "Hifz Reports", href: "/parent/hifz", icon: BookOpen },
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
