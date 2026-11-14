"use client";

import { Clock, BookOpen } from "lucide-react";
import { PortalShell } from "@/components/PortalShell";

const navItems = [
  { label: "Attendance", href: "/faculty/attendance", icon: Clock },
  { label: "Tilawat Dua", href: "/faculty/tilawat-dua", icon: BookOpen },
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
