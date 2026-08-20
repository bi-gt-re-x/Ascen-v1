/**
 * Turning a pile of record entries into a hall of fame.
 *
 * ## The one idea
 *
 * A row in the `records` table is an *entry*, not a record. "AMC 8, best 25"
 * is not stored anywhere — it is every row named "AMC 8", and the best of them
 * is the largest. Everything this module does follows from that:
 *
 *     the best         the largest `value` among the rows
 *     the evolution    those rows in date order — 18 → 20 → 21 → 23 → 25
 *     "+7 since first" the best minus the earliest
 *     "NEW RECORD"     the most recent entry is also the largest
 *
 * Which is why nothing here is stored and nothing is written back. It is all a
 * view of rows the page already holds, recomputed when they change.
 *
 * ## Bigger is better, and that is an assumption
 *
 * Every comparison here treats the larger number as the better one. That is
 * right for scores, streaks, levels and problems solved, and wrong for a
 * personal best measured in time — a five-minute mile beats a six-minute one.
 * The app has no way to know which it is looking at, and guessing from the
 * unit would be wrong the first time somebody logs "minutes practised", which
 * is a *bigger-is-better* duration. So it is uniform and documented rather
 * than clever and occasionally baffling. A `lower_is_better` flag on the row
 * is the honest fix and it is a migration.
 */
import type { RecordRow } from '@/services/records';

const DAY = 86_400_000;

/** How recently the newest entry must land to still read as "new". */
export const FRESH_DAYS = 30;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
/**
 * A figure, printed the way its unit asks.
 *
 * Minutes become "4h 18m" because that is how anybody says a coding session,
 * and 258 is a number you have to do arithmetic on to understand. Everything
 * else is the number and its unit, with the unit dropped when it is one of the
 * generic ones that adds nothing beside a score.
 */
export function formatValue(value: number, unit: string, target = 0): string {
  const clean = Math.round(value * 100) / 100;

  if (unit === 'minutes') {
    const total = Math.max(0, Math.round(clean));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    const span = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    return target > 0 ? `${span} / ${formatValue(target, 'minutes')}` : span;
  }

  const shown = clean.toLocaleString();
  if (target > 0) return `${shown} / ${(Math.round(target * 100) / 100).toLocaleString()}`;
  return unit && unit !== 'points' ? `${shown} ${unit}` : shown;
}

/** "Aug 12, 2026", or "—" for a milestone that has not happened. */
export function formatOn(iso: string): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  // Built from parts, not `new Date(iso)`: a bare YYYY-MM-DD parses as UTC and
  // prints a day early anywhere behind it. Same reasoning as the goals calendar.
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const time = (iso: string): number => {
  if (!iso) return 0;
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).getTime() : 0;
};

// ---------------------------------------------------------------------------
// One record, across its entries
// ---------------------------------------------------------------------------
export interface Best {
  name: string;
  category: string;
  unit: string;
  target: number;
  /** The largest entry. */
  value: number;
  /** When the best was set. */
  on: string;
  /** The earliest entry's value, for "+4 since first". */
  first: number;
  /** How many entries there are. One means there is no progression to show. */
  entries: number;
  /** Every entry, oldest first — the evolution. */
  history: RecordRow[];
  /** The newest entry is also the largest, and recent. Draws "NEW RECORD". */
  fresh: boolean;
}

/**
 * Group record entries by name and reduce each group to its best.
 *
 * Milestones are not included: they carry no figure, so "best" is meaningless
 * for them and they have their own section on the page.
 */
export function personalBests(rows: RecordRow[], today: Date = new Date()): Best[] {
  const groups = new Map<string, RecordRow[]>();
  for (const row of rows) {
    if (row.kind !== 'record') continue;
    const key = row.name.trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const out: Best[] = [];
  for (const entries of groups.values()) {
    const history = [...entries].sort((a, b) => time(a.achieved_on) - time(b.achieved_on));
    const top = history.reduce((best, row) => (row.value > best.value ? row : best), history[0]!);
    const newest = history[history.length - 1]!;
    const oldest = history[0]!;

    out.push({
      name: top.name,
      category: top.category,
      unit: top.unit,
      target: top.target,
      value: top.value,
      on: top.achieved_on,
      first: oldest.value,
      entries: history.length,
      history,
      fresh:
        newest.id === top.id &&
        history.length > 1 &&
        time(newest.achieved_on) > today.getTime() - FRESH_DAYS * DAY,
    });
  }

  // Most recently set first: a hall of fame opens on what you just did.
  return out.sort((a, b) => time(b.on) - time(a.on) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// The page's headline figures
// ---------------------------------------------------------------------------
export interface Tally {
  records: number;
  milestones: number;
  categories: number;
  /** Bests set this calendar month — the "all-time bests this month" tile. */
  thisMonth: number;
}

export function tally(rows: RecordRow[], today: Date = new Date()): Tally {
  const bests = personalBests(rows, today);
  const categories = new Set(
    rows.map((row) => row.category.trim()).filter(Boolean),
  );
  const month = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}`;

  return {
    // Every entry, not every name: 127 records means 127 things logged.
    records: rows.filter((row) => row.kind === 'record').length,
    milestones: rows.filter((row) => row.kind === 'milestone').length,
    categories: categories.size,
    thisMonth: bests.filter((best) => best.on.startsWith(month)).length,
  };
}

/** The category names in use, most-used first, for the filter row. */
export function categories(rows: RecordRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.category.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

// ---------------------------------------------------------------------------
// The timeline, and the filter bar
// ---------------------------------------------------------------------------
/** Everything with a date, newest first — records and milestones together. */
export function timeline(rows: RecordRow[], limit = 12): RecordRow[] {
  return rows
    .filter((row) => Boolean(row.achieved_on))
    .sort((a, b) => time(b.achieved_on) - time(a.achieved_on))
    .slice(0, limit);
}

export type Show = 'all' | 'records' | 'milestones';
export type Sort = 'newest' | 'oldest' | 'improvement' | 'category';

/**
 * The search-and-sort bar at the foot of the page.
 *
 * `improvement` sorts by how far a record has come rather than how large it
 * is, which is the ordering the page is actually about — a score that went
 * 18 → 25 is a better story than one logged once at 400.
 */
export function filterRows(
  rows: RecordRow[],
  { query = '', show = 'all' as Show, sort = 'newest' as Sort } = {},
): RecordRow[] {
  const needle = query.trim().toLowerCase();
  const gains = new Map<string, number>();
  for (const best of personalBests(rows)) {
    gains.set(best.name.trim().toLowerCase(), best.value - best.first);
  }

  return rows
    .filter((row) => (show === 'all' ? true : show === 'records' ? row.kind === 'record' : row.kind === 'milestone'))
    .filter(
      (row) =>
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.category.toLowerCase().includes(needle) ||
        row.note.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      if (sort === 'oldest') return time(a.achieved_on) - time(b.achieved_on);
      if (sort === 'category') {
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      }
      if (sort === 'improvement') {
        const ga = gains.get(a.name.trim().toLowerCase()) ?? 0;
        const gb = gains.get(b.name.trim().toLowerCase()) ?? 0;
        return gb - ga || time(b.achieved_on) - time(a.achieved_on);
      }
      return time(b.achieved_on) - time(a.achieved_on);
    });
}

// ---------------------------------------------------------------------------
// Milestones, in two levels
// ---------------------------------------------------------------------------
/**
 * A key milestone and the smaller ones it folds up.
 *
 * There is no parent column on the table and this does not want one. A
 * milestone already carries a `category` — the reader's own heading, "Full-stack
 * project", "Competitive Math" — and a heading with several things under it is
 * exactly what a key milestone is. So the grouping is read out of what the
 * account already typed rather than asked for a second time.
 */
export interface KeyMilestone {
  /** The category, lowercased — the key the open/shut state is remembered by. */
  key: string;
  /** The category as it was typed, which is what the row is titled. */
  name: string;
  /** The smaller milestones, in the order the server sent them. */
  children: RecordRow[];
  /** How many of them have a date. `reached === children.length` draws the tick. */
  reached: number;
  /** The newest date among them, or '' while none has happened. */
  on: string;
}

/**
 * Split milestones into the key ones and the loose ones.
 *
 * **A category of one is not a key milestone.** It is a milestone, and it draws
 * as one, at the top level beside the keys. Folding a single row behind a
 * disclosure hides it and saves nothing; the point of the two levels is that
 * eleven milestones read as three lines until you ask for more.
 *
 * Uncategorised milestones are loose for the same reason — they share no
 * heading, so there is nothing to file them under but "Other", and a group
 * called "Other" is a list with a lid on it.
 *
 * Keys sort by their newest achievement, so the thing you are furthest through
 * is at the top; a key nobody has started yet has no date and sorts last, which
 * is the ordering `_mine` already applies to rows in backend/api/records.py.
 */
export function keyMilestones(rows: RecordRow[]): {
  keys: KeyMilestone[];
  loose: RecordRow[];
} {
  const groups = new Map<string, { name: string; children: RecordRow[] }>();
  const loose: RecordRow[] = [];

  for (const row of rows) {
    if (row.kind !== 'milestone') continue;
    const heading = row.category.trim();
    if (!heading) {
      loose.push(row);
      continue;
    }
    const key = heading.toLowerCase();
    const group = groups.get(key) ?? { name: heading, children: [] };
    group.children.push(row);
    groups.set(key, group);
  }

  const keys: KeyMilestone[] = [];
  for (const [key, group] of groups) {
    if (group.children.length < 2) {
      loose.push(...group.children);
      continue;
    }
    keys.push({
      key,
      name: group.name,
      children: group.children,
      reached: group.children.filter((row) => Boolean(row.achieved_on)).length,
      on: group.children.reduce(
        (latest, row) => (time(row.achieved_on) > time(latest) ? row.achieved_on : latest),
        '',
      ),
    });
  }

  // Both lists by the same rule, because the loose one is built in two passes
  // — the uncategorised as they arrive, the categories of one after every
  // group is known — and would otherwise print in the order it was assembled
  // rather than in any order a reader could name.
  const byRecency = (a: string, b: string, an: string, bn: string) => {
    if (Boolean(a) !== Boolean(b)) return a ? -1 : 1;
    return time(b) - time(a) || an.localeCompare(bn);
  };
  keys.sort((a, b) => byRecency(a.on, b.on, a.name, b.name));
  loose.sort((a, b) => byRecency(a.achieved_on, b.achieved_on, a.name, b.name));

  return { keys, loose };
}
