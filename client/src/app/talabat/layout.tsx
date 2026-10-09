"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  Clock,
  CalendarDays,
  BookMarked,
  BookOpen,
  Shield,
  BarChart3,
  User,
  ClipboardList,
  Palette,
  GraduationCap,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

const rawNavItems = [
  { key: "dashboard", label: "Dashboard", href: "/talabat", icon: Activity },
  { key: "attendance", label: "Attendance", href: "/talabat/attendance", icon: Clock },
  { key: "attendance", label: "Leave Records", href: "/talabat/leave-request", icon: CalendarDays },
  { key: "calendar", label: "Calendar", href: "/fatimi-calendar", icon: CalendarDays },
  { key: "yearly-profile", label: "Yearly Profile", href: "/talabat/yearly-profile", icon: GraduationCap },
  { key: "hifz", label: "Hifz Journey", href: "/talabat/hifz", icon: BookMarked },
  { key: "hifz", label: "Hifz Marhala", href: "/talabat/hifz-marhala", icon: BookOpen },
  { key: "library", label: "Library", href: "/talabat/library", icon: BookOpen },
  { key: "assignments", label: "Assignments", href: "/talabat/assignments", icon: ClipboardList },
  { key: "hobbies", label: "Hobbies & Skills", href: "/talabat/hobbies", icon: Palette },
  { key: "skillTree", label: "Skill Tree", href: "/talabat/skill-tree", icon: BarChart3 },
  { key: "badges", label: "Badges", href: "/talabat/badges", icon: Shield },
  { key: "profile", label: "My Profile", href: "/talabat/profile", icon: User },
];

export default function TalabatLayout() {
  const { isModuleVisible } = usePortalAccess();
  const [isHafiz, setIsHafiz] = useState<boolean>(false);
  const [isGrade4, setIsGrade4] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/talabat/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && (data.status === "HAFIZ" || !!data.hafizYear)) {
          setIsHafiz(true);
        }
        const g = String(data?.grade || "").trim().toLowerCase();
        if (g === "4" || g === "darajah 4" || g === "grade 4" || g === "class 4" || g === "iv" || g === "4th") {
          setIsGrade4(true);
        }
      })
      .catch(() => {});
  }, []);

  const filteredNavItems = useMemo(() => {
    return rawNavItems.filter((item) => {
      // For Hafiz students, do not show Hifz pages
      if (isHafiz && item.key === "hifz") {
        return false;
      }
      // Only show Yearly Profile to Grade 4 students
      if (item.key === "yearly-profile" && !isGrade4) {
        return false;
      }
      if (item.key === "yearly-profile") {
        return true;
      }
      return isModuleVisible(item.key, "STUDENT");
    });
  }, [isModuleVisible, isHafiz, isGrade4]);

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
