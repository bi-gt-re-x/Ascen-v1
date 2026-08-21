/**
 * One goal, at full width — the shape the Active Goals tab is made of.
 *
 * ## What the card is arranged to answer
 *
 * Three questions in three regions, left to right and top to bottom, and no
 * region answers a question another one already did:
 *
 *     the header   what is this, and how far in am I
 *     the left     how did it get here, and what are the checkpoints
 *     the right    what am I on now, and what do I do next
 *     the footer   when did it start, when is it due, what has it cost
 *
 * The old ladder answered the first and the middle and left the last two to
 * three other bands further down the page. Putting them on the card is most of
 * why the page can now be four tabs instead of eleven stacked sections.
 *
 * ## The left panel draws what the goal actually has
 *
 * A goal with two or more dated checkpoints behind it has a shape over time, so
 * it gets a line. One with none has no line to draw — plotting a single point,
 * or a straight run from zero to today, would be a picture of nothing — so it
 * gets its checkpoints as a roadmap instead, which is what that goal's progress
 * genuinely looks like. The panel's heading says which of the two you are
 * looking at rather than leaving one to be mistaken for the other.
 *
 * ## What is not invented
 *
 * The current checkpoint has no percentage of its own; a checkpoint is reached
 * or it is not. Where tasks are linked to it, the share of them finished is a
 * real reading and is drawn. Where none are, the bar is absent and the date
 * takes its place — rather than a figure derived from the goal's overall
 * progress, which would be the same number twice with one of them relabelled.
 */
import { useMemo, useState } from 'react';
import { GoalTile, HealthChip, categoryOf } from './Outcome';
import { formatGoalDate, goalDate, goalNumbers, goalWeight, isOverdue } from './numbers';
import { goalHealth } from '@/utils/goalHealth';
import type { Goal, Milestone, Task } from '@/types';

const DAY = 86_400_000;

/** Below this a goal is not "long term" — about a season. */
const LONG_TERM_DAYS = 120;

/** Priority at or above this wears the high-priority tag. */
const HIGH_PRIORITY = 7;

/** Actions listed before the rest are left to the task page. */
const ACTIONS = 4;

/** Checkpoints listed before the rest are left to the detail panel. */
const STONES = 6;

const pct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Milliseconds, or 0. Bare dates are read as local days — see `goalDate`. */
const time = (value?: string) => goalDate(value)?.getTime() ?? 0;

/** "Aug 21" — short, because these sit in a column an inch wide. */
function shortDate(value?: string): string {
  const at = time(value);
  if (!at) return '';
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "320h 15m", the way the footer prints it. */
function hoursMinutes(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// ---------------------------------------------------------------------------
// The ring
// ---------------------------------------------------------------------------
function Ring({ percent, tone }: { percent: number; tone: string }) {
  const size = 46;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (pct(percent) / 100) * circumference;
  return (
    <svg className={`ag-ring tone-${tone}`} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ag-ring-track" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ag-ring-arc"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Progress over time
// ---------------------------------------------------------------------------
type Range = 'year' | 'all';

interface Point {
  at: number;
  percent: number;
}

/**
 * The goal's completion history, as a running percentage.
 *
 * Built from the days its checkpoints were actually reached, plus today's
 * standing as the last point — so the line ends where the ring says it is. Not
 * a series the account stores: a goal keeps no history of its own percentage,
 * and this is the honest reconstruction of one from the dates it does keep.
 */
/** Checkpoints actually reached inside the window — what makes a line worth it. */
function movement(goal: Goal, range: Range, today: number): number {
  const floor = range === 'year' ? today - 365 * DAY : 0;
  return (goal.milestones ?? []).filter(
    (stone) => stone.status === 'done' && time(stone.completed_at) >= floor,
  ).length;
}

function series(goal: Goal, range: Range, today: number): Point[] {
  const stones = goal.milestones ?? [];
  if (stones.length === 0) return [];

  const floor = range === 'year' ? today - 365 * DAY : 0;
  const done = stones
    .filter((stone) => stone.status === 'done' && time(stone.completed_at))
    .map((stone) => time(stone.completed_at))
    .sort((a, b) => a - b);

  if (done.length === 0) return [];

  const out: Point[] = [];
  done.forEach((at, index) => {
    if (at < floor) return;
    out.push({ at, percent: ((index + 1) / stones.length) * 100 });
  });

  // Everything reached happened before the window opened: the line would be
  // empty even though the goal is well along, so the window's left edge carries
  // the standing it started at.
  if (out.length === 0) {
    out.push({ at: floor, percent: (done.length / stones.length) * 100 });
  } else if (done.length > out.length) {
    out.unshift({ at: floor, percent: ((done.length - out.length) / stones.length) * 100 });
  } else {
    // Nothing had been reached before the first point, so the line starts at
    // nothing — on the day the goal was set. Without it a goal with one
    // checkpoint behind it draws a flat run at its current standing, which is
    // arithmetically true and reads as "no progress ever". The rise from zero is
    // the progress.
    const began = time(goal.start_date || goal.created_at);
    if (began && began < out[0]!.at && began >= floor) out.unshift({ at: began, percent: 0 });
  }

  out.push({ at: today, percent: goalNumbers(goal).progress });
  return out;
}

function Sparkline({ points, tone }: { points: Point[]; tone: string }) {
  const w = 300;
  const h = 118;
  const padX = 4;
  const first = points[0]!.at;
  const last = points[points.length - 1]!.at;
  const span = Math.max(1, last - first);

  const at = (point: Point) => ({
    x: padX + ((point.at - first) / span) * (w - padX * 2),
    y: h - (pct(point.percent) / 100) * (h - 8) - 4,
  });

  const placed = points.map(at);
  const line = placed.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${placed[placed.length - 1]!.x.toFixed(1)},${h} L${placed[0]!.x.toFixed(1)},${h} Z`;

  // Four month labels across the span, evenly. Not one per point: the points
  // land on the days checkpoints happened, which is not a scale.
  const marks = [0, 1, 2, 3].map((i) => {
    const stamp = first + (span * i) / 3;
    return {
      x: padX + (i / 3) * (w - padX * 2),
      label: new Date(stamp).toLocaleDateString(undefined, { month: 'short' }),
    };
  });

  return (
    <div className={`ag-chart tone-${tone}`}>
      <ul className="ag-chart-scale" aria-hidden="true">
        {[100, 75, 50, 25, 0].map((value) => (
          <li key={value}>{value}%</li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ag-chart-plot" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className="ag-chart-grid" x1={0} x2={w} y1={4 + f * (h - 8)} y2={4 + f * (h - 8)} />
        ))}
        <path className="ag-chart-area" d={area} />
        <path className="ag-chart-line" d={line} />
        {placed.map((p, i) => (
          <circle key={i} className="ag-chart-dot" cx={p.x} cy={p.y} r={2.6} />
        ))}
      </svg>
      <ul className="ag-chart-months" aria-hidden="true">
        {marks.map((mark, i) => (
          <li key={i} style={{ left: `${(mark.x / w) * 100}%` }}>
            {mark.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------
function Stones({
  goal,
  onOpen,
}: {
  goal: Goal;
  onOpen: () => void;
}) {
  const stones = goal.milestones ?? [];
  const done = stones.filter((stone) => stone.status === 'done').length;

  return (
    <>
      <header className="ag-panel-head">
        <h4>Milestones</h4>
        <span className="ag-quiet">
          {done} / {stones.length} completed
        </span>
      </header>
      <ul className="ag-stones">
        {stones.slice(0, STONES).map((stone) => (
          <li key={stone.id} className={`is-${stone.status}`}>
            <button type="button" onClick={onOpen}>
              <span className="ag-stone-tick" aria-hidden="true">
                {stone.status === 'done' ? '✓' : ''}
              </span>
              <span className="ag-stone-name">{stone.title}</span>
              <span className="ag-quiet">
                {shortDateWithYear(stone.status === 'done' ? stone.completed_at : stone.target_date)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {stones.length > STONES && (
        <button type="button" className="ag-more" onClick={onOpen}>
          {stones.length - STONES} more
        </button>
      )}
    </>
  );
}

/** "May 2024" — the checkpoint column, where the year is the point. */
function shortDateWithYear(value?: string): string {
  const at = time(value);
  if (!at) return '—';
  return new Date(at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/**
 * The checkpoints as a roadmap, for a goal with nothing dated behind it.
 *
 * Each row's bar is the checkpoint's own state rather than a figure — reached,
 * being worked on, not started — because a checkpoint has no percentage and
 * three lengths that mean three states is the most a bar can honestly say here.
 */
function Roadmap({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const stones = goal.milestones ?? [];
  const share = (stone: Milestone) =>
    stone.status === 'done' ? 100 : stone.status === 'active' ? 45 : 6;

  return (
    <>
      <header className="ag-panel-head">
        <h4>Roadmap</h4>
        <span className="ag-quiet">
          {stones.filter((stone) => stone.status === 'done').length} / {stones.length} completed
        </span>
      </header>
      <ul className="ag-roadmap">
        {stones.slice(0, STONES + 2).map((stone) => (
          <li key={stone.id} className={`is-${stone.status}`}>
            <button type="button" onClick={onOpen}>
              <span className="ag-road-name">{stone.title}</span>
              <span className="ag-road-bar">
                <i style={{ width: `${share(stone)}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------
export interface ActiveGoalCardProps {
  goal: Goal;
  tasks: Task[];
  busy: boolean;
  onOpen: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onComplete: (task: Task) => void;
  onAddAction: (goal: Goal, title: string, milestoneId?: string) => void;
  /** Ask for a checkpoint list. Resolves null when the model could not answer. */
  onSuggest: (goal: Goal) => Promise<string[] | null>;
  /** Write a whole checkpoint list. Resolves false if the write failed. */
  onSaveStones: (goal: Goal, titles: string[]) => Promise<boolean>;
}

export function ActiveGoalCard({
  goal,
  tasks,
  busy,
  onOpen,
  onEdit,
  onDelete,
  onComplete,
  onAddAction,
  onSuggest,
  onSaveStones,
}: ActiveGoalCardProps) {
  const today = Date.now();
  const category = categoryOf(goal);
  const numbers = goalNumbers(goal);
  const health = goalHealth(goal, tasks);
  const stones = goal.milestones ?? [];

  /* Opens on the window that has something in it. A goal whose last checkpoint
     landed eighteen months ago has nothing to draw inside a year, and the line
     falls back to a flat run at its standing — true, and a picture of nothing.
     Checked once on first render rather than watched, so a reader who picks a
     range keeps it. */
  const [range, setRange] = useState<Range>(() =>
    movement(goal, 'year', Date.now()) > 0 ? 'year' : 'all',
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  /* The suggestion round trip is a model call and can take several seconds, so
     it carries its own busy state rather than the page's — the rest of the card
     stays usable while one goal is thinking. The ladder this replaced owned its
     spinner for the same reason. */
  const [thinking, setThinking] = useState(false);

  const line = useMemo(() => series(goal, range, today), [goal, range, today]);

  /** Every task that is work toward this goal, by either route. */
  const mine = useMemo(() => {
    const ids = new Set(stones.map((stone) => stone.id));
    return tasks.filter(
      (task) => task.goal_id === goal.id || (task.milestone_id && ids.has(task.milestone_id)),
    );
  }, [goal.id, stones, tasks]);

  /** The checkpoint being worked on: the active one, else the first unfinished. */
  const focus = useMemo(
    () =>
      stones.find((stone) => stone.status === 'active') ??
      stones.find((stone) => stone.status !== 'done') ??
      null,
    [stones],
  );

  /** How much of the focus checkpoint's own work is finished, where any exists. */
  const focusShare = useMemo(() => {
    if (!focus) return null;
    const linked = mine.filter((task) => task.milestone_id === focus.id);
    if (linked.length === 0) return null;
    return (linked.filter((task) => task.status === 'done').length / linked.length) * 100;
  }, [focus, mine]);

  const actions = useMemo(
    () =>
      mine
        .filter((task) => task.status !== 'done')
        .sort((a, b) => (time(a.due_date) || Infinity) - (time(b.due_date) || Infinity))
        .slice(0, ACTIONS),
    [mine],
  );

  /** What the goal has cost, off the clock its finished tasks recorded. */
  const invested = useMemo(
    () =>
      mine.reduce(
        (sum, task) => sum + (task.status === 'done' ? Number(task.completion_seconds) || 0 : 0),
        0,
      ),
    [mine],
  );

  const started = goal.start_date || goal.created_at;
  const span = time(goal.deadline) - time(started);
  const longTerm = span > LONG_TERM_DAYS * DAY;
  const priority = goalWeight(goal);
  const overdue = isOverdue(goal);

  const submit = () => {
    const title = draft.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    onAddAction(goal, title, focus?.id);
    setDraft('');
    setAdding(false);
  };

  return (
    <article className={`ag-card tone-${category.tone}`}>
      {/* ---- header --------------------------------------------------- */}
      <header className="ag-top">
        <GoalTile goal={goal} size={22} />

        <div className="ag-top-text">
          <div className="ag-title-row">
            <h3 title={goal.title}>{goal.title}</h3>
            {priority >= HIGH_PRIORITY && <span className="ag-badge">Primary Goal</span>}
          </div>
          {(goal.why || goal.description) && (
            <p className="ag-why">{goal.why || goal.description}</p>
          )}
          <ul className="ag-tags">
            <li>{longTerm ? 'Long Term' : 'Short Term'}</li>
            <li className={priority >= HIGH_PRIORITY ? 'is-hot' : ''}>
              {priority >= HIGH_PRIORITY ? 'High' : priority >= 4 ? 'Medium' : 'Low'} Priority
            </li>
            {overdue && <li className="is-late">Overdue</li>}
          </ul>
        </div>

        <div className="ag-top-right">
          <div className="ag-progress">
            <strong>{pct(numbers.progress)}%</strong>
            <span>Progress</span>
          </div>
          <Ring percent={numbers.progress} tone={category.tone} />
          <div className="ag-menu-wrap">
            <button
              type="button"
              className="ag-kebab"
              aria-label={`Actions for ${goal.title}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="12" cy="19" r="1.7" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="ag-menu-veil"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="ag-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpen(goal); }}>
                    Open
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(goal); }}>
                    Edit
                  </button>
                  <button type="button" role="menuitem" className="is-bad" onClick={() => { setMenuOpen(false); onDelete(goal); }}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---- body ------------------------------------------------------ */}
      <div className="ag-body">
        <section className="ag-panel">
          {line.length > 1 ? (
            <>
              <header className="ag-panel-head">
                <h4>Progress over time</h4>
                <label className="ag-range">
                  <span className="gx-sr">Range</span>
                  <select value={range} onChange={(event) => setRange(event.target.value as Range)}>
                    <option value="year">This Year</option>
                    <option value="all">All Time</option>
                  </select>
                </label>
              </header>
              <Sparkline points={line} tone={category.tone} />
              <Stones goal={goal} onOpen={() => onOpen(goal)} />
            </>
          ) : stones.length > 0 ? (
            <Roadmap goal={goal} onOpen={() => onOpen(goal)} />
          ) : (
            <>
              <header className="ag-panel-head">
                <h4>Milestones</h4>
              </header>
              <p className="ag-empty">
                No checkpoints yet. A goal without them is a wish with a percentage — break it into
                the states it passes through and the percentage starts meaning something.
              </p>
              <div className="ag-empty-tools">
                <button
                  type="button"
                  className="ag-more is-primary"
                  disabled={thinking}
                  onClick={() => {
                    setThinking(true);
                    void onSuggest(goal)
                      .then((titles) => (titles && titles.length ? onSaveStones(goal, titles) : null))
                      .finally(() => setThinking(false));
                  }}
                >
                  {thinking ? 'Thinking…' : 'Suggest checkpoints'}
                </button>
                <button type="button" className="ag-more" onClick={() => onOpen(goal)}>
                  Add them myself
                </button>
              </div>
            </>
          )}
        </section>

        <section className="ag-panel">
          <header className="ag-panel-head">
            <h4>Current focus</h4>
            <HealthChip health={health} />
          </header>

          {focus ? (
            <div className="ag-focus">
              <span className="ag-focus-ico" aria-hidden="true">
                <GoalTile goal={goal} size={16} />
              </span>
              <div className="ag-focus-text">
                <strong>{focus.title}</strong>
                <span>{focus.note || health.reason}</span>
              </div>
              {focusShare === null ? (
                <span className="ag-focus-when">{shortDateWithYear(focus.target_date)}</span>
              ) : (
                <span className="ag-focus-pct">{pct(focusShare)}%</span>
              )}
              {focusShare !== null && (
                <span className="ag-focus-bar">
                  <i style={{ width: `${pct(focusShare)}%` }} />
                </span>
              )}
            </div>
          ) : (
            <p className="ag-empty">
              {/* `focus` is null in two quite different situations and one
                  sentence covered both: a goal that has finished every
                  checkpoint, and a goal that never had any. The second was
                  being congratulated for it. */}
              {stones.length === 0
                ? 'Nothing to focus on yet — this goal has no checkpoints. The panel on the left is where they start.'
                : 'Every checkpoint is behind you. What is left is the goal itself.'}
            </p>
          )}

          <header className="ag-panel-head ag-panel-head-tight">
            <h4>Next actions</h4>
            {mine.length > 0 && (
              <span className="ag-quiet">
                {mine.filter((task) => task.status === 'done').length} of {mine.length} done
              </span>
            )}
          </header>

          {actions.length === 0 ? (
            <p className="ag-empty">
              Nothing open against this goal. Add one below and it is a real task — it shows on the
              dashboard and pays the same XP.
            </p>
          ) : (
            <ul className="ag-actions">
              {actions.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="ag-check"
                    disabled={busy}
                    aria-label={`Complete ${task.title}`}
                    onClick={() => onComplete(task)}
                  >
                    <span aria-hidden="true" />
                  </button>
                  <span className="ag-action-name" title={task.title}>
                    {task.title}
                  </span>
                  <span className={`ag-quiet${time(task.due_date) && time(task.due_date) < today ? ' is-late' : ''}`}>
                    {shortDate(task.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <form
              className="ag-add"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <input
                autoFocus
                value={draft}
                placeholder="What is the next action?"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={submit}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setDraft('');
                    setAdding(false);
                  }
                }}
              />
            </form>
          ) : (
            <button type="button" className="ag-add-btn" disabled={busy} onClick={() => setAdding(true)}>
              + Add new action
            </button>
          )}
        </section>
      </div>

      {/* ---- footer ---------------------------------------------------- */}
      <footer className="ag-foot">
        <button type="button" className="ag-details" onClick={() => onOpen(goal)}>
          View Details
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>

        <dl className="ag-facts">
          <div>
            <dt>Start date</dt>
            <dd>{formatGoalDate(started) || '—'}</dd>
          </div>
          <div>
            <dt>Target date</dt>
            <dd className={overdue ? 'is-late' : undefined}>{formatGoalDate(goal.deadline) || '—'}</dd>
          </div>
          <div>
            <dt>Time invested</dt>
            {/* Off the clock finished tasks recorded, never estimated. A goal
                whose work was never timed says so rather than guessing. */}
            <dd>{invested > 0 ? hoursMinutes(invested) : '—'}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>
              <span className="ag-dot" aria-hidden="true" />
              {category.label}
            </dd>
          </div>
        </dl>
      </footer>
    </article>
  );
}
