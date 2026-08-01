/**
 * Dates, in local time.
 *
 * One rule runs through all of this and it is the source of most calendar
 * bugs: **`toISOString()` is UTC.** West of Greenwich it reports yesterday for
 * anything before midnight-plus-offset, so a task completed at 8pm lands on the
 * wrong day, the streak looks broken, and the XP shows on the wrong square.
 *
 * The backend keys every day by local ISO date, so `isoDate` below builds it
 * from local parts and nothing here calls `toISOString` for a date key.
 */

/** A Date as "YYYY-MM-DD", in local time. Never UTC. */
export function isoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse "YYYY-MM-DD" as local midnight. `new Date(iso)` would parse it as UTC. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const shift = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - shift);
  return start;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return isoDate(a) === isoDate(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// --------------------------------------------------------------------------
// Display
// --------------------------------------------------------------------------
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const value = typeof date === 'string' ? fromIsoDate(date.slice(0, 10)) : date;
  return new Intl.DateTimeFormat(undefined, options).format(value);
}

/** "Fri, Aug 1" — the calendar's column headings. */
export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** "Good morning" / "Good afternoon" / "Good evening", by the clock. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
