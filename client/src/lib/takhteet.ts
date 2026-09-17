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
  { label: string; badge: string; bar: string }
> = {
  PENDING: {
    label: "Pending",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    bar: "bg-gray-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-100 text-[#047857] border-emerald-200",
    bar: "bg-[#047857]",
  },
};

export function statusMeta(status: string) {
  return TAKHTEET_STATUS_META[status] || TAKHTEET_STATUS_META.PENDING;
}
