"use client";

import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  Users,
  GraduationCap,
  Heart,
  Layers,
  UserCheck,
  Fingerprint,
  Mail,
  Clock,
  Megaphone,
  ShieldCheck,
  Award,
  ShoppingBag,
  Barcode,
  KeyRound,
} from "lucide-react";
import { PortalShell, type PortalNavItem } from "@/components/PortalShell";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { useSession } from "next-auth/react";

const navItems: PortalNavItem[] = [
  // ── Operations & Attendance ──
  {
    label: "Dashboard",
    href: "/admin",
    icon: Activity,
    shortcut: "1",
    category: "Operations",
  },
  {
    label: "Biometric Scanners",
    href: "/admin/biometric",
    icon: Fingerprint,
    badge: "Live",
    category: "Operations",
  },
  {
    label: "Attendance Logs",
    href: "/admin/attendance-logs",
    icon: Layers,
    category: "Operations",
  },
  {
    label: "Leave Management",
    href: "/admin/leave",
    icon: CalendarDays,
    category: "Operations",
  },
  {
    label: "Attendance Schedule",
    href: "/admin/attendance-schedule",
    icon: Clock,
    category: "Operations",
  },
  {
    label: "Email Reports",
    href: "/admin/attendance-emails",
    icon: Mail,
    category: "Operations",
  },
  {
    label: "Individual Tracking",
    href: "/admin/tracking",
    icon: BarChart3,
    category: "Operations",
  },
  {
    label: "Procurement Requisitions",
    href: "/admin/procurement",
    icon: ShoppingBag,
    category: "Operations",
  },

  // ── Academics & Takhteet ──
  {
    label: "Classes",
    href: "/admin/classes",
    icon: BookOpen,
    category: "Academics",
  },
  {
    label: "Timetable Matrix",
    href: "/admin/timetable",
    icon: CalendarDays,
    category: "Academics",
  },
  {
    label: "Quran & Hifz",
    href: "/admin/hifz",
    icon: FileText,
    category: "Academics",
  },
  {
    label: "Hifz Marhala",
    href: "/admin/hifz-marhala",
    icon: GraduationCap,
    category: "Academics",
  },
  {
    label: "Takhteet Curriculum",
    href: "/admin/takhteet",
    icon: ClipboardList,
    category: "Academics",
  },

  // ── Talabat & Community ──
  {
    label: "Talabat (Students)",
    href: "/admin/students",
    icon: GraduationCap,
    category: "Community",
  },
  {
    label: "Parents Directory",
    href: "/admin/parents",
    icon: Heart,
    category: "Community",
  },
  {
    label: "Staff & Users",
    href: "/admin/users",
    icon: Users,
    category: "Community",
  },
  {
    label: "User Passwords",
    href: "/admin/passwords",
    icon: KeyRound,
    category: "Community",
  },
  {
    label: "Portal Assignments",
    href: "/admin/portal-assignments",
    icon: UserCheck,
    category: "Community",
  },

  // ── Systems & Governance ──
  {
    label: "Makhzan (Warehouse)",
    href: "/admin/makhzn",
    icon: Barcode,
    category: "Systems",
  },
  {
    label: "Library",
    href: "/admin/library",
    icon: Layers,
    category: "Systems",
  },
  {
    label: "Point Matrix",
    href: "/admin/point-matrix",
    icon: Award,
    category: "Systems",
  },
  {
    label: "Broadcast Studio",
    href: "/admin/notifications",
    icon: Megaphone,
    category: "Systems",
  },
  {
    label: "Security & Audit",
    href: "/admin/security",
    icon: ShieldCheck,
    category: "Systems",
  },
];

export default function AdminLayout() {
  const { data: session } = useSession();
  const isTeacher = session?.user?.role === "TEACHER";

  return (
    <>
      <CommandPalette />
      <PortalShell
        role={isTeacher ? "TEACHER" : "ADMIN"}
        portalName={isTeacher ? "Darse Burhani Management" : "Admin Portal"}
        subtitle={isTeacher ? "Teacher & Admin Operations" : "Admin Command"}
        roleLabel={isTeacher ? "Teacher (Admin Access)" : "Admin"}
        navItems={navItems}
        searchPlaceholder="Type ⌘K to search or jump..."
      />
    </>
  );
}
