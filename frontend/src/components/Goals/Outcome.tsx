/**
 * The Goals page's own furniture — everything above the detail view.
 *
 * The page answers four questions in order and these are the parts that answer
 * them: what am I trying to accomplish (the priority cards), how far am I (the
 * bars and the checkpoint runs), what comes next (the timeline and the next
 * checkpoints), and am I on track (the health chip, in the same corner of
 * every card, and the distribution ring).
 *
 * Nothing here computes anything. Health is utils/goalHealth, the readings are
 * utils/goalAnalytics, and the figures under a bar are `goalNumbers` — this
 * file draws what those three decided, which is what keeps a card and the
 * detail view behind it from ever disagreeing about the same goal.
 *
 * What it does decide is *how a figure arrives*: every number and every mark
 * here travels to its value through `useCountUp` rather than being replaced by
 * it, because the page re-reads everything from the server after each write and
 * a checkpoint ticked off would otherwise move four figures between one frame
 * and the next. A mark and the reading beside it always run the same number
 * through the same hook, so they cannot end up in different places mid-flight.
 *
 * ## What it does not draw
 *
 * There is no time-invested panel, no focus-per-goal breakdown and no daily
 * average. Two separate reasons, and both matter. The first is that the app
 * records focus time per day rather than per task, so a per-goal hour count
 * has nothing behind it. The second is that this is not the analytics page:
 * Goals says where you are going and whether you will get there, and the
 * moment it grows a second column of averages it has become a worse version of
 * the page next door.
 */
import { useId, type ReactNode } from 'react';
import { useCountUp } from '@/hooks';
import { formatGoalDate } from './numbers';
import { type GoalHealth, type HealthState } from '@/utils/goalHealth';
import { goalNotes, goalsOverview, type GoalNote } from '@/utils/goalAnalytics';
import type { Goal, GoalCategory, Milestone, Task } from '@/types';

const DAY = 86_400_000;

/**
 * What a goal can be about.
 *
 * A label, a hue name the stylesheet turns into a colour, and the drawing on
 * its tile. The palette lives in the stylesheet so this stays a list of what
 * the categories *are*; `other` is the fallback for anything the backend lets
 * through that is not here, which is why the lookup below never throws.
 */
export const CATEGORIES: Array<{
  id: GoalCategory;
  label: string;
  tone: string;
  path: string;
}> = [
  { id: 'math', label: 'Math', tone: 'blue', path: 'M5 7h14M9 12h10M5 17h9M7 4l-2 6M17 14l2 6' },
  { id: 'coding', label: 'Coding', tone: 'violet', path: 'M8 6l-5 6 5 6M16 6l5 6-5 6' },
  { id: 'ai', label: 'AI / ML', tone: 'teal', path: 'M12 3v4M12 17v4M5 12H3M21 12h-2M7 7l-2-2M19 19l-2-2M7 17l-2 2M19 5l-2 2M12 9a3 3 0 100 6 3 3 0 000-6z' },
  { id: 'school', label: 'School', tone: 'amber', path: 'M3 8l9-4 9 4-9 4-9-4zM7 11v5c0 1 2 2 5 2s5-1 5-2v-5' },
  { id: 'music', label: 'Music', tone: 'pink', path: 'M9 18V5l10-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'fitness', label: 'Fitness', tone: 'green', path: 'M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10' },
  { id: 'projects', label: 'Projects', tone: 'indigo', path: 'M3 7h6l2 2h10v10H3V7z' },
  { id: 'personal', label: 'Personal', tone: 'rose', path: 'M12 20s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.5-7 9-7 9z' },
  { id: 'other', label: 'Other', tone: 'grey', path: 'M12 3l2.6 5.6 6.4.8-4.7 4.3 1.3 6.3L12 17l-5.6 3 1.3-6.3L3 9.4l6.4-.8L12 3z' },
];

export function categoryOf(goal: Goal) {
  return CATEGORIES.find((entry) => entry.id === goal.category) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

/** A 24-box stroked drawing, at whatever size the caller needs. */
function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** The tinted rounded tile a goal wears, with its category's drawing in it. */
export function GoalTile({ goal, size = 18 }: { goal: Goal; size?: number }) {
  const category = categoryOf(goal);
  return (
    <span className={`gx-tile tone-${category.tone}`} aria-hidden="true">
      <Icon path={category.path} size={size} />
    </span>
  );
}

// --------------------------------------------------------------------------
// The chip that says whether this is going to happen
// --------------------------------------------------------------------------
const HEALTH_LABEL: Record<HealthState, string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  'off-track': 'Off Track',
  'not-started': 'Not Started',
};

/**
 * The health chip, with its reason on the hover.
 *
 * The reason is not decoration: "At Risk" on its own is a colour, and the
 * reader's next question is always the same one. The model that produced the
 * colour produces the sentence, and the sentence travels with it — on the card
 * it is a title, and in the detail view it is printed. See `reasonFor` in
 * utils/goalHealth.
 */
export function HealthChip({ health }: { health: GoalHealth }) {
  return (
    <span className={`gx-health is-${health.state}`} title={health.reason}>
      <i aria-hidden="true" />
      {health.state === 'on-track' && health.score === 100 ? 'Complete' : HEALTH_LABEL[health.state]}
    </span>
  );
}

// --------------------------------------------------------------------------
// Small marks
// --------------------------------------------------------------------------
export function ProgressBar({ pct, tone }: { pct: number; tone?: string }) {
  const target = Math.max(0, Math.min(100, pct));
  // Grown by the hook rather than by a CSS keyframe, so a bar that moves
  // because a checkpoint was ticked travels the same way as one arriving for
  // the first time — and always in step with the figure printed beside it.
  const width = useCountUp(target);
  return (
    <span className="gx-track" role="img" aria-label={`${Math.round(target)} percent`}>
      <i className={`gx-fill${tone ? ` tone-${tone}` : ''}`} style={{ width: `${width}%` }} />
    </span>
  );
}

/**
 * A ring, for the one figure on the page that is a proportion of itself.
 *
 * `pathLength` normalises the circumference to 100 so the dash array is the
 * percentage with no arithmetic and no radius to keep in step with the CSS.
 */
export function Ring({ pct, tone = 'violet', size = 46 }: { pct: number; tone?: string; size?: number }) {
  const value = useCountUp(Math.max(0, Math.min(100, pct)));
  // Unique per instance because two gradients cannot share an id, and there is
  // one of these per stat card. The stops are `currentColor` rather than the
  // tone variable so the gradient needs no knowledge of which tone it is in:
  // the stylesheet points `color` at `--tone` and both themes get their own
  // hue out of the same two lines. See the `.gx-ring` note in goals.css.
  const sweep = useId();
  return (
    <svg className={`gx-ring tone-${tone}`} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={sweep} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity=".45" />
        </linearGradient>
      </defs>
      <circle className="gx-ring-track" cx="20" cy="20" r="16" pathLength={100} />
      <circle
        className="gx-ring-fill"
        cx="20"
        cy="20"
        r="16"
        pathLength={100}
        stroke={`url(#${sweep})`}
        strokeDasharray={`${value} ${100 - value}`}
      />
    </svg>
  );
}

/**
 * The work behind a goal, as a line.
 *
 * One point per week, counting the tasks finished toward the goal — real
 * evidence rather than a drawn-in trend, which is why a goal nobody has linked
 * anything to draws nothing at all instead of a flat line implying zero
 * activity was measured.
 */
function Spark({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2 || values.every((value) => value === 0)) return null;
  const peak = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const line = values
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(24 - (value / peak) * 22).toFixed(1)}`)
    .join(' ');
  const wash = useId();
  return (
    <svg className={`gx-spark tone-${tone}`} viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={wash} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="gx-spark-area" d={`${line} L100,26 L0,26 Z`} fill={`url(#${wash})`} />
      <path className="gx-spark-line" d={line} />
    </svg>
  );
}

// --------------------------------------------------------------------------
// Section 1 — the strip
// --------------------------------------------------------------------------
const STAT_ICONS = {
  active: 'M12 3l2.6 5.6 6.4.8-4.7 4.3 1.3 6.3L12 17l-5.6 3 1.3-6.3L3 9.4l6.4-.8L12 3z',
  check: 'M20 6L9 17l-5-5',
  warn: 'M12 4l9 16H3l9-16zM12 10v4M12 17h.01',
  calendar: 'M3 6h18v15H3V6zM3 11h18M8 3v4M16 3v4',
};

/**
 * Where everything stands, in five figures.
 *
 * Every one of them is counted off the goals themselves. There are no
 * "vs last 30 days" deltas here, and their absence is deliberate: this app
 * keeps no history of a goal's percentage, so a change figure would have to be
 * invented, and a made-up arrow on the first card is how a reader learns to
 * distrust the other four. What each card carries instead is a second real
 * fact about the same number.
 */
export function OverviewStrip({
  goals,
  tasks,
  today = new Date(),
}: {
  goals: Goal[];
  tasks: Task[];
  today?: Date;
}) {
  const view = goalsOverview(goals, tasks, today);
  const share = view.active ? Math.round((view.onTrack / view.active) * 100) : 0;

  // Counted to rather than replaced — see hooks/useCountUp.ts. The footers are
  // left to change at once: they are sentences about the figure above them, and
  // a sentence counting through its own numbers is noise, not motion.
  const active = Math.round(useCountUp(view.active));
  const onTrack = Math.round(useCountUp(view.onTrack));
  const atRisk = Math.round(useCountUp(view.atRisk));
  const dueSoon = Math.round(useCountUp(view.dueSoon.length));
  // The ring beside this reading runs its own tween off the same figure — same
  // input, same duration, same first frame — so the two cannot drift apart.
  const overallTarget = Math.round(view.overall);
  const overall = Math.round(useCountUp(overallTarget));

  // How the active count got to where it is: goals opened per week. Counted
  // from `start_date`, which is the day the run at it began.
  const opened = new Array(12).fill(0) as number[];
  goals.forEach((goal) => {
    const at = new Date(`${String(goal.start_date || goal.created_at).slice(0, 10)}T00:00:00`).getTime();
    if (Number.isNaN(at)) return;
    const back = Math.floor((today.getTime() - at) / (7 * DAY));
    if (back < 0 || back >= 12) return;
    const index = 11 - back;
    opened[index] = (opened[index] ?? 0) + 1;
  });

  const next = view.dueSoon[0];

  return (
    <div className="gx-strip">
      <article className="gx-stat tone-violet">
        <header>
          <span className="gx-stat-label">Active Goals</span>
        </header>
        <strong className="gx-stat-value">{active}</strong>
        <span className="gx-stat-foot">
          {view.completed ? `${view.completed} reached so far` : 'none reached yet'}
        </span>
        <Spark values={opened} tone="violet" />
      </article>

      <article className="gx-stat tone-indigo">
        <header>
          <span className="gx-stat-label">Overall Progress</span>
          <Ring pct={overallTarget} tone="indigo" />
        </header>
        <strong className="gx-stat-value">{overall}%</strong>
        <span className="gx-stat-foot">weighted by how much each matters</span>
      </article>

      <article className="gx-stat tone-green">
        <header>
          <span className="gx-stat-label">Goals On Track</span>
          <span className="gx-stat-ico">
            <Icon path={STAT_ICONS.check} />
          </span>
        </header>
        <strong className="gx-stat-value">{onTrack}</strong>
        <span className="gx-stat-foot">{share}% of active goals</span>
      </article>

      <article className="gx-stat tone-amber">
        <header>
          <span className="gx-stat-label">Goals At Risk</span>
          <span className="gx-stat-ico">
            <Icon path={STAT_ICONS.warn} />
          </span>
        </header>
        <strong className="gx-stat-value">{atRisk}</strong>
        <span className="gx-stat-foot">
          {view.offTrack ? `${view.offTrack} already off track` : 'none off track'}
        </span>
      </article>

      <article className="gx-stat tone-blue">
        <header>
          <span className="gx-stat-label">Upcoming Deadlines</span>
          <span className="gx-stat-ico">
            <Icon path={STAT_ICONS.calendar} />
          </span>
        </header>
        <strong className="gx-stat-value">{dueSoon}</strong>
        <span className="gx-stat-foot">
          {next ? `Next: ${formatGoalDate(next.deadline)}` : 'nothing in the next fortnight'}
        </span>
      </article>
    </div>
  );
}

// --------------------------------------------------------------------------
// Section 2 — the priority cards
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Section 3 — the timeline
// --------------------------------------------------------------------------
/**
 * Everything that has happened and everything queued, down one rail.
 *
 * The one view on the page that crosses goals. A reader with four goals does
 * not experience them as four lists — they experience one next few months —
 * and this is what says what is actually in it. Reached checkpoints are above
 * the line and unreached below, so the rail reads as a path rather than as a
 * backlog, which is the whole difference between a timeline and a to-do list.
 */
export function GoalTimeline({
  goals,
  onOpen,
  onDate,
  today = new Date(),
  limit = 9,
}: {
  goals: Goal[];
  onOpen: (goal: Goal) => void;
  /**
   * Set or clear when a checkpoint is meant to be reached.
   *
   * Optional, and the rail is read-only without it. `target_date` has been on
   * the milestone model, in the API and on this page's own sort keys since the
   * table existed — every view here reads it, sorts by it and prints "in 12d"
   * off it — and nothing in the app ever let anyone write one. A rail whose
   * order is a date the reader has no way to set is a rail that draws whatever
   * order the rows happen to be in and calls it a timeline.
   *
   * An empty string clears the date, which is the value an emptied date input
   * gives and what the backend reads as "no date".
   */
  onDate?: (milestone: Milestone, date: string) => void;
  today?: Date;
  limit?: number;
}) {
  type Row = { goal: Goal; row: Milestone; at: number | null; done: boolean };

  const all: Row[] = goals.flatMap((goal) =>
    (goal.milestones ?? []).map((row) => {
      const stamp = row.status === 'done' ? row.completed_at : row.target_date;
      const at = stamp
        ? new Date(`${String(stamp).slice(0, 10)}T00:00:00`).getTime()
        : null;
      return { goal, row, at: Number.isNaN(at) ? null : at, done: row.status === 'done' };
    }),
  );

  // The last few that happened, then the next few that have not. Undated ones
  // sort to the end of their own half: "at some point" is still information,
  // but it is not a position on a rail.
  const past = all
    .filter((entry) => entry.done)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .slice(-3);
  const ahead = all
    .filter((entry) => !entry.done)
    .sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit - past.length);

  if (past.length === 0 && ahead.length === 0) {
    return (
      <p className="gx-empty">
        Nothing on the rail yet. Break a goal into milestones.
      </p>
    );
  }

  const render = (entry: Row, current: boolean) => {
    const category = categoryOf(entry.goal);
    const days = entry.at === null ? null : Math.round((entry.at - today.getTime()) / DAY);
    return (
      <li
        className={`gx-tl-row tone-${category.tone}${entry.done ? ' is-done' : ''}${current ? ' is-now' : ''}`}
        key={entry.row.id}
      >
        <span className="gx-tl-mark" aria-hidden="true">
          {entry.done ? '✓' : current ? '→' : ''}
        </span>
        <button type="button" className="gx-tl-body" onClick={() => onOpen(entry.goal)}>
          <span className="gx-tl-goal">{entry.goal.title}</span>
          <span className="gx-tl-title">{entry.row.title}</span>
        </button>
        {/* Done is a fact and gets a date; anything ahead is a plan and gets
            a control. A finished checkpoint prints when it was reached, which
            is not a thing to edit. */}
        {onDate && !entry.done ? (
          <label className="gx-tl-set">
            <span className={days !== null && days < 0 ? 'is-late' : undefined}>
              {entry.at === null
                ? 'Set a date'
                : days !== null && days < 0
                  ? `${Math.abs(days)}d late`
                  : days === 0
                    ? 'today'
                    : `in ${days}d`}
            </span>
            <input
              type="date"
              value={entry.row.target_date ? String(entry.row.target_date).slice(0, 10) : ''}
              aria-label={`When to finish ${entry.row.title}`}
              onChange={(event) => onDate(entry.row, event.target.value)}
            />
          </label>
        ) : (
          <span className="gx-tl-when">
            {entry.at === null
              ? 'no date'
              : entry.done
                ? formatGoalDate(new Date(entry.at).toISOString())
                : days !== null && days < 0
                  ? `${Math.abs(days)}d late`
                  : days === 0
                    ? 'today'
                    : `in ${days}d`}
          </span>
        )}
      </li>
    );
  };

  return (
    <ol className="gx-timeline">
      {past.map((entry) => render(entry, false))}
      {past.length > 0 && ahead.length > 0 && (
        <li className="gx-tl-today" aria-hidden="true">
          <span>Today</span>
        </li>
      )}
      {ahead.map((entry, index) => render(entry, index === 0))}
    </ol>
  );
}

// --------------------------------------------------------------------------
// Next milestones
// --------------------------------------------------------------------------
/**
 * The checkpoints actually being worked on, with what is under each.
 *
 * The timeline says when; this says how far into each one you are, counted
 * from the tasks pointed at it. A checkpoint with nothing linked shows no bar
 * rather than an empty one — there is a difference between no progress and
 * nothing to measure, and drawing a 0% bar claims the first when it means the
 * second.
 */
export function NextMilestones({
  goals,
  tasks,
  onOpen,
  today = new Date(),
  limit = 4,
}: {
  goals: Goal[];
  tasks: Task[];
  onOpen: (goal: Goal) => void;
  today?: Date;
  limit?: number;
}) {
  const rows = goals
    .filter((goal) => goal.status !== 'completed')
    .map((goal) => {
      const next = (goal.milestones ?? []).find((row) => row.status !== 'done');
      return next ? { goal, row: next } : null;
    })
    .filter((entry): entry is { goal: Goal; row: Milestone } => entry !== null)
    .sort((a, b) => (a.row.target_date || '9999') < (b.row.target_date || '9999') ? -1 : 1)
    .slice(0, limit);

  if (rows.length === 0) {
    return <p className="gx-empty">No milestone is waiting. Every goal with checkpoints is done with them.</p>;
  }

  return (
    <ul className="gx-next">
      {rows.map(({ goal, row }) => {
        const mine = tasks.filter((task) => task.milestone_id === row.id);
        const done = mine.filter((task) => task.status === 'done').length;
        const at = row.target_date
          ? new Date(`${row.target_date}T00:00:00`).getTime()
          : null;
        const days = at === null ? null : Math.round((at - today.getTime()) / DAY);
        const category = categoryOf(goal);
        return (
          <li className={`gx-next-row tone-${category.tone}`} key={row.id}>
            <GoalTile goal={goal} size={15} />
            <button type="button" className="gx-next-body" onClick={() => onOpen(goal)}>
              <span className="gx-next-title">{row.title}</span>
              <span className="gx-next-goal">{goal.title}</span>
              {mine.length > 0 && (
                <span className="gx-next-bar">
                  <span className="gx-next-count">
                    {done} / {mine.length}
                  </span>
                  <ProgressBar pct={(done / mine.length) * 100} tone={category.tone} />
                </span>
              )}
            </button>
            <span className="gx-next-when">
              <strong>
                {days === null
                  ? 'No date'
                  : days < 0
                    ? `${Math.abs(days)}d late`
                    : days === 0
                      ? 'Today'
                      : `Due in ${days} days`}
              </strong>
              {row.target_date && <span>{formatGoalDate(row.target_date)}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// --------------------------------------------------------------------------
// Health, as a distribution
// --------------------------------------------------------------------------
/**
 * The four health states as one ring.
 *
 * The only chart on the page, and it earns its place by answering the page's
 * own question — how much of what I am carrying is actually going to happen —
 * in a way five numbers in a row do not. A ring is right here for the reason
 * it is wrong almost everywhere else: four slices of one whole, all labelled,
 * all counted beside it.
 */
export function HealthRing({
  goals,
  tasks,
  today,
}: {
  goals: Goal[];
  tasks: Task[];
  today?: Date;
}) {
  const view = goalsOverview(goals, tasks, today);
  const total = view.active || 1;

  // Four fixed states, so four calls rather than a loop. Each arc is drawn from
  // its own animated count and the offsets are accumulated from those same
  // numbers, so the ring stays a closed circle at every frame of the sweep
  // instead of opening gaps between slices that are still catching up.
  const slices = [
    { key: 'on-track', label: 'On Track', shown: useCountUp(view.onTrack) },
    { key: 'at-risk', label: 'At Risk', shown: useCountUp(view.atRisk) },
    { key: 'off-track', label: 'Off Track', shown: useCountUp(view.offTrack) },
    { key: 'not-started', label: 'Not Started', shown: useCountUp(view.notStarted) },
  ];
  const active = Math.round(useCountUp(view.active));

  let offset = 0;
  return (
    <div className="gx-dist">
      <div className="gx-dist-ring">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle className="gx-ring-track" cx="20" cy="20" r="15.5" pathLength={100} />
          {slices.map((slice) => {
            const share = (slice.shown / total) * 100;
            const dash = (
              <circle
                key={slice.key}
                className={`gx-dist-arc is-${slice.key}`}
                cx="20"
                cy="20"
                r="15.5"
                pathLength={100}
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-offset}
              />
            );
            offset += share;
            return dash;
          })}
        </svg>
        <span className="gx-dist-centre">
          <strong>{active}</strong>
          <span>Active Goals</span>
        </span>
      </div>
      <ul className="gx-dist-key">
        {slices.map((slice) => (
          <li key={slice.key}>
            <i className={`is-${slice.key}`} aria-hidden="true" />
            <span>{slice.label}</span>
            <strong>
              {Math.round(slice.shown)}{' '}
              <span className="gx-quiet">({view.active ? Math.round((slice.shown / total) * 100) : 0}%)</span>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------
// Insights
// --------------------------------------------------------------------------
const NOTE_ICONS: Record<GoalNote['tone'], string> = {
  good: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  watch: 'M12 4l9 16H3l9-16zM12 10v4M12 17h.01',
  note: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
};

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
        Nothing to read yet. These fill in from tasks you link to a goal.
      </p>
    );
  }
  return (
    <ul className="gx-notes">
      {notes.map((note) => {
        const goal = goals.find((entry) => entry.id === note.goalId);
        return (
          <li className={`gx-note tone-${note.tone}`} key={note.headline}>
            <span className="gx-note-ico">
              <Icon path={NOTE_ICONS[note.tone]} size={15} />
            </span>
            <div>
              <strong>{note.headline}</strong>
              <span className="gx-quiet">{note.hint}</span>
            </div>
            {goal && (
              <button type="button" className="gx-link" onClick={() => onOpen(goal)}>
                Open →
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --------------------------------------------------------------------------
// What is already behind you
// --------------------------------------------------------------------------
/**
 * Completed goals and checkpoints, most recent first.
 *
 * Rewarding without being a trophy cabinet: one row each, what it belonged to,
 * the date it happened, and a tag saying which of the two it was. No confetti
 * and no XP — the spec's word for this is "not overly gamified", and the way
 * to earn that is to let the achievement be the whole of the reward.
 */
export function RecentlyCompleted({ goals }: { goals: Goal[] }) {
  type Row = { key: string; title: string; under: string; on: string; kind: 'Goal' | 'Milestone' };

  const rows: Row[] = [
    ...goals
      .filter((goal) => goal.status === 'completed')
      .map((goal) => ({
        key: `g:${goal.id}`,
        title: goal.title,
        under: categoryOf(goal).label,
        on: goal.deadline || goal.created_at,
        kind: 'Goal' as const,
      })),
    ...goals.flatMap((goal) =>
      (goal.milestones ?? [])
        .filter((row) => row.status === 'done' && row.completed_at)
        .map((row) => ({
          key: `m:${row.id}`,
          title: row.title,
          under: goal.title,
          on: row.completed_at!,
          kind: 'Milestone' as const,
        })),
    ),
  ]
    .sort((a, b) => (a.on < b.on ? 1 : -1))
    .slice(0, 6);

  if (rows.length === 0) {
    return <p className="gx-empty">Nothing reached yet. The first one lands here.</p>;
  }

  return (
    <ul className="gx-done">
      {rows.map((row) => (
        <li className={`gx-done-row is-${row.kind.toLowerCase()}`} key={row.key}>
          <span className="gx-done-mark" aria-hidden="true">
            <Icon path={STAT_ICONS.check} size={12} />
          </span>
          <span className="gx-done-body">
            <span className="gx-done-title">{row.title}</span>
            <span className="gx-quiet">
              {row.under} · {formatGoalDate(row.on)}
            </span>
          </span>
          <span className="gx-tag">{row.kind}</span>
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------------------------
// Furniture
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

/** The line at the foot of the page. */
export function GoalsCta({ onNew }: { onNew: () => void }) {
  return (
    <aside className="gx-cta">
      <span className="gx-tile tone-violet" aria-hidden="true">
        <Icon path={CATEGORIES[8]!.path} size={18} />
      </span>
      <div>
        <strong>Your goals. Your system. Your future.</strong>
        <span className="gx-quiet">Small daily actions today create the future you want.</span>
      </div>
      <button type="button" className="gx-btn is-primary" onClick={onNew}>
        Create New Goal →
      </button>
    </aside>
  );
}

/**
 * The line above everything — what the goals are all in service of.
 *
 * One sentence, editable nowhere yet, and deliberately not a feature: the
 * hierarchy the page is built on starts at a vision and it is worth naming
 * even when the app has nowhere to store one. It reads from the account's
 * goals rather than claiming to know: with goals set it says what they have in
 * common, and with none it says what the page is for.
 */
export function VisionLine({ goals }: { goals: Goal[] }) {
  const active = goals.filter((goal) => goal.status !== 'completed');
  const kinds = new Set(active.map((goal) => categoryOf(goal).label));
  if (active.length === 0) return null;
  return (
    <p className="gx-vision">
      <span>Vision</span>
      {active.length} goal{active.length === 1 ? '' : 's'} in flight across{' '}
      {[...kinds].slice(0, 3).join(', ')}
      {kinds.size > 3 ? ` and ${kinds.size - 3} more` : ''}.
    </p>
  );
}

/** The checkpoints as a row of segments — used by the detail view. */
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
