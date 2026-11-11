/** Date helpers so screens follow the real calendar instead of a fixed demo date. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD in the user's local time zone. */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Roster period for a date, e.g. "2026-11". */
export function currentPeriod(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "2026-11" -> "November 2026" */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** YYYY-MM-DD that is `days` after the given ISO date (or today). */
export function addDaysISO(days: number, from: string = todayISO()): string {
  const [y, m, d] = from.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}
