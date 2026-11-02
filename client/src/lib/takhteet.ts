export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(month?: number | null): string {
  if (!month) return "—";
  return MONTH_NAMES[month - 1] || `Month ${month}`;
}

export const TAKHTEET_STATUS_META: Record<
  string,
  { label: string; badge: string; bar: string; iconColor: string; bgSoft: string }
> = {
  PENDING: {
    label: "Pending",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    bar: "bg-slate-300 dark:bg-slate-700",
    iconColor: "text-slate-500",
    bgSoft: "bg-slate-50 dark:bg-slate-900",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    bar: "bg-gradient-to-r from-amber-500 to-yellow-500",
    iconColor: "text-amber-600 dark:text-amber-400",
    bgSoft: "bg-amber-50/50 dark:bg-amber-950/20",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-500",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bgSoft: "bg-emerald-50/50 dark:bg-emerald-950/20",
  },
};

export function statusMeta(status: string) {
  return TAKHTEET_STATUS_META[status] || TAKHTEET_STATUS_META.PENDING;
}
