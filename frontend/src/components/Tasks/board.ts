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
export type Bucket = 'overdue' | 'today' | 'soon' | 'later' | 'none' | 'done' | 'all';

export const BUCKETS: Array<{ key: Bucket; label: string; hint: string }> = [
  { key: 'overdue', label: 'Overdue', hint: 'Past its date. Move it or finish it.' },
  { key: 'today', label: 'Today', hint: 'Due before the day is out.' },
  { key: 'soon', label: 'Next 7 days', hint: 'The week in front of you.' },
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
export function groupTasks(tasks: Task[], query: TaskQuery, today = new Date()): TaskGroup[] {
  const sorted = sortTasks(filterTasks(tasks, query), query.sort, query.descending);
  if (sorted.length === 0) return [];

  if (query.sort !== 'due') {
    const entry = SORTS.find((sort) => sort.key === query.sort);
    return [
      {
        key: 'all',
        label: 'All matching tasks',
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
  const counts: TaskCounts = { open: 0, done: 0, overdue: 0, today: 0, openXp: 0, todayXp: 0 };

  tasks.forEach((task) => {
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
    if (bucket === 'today') counts.today += 1;
  });

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
