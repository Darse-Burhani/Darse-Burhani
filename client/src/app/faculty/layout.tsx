"use client";

import { Clock, CalendarDays } from "lucide-react";
import { PortalShell } from "@/components/PortalShell";

const navItems = [
  { label: "Attendance", href: "/faculty/attendance", icon: Clock },
  { label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
];

export default function FacultyLayout() {
  return (
    <PortalShell
      role="TEACHER"
      portalName="Faculty Portal"
      subtitle="Manual Attendance"
      roleLabel="Faculty"
      navItems={navItems}
      searchPlaceholder="Search talabat…"
    />
  );
}
