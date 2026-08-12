/**
 * The Goals page's own furniture — everything above the detail view.
 *
 * The page answers four questions in order and these are the parts that answer
 * them: what am I trying to accomplish (the cards), how far am I (the bars and
 * the checkpoint tracks), what comes next (the timeline and the upcoming
 * checkpoints), and am I on track (the health chip, everywhere, in the same
 * place on every card).
 *
 * Nothing here computes anything. Health is utils/goalHealth, the readings are
 * utils/goalAnalytics, and the figures under a bar are `goalNumbers` — this
 * file draws what those three decided, which is what keeps a card and the
 * detail view behind it from ever disagreeing about the same goal.
 */
import type { ReactNode } from 'react';
import { fmtGoalNumber, formatGoalDate, goalNumbers } from './numbers';
import { goalHealth, type GoalHealth, type HealthState } from '@/utils/goalHealth';
import { goalNotes, goalsOverview, type GoalNote } from '@/utils/goalAnalytics';
import type { Goal, GoalCategory, Milestone, Task } from '@/types';

/**
 * What a goal can be about.
 *
 * The label and the tone only. The tone is a hue name that the stylesheet
 * turns into a colour, so the palette lives in one place and this stays a list
 * of what the categories *are*. `other` is the fallback for anything the
 * backend lets through that is not on this list, which is why the lookup below
 * never throws.
 */
export const CATEGORIES: Array<{ id: GoalCategory; label: string; tone: string }> = [
  { id: 'math', label: 'Math', tone: 'blue' },
  { id: 'coding', label: 'Coding', tone: 'violet' },
  { id: 'ai', label: 'AI / ML', tone: 'teal' },
  { id: 'school', label: 'School', tone: 'amber' },
  { id: 'music', label: 'Music', tone: 'pink' },
  { id: 'fitness', label: 'Fitness', tone: 'green' },
  { id: 'projects', label: 'Projects', tone: 'indigo' },
  { id: 'personal', label: 'Personal', tone: 'rose' },
  { id: 'other', label: 'Other', tone: 'grey' },
];

export function categoryOf(goal: Goal) {
  return CATEGORIES.find((entry) => entry.id === goal.category) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

// --------------------------------------------------------------------------
// The chip that says whether this is going to happen
// --------------------------------------------------------------------------
const DOTS: Record<HealthState, string> = {
  'on-track': '🟢',
  'at-risk': '🟡',
  'off-track': '🔴',
  'not-started': '⚪',
};

/**
 * The health chip, and the reason under it when there is room.
 *
 * The reason is not decoration. "At Risk" on its own is a colour, and the
 * reader's next question is always the same one — so the model that produced
 * the colour also produces the sentence, and the sentence travels with it. See
 * `reasonFor` in utils/goalHealth.
 */
export function HealthChip({ health, size }: { health: GoalHealth; size?: 'sm' }) {
  return (
    <span
      className={`gx-health is-${health.state}${size === 'sm' ? ' is-sm' : ''}`}
      title={health.reason}
    >
      <span aria-hidden="true">{DOTS[health.state]}</span>
      {health.label}
    </span>
  );
}

// --------------------------------------------------------------------------
// Progress
// --------------------------------------------------------------------------
export function ProgressBar({ pct, tone }: { pct: number; tone?: string }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <span className="gx-track" role="img" aria-label={`${Math.round(width)} percent`}>
      <i className={`gx-fill${tone ? ` tone-${tone}` : ''}`} style={{ width: `${width}%` }} />
    </span>
  );
}

/**
 * The checkpoints as a row of segments.
 *
 * A count — "6 / 9 milestones" — says how many and not which, and which is the
 * thing a reader wants at a glance: four done, then a gap, then the one being
 * worked on. One segment per checkpoint, in execution order, so the shape of
 * the run is visible before any number is read. It stops being useful past
 * about a dozen, which is also about where a goal has too many checkpoints.
 */
export function MilestoneTrack({ rows }: { rows: Milestone[] }) {
  if (rows.length === 0) return null;
  const next = rows.find((row) => row.status !== 'done');
  return (
    <span className="gx-steps" aria-hidden="true">
      {rows.map((row) => (
        <i
          key={row.id}
          className={`gx-step${row.status === 'done' ? ' is-done' : ''}${row.id === next?.id ? ' is-next' : ''}`}
          title={row.title}
        />
      ))}
    </span>
  );
}

// --------------------------------------------------------------------------
// Section 1 — the overview strip
// --------------------------------------------------------------------------
export function OverviewStrip({
  goals,
  tasks,
  today,
}: {
  goals: Goal[];
  tasks: Task[];
  today?: Date;
}) {
  const view = goalsOverview(goals, tasks, today);

  const cards: Array<{ key: string; label: string; value: ReactNode; foot: string; tone: string }> = [
    {
      key: 'active',
      label: 'Active goals',
      value: view.active,
      foot: view.completed ? `${view.completed} reached so far` : 'nothing finished yet',
      tone: 'violet',
    },
    {
      key: 'overall',
      label: 'Overall progress',
      value: `${Math.round(view.overall)}%`,
      foot: 'weighted by how much each one matters',
      tone: 'blue',
    },
    {
      key: 'ontrack',
      label: 'On track',
      value: view.onTrack,
      foot: `${view.atRisk} at risk · ${view.offTrack} off track`,
      tone: 'green',
    },
    {
      key: 'due',
      label: 'Due within a fortnight',
      value: view.dueSoon.length,
      foot: view.dueSoon[0]
        ? `soonest: ${view.dueSoon[0].title}`
        : 'nothing lands in the next two weeks',
      tone: 'amber',
    },
  ];

  return (
    <div className="gx-strip">
      {cards.map((card) => (
        <article className={`gx-stat tone-${card.tone}`} key={card.key}>
          <span className="gx-stat-label">{card.label}</span>
          <strong className="gx-stat-value">{card.value}</strong>
          <span className="gx-stat-foot">{card.foot}</span>
        </article>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Section 2 — the goal cards
// --------------------------------------------------------------------------
/**
 * One goal, at the size the page opens on.
 *
 * Everything the spec asks a card to answer, in the order a reader asks it:
 * what it is, what it is about, how far along, what the figures behind that
 * are, when it is due, how many checkpoints are left, and whether any of it is
 * going to happen. The health chip is top-right on every card, which is the
 * one position on this page that always means the same thing.
 */
export function OutcomeCard({
  goal,
  tasks,
  today,
  onOpen,
}: {
  goal: Goal;
  tasks: Task[];
  today?: Date;
  onOpen: (goal: Goal) => void;
}) {
  const numbers = goalNumbers(goal);
  const health = goalHealth(goal, tasks, today);
  const category = categoryOf(goal);
  const rows = goal.milestones ?? [];
  const left = rows.filter((row) => row.status !== 'done').length;
  const daysLeft = health.signals.daysLeft;

  return (
    <article
      className={`gx-card tone-${category.tone}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(goal)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(goal);
        }
      }}
    >
      <header className="gx-card-head">
        <div className="gx-card-title">
          <span className="gx-cat">{category.label}</span>
          <h3>{goal.title}</h3>
        </div>
        <HealthChip health={health} />
      </header>

      <div className="gx-card-bar">
        <ProgressBar pct={numbers.progress} tone={category.tone} />
        <span className="gx-card-pct">{Math.round(numbers.progress)}%</span>
      </div>

      <p className="gx-card-figures">
        {numbers.numeric && numbers.target > 0 ? (
          <>
            <strong>{fmtGoalNumber(numbers.current, numbers)}</strong>
            <span className="gx-quiet"> / {fmtGoalNumber(numbers.target, numbers)}</span>
            {numbers.label && <span className="gx-quiet"> {numbers.label}</span>}
          </>
        ) : rows.length > 0 ? (
          <>
            <strong>
              {numbers.current} / {numbers.target}
            </strong>
            <span className="gx-quiet"> checkpoints reached</span>
          </>
        ) : (
          <span className="gx-quiet">No measure set — break it into checkpoints to track it.</span>
        )}
      </p>

      {rows.length > 0 && <MilestoneTrack rows={rows} />}

      <footer className="gx-card-foot">
        <span>
          {left > 0 ? `${left} checkpoint${left === 1 ? '' : 's'} left` : 'every checkpoint reached'}
        </span>
        <span className="gx-dot-sep" aria-hidden="true" />
        <span>
          {goal.deadline
            ? daysLeft !== null && daysLeft >= 0
              ? `${formatGoalDate(goal.deadline)} · ${daysLeft} days`
              : `${formatGoalDate(goal.deadline)} · overdue`
            : 'no date'}
        </span>
      </footer>

      <p className="gx-card-reason">{health.reason}</p>
    </article>
  );
}

// --------------------------------------------------------------------------
// Section 3 — the timeline
// --------------------------------------------------------------------------
/**
 * Every upcoming checkpoint across every goal, in date order.
 *
 * The one place on the page that crosses goals. A reader with four goals does
 * not experience them as four lists — they experience one next fortnight — and
 * this is the view that says what is actually in it. Checkpoints with no date
 * come last, in goal order, because "at some point" is still information.
 */
export function GoalTimeline({
  goals,
  onOpen,
  today = new Date(),
}: {
  goals: Goal[];
  onOpen: (goal: Goal) => void;
  today?: Date;
}) {
  const rows = goals
    .filter((goal) => goal.status !== 'completed')
    .flatMap((goal) =>
      (goal.milestones ?? [])
        .filter((row) => row.status !== 'done')
        .map((row) => ({ goal, row })),
    )
    .sort((a, b) => {
      const left = a.row.target_date || '9999';
      const right = b.row.target_date || '9999';
      if (left !== right) return left < right ? -1 : 1;
      return a.row.position - b.row.position;
    })
    .slice(0, 8);

  if (rows.length === 0) {
    return (
      <p className="gx-empty">
        Nothing is queued. Break a goal into checkpoints and the next few will line up here.
      </p>
    );
  }

  return (
    <ol className="gx-timeline">
      {rows.map(({ goal, row }, index) => {
        const at = row.target_date
          ? new Date(`${row.target_date}T00:00:00`).getTime()
          : null;
        const days =
          at === null ? null : Math.round((at - today.getTime()) / 86_400_000);
        const category = categoryOf(goal);
        return (
          <li className={`gx-tl-row tone-${category.tone}`} key={row.id}>
            <span className="gx-tl-mark" aria-hidden="true">
              {index === 0 ? '→' : '○'}
            </span>
            <button type="button" className="gx-tl-body" onClick={() => onOpen(goal)}>
              <span className="gx-tl-title">{row.title}</span>
              <span className="gx-tl-goal">{goal.title}</span>
            </button>
            <span className="gx-tl-when">
              {days === null
                ? 'no date'
                : days < 0
                  ? `${Math.abs(days)}d late`
                  : days === 0
                    ? 'today'
                    : `in ${days}d`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --------------------------------------------------------------------------
// Section 5 — what the record says about the set of them
// --------------------------------------------------------------------------
export function GoalInsights({
  goals,
  tasks,
  today,
  onOpen,
}: {
  goals: Goal[];
  tasks: Task[];
  today?: Date;
  onOpen: (goal: Goal) => void;
}) {
  const notes: GoalNote[] = goalNotes(goals, tasks, today);
  if (notes.length === 0) {
    return (
      <p className="gx-empty">
        Nothing to read yet. These fill in from the tasks you link to a goal — which is what makes
        a goal something the app can see you working on rather than something you told it about.
      </p>
    );
  }
  return (
    <ul className="gx-notes">
      {notes.map((note) => {
        const goal = goals.find((entry) => entry.id === note.goalId);
        return (
          <li className={`gx-note tone-${note.tone}`} key={note.headline}>
            <div>
              <strong>{note.headline}</strong>
              <span className="gx-quiet">{note.hint}</span>
            </div>
            {goal && (
              <button type="button" className="gx-link" onClick={() => onOpen(goal)}>
                Open
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --------------------------------------------------------------------------
// Section 6 — what has already been reached
// --------------------------------------------------------------------------
/**
 * Completed goals and checkpoints, most recent first.
 *
 * Rewarding without being a trophy cabinet: one line each, the date it
 * happened, no confetti and no XP. The spec's word for this is "not overly
 * gamified", and the way to earn that is to let the achievement be the whole
 * of the reward.
 */
export function RecentlyCompleted({ goals }: { goals: Goal[] }) {
  const done = goals.filter((goal) => goal.status === 'completed');
  const checkpoints = goals
    .flatMap((goal) =>
      (goal.milestones ?? [])
        .filter((row) => row.status === 'done' && row.completed_at)
        .map((row) => ({ goal, row })),
    )
    .sort((a, b) => (a.row.completed_at! < b.row.completed_at! ? 1 : -1))
    .slice(0, 6);

  if (done.length === 0 && checkpoints.length === 0) {
    return <p className="gx-empty">Nothing reached yet. The first one lands here.</p>;
  }

  return (
    <ul className="gx-done">
      {done.slice(0, 4).map((goal) => (
        <li className="gx-done-row is-goal" key={goal.id}>
          <span className="gx-done-mark" aria-hidden="true">
            ★
          </span>
          <span className="gx-done-title">{goal.title}</span>
          <span className="gx-quiet">goal reached</span>
        </li>
      ))}
      {checkpoints.map(({ goal, row }) => (
        <li className="gx-done-row" key={row.id}>
          <span className="gx-done-mark" aria-hidden="true">
            ✓
          </span>
          <span className="gx-done-title">{row.title}</span>
          <span className="gx-quiet">
            {goal.title} · {formatGoalDate(row.completed_at ?? '')}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------------------------
// A section wrapper, so every band on the page is built the same way
// --------------------------------------------------------------------------
export function Band({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="gx-band">
      <header className="gx-band-head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="gx-quiet">{hint}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}
