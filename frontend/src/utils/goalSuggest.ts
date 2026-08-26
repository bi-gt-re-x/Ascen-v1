/**
 * Goals worth setting that are not set — the one piece of goal analysis the
 * app could not already do.
 *
 * Everything else about goals answers "how is this one going". This answers
 * "what is missing", which is a question about the *set* rather than about any
 * member of it, and it is the only one that can be asked of an account with no
 * goals at all.
 *
 * ## Every suggestion is drawn from the record, never from a template
 *
 * The tempting version of this file is a list of good goals — "build a
 * streak", "finish 100 tasks" — ranked by nothing and true of everybody. That
 * is a page telling you about its own defaults. Each rule below fires only on
 * a fact about this account, prints that fact as its reason, and stays silent
 * when the fact is absent. An account the record cannot say anything useful
 * about gets nothing here, which is the honest answer and the same one the
 * rest of the analytics page gives.
 *
 * ## Silence is the common case, and that is correct
 *
 * A reader with four well-paced goals covering their live subjects should see
 * this panel empty. Advice that is always present is advice nobody reads, and
 * the goals page is where goals get made — this is a prompt, not a queue.
 */
import { goalNumbers, measureOf } from '@/components/Goals/numbers';
import type { Goal, GrowthDay, Task } from '@/types';

/** A subject's share of the window's XP, and whether a goal already names it. */
export interface SubjectShare {
  id: string;
  label: string;
  xp: number;
  share: number;
}

export interface GoalSuggestion {
  id: string;
  /** The instruction, in the imperative. */
  title: string;
  /** The fact from the record that produced it. One sentence. */
  because: string;
  /** What kind of goal it would be, for the label on the way out. */
  kind: 'outcome' | 'streak' | 'subject' | 'date' | 'first';
}

/** Below this a subject is not really being worked on. */
const SUBJECT_SHARE = 0.12;

/** A run of days worked, at or above which consistency is worth formalising. */
const STREAK_WORTH_KEEPING = 5;

/** How many suggestions is a prompt rather than a queue. */
const MAX_SUGGESTIONS = 3;

export interface SuggestInput {
  goals: Goal[];
  tasks: Task[];
  days: GrowthDay[];
  /** Subject shares over the window, biggest first. */
  subjects: SubjectShare[];
  currentStreak: number;
}

export function suggestGoals(input: SuggestInput): GoalSuggestion[] {
  const { goals, tasks, subjects, currentStreak } = input;
  const active = goals.filter((goal) => goal.status !== 'completed');
  const out: GoalSuggestion[] = [];

  /* Nothing at all. The one case where a suggestion is not competing with
     anything the reader has already decided, so it leads and it is the only
     one — offering three to somebody with none is a form to fill in. */
  if (active.length === 0) {
    const busiest = subjects[0];
    return [
      {
        id: 'first',
        kind: 'first',
        title: busiest ? `Set a goal on ${busiest.label}` : 'Set your first goal',
        because: busiest
          ? `${busiest.label} is where most of your work has gone and nothing is aiming it anywhere.`
          : 'Nothing here is aimed at anything yet, so none of these figures have a target to be read against.',
      },
    ];
  }

  /* A subject carrying real work with no goal pointed at it. The strongest
     rule here, because the gap is between what the reader is *doing* and what
     they have said they are doing — and the record is unambiguous about the
     first half. */
  const named = new Set(
    active.flatMap((goal) =>
      String(goal.subject_ids || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
  const orphan = subjects.find((row) => row.share >= SUBJECT_SHARE && !named.has(row.id));
  if (orphan) {
    out.push({
      id: `subject-${orphan.id}`,
      kind: 'subject',
      title: `Aim a goal at ${orphan.label}`,
      because: `${Math.round(orphan.share * 100)}% of your work in this window was ${orphan.label}, and no goal names it.`,
    });
  }

  /* Every goal is a counter. A counter cannot be missed — XP only goes up —
     so an account whose every goal is one has nothing on it that can report
     bad news, which is the failure mode the tile row on the Overview exists
     to avoid. */
  const measures = new Set(active.map((goal) => measureOf(goal)));
  const allCounters = [...measures].every((measure) =>
    ['xp', 'streak', 'tasks', 'focus'].includes(measure),
  );
  if (allCounters && active.length >= 2) {
    out.push({
      id: 'outcome',
      kind: 'outcome',
      title: 'Set one goal that is not a counter',
      because:
        'Every goal you have counts something that only goes up, so none of them can tell you it is going badly. A checkpoint or a number goal can.',
    });
  }

  /* A streak worth keeping, with nothing protecting it. */
  const hasStreakGoal = active.some((goal) => measureOf(goal) === 'streak');
  if (!hasStreakGoal && currentStreak >= STREAK_WORTH_KEEPING) {
    out.push({
      id: 'streak',
      kind: 'streak',
      title: `Put a streak goal behind your ${currentStreak} days`,
      because: `You are ${currentStreak} days in and nothing is holding you to it, so the run ends quietly when it ends.`,
    });
  }

  /* Open-ended goals that are actually moving. A date is what turns "one day"
     into a pace that can be read, and it is only worth suggesting for a goal
     with work behind it — putting a deadline on something dormant is a way to
     be late rather than a way to finish. */
  const moving = active.filter((goal) => {
    if (goal.deadline) return false;
    if (goalNumbers(goal).progress <= 0) return false;
    return tasks.some((task) => task.goal_id === goal.id && task.status === 'done');
  });
  if (moving.length > 0 && moving[0]) {
    out.push({
      id: `date-${moving[0].id}`,
      kind: 'date',
      title: `Put a date on "${moving[0].title}"`,
      because:
        moving.length === 1
          ? 'It is moving and open-ended, so there is no pace to read and nothing to be early or late against.'
          : `${moving.length} of your goals are moving with no date on them, so none of them has a pace to read.`,
    });
  }

  return out.slice(0, MAX_SUGGESTIONS);
}

/**
 * How much of the account's finished work is aimed at a goal.
 *
 * One figure, used in two places — the Goals tab states it and the Insights
 * tab prints it as a line. Tasks that carry a goal, over tasks finished in the
 * same window; null when nothing was finished, because a share of nothing is
 * not zero percent.
 */
export function goalWorkShare(tasks: Task[]): { share: number; aimed: number; total: number } | null {
  const done = tasks.filter((task) => task.status === 'done');
  if (done.length === 0) return null;
  const aimed = done.filter((task) => task.goal_id).length;
  return { share: aimed / done.length, aimed, total: done.length };
}
