import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  CalendarDays,
  Clock,
  Settings,
  GraduationCap,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";

const isRabeaGrade = (grade?: string | null) => {
  if (!grade) return false;
  const g = grade.trim().toLowerCase();
  return (
    g === "4" ||
    g === "iv" ||
    g === "4th" ||
    g.includes("rabea") ||
    g.includes("rabi'a") ||
    g.includes("الرابعة") ||
    g.includes("رابعة") ||
    g.includes("grade 4") ||
    g.includes("class 4") ||
    g.includes("darajah 4")
  );
};

export default function ParentLayout() {
  const [hasRabeaChild, setHasRabeaChild] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/parent/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data?.children)) {
          const hasRabea = json.data.children.some((c: any) => isRabeaGrade(c.grade));
          setHasRabeaChild(hasRabea);
        }
      })
      .catch(() => {});
  }, []);

  const navItems = useMemo(() => {
    const items = [
      { label: "Dashboard", href: "/parent", icon: Activity },
    ];
    if (hasRabeaChild) {
      items.push({
        label: "Yearly Profile (Rabea)",
        href: "/parent/yearly-profile",
        icon: GraduationCap,
      });
    }
    items.push(
      { label: "Activity Log", href: "/parent/activity", icon: Clock },
      { label: "School Calendar", href: "/fatimi-calendar", icon: CalendarDays },
      { label: "Account Settings", href: "/parent/settings", icon: Settings }
    );
    return items;
  }, [hasRabeaChild]);

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

