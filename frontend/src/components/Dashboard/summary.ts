/**
 * Everything the dashboard's cards are counted from, in one place.
 *
 * These are pure functions over the task list the page already has, and that
 * is deliberate: the dashboard makes one call (`/api/get_user_data`) and every
 * panel on it — today's ring, the tabs, the weekly numbers, the priorities,
 * the activity feed — is a different question asked of that one answer. No
 * panel fetches for itself, so none of them can disagree about what a task is.
 *
 * The one rule running through all of it: **days are local ISO dates, compared
 * as strings.** A stored stamp is `2026-07-30T09:26:31`, so `.slice(0, 10)` is
 * its day and `'2026-07-28' <= day` is a date comparison that never builds a
 * Date and therefore never drifts a timezone. See utils/dates.ts for why
 * `toISOString()` is not allowed near a day key.
 */
import { isCalendarPlaced } from '@/utils/calendarGrid';
import type { Task, TaskPriority } from '@/types';

/** The day part of a stored timestamp, or '' when there is not one. */
function dayOf(stamp: string | undefined): string {
  return (stamp || '').slice(0, 10);
}

function xpOf(task: Task): number {
  return Number(task.xp_value) || 0;
}

// --------------------------------------------------------------------------
// Priority
// --------------------------------------------------------------------------
export interface PriorityMeta {
  /** 'High' | 'Medium' | 'Low' */
  label: string;
  /** The modifier the stylesheet colours the dot and the badge from. */
  tone: 'high' | 'med' | 'low';
}

/**
 * How a task's priority is written and coloured.
 *
 * This is what fills the coloured line under a task's title. The design it
 * came from showed a *category* there — Personal, Math, Coding — but tasks
 * have no category: the columns are title, description, priority, status,
 * xp_value, due_date and the timer pair (data/sql/tasks.sql). Priority is the
 * field that is actually there, so priority is what is shown.
 */
export function priorityMeta(priority: TaskPriority | string): PriorityMeta {
  const value = String(priority || '').toLowerCase();
  if (value === 'high') return { label: 'High', tone: 'high' };
  if (value === 'medium') return { label: 'Medium', tone: 'med' };
  return { label: 'Low', tone: 'low' };
}

// --------------------------------------------------------------------------
// The tabs
// --------------------------------------------------------------------------
export interface TaskBuckets {
  /** Open and wanted now: due today, overdue, or carrying no date at all. */
  today: Task[];
  /** Open and dated after today. */
  upcoming: Task[];
  /** Finished, most recently first. */
  completed: Task[];
}

/**
 * Split the task list into the three tabs.
 *
 * "Today" means *on today's plate*, not *dated today* — an overdue task is
 * still today's problem, and an undated one has never been anything else. The
 * alternative reading, tasks whose due date is literally today, would hide
 * five overdue tasks behind a tab nobody would think to open.
 *
 * The split matters here more than it would on a smaller account: of 244 open
 * tasks, six are on today's plate and 238 are scheduled out to December. A
 * single undivided list is not a list anyone can read.
 */
export function bucketTasks(tasks: Task[], todayIso: string): TaskBuckets {
  const buckets: TaskBuckets = { today: [], upcoming: [], completed: [] };

  tasks.forEach((task) => {
    if (task.status === 'done') {
      buckets.completed.push(task);
      return;
    }
    if (task.status !== 'todo') return; // 'expired' belongs to no tab
    const due = dayOf(task.due_date);
    if (!due || due <= todayIso) buckets.today.push(task);
    else buckets.upcoming.push(task);
  });

  buckets.today.sort(byDueDate);
  buckets.upcoming.sort(byDueDate);
  // Completions have no order of their own in the table, and a task finished
  // before completion times were recorded has no stamp at all — those sort to
  // the bottom rather than jumbling the ones that do.
  buckets.completed.sort(
    (a, b) => dayStampValue(b.completed_at) - dayStampValue(a.completed_at),
  );

  return buckets;
}

/** Undated tasks lead: nothing is holding them to a later day. */
function byDueDate(a: Task, b: Task): number {
  const left = a.due_date || '';
  const right = b.due_date || '';
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function dayStampValue(stamp: string | undefined): number {
  if (!stamp) return 0;
  const time = new Date(stamp).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * A task belongs to the calendar half of a tab when it is scheduled.
 *
 * The same test the page has always used — `show_on_calendar` *and* a due
 * date — but no longer a second copy of it. It is the calendar's own predicate
 * now, so a task filed under this page's "Calendar Tasks" heading is exactly a
 * task the calendar will draw, and a to-do is exactly one it will not. Two
 * spellings of one rule is how the heading ends up disagreeing with the grid.
 */
export function isCalendarTask(task: Task): boolean {
  return isCalendarPlaced(task);
}

// --------------------------------------------------------------------------
// Today's Progress
// --------------------------------------------------------------------------
export interface DaySummary {
  /** On today's plate: open and due-or-undated, plus whatever was finished. */
  total: number;
  done: number;
  xp: number;
  /** 0-100, rounded. */
  percent: number;
}

/**
 * Today, honestly.
 *
 * The design this card came from showed 13 / 9 / 69% / 546 XP under the
 * heading "Today's Progress" — but those are the *week's* figures, the same
 * four the Weekly Overview card below shows, and the two cards read
 * identically because of it. Only one of them can be about today, so this one
 * is: today's plate against what has actually been finished today.
 *
 * That means the card reads 0% on a day nothing has been completed, which is
 * the point of it.
 */
export function daySummary(tasks: Task[], todayIso: string): DaySummary {
  let open = 0;
  let done = 0;
  let xp = 0;

  tasks.forEach((task) => {
    if (task.status === 'done') {
      if (dayOf(task.completed_at) !== todayIso) return;
      done += 1;
      xp += xpOf(task);
      return;
    }
    if (task.status !== 'todo') return;
    const due = dayOf(task.due_date);
    if (!due || due <= todayIso) open += 1;
  });

  const total = open + done;
  return {
    total,
    done,
    xp,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

// --------------------------------------------------------------------------
// Weekly Overview
// --------------------------------------------------------------------------
export interface WeekSummary {
  total: number;
  done: number;
  /** 0-100, rounded. */
  rate: number;
  xp: number;
}

/**
 * The week's four numbers — `daySummary` above, over seven days.
 *
 * **Completed and XP Earned are counted from completion stamps**, so they say
 * what was done between Monday and Sunday, whenever the task was scheduled.
 * That is the whole correction here. This card used to count the *cohort* of
 * tasks scheduled inside the week and report how many of those were finished,
 * which is a different question and read as a much smaller answer: a week in
 * which six tasks were completed for 241 XP showed "Completed 1" and "XP
 * Earned 72", because five of the six had been scheduled in earlier weeks.
 * Nothing on the card said so, and a figure headed XP Earned that is not the XP
 * you earned is simply wrong.
 *
 * `total` is the week's plate, on the same principle: what is still open and
 * due inside it, plus what has been finished in it. A task that is both is
 * counted once, as done. Overdue and undated tasks are *not* pulled in — the
 * day card does that because an overdue task is genuinely today's problem, but
 * on a seven-day view it would put 47 undated tasks into a total that is meant
 * to describe one week.
 *
 * This is what makes the two cards on the page agree. It also means the figures
 * here no longer match the Week sidebar in the calendar (pages/Calendar/Week),
 * which still counts the cohort and is right to: it is scoped to whichever week
 * is on screen, past ones included, where "what has been completed since" is
 * not a question the view can ask. Same words, two honest answers, because the
 * two views are asking about different things.
 */
export function weekSummary(
  tasks: Task[],
  mondayIso: string,
  sundayIso: string,
): WeekSummary {
  let open = 0;
  let done = 0;
  let xp = 0;

  tasks.forEach((task) => {
    if (task.status === 'done') {
      // A completion with no stamp — the column was added partway through this
      // account's history — cannot be placed in a week, and '' fails this test
      // rather than needing a case of its own.
      const at = dayOf(task.completed_at);
      if (at < mondayIso || at > sundayIso) return;
      done += 1;
      xp += xpOf(task);
      return;
    }
    if (task.status !== 'todo') return;
    const due = dayOf(task.due_date);
    if (due >= mondayIso && due <= sundayIso) open += 1;
  });

  const total = open + done;
  return {
    total,
    done,
    rate: total ? Math.round((done / total) * 100) : 0,
    xp,
  };
}

// --------------------------------------------------------------------------
// Top Priorities
// --------------------------------------------------------------------------
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * What to do next: the open tasks on today's plate, hardest first.
 *
 * Ranked by priority and then by XP, because two high-priority tasks are not
 * equally urgent and XP is the only other measure of weight a task carries.
 * Scoped to today's bucket rather than to all 244 open tasks — a card headed
 * "Top Priorities" that ranks something due in December is not advice.
 *
 * Three of them. A list you are meant to act on now is short, and the card has
 * to sit level with the two beside it.
 */
export function topPriorities(tasks: Task[], limit = 3): Task[] {
  return [...tasks]
    .sort((a, b) => {
      const rank =
        (PRIORITY_RANK[String(a.priority).toLowerCase()] ?? 2) -
        (PRIORITY_RANK[String(b.priority).toLowerCase()] ?? 2);
      return rank !== 0 ? rank : xpOf(b) - xpOf(a);
    })
    .slice(0, limit);
}

// --------------------------------------------------------------------------
// Recent Activity
// --------------------------------------------------------------------------
export interface Activity {
  id: string;
  title: string;
  xp: number;
  /** The completion stamp, already parsed. */
  at: Date;
}

/**
 * The last few things finished.
 *
 * Only completions carrying a `completed_at` can appear: the column was added
 * partway through this account's history, so 60 of its 99 finished tasks have
 * no stamp. Guessing a time for those would put invented entries at the top of
 * a feed whose whole job is to say when — so they are simply not in it.
 */
export function recentActivity(tasks: Task[], limit = 3): Activity[] {
  return tasks
    .filter((task) => task.status === 'done' && task.completed_at)
    .map((task) => ({
      id: task.id,
      title: task.title || 'Untitled',
      xp: xpOf(task),
      at: new Date(task.completed_at as string),
    }))
    .filter((entry) => !Number.isNaN(entry.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
