import { useMemo } from "react";
import {
  Activity,
  Clock,
  Settings,
  Fingerprint,
  BookOpen,
  Library,
  CalendarCheck,
  MessageSquareHeart,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

export default function ParentLayout() {
  const { isModuleVisible } = usePortalAccess();

  const allNavItems = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", href: "/parent", icon: Activity, category: "Academics" },
      { key: "activity", label: "Activity Log", href: "/parent/activity", icon: Clock, category: "Academics" },
      { key: "tracking", label: "Attendance & Scans", href: "/parent/tracking", icon: Fingerprint, category: "Academics" },
      { key: "timetable", label: "Class Timetable", href: "/parent/timetable", icon: BookOpen, category: "Academics" },
      { key: "library", label: "Library Books", href: "/parent/library", icon: Library, category: "Academics" },
      { key: "leave", label: "Leave Requests", href: "/parent/leave", icon: CalendarCheck, category: "Administration" },
      { key: "support", label: "Grievances & Feedback", href: "/parent/grievances", icon: MessageSquareHeart, category: "Administration" },
      { key: "settings", label: "Account Settings", href: "/parent/settings", icon: Settings, category: "Profile" },
    ],
    []
  );

  const navItems = useMemo(() => {
    return allNavItems.filter((item) => isModuleVisible(item.key, "PARENT"));
  }, [allNavItems, isModuleVisible]);

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

