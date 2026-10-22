import { useMemo } from "react";
import {
  Activity,
  CalendarDays,
  Clock,
  Settings,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";

export default function ParentLayout() {
  const navItems = useMemo(
    () => [
      { label: "Dashboard", href: "/parent", icon: Activity },
      { label: "Activity Log", href: "/parent/activity", icon: Clock },
      { label: "School Calendar", href: "/fatimi-calendar", icon: CalendarDays },
      { label: "Account Settings", href: "/parent/settings", icon: Settings },
    ],
    []
  );

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

