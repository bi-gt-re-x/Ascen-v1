/**
 * The calendar's event store — the browser's, not the backend's.
 *
 * Events created on the calendar (the "Add New Event" dialog and everything
 * that recurs from it) have always lived in localStorage under
 * `calendarData:<account>`, written by calendar-month.js.
 * The backend has endpoints for calendar entries, but the month, week and day
 * views never used them, so every event any user of this app has ever made is
 * in this store and nowhere else. Moving the port onto the API would therefore
 * not be a refactor — it would be every existing calendar going blank. So the
 * keys, the shapes and the unpadded `YYYY-M-D` date keys are kept exactly, and
 * the store is read and written here instead of being spread across three
 * files.
 *
 * Tasks are the other half of the calendar and are not in here at all: they
 * come from the database (`/api/get_user_data`), and only those flagged
 * `show_on_calendar` are ever drawn.
 *
 * The date key deserves its own warning. This store uses `2026-7-4`; every
 * other part of the app uses real ISO `2026-07-04`. `monthKey` and `isoOf`
 * convert, and nothing should build either by hand.
 */

/** One block on a day: an event, or a task the day panel has materialised. */
export interface CalendarSection {
  /** "HH:MM", 24-hour. Empty on a finished to-do, which has only an end. */
  startTime: string;
  endTime: string;
  /** The name. Called `task` because that is what the store has always called it. */
  task: string;
  recurrence?: RecurrenceType;
  recurrenceDays?: number[];
  xp?: number;
  /** `#rrggbb`, assigned once per event and copied to all its recurrences. */
  color?: string;
  /** The pre-hex palette index. Legacy events still carry it. */
  colorIndex?: number;
  subtasks?: Subtask[];
  hasSubtasks?: boolean;
  /** True for a task the day panel placed here; false for a real event. */
  isDashboardTask?: boolean;
  dashboardTaskId?: string;
  completed?: boolean;
  /** A to-do that reached the calendar by being finished. Never persisted. */
  completedTodo?: boolean;
  hasConflict?: boolean;
}

export type Subtask = string | { text: string; xp?: number; taskId?: string; completed?: boolean };

export type RecurrenceType = 'none' | 'weekly' | 'monthly';

export interface CalendarDay {
  timestamps: CalendarSection[];
  /** The legacy per-day note. The live one is the shared store — see useDayFocus. */
  focus?: string;
}

/** Every day that has anything on it, keyed "YYYY-M-D" (unpadded). */
export type CalendarData = Record<string, CalendarDay>;

// --------------------------------------------------------------------------
// Keys
// --------------------------------------------------------------------------
/**
 * Storage is per account.
 *
 * It was not always: every account signing in on one machine used to share
 * `calendarData`, and each other's events with it. The scoping was the fix,
 * and the key shape is load-bearing — change it and every existing calendar
 * reads as empty.
 */
export function userScopedKey(base: string, username: string | null): string {
  return `${base}:${username || 'Default'}`;
}

/** The store's key for an ISO date: "2026-07-04" -> "2026-7-4". */
export function monthKey(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${year}-${month}-${day}`;
}

/** The ISO date for a store key: "2026-7-4" -> "2026-07-04". */
export function isoOf(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month ?? 1)}-${pad(day ?? 1)}`;
}

// --------------------------------------------------------------------------
// Reading and writing
// --------------------------------------------------------------------------
export function loadCalendarData(username: string | null): CalendarData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      localStorage.getItem(userScopedKey('calendarData', username)) || '{}',
    );
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};

  const data = parsed as CalendarData;
  // A day whose entries are gone is a day that should not be in the store.
  Object.keys(data).forEach((key) => {
    const day = data[key];
    if (!day || !Array.isArray(day.timestamps)) delete data[key];
  });
  return data;
}

/**
 * Write the store back.
 *
 * Two things are dropped on the way out, both because they are derived: a
 * finished to-do's card (rebuilt from the database every time its day is
 * opened — a saved copy would outlive the task being re-opened or deleted),
 * and empty subtasks.
 */
export function saveCalendarData(username: string | null, data: CalendarData): void {
  const clean: CalendarData = {};

  Object.keys(data).forEach((dateKey) => {
    const day = data[dateKey];
    if (!day) return;
    clean[dateKey] = {
      focus: day.focus,
      timestamps: day.timestamps
        .filter((section) => !section.completedTodo)
        .map((section) => {
          if (!section.subtasks?.length) return section;
          const kept = section.subtasks.filter((sub) =>
            typeof sub === 'string' ? sub.trim() !== '' : (sub.text || '').trim() !== '',
          );
          if (!kept.length) {
            const { subtasks: _subtasks, hasSubtasks: _hasSubtasks, ...rest } = section;
            return rest;
          }
          return { ...section, subtasks: kept };
        }),
    };
  });

  try {
    localStorage.setItem(
      userScopedKey('calendarData', username),
      JSON.stringify(clean),
    );
  } catch {
    /* private mode, or the quota is full: the day is still on screen */
  }
}

// --------------------------------------------------------------------------
// Recurrence
// --------------------------------------------------------------------------
/** How far a recurring event is written ahead. The dialog says so too. */
const RECURRENCE_MONTHS = 12;

/**
 * Every date key a recurrence lands on, over the next twelve months.
 *
 * Weekly repeats on the chosen days of the week, monthly on the chosen days of
 * the month — skipping the months too short to have one, so a 31st does not
 * silently become a 1st. The base date is excluded: the caller writes that one
 * itself, and only if it matches the pattern.
 */
export function recurringDateKeys(
  baseKey: string,
  type: RecurrenceType,
  days: number[],
): string[] {
  if (type === 'none' || !days.length) return [];

  const [startYear, startMonth] = baseKey.split('-').map(Number);
  if (!startYear || !startMonth) return [];
  const out: string[] = [];

  if (type === 'weekly') {
    const end = new Date(startYear, startMonth - 1 + RECURRENCE_MONTHS, 0);
    const cursor = new Date(startYear, startMonth - 1, 1);
    while (cursor <= end) {
      if (days.includes(cursor.getDay())) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
        if (key !== baseKey) out.push(key);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  for (let offset = 0; offset < RECURRENCE_MONTHS; offset++) {
    const month = new Date(startYear, startMonth - 1 + offset, 1);
    const year = month.getFullYear();
    const monthNumber = month.getMonth() + 1;
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    days.forEach((day) => {
      if (day > daysInMonth) return;
      const key = `${year}-${monthNumber}-${day}`;
      if (key !== baseKey) out.push(key);
    });
  }
  return out;
}

/** Whether a date is one the pattern would have chosen. */
export function matchesRecurrence(
  dateKey: string,
  type: RecurrenceType,
  days: number[],
): boolean {
  if (type === 'none') return true;
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return false;
  return type === 'weekly'
    ? days.includes(new Date(year, month - 1, day).getDay())
    : days.includes(day);
}

/**
 * Two entries are the same event when their name and both times match.
 *
 * The store has no id for an event — a recurrence is a copy, not a reference —
 * so this is what "all occurrences" means when one is edited or deleted.
 */
export function isSameEvent(a: CalendarSection, b: CalendarSection): boolean {
  return (
    !a.isDashboardTask &&
    !b.isDashboardTask &&
    a.task === b.task &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime
  );
}

// --------------------------------------------------------------------------
// The week's own two notes
// --------------------------------------------------------------------------
/** The week's focus line, kept per account and per Monday. */
export function loadWeeklyFocus(username: string | null, mondayIso: string): string {
  try {
    return localStorage.getItem(`wkFocus:${username || 'Default'}:${mondayIso}`) || '';
  } catch {
    return '';
  }
}

export function saveWeeklyFocus(
  username: string | null,
  mondayIso: string,
  text: string,
): void {
  try {
    localStorage.setItem(`wkFocus:${username || 'Default'}:${mondayIso}`, text);
  } catch {
    /* private mode: this week's focus lasts as long as the tab does */
  }
}

/** The four numbers the weekly overview shows. */
export interface WeekSnapshot {
  total: number;
  done: number;
  rate: number;
  xp: number;
}

/**
 * A finished week's overview, frozen.
 *
 * Once a week is over its numbers should stop moving: editing or deleting a
 * task months later must not rewrite what that week amounted to. The current
 * week keeps its snapshot fresh, so whatever it holds when the week ends is
 * what stays.
 */
export function loadWeekSnapshots(username: string | null): Record<string, WeekSnapshot> {
  try {
    const raw = localStorage.getItem(userScopedKey('wkOverviewSnapshots', username));
    return raw ? (JSON.parse(raw) as Record<string, WeekSnapshot>) : {};
  } catch {
    return {};
  }
}

export function saveWeekSnapshot(
  username: string | null,
  mondayIso: string,
  snapshot: WeekSnapshot,
): void {
  const all = loadWeekSnapshots(username);
  all[mondayIso] = snapshot;
  try {
    localStorage.setItem(
      userScopedKey('wkOverviewSnapshots', username),
      JSON.stringify(all),
    );
  } catch {
    /* private mode: past weeks recompute instead of freezing */
  }
}

// --------------------------------------------------------------------------
// Conflicts
// --------------------------------------------------------------------------
/**
 * Mark the entries a day cannot honour: a zero-length block, or two blocks
 * booked for exactly the same span.
 *
 * Only *identical* spans count here, deliberately. Merely overlapping blocks
 * are the week grid's business, which stops the reader and makes them delete
 * one; the day panel would be crying wolf on a pair the grid already handles.
 */
export function markConflicts(sections: CalendarSection[]): CalendarSection[] {
  const conflicted = new Set<number>();

  sections.forEach((section, index) => {
    if (section.startTime && section.startTime === section.endTime) {
      conflicted.add(index);
    }
  });

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i];
      const b = sections[j];
      if (!a || !b) continue;
      if (a.startTime === b.startTime && a.endTime === b.endTime) {
        conflicted.add(i);
        conflicted.add(j);
      }
    }
  }

  return sections.map((section, index) => ({
    ...section,
    hasConflict: conflicted.has(index),
  }));
}
