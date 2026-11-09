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
  { label: string; badge: string; bar: string; iconColor: string; bgSoft: string; textStrong: string }
> = {
  PENDING: {
    label: "Pending",
    badge: "bg-slate-100 text-slate-900 border-slate-300 font-bold dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
    bar: "bg-slate-400 dark:bg-slate-600",
    iconColor: "text-slate-600 dark:text-slate-300",
    bgSoft: "bg-slate-50 dark:bg-slate-900/60",
    textStrong: "text-slate-900 dark:text-slate-100",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-amber-100 text-amber-950 border-amber-400 font-extrabold shadow-2xs dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700",
    bar: "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500",
    iconColor: "text-amber-700 dark:text-amber-300",
    bgSoft: "bg-amber-50/80 dark:bg-amber-950/30",
    textStrong: "text-amber-950 dark:text-amber-200",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-100 text-emerald-950 border-emerald-400 font-extrabold shadow-2xs dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700",
    bar: "bg-gradient-to-r from-emerald-600 to-teal-600",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    bgSoft: "bg-emerald-50/80 dark:bg-emerald-950/30",
    textStrong: "text-emerald-950 dark:text-emerald-200",
  },
};

export function statusMeta(status: string) {
  return TAKHTEET_STATUS_META[status] || TAKHTEET_STATUS_META.PENDING;
}
