/**
 * XP earned in a week, split by what the work was about.
 *
 * The Week view's overview used to carry an "XP Earned" bar chart — the same
 * seven days as the sparkline two panels above it, drawn twice the size. Two
 * pictures of one series is one picture too many, and neither of them answered
 * the question a breakdown is for: not *when* the XP happened, which the
 * sparkline already says, but **what it was for**.
 *
 * A subject on a task is what makes that answerable, and tasks have carried one
 * since the picker was added. (The panel that stood here before the bar chart
 * was also called "XP Breakdown" and had five invented rows — Math 160, Coding
 * 140 — because at the time nothing on a task could be grouped by. This is that
 * panel with real numbers behind it.)
 *
 * ## The rules
 *
 * **Earned, not offered.** Only finished tasks count, and they count on the day
 * they were finished — the same test the sparkline and the streak dots use, so
 * the three panels can never tell different stories about the same week.
 *
 * **Five, then Other.** The top five subjects by XP get a row each. Everything
 * below them goes into one row at the bottom, and so does every task with no
 * subject at all — an unfiled task is not a subject, and a row per subject with
 * 10 XP in it would bury the five that matter. Other is always last, however
 * large it grows: it is the remainder, and a remainder that sorts itself into
 * the middle of the list stops reading as one.
 */
import type { Subject } from '@/services/subjects';
import type { Task } from '@/types';

/** How many named subjects get a row of their own. */
export const TOP_SUBJECTS = 5;

/** The key the catch-all row is given. Not a subject id — no subject has one. */
export const OTHER_KEY = '__other__';

export interface SubjectXpRow {
  /** The subject's id, or `OTHER_KEY`. */
  key: string;
  /** "Chem", or "Other". */
  label: string;
  /** The subject's full name, for the row's title. Absent on Other. */
  name?: string;
  /** The icon file under /static/icons. Absent on Other. */
  icon?: string;
  xp: number;
  /** How many finished tasks are behind the figure. */
  count: number;
}

export interface SubjectXp {
  rows: SubjectXpRow[];
  total: number;
}

/**
 * @param tasks     The account's calendar tasks.
 * @param subjects  The catalogue, keyed by id — see hooks/useSubjects.
 * @param fromIso   First day of the range, inclusive. "2026-08-03".
 * @param toIso     Last day, inclusive.
 */
export function subjectXp(
  tasks: Task[],
  subjects: Map<string, Subject>,
  fromIso: string,
  toIso: string,
): SubjectXp {
  const named = new Map<string, SubjectXpRow>();
  const other: SubjectXpRow = { key: OTHER_KEY, label: 'Other', xp: 0, count: 0 };
  let total = 0;

  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    const day = (task.completed_at || '').slice(0, 10);
    if (!day || day < fromIso || day > toIso) return;

    const xp = Number(task.xp_value) || 0;
    total += xp;

    // A task filed under a subject the catalogue no longer knows is in the
    // same position as one never filed at all: there is no name to print.
    const subject = (task.subject && subjects.get(task.subject)) || null;
    if (!subject) {
      other.xp += xp;
      other.count += 1;
      return;
    }

    const row = named.get(subject.id) ?? {
      key: subject.id,
      label: subject.label,
      name: subject.name,
      icon: subject.icon,
      xp: 0,
      count: 0,
    };
    row.xp += xp;
    row.count += 1;
    named.set(subject.id, row);
  });

  // Ties broken by name, so the order of a week with two 40 XP subjects in it
  // does not change between renders.
  const ranked = [...named.values()].sort(
    (a, b) => b.xp - a.xp || a.label.localeCompare(b.label),
  );

  // The sixth subject and below join the unfiled tasks rather than getting a
  // row each: the panel is about where a week went, and a tail of single-task
  // rows is what stops that being readable at a glance.
  ranked.slice(TOP_SUBJECTS).forEach((row) => {
    other.xp += row.xp;
    other.count += row.count;
  });

  const rows = ranked.slice(0, TOP_SUBJECTS);
  if (other.count > 0) rows.push(other);

  return { rows, total };
}
