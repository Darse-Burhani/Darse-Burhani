"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  CalendarDays,
  Clock,
  Settings,
  Fingerprint,
  BookOpen,
  Library,
  CalendarCheck,
  GraduationCap,
  ClipboardCheck,
  Shield,
  Layers,
  Users,
  Bell,
  User,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/PortalShell";

const adminNavItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: Activity, category: "Operations" },
  { label: "Attendance Scans", href: "/admin/attendance-hik", icon: Fingerprint, category: "Operations" },
  { label: "Manual Logs", href: "/admin/attendance-manual", icon: ClipboardCheck, category: "Operations" },
  { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays, category: "Operations" },
  { label: "Classes", href: "/admin/classes", icon: BookOpen, category: "Academics" },
  { label: "Takhteet", href: "/admin/takhteet", icon: Layers, category: "Academics" },
  { label: "Students", href: "/admin/students", icon: GraduationCap, category: "People" },
  { label: "Users", href: "/admin/users", icon: Users, category: "People" },
  { label: "Notifications", href: "/notifications", icon: Bell, category: "Systems" },
  { label: "Settings", href: "/admin/settings", icon: Settings, category: "Systems" },
];

const teacherNavItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: Activity, category: "Overview" },
  { label: "My Classes", href: "/teacher/classes", icon: BookOpen, category: "Academics" },
  { label: "Timetable Matrix", href: "/teacher/timetable", icon: CalendarDays, category: "Academics" },
  { label: "Takhteet", href: "/teacher/takhteet", icon: Layers, category: "Academics" },
  { label: "Attendance", href: "/teacher/attendance", icon: ClipboardCheck, category: "Attendance" },
  { label: "Hikvision Scans", href: "/teacher/attendance-hik", icon: Fingerprint, category: "Attendance" },
  { label: "Notifications", href: "/notifications", icon: Bell, category: "Account" },
  { label: "My Profile", href: "/teacher/profile", icon: User, category: "Account" },
];

const studentNavItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/talabat", icon: Activity, category: "General" },
  { label: "Class Timetable", href: "/talabat/timetable", icon: CalendarDays, category: "Academics" },
  { label: "Attendance", href: "/talabat/attendance", icon: Clock, category: "Academics" },
  { label: "Leave Records", href: "/talabat/leave-request", icon: CalendarCheck, category: "Academics" },
  { label: "Library", href: "/talabat/library", icon: Library, category: "Tools" },
  { label: "Badges", href: "/talabat/badges", icon: Shield, category: "General" },
  { label: "Notifications", href: "/notifications", icon: Bell, category: "Account" },
  { label: "My Profile", href: "/talabat/profile", icon: User, category: "Account" },
];

const parentNavItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/parent", icon: Activity, category: "Academics" },
  { label: "Activity Log", href: "/parent/activity", icon: Clock, category: "Academics" },
  { label: "Attendance & Scans", href: "/parent/tracking", icon: Fingerprint, category: "Academics" },
  { label: "Class Timetable", href: "/parent/timetable", icon: BookOpen, category: "Academics" },
  { label: "Library Books", href: "/parent/library", icon: Library, category: "Academics" },
  { label: "Leave Requests", href: "/parent/leave", icon: CalendarCheck, category: "Administration" },
  { label: "Notifications", href: "/notifications", icon: Bell, category: "Profile" },
  { label: "Account Settings", href: "/parent/settings", icon: Settings, category: "Profile" },
];

export default function NotificationsLayout() {
  const { data: session } = useSession();
  const role = (session?.user?.role as "ADMIN" | "TEACHER" | "STUDENT" | "PARENT") || "STUDENT";

  const { portalName, subtitle, roleLabel, navItems } = useMemo(() => {
    switch (role) {
      case "ADMIN":
        return {
          portalName: "Admin Executive Console",
          subtitle: "System Notifications & Broadcasts",
          roleLabel: "Admin",
          navItems: adminNavItems,
        };
      case "TEACHER":
        return {
          portalName: "Teacher Portal",
          subtitle: "Faculty Communications",
          roleLabel: "Teacher",
          navItems: teacherNavItems,
        };
      case "PARENT":
        return {
          portalName: "Parent Portal",
          subtitle: "Family & Student Notices",
          roleLabel: "Parent",
          navItems: parentNavItems,
        };
      case "STUDENT":
      default:
        return {
          portalName: "Talabat Portal",
          subtitle: "Academic Announcements",
          roleLabel: "Talabat",
          navItems: studentNavItems,
        };
    }
  }, [role]);

  return (
    <PortalShell
      role={role}
      portalName={portalName}
      subtitle={subtitle}
      roleLabel={roleLabel}
      navItems={navItems}
      searchPlaceholder="Search notifications or modules..."
    />
  );
}
