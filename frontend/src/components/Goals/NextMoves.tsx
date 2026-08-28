/**
 * The half of the goals page that answers "so what do I do now".
 *
 * ## Why this exists
 *
 * Everything else on the page describes a goal: how far into it you are, which
 * checkpoint is next, whether the date is going to hold. All of that is the
 * present tense of a plan, and a plan you can only read is a plan you do not
 * act on. A goals page that stops at description is a Notion database with a
 * progress bar on it.
 *
 * So these three read the same rows the rest of the page does and answer a
 * different question. The greeting says what you are carrying. `NextMoves`
 * says which specific tasks move it, and lets you tick one off without
 * leaving. `Momentum` says whether the last week actually went anywhere.
 *
 * ## Nothing here invents work
 *
 * Every row in `NextMoves` is a real open task that names a goal, through
 * `goal_id` or through a `milestone_id` belonging to one. It does not propose
 * tasks, and it does not turn checkpoints into pretend ones: a goal with
 * nothing linked shows as exactly that, because "you have not connected any
 * work to this" is the useful thing to say to somebody who has not.
 */
import { useMemo } from 'react';
import { categoryOf } from './Outcome';
import { goalNumbers } from './numbers';
import { goalsOverview } from '@/utils/goalAnalytics';
import { greeting as timeGreeting } from '@/utils/dates';
import type { Goal, Task } from '@/types';

const DAY = 86_400_000;

/** The window `Momentum` reads. A week, because that is the unit people plan in. */
export const MOMENTUM_DAYS = 7;

/** Every goal a task could be pointing at, by the two ids that can point at one. */
function goalIndex(goals: Goal[]): Map<string, Goal> {
  const index = new Map<string, Goal>();
  for (const goal of goals) {
    index.set(goal.id, goal);
    for (const milestone of goal.milestones ?? []) index.set(milestone.id, goal);
  }
  return index;
}

/** The goal a task is work toward, or undefined. `goal_id` wins over the checkpoint. */
export function goalOf(task: Task, index: Map<string, Goal>): Goal | undefined {
  return (
    (task.goal_id ? index.get(task.goal_id) : undefined) ??
    (task.milestone_id ? index.get(task.milestone_id) : undefined)
  );
}

const at = (iso?: string): number | null => {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
};

// ---------------------------------------------------------------------------
// The line the page opens with
// ---------------------------------------------------------------------------
/**
 * "Good afternoon. You are working toward four goals."
 *
 * The counts come from `goalsOverview`, which is what the rest of the page
 * already reads, so this cannot disagree with the tiles below it. It says
 * "needs attention" rather than "at risk" for the same reason the health chip
 * does not shout: the number is a prompt to look, not a verdict.
 */
export function GoalsGreeting({
  goals,
  tasks,
  today = new Date(),
}: {
  goals: Goal[];
  tasks: Task[];
  today?: Date;
}) {
  const overview = useMemo(() => goalsOverview(goals, tasks, today), [goals, tasks, today]);
  const needs = overview.atRisk + overview.offTrack;

  return (
    <div className="gx-greet">
      <p className="gx-greet-hi">{timeGreeting(today)}.</p>
      {overview.active === 0 ? (
        <p className="gx-greet-line">Nothing on the go. The first goal is the hard one.</p>
      ) : (
        <p className="gx-greet-line">
          You are working toward <strong>{overview.active}</strong>{' '}
          {overview.active === 1 ? 'goal' : 'goals'}
          <span className="gx-greet-split">
            {overview.onTrack > 0 && <>{overview.onTrack} on track</>}
            {overview.onTrack > 0 && needs > 0 && ' · '}
            {needs > 0 && (
              <em>
                {needs} {needs === 1 ? 'needs' : 'need'} attention
              </em>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next moves
// ---------------------------------------------------------------------------
export interface Move {
  task: Task;
  goal: Goal;
  /** Seconds the block was scheduled for, when it is a block. */
  planned: number | null;
  /** Days past its date. 0 or less means it is not late. */
  late: number;
}

// ---------------------------------------------------------------------------
// Momentum
// ---------------------------------------------------------------------------
export interface MomentumReading {
  done: number;
  /** Everything that was on the week: finished, plus what was due and is not. */
  total: number;
  /** Which of the last seven days had a goal-linked completion. */
  days: boolean[];
}

/**
 * Whether the last week actually went anywhere.
 *
 * The denominator is the honest part. It is not "every task you have", which
 * would make a long backlog look like failure, and it is not "what you
 * finished", which would make every week 100%. It is what the week was
 * actually asked to carry: the goal-linked tasks finished inside it, plus the
 * goal-linked tasks that were due inside it and are still open. A week where
 * nothing was due and nothing was done has no reading at all, and says so.
 */
export function momentum(
  goals: Goal[],
  tasks: Task[],
  today: Date = new Date(),
  span = MOMENTUM_DAYS,
): MomentumReading {
  const index = goalIndex(goals);
  const now = today.getTime();
  const from = now - span * DAY;
  const days = Array.from({ length: span }, () => false);

  let done = 0;
  let missed = 0;

  for (const task of tasks) {
    if (!goalOf(task, index)) continue;

    const finished = at(task.completed_at);
    if (task.status === 'done' && finished !== null && finished >= from && finished <= now) {
      done += 1;
      const slot = span - 1 - Math.floor((now - finished) / DAY);
      if (slot >= 0 && slot < span) days[slot] = true;
      continue;
    }

    const due = at(task.due_date);
    if (task.status !== 'done' && due !== null && due >= from && due <= now) missed += 1;
  }

  return { done, total: done + missed, days };
}

export function Momentum({
  goals,
  tasks,
  today = new Date(),
}: {
  goals: Goal[];
  tasks: Task[];
  today?: Date;
}) {
  const reading = useMemo(() => momentum(goals, tasks, today), [goals, tasks, today]);

  if (reading.total === 0) {
    return (
      <p className="gx-empty">
        Nothing was due or finished toward a goal this week.
      </p>
    );
  }

  const pct = Math.round((reading.done / reading.total) * 100);

  return (
    <div className="gx-mo">
      <p className="gx-mo-line">
        You finished <strong>{reading.done}</strong> of <strong>{reading.total}</strong>{' '}
        goal-linked {reading.total === 1 ? 'task' : 'tasks'} this week.
      </p>

      <div
        className="gx-mo-bar"
        role="img"
        aria-label={`${pct} percent of this week's goal-linked tasks finished`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>

      {/* One square a day, so a good week and a week that was all Monday do not
          read the same. The bar above cannot tell those apart. */}
      <div className="gx-mo-days" aria-hidden="true">
        {reading.days.map((lit, index) => (
          <i key={index} className={lit ? 'is-lit' : ''} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Growth areas
// ---------------------------------------------------------------------------
export interface Area {
  id: string;
  label: string;
  tone: string;
  goals: number;
  progress: number;
}

/** Active goals grouped by their category, with progress weighted by priority. */
export function growthAreas(goals: Goal[]): Area[] {
  const rows = new Map<string, { label: string; tone: string; n: number; sum: number; weight: number }>();

  for (const goal of goals) {
    if (goal.status === 'completed') continue;
    const category = categoryOf(goal);
    const row = rows.get(category.id) ??
      { label: category.label, tone: category.tone, n: 0, sum: 0, weight: 0 };
    const weight = Math.max(1, Math.min(10, Math.trunc(Number(goal.priority)) || 5));
    row.n += 1;
    row.sum += goalNumbers(goal).progress * weight;
    row.weight += weight;
    rows.set(category.id, row);
  }

  return [...rows.entries()]
    .map(([id, row]) => ({
      id,
      label: row.label,
      tone: row.tone,
      goals: row.n,
      progress: row.weight ? row.sum / row.weight : 0,
    }))
    .sort((a, b) => b.goals - a.goals || b.progress - a.progress);
}

export function GrowthAreas({ goals, onPick }: { goals: Goal[]; onPick?: (id: string) => void }) {
  const areas = useMemo(() => growthAreas(goals), [goals]);

  if (areas.length === 0) {
    return <p className="gx-empty">No active goals to group yet.</p>;
  }

  return (
    <ul className="gx-areas">
      {areas.map((area) => (
        <li key={area.id} className={`gx-area tone-${area.tone}`}>
          <button type="button" disabled={!onPick} onClick={() => onPick?.(area.id)}>
            <span className="gx-area-name">{area.label}</span>
            <span className="gx-area-n">
              {area.goals} {area.goals === 1 ? 'goal' : 'goals'}
            </span>
            <span className="gx-area-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(2, Math.min(100, area.progress))}%` }} />
            </span>
            <span className="gx-area-pct">{Math.round(area.progress)}%</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
