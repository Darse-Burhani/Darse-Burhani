/**
 * Institutional Garamat (Library Late Fine) Calculation Rules
 * 
 * Rules:
 * 1. Default loan period: 7 days.
 * 2. On or before due date: No fine.
 * 3. Thursday Rule: If returned on Thursday and within the 1-day grace/due window (e.g. due on Thursday or Wednesday),
 *    no gharamat is shown on that day.
 * 4. Friday Rule: Returning a book whose due date was Thursday on Friday (or later) incurs Garamat (₹10/day).
 */

export function calculateGaramatDetails({
  dueAt,
  returnDate = new Date(),
  ratePerDay = 10,
  customAmount,
}: {
  dueAt: Date | string;
  returnDate?: Date | string;
  ratePerDay?: number;
  customAmount?: number;
}) {
  const dDue = new Date(dueAt);
  const dReturn = new Date(returnDate);

  // Normalize by calendar date in Asia/Kolkata (IST, UTC+5:30)
  const getISTDayStart = (d: Date) => {
    const istStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
    return new Date(`${istStr}T00:00:00+05:30`).getTime();
  };

  const dueDayStart = getISTDayStart(dDue);
  const returnDayStart = getISTDayStart(dReturn);

  // If returned on or before due date calendar day: No fine
  if (returnDayStart <= dueDayStart) {
    return { isLate: false, daysLate: 0, amount: 0, isThursdayGrace: false };
  }

  // Get weekday in IST: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const getISTDayOfWeek = (d: Date) => {
    const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[weekdayStr] ?? d.getDay();
  };

  const returnDayOfWeek = getISTDayOfWeek(dReturn);
  const diffCalendarDays = Math.round((returnDayStart - dueDayStart) / (1000 * 60 * 60 * 24));

  // Thursday Rule: "IF RETURN IS THURSDAY DONT SHOW GRAMAET ON THAT DAY"
  // If returned on Thursday and it was due on Thursday (or 1-day grace from Wednesday), NO gharamat on Thursday!
  if (returnDayOfWeek === 4 && diffCalendarDays <= 1) {
    return { isLate: false, daysLate: 0, amount: 0, isThursdayGrace: true };
  }

  // "RETURING BOOK OF THURSDAY IS RETUREND ON FRIDAY THEN SHOW GARAMAT"
  const daysLate = Math.max(1, diffCalendarDays);
  const amount = typeof customAmount === "number" ? customAmount : daysLate * ratePerDay;

  return {
    isLate: true,
    daysLate,
    amount,
    isThursdayGrace: false,
  };
}
