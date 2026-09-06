/**
 * One line about what to do *differently*.
 *
 * Everything else on this page — including the "up next" strip above it — is
 * about what is already on the plate: what is due, what is next, how the week
 * is going. Nothing said what the record suggests the reader change. Analytics
 * has a whole tab of that and does it far better with the room to; this is one
 * line of it, on the page people actually open.
 *
 * ## The same arithmetic, a smaller budget
 *
 * `buildPlan` (utils/nextActions) is what the Recommendations tab is built
 * from. It is given the same tasks and goals this page already holds and asked
 * for the single highest-weighted thing, so the dashboard cannot suggest one
 * thing while Analytics suggests another. What it is *not* given is the growth
 * series — that is a fetch this page does not make, and it feeds exactly one
 * candidate out of eight (the streak nudge). Today is passed as a one-day
 * series instead, built from figures the dashboard has already counted, so
 * that candidate survives without the page paying for a request to get it.
 *
 * ## Two of the eight kinds are not welcome here
 *
 * `overdue` and `due` are the plan's heaviest candidates and they are the two
 * this page already draws twice over — the task list is under the reader's
 * cursor and the "up next" strip names the very next one by time. Left in,
 * this line said "Finish Piano practice — due today" under a heading promising
 * something worth *changing*, which is a heading that has lied.
 *
 * What is left is the six that are about a habit rather than an item: a goal
 * with no work against it, a subject going weak, one going untouched, work
 * finished and never rated, a task that has sat undated for a month, a day
 * with nothing logged on it yet. None of those is visible anywhere else on the
 * page.
 *
 * ## When it says nothing
 *
 * A plan with nothing in it draws nothing at all. An account with two tasks
 * and no goals has no advice worth reading, and a card that fills the gap with
 * encouragement is a card people learn to skip.
 */
import { Link } from 'react-router-dom';
import { buildPlan } from '@/utils/nextActions';
import type { ActionKind } from '@/utils/nextActions';
import type { Goal, GrowthDay, Task } from '@/types';

export interface NextMoveProps {
  tasks: Task[];
  goals: Goal[];
  /** Today's ISO day, and what has been done in it so far. */
  todayIso: string;
  doneToday: number;
  xpToday: number;
  /** A subject id to its name, for the actions that name one. */
  nameOf: (id: string) => string;
}

/** Minutes the one suggestion is allowed to ask for. */
const BUDGET = 45;

/** The kinds this line will not carry, because the page already does — see
    the note above. */
const ALREADY_SAID: ActionKind[] = ['overdue', 'due'];

export function NextMove({
  tasks,
  goals,
  todayIso,
  doneToday,
  xpToday,
  nameOf,
}: NextMoveProps) {
  /* Today as the day series, which is all `buildPlan` reads it for: it looks at
     the last entry to decide whether the day is still empty. A fuller series
     would earn nothing here and cost a request. */
  const days: GrowthDay[] = [
    {
      date: todayIso,
      day_number: 0,
      xp_earned: xpToday,
      tasks_completed: doneToday,
      cumulative_xp: 0,
      avg_task_xp: 0,
      focus_minutes: 0,
      cumulative_focus_minutes: 0,
    } as GrowthDay,
  ];

  const plan = buildPlan({
    tasks,
    goals,
    days,
    nameOf,
    budget: BUDGET,
    /* The week, so the tie-break is stable all week — a suggestion that
       reshuffles itself on every render is one nobody trusts. `buildPlan`
       only reads this as a seed. */
    stamp: todayIso.slice(0, 7),
  });

  /* `actions` first, then `more`: both are ranked, and `more` only holds what
     did not fit the budget rather than what was judged less worth doing. */
  const move = [...plan.actions, ...plan.more].find(
    (action) => !ALREADY_SAID.includes(action.kind),
  );
  if (!move) return null;

  return (
    <section className="dash-move" aria-label="What to change">
      <span className="dash-move-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      </span>
      <div className="dash-move-main">
        <span className="dash-move-label">Worth changing</span>
        <strong className="dash-move-title">{move.title}</strong>
        <span className="dash-move-why">{move.because}</span>
      </div>
      <Link className="dash-move-all" to="/recommendations">
        See the rest<span aria-hidden="true"> →</span>
      </Link>
    </section>
  );
}
