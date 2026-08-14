/**
 * What the tasks page shows, decided here rather than while rendering.
 *
 * Everything in this file is a pure function of the task list and the reader's
 * controls. Nothing fetches, nothing holds state, and nothing knows what a
 * `<div>` is — which is what makes the page's behaviour testable without a
 * browser and what keeps the components to markup and handlers.
 *
 * ## Why a page, when the dashboard already lists tasks
 *
 * The dashboard answers *what should I do right now*, so its list is short,
 * ordered for today, and deliberately hard to get lost in. This page answers
 * *what have I got on*, which is a different question and needs the things the
 * dashboard refuses to grow: a search, filters that stack, a sort the reader
 * chooses, and selection so a dozen tasks can be dealt with at once. The two
 * read the same tasks through the same service; only the questions differ.
 */
import type { Task, TaskPriority } from '@/types';

const DAY = 86_400_000;

// --------------------------------------------------------------------------
// The controls
// --------------------------------------------------------------------------
/** Which tasks are on the page at all. */
export type StatusFilter = 'open' | 'done' | 'all';

/** How the list inside each group is ordered. */
export type SortKey = 'due' | 'priority' | 'xp' | 'created' | 'title';

export interface TaskQuery {
  status: StatusFilter;
  /** Matched against the title, case-insensitively. Empty means everything. */
  search: string;
  /** Subject ids to keep. Empty means every subject, and untagged tasks too. */
  subjects: string[];
  /** Priorities to keep. Empty means all three. */
  priorities: TaskPriority[];
  sort: SortKey;
  /** Sorts run ascending unless this says otherwise. */
  descending: boolean;
}

export const EMPTY_QUERY: TaskQuery = {
  status: 'open',
  search: '',
  subjects: [],
  priorities: [],
  sort: 'due',
  descending: false,
};

/**
 * The sorts, with the words each one describes its own direction in.
 *
 * Spelled out per key rather than assembled from "ascending" and "descending",
 * because those words mean nothing to a reader and are actively wrong for
 * priority: sorting it ascending puts *high* at the top, since high is rank
 * zero, so a generic "lowest first" would describe the list backwards.
 */
export const SORTS: Array<{
  key: SortKey;
  label: string;
  /** How the section heading names it: "Ordered by due date, …". */
  noun: string;
  /** What ascending and descending actually do to this field. */
  asc: string;
  desc: string;
}> = [
  { key: 'due', label: 'Due date', noun: 'due date', asc: 'soonest first', desc: 'latest first' },
  { key: 'priority', label: 'Priority', noun: 'priority', asc: 'highest first', desc: 'lowest first' },
  { key: 'xp', label: 'XP', noun: 'XP', asc: 'lowest first', desc: 'highest first' },
  { key: 'created', label: 'Added', noun: 'when it was added', asc: 'oldest first', desc: 'newest first' },
  { key: 'title', label: 'Name', noun: 'name', asc: 'A to Z', desc: 'Z to A' },
];

export const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];

/** High sorts before medium before low, whatever the words happen to be. */
const RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

// --------------------------------------------------------------------------
// When a task is due
// --------------------------------------------------------------------------
/**
 * The buckets the open list is cut into.
 *
 * Deliberately about *time to act* rather than the calendar: "this week" is the
 * next seven days rather than the days before Sunday, because a task due on
 * Monday is not more urgent on Sunday night than it was on Saturday morning.
 * `none` is last and is not a failure state — a task with no date is not late.
 */
export type Bucket =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'soon'
  | 'later'
  | 'none'
  | 'done'
  | 'all';

export const BUCKETS: Array<{ key: Bucket; label: string; hint: string }> = [
  { key: 'overdue', label: 'Overdue', hint: 'Past its date. Move it or finish it.' },
  { key: 'today', label: 'Due Today', hint: 'Due before the day is out.' },
  // Tomorrow is its own heading rather than the first day of "this week",
  // because it is the only future day a reader plans in the same breath as
  // today — everything past it is a week, not a day.
  { key: 'tomorrow', label: 'Tomorrow', hint: 'The next day up.' },
  { key: 'soon', label: 'This Week', hint: 'The week in front of you.' },
  { key: 'later', label: 'Later', hint: 'Dated, but not yet.' },
  { key: 'none', label: 'No date', hint: 'Real work, just not scheduled.' },
  { key: 'done', label: 'Completed', hint: 'Already behind you.' },
];

/** Midnight local, as a number — the day a stamp falls on, not the instant. */
function dayOf(value: string | undefined | null): number | null {
  if (!value) return null;
  const at = new Date(`${String(value).slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(at) ? null : at;
}

export function bucketOf(task: Task, today = new Date()): Bucket {
  if (task.status === 'done') return 'done';
  const due = dayOf(task.due_date);
  if (due === null) return 'none';
  const midnight = dayOf(today.toISOString().slice(0, 10)) ?? today.getTime();
  const days = Math.round((due - midnight) / DAY);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return days <= 7 ? 'soon' : 'later';
}

/** "3 days late", "today", "in 5 days" — the phrase a row prints for its date. */
export function dueLabel(task: Task, today = new Date()): string | null {
  const due = dayOf(task.due_date);
  if (due === null) return null;
  const midnight = dayOf(today.toISOString().slice(0, 10)) ?? today.getTime();
  const days = Math.round((due - midnight) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return '1 day late';
  if (days < 0) return `${Math.abs(days)} days late`;
  if (days <= 7) return `In ${days} days`;
  return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --------------------------------------------------------------------------
// Filtering and sorting
// --------------------------------------------------------------------------
/**
 * The reader's controls, applied in the order they think about them.
 *
 * Status first because it is the biggest cut, then the text, then the two
 * facet lists. An empty facet means "every one of these" rather than "none",
 * which is the only reading that lets a filter row start switched off.
 */
export function filterTasks(tasks: Task[], query: TaskQuery): Task[] {
  const needle = query.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (query.status === 'open' && task.status === 'done') return false;
    if (query.status === 'done' && task.status !== 'done') return false;

    if (needle) {
      const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (query.subjects.length > 0 && !query.subjects.includes(task.subject ?? '')) {
      return false;
    }
    if (query.priorities.length > 0 && !query.priorities.includes(task.priority)) {
      return false;
    }
    return true;
  });
}

/**
 * One comparison per sort key, with a stable fallback.
 *
 * Undated tasks sort to the end of a due-date sort in both directions. They are
 * not "the furthest away" — they are not on the axis at all — and letting them
 * lead a descending sort would put the least urgent work at the top of a list
 * the reader asked to be ordered by urgency.
 */
export function sortTasks(tasks: Task[], sort: SortKey, descending = false): Task[] {
  const direction = descending ? -1 : 1;

  return [...tasks].sort((a, b) => {
    switch (sort) {
      case 'due': {
        const left = dayOf(a.due_date);
        const right = dayOf(b.due_date);
        if (left === null && right === null) break;
        if (left === null) return 1;
        if (right === null) return -1;
        if (left !== right) return (left - right) * direction;
        break;
      }
      case 'priority': {
        const gap = RANK[a.priority] - RANK[b.priority];
        if (gap !== 0) return gap * direction;
        break;
      }
      case 'xp': {
        const gap = (Number(a.xp_value) || 0) - (Number(b.xp_value) || 0);
        if (gap !== 0) return gap * direction;
        break;
      }
      case 'created': {
        const gap = (dayOf(a.created_at) ?? 0) - (dayOf(b.created_at) ?? 0);
        if (gap !== 0) return gap * direction;
        break;
      }
      case 'title': {
        const gap = a.title.localeCompare(b.title);
        if (gap !== 0) return gap * direction;
        break;
      }
    }
    // Ties break on the id, so a re-render cannot shuffle two equal rows past
    // each other and make the list appear to move on its own.
    return String(a.id).localeCompare(String(b.id));
  });
}

export interface TaskGroup {
  key: Bucket;
  label: string;
  hint: string;
  tasks: Task[];
}

/**
 * The filtered, sorted list, cut into the sections the page draws.
 *
 * Grouped by due date **only when the reader is sorting by due date**, and one
 * flat list otherwise. The buckets are themselves an ordering by date, so
 * keeping them under a sort by XP meant the sort could only order rows inside a
 * group the reader had not asked for: picking "Sort: XP" left a 10 XP task
 * above a 50 XP one because one was due sooner. A control that silently does
 * less than it says is worse than one that is not there, so the grouping steps
 * aside for the sort rather than quietly outranking it.
 *
 * Empty groups are dropped — a heading over nothing is a heading about nothing.
 */
export function groupTasks(
  tasks: Task[],
  query: TaskQuery,
  today = new Date(),
  grouped = true,
): TaskGroup[] {
  const sorted = sortTasks(filterTasks(tasks, query), query.sort, query.descending);
  if (sorted.length === 0) return [];

  if (!grouped || query.sort !== 'due') {
    const entry = SORTS.find((sort) => sort.key === query.sort);
    return [
      {
        key: 'all',
        label: 'All tasks',
        hint: entry ? `Ordered by ${entry.noun}, ${query.descending ? entry.desc : entry.asc}.` : '',
        tasks: sorted,
      },
    ];
  }

  return BUCKETS.map((bucket) => ({
    ...bucket,
    tasks: sorted.filter((task) => bucketOf(task, today) === bucket.key),
  })).filter((group) => group.tasks.length > 0);
}

// --------------------------------------------------------------------------
// The figures across the top
// --------------------------------------------------------------------------
export interface TaskCounts {
  open: number;
  done: number;
  overdue: number;
  today: number;
  /** XP sitting in the open list — what finishing all of it would be worth. */
  openXp: number;
  /** XP already banked from tasks completed today. */
  todayXp: number;
  /** How many of today's are high priority — the card's second line. */
  todayHigh: number;
  /**
   * Of the work due in the last week, the share that got finished.
   *
   * Measured on the *due* date rather than the completion date, so a task
   * finished three days late still counts against the week it was owed in
   * rather than quietly improving the week it was finished in.
   */
  completionRate: number;
}

/**
 * Counted off the whole list rather than the filtered one.
 *
 * A summary that moved when a filter was typed into would be measuring the
 * filter, not the account: "3 overdue" has to mean three overdue tasks exist,
 * not three survived the current search.
 */
export function taskCounts(tasks: Task[], today = new Date()): TaskCounts {
  const stamp = today.toISOString().slice(0, 10);
  const counts: TaskCounts = {
    open: 0, done: 0, overdue: 0, today: 0, openXp: 0, todayXp: 0, todayHigh: 0, completionRate: 0,
  };

  const midnightToday = dayOf(stamp) ?? today.getTime();
  let dueInWeek = 0;
  let closedInWeek = 0;

  tasks.forEach((task) => {
    const due = dayOf(task.due_date);
    if (due !== null && due <= midnightToday && due > midnightToday - 7 * DAY) {
      dueInWeek += 1;
      if (task.status === 'done') closedInWeek += 1;
    }
    const xp = Number(task.xp_value) || 0;
    if (task.status === 'done') {
      counts.done += 1;
      if (String(task.completed_at ?? '').slice(0, 10) === stamp) counts.todayXp += xp;
      return;
    }
    counts.open += 1;
    counts.openXp += xp;
    const bucket = bucketOf(task, today);
    if (bucket === 'overdue') counts.overdue += 1;
    if (bucket === 'today') {
      counts.today += 1;
      if (task.priority === 'high') counts.todayHigh += 1;
    }
  });

  counts.completionRate = dueInWeek > 0 ? Math.round((closedInWeek / dueInWeek) * 100) : 0;
  return counts;
}

/** Whether anything is narrowing the list — what the Clear button is for. */
export function isFiltered(query: TaskQuery): boolean {
  return (
    query.status !== EMPTY_QUERY.status ||
    query.search.trim() !== '' ||
    query.subjects.length > 0 ||
    query.priorities.length > 0
  );
}

// --------------------------------------------------------------------------
// The sparkline under each stat card
// --------------------------------------------------------------------------
/**
 * The last fortnight of each headline figure, recomputed from the task list.
 *
 * **Nothing here is recorded history.** The account stores no daily snapshot of
 * how many tasks were open, so a card that wanted a trend had two options:
 * invent one, or reconstruct it. This reconstructs it — every task carries
 * `created_at` and, once finished, `completed_at`, and those two dates are
 * enough to answer "was this task open at the end of that day" for any day in
 * range. Walk the days, ask that question of every task, and the series falls
 * out.
 *
 * The reconstruction is honest but it is not a recording, and the difference
 * shows in one place: a task deleted last week was never open on any of these
 * days, because it is not in the list to be asked about. The line is the shape
 * of the work that still exists, which is the only past the data supports.
 */
export interface StatSeries {
  open: number[];
  dueToday: number[];
  overdue: number[];
  completion: number[];
  openXp: number[];
}

/** How many days of history each sparkline draws. */
export const TREND_DAYS = 14;

/** The window the completion rate is measured over, in days. */
const RATE_WINDOW = 7;

function midnight(today: Date): number {
  return dayOf(today.toISOString().slice(0, 10)) ?? today.getTime();
}

export function statSeries(tasks: Task[], today = new Date(), days = TREND_DAYS): StatSeries {
  const end = midnight(today);
  const series: StatSeries = { open: [], dueToday: [], overdue: [], completion: [], openXp: [] };

  // Parsed once rather than per day — this runs over every task in the account
  // for every day drawn, and the date parsing is the whole cost.
  const parsed = tasks.map((task) => ({
    made: dayOf(task.created_at),
    due: dayOf(task.due_date),
    done: task.status === 'done' ? dayOf(task.completed_at) ?? -Infinity : null,
    xp: Number(task.xp_value) || 0,
  }));

  for (let step = days - 1; step >= 0; step--) {
    const day = end - step * DAY;
    let open = 0;
    let openXp = 0;
    let overdue = 0;
    let dueToday = 0;
    let closedInWindow = 0;
    let dueInWindow = 0;

    parsed.forEach((task) => {
      // Not yet made on this day: it did not exist to be counted.
      if (task.made !== null && task.made > day) return;
      const wasOpen = task.done === null || task.done > day;
      if (wasOpen) {
        open += 1;
        openXp += task.xp;
        if (task.due !== null && task.due < day) overdue += 1;
      }
      if (task.due === day) dueToday += 1;

      // The rolling rate: of the work due in the week up to this day, how much
      // of it was finished. Measured on the *due* date rather than the
      // completion date, so a task finished late still counts against the week
      // it was owed in.
      if (task.due !== null && task.due <= day && task.due > day - RATE_WINDOW * DAY) {
        dueInWindow += 1;
        if (task.done !== null && task.done <= day) closedInWindow += 1;
      }
    });

    series.open.push(open);
    series.openXp.push(openXp);
    series.overdue.push(overdue);
    series.dueToday.push(dueToday);
    series.completion.push(dueInWindow > 0 ? Math.round((closedInWindow / dueInWindow) * 100) : 0);
  }

  return series;
}

/** Where a series has got to against where it started, as a percentage. */
export function trendPct(series: number[]): number | null {
  const first = series[0];
  const last = series[series.length - 1];
  if (first === undefined || last === undefined || first === 0) return null;
  return Math.round(((last - first) / first) * 100);
}

// --------------------------------------------------------------------------
// How long it takes
// --------------------------------------------------------------------------
/**
 * How long a task has been set aside for, in seconds, or null.
 *
 * **This is the block on the calendar, not a guess and not a measurement.** A
 * task with `show_on_calendar` carries its slot in two fields it would
 * otherwise use for something else: `created_at` is where the block starts and
 * `due_date` is where it ends, which is how hooks/useCalendarTasks lays them
 * out on the grid. The distance between them is time the reader themselves put
 * aside, so a row can print it without claiming to know anything the account
 * does not.
 *
 * The two obvious alternatives are both worse. `timer_duration` is the field
 * this should read and nothing has ever written it — it is null on every task
 * in every account. `completion_seconds` looks like a duration and is not one:
 * backend/api/tasks.py records it as `now - created_at`, so it measures how
 * long a task sat before being finished. On a task created three weeks before
 * its deadline that is three weeks, and a row printing "Est. 21d" beside it
 * would be stating a lead time as an estimate of the work.
 *
 * Undated tasks, tasks not on the calendar, and blocks longer than `MAX_BLOCK`
 * get nothing. The cap is what keeps a genuine deadline — created today, due
 * next month — from being read as a month-long sitting on the rare task that
 * has `show_on_calendar` set without a real slot behind it.
 */
const MAX_BLOCK = 12 * 3600;

export function plannedSeconds(task: Task): number | null {
  if (!task.show_on_calendar || !task.created_at || !task.due_date) return null;
  const from = new Date(task.created_at).getTime();
  const to = new Date(task.due_date).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const span = (to - from) / 1000;
  return span > 0 && span <= MAX_BLOCK ? span : null;
}

/** "1h 30m", "45m" — a span in the words a row prints it in. */
export function spellDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "6:00 PM", or null when the date carries no time of day. */
export function timeLabel(value: string | undefined | null): string | null {
  if (!value) return null;
  const raw = String(value);
  if (!raw.includes('T')) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getHours() === 0 && at.getMinutes() === 0) return null;
  return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "Due Today, 6:00 PM" — the whole date line on a row, or null. */
export function dueLine(task: Task, today = new Date()): string | null {
  const day = dueLabel(task, today);
  if (!day) return null;
  const time = timeLabel(task.due_date);
  return time ? `Due ${day}, ${time}` : `Due ${day}`;
}

// --------------------------------------------------------------------------
// The sidebar
// --------------------------------------------------------------------------
/** The next dated open tasks, soonest first. */
export function upcoming(tasks: Task[], limit = 3, today = new Date()): Task[] {
  const from = midnight(today);
  return tasks
    .filter((task) => {
      if (task.status === 'done') return false;
      const due = dayOf(task.due_date);
      return due !== null && due >= from;
    })
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, limit);
}

export interface Streak {
  title: string;
  /** Consecutive days, counting back from the most recent completion. */
  days: number;
}

/**
 * How many days running each repeated task has been kept up.
 *
 * Grouped by title, for the same reason the estimates are: a task the reader
 * does every morning arrives as one row per morning, and the streak is a fact
 * about the habit rather than about any one of those rows.
 *
 * Counted back from the **most recent completion rather than from today**, and
 * only kept if that completion was today or yesterday. A run that ended a month
 * ago is not a streak the panel should be printing a flame next to, but a run
 * finished yesterday is still alive — the day is not over, and a panel that
 * blanked every streak at midnight would be wrong for most of the morning.
 */
export function streaks(tasks: Task[], limit = 3, today = new Date()): Streak[] {
  const byTitle = new Map<string, { title: string; days: Set<number> }>();

  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    const done = dayOf(task.completed_at);
    if (done === null) return;
    const key = task.title.trim().toLowerCase();
    const entry = byTitle.get(key);
    if (entry) entry.days.add(done);
    else byTitle.set(key, { title: task.title.trim(), days: new Set([done]) });
  });

  const now = midnight(today);
  const out: Streak[] = [];

  byTitle.forEach(({ title, days }) => {
    const last = Math.max(...days);
    // Alive only if it reaches today or yesterday. See the note above.
    if (now - last > DAY) return;
    let run = 0;
    let cursor = last;
    while (days.has(cursor)) {
      run += 1;
      cursor -= DAY;
    }
    if (run > 1) out.push({ title, days: run });
  });

  return out.sort((a, b) => b.days - a.days || a.title.localeCompare(b.title)).slice(0, limit);
}
