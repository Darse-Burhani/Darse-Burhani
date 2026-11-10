import { useMemo } from "react";
import {
  Activity,
  CalendarDays,
  Clock,
  Settings,
} from "lucide-react";
import { PortalShell } from "@/components/PortalShell";
import { usePortalAccess } from "@/context/PortalAccessContext";

export default function ParentLayout() {
  const { isModuleVisible } = usePortalAccess();

  const allNavItems = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", href: "/parent", icon: Activity },
      { key: "activity", label: "Activity Log", href: "/parent/activity", icon: Clock },
      { key: "calendar", label: "School Calendar", href: "/fatimi-calendar", icon: CalendarDays },
      { key: "settings", label: "Account Settings", href: "/parent/settings", icon: Settings },
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

