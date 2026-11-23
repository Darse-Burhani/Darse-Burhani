import {
  BookOpen,
  BookMarked,
  ArrowRight,
  Layers,
  UserCheck,
  Clock,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";
import type { HubTabItem } from "@/components/admin/AdminHubTabs";

/**
 * Canonical, humanized primary navigation tabs for the Maktabat / Library Hub.
 * Shared across all library sub-pages for consistency, fast pre-fetching, and clean UX.
 */
export const LIBRARY_HUB_TABS: HubTabItem[] = [
  { label: "Books & Catalog", href: "/admin/library", icon: BookOpen },
  { label: "Issued Books", href: "/admin/library/checkout?tab=issued", icon: BookMarked },
  { label: "Issue / Return", href: "/admin/library/checkout", icon: ArrowRight },
  { label: "Shelves & Racks", href: "/admin/library/shelves", icon: Layers },
  { label: "Attendance", href: "/admin/library/attendance", icon: UserCheck },
  { label: "Overdue & Fines", href: "/admin/library/overdue", icon: Clock },
  { label: "Shelf Audit", href: "/admin/library/auditor", icon: ShieldCheck },
  { label: "Overview", href: "/admin/library/overview", icon: LayoutDashboard },
];

export const LIBRARY_HUB_TITLE = "Maktabat Library";
export const LIBRARY_HUB_DESCRIPTION =
  "Book catalog, member loans, color-coded shelves, attendance, and overdue tracking.";
