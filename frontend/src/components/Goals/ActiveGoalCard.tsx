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
 * ## The left panel is one chart, and which one depends on the goal
 *
 * Not a fixed chart with the numbers swapped. `pickVisual` in utils/goalVisuals
 * runs goal type → subject → available data and returns exactly one: a
 * competition maths goal with rated attempts behind it gets accuracy against
 * difficulty, a violin goal gets the consistency grid, a project gets its
 * roadmap, a goal measured by a number gets the distance to it. The same card,
 * completely different analytics, which is the point — an app where every goal
 * gets the same graph is telling you about its template.
 *
 * One, though. Not a stack and not tabs: two charts on a card are two things
 * competing to be the thing you look at, and neither wins. The checkpoint list
 * that used to sit under the chart is gone with it — the current one is named in
 * the panel opposite and the rest are one click away.
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
import { GoalVisual } from './GoalVisual';
import { formatGoalDate, goalDate, goalNumbers, goalWeight, isOverdue } from './numbers';
import { goalHealth } from '@/utils/goalHealth';
import { pickVisual, visualContext } from '@/utils/goalVisuals';
import type { Goal, Task } from '@/types';

const DAY = 86_400_000;

/** Below this a goal is not "long term" — about a season. */
const LONG_TERM_DAYS = 120;

/** Priority at or above this wears the high-priority tag. */
const HIGH_PRIORITY = 7;

/** Actions listed before the rest are left to the task page. */
const ACTIONS = 4;

/** Search results offered when linking an existing task. A shortlist, not a list. */
const MATCHES = 6;

const pct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Milliseconds, or 0. Bare dates are read as local days — see `goalDate`. */
const time = (value?: string) => goalDate(value)?.getTime() ?? 0;

/** "Aug 21" — short, because these sit in a column an inch wide. */
function shortDate(value?: string): string {
  const at = time(value);
  if (!at) return '';
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "May 2024" — where the year is the point rather than the day. */
function monthYear(value?: string): string {
  const at = time(value);
  if (!at) return '—';
  return new Date(at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
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
  /** Point a task that already exists at this goal, rather than making a new one. */
  onLinkTask: (goal: Goal, task: Task, milestoneId?: string) => void;
  /** Ask for a checkpoint list. Resolves null when the model could not answer. */
  onSuggest: (goal: Goal) => Promise<string[] | null>;
  /** Write a whole checkpoint list. Resolves false if the write failed. */
  onSaveStones: (goal: Goal, titles: string[]) => Promise<boolean>;
  /** Turns a subject id into its name, for the charts that group by subject. */
  nameOf: (id: string) => string;
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
  onLinkTask,
  onSuggest,
  onSaveStones,
  nameOf,
}: ActiveGoalCardProps) {
  const today = Date.now();
  const category = categoryOf(goal);
  const numbers = goalNumbers(goal);
  const health = goalHealth(goal, tasks);
  const stones = goal.milestones ?? [];

  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  /* Which search result the keyboard is on. -1 is the box itself, and it is the
     resting position: Enter on a typed title makes a new task, which is what the
     box did before it could also search. You arrow into the list deliberately. */
  const [pick, setPick] = useState(-1);
  /* The suggestion round trip is a model call and can take several seconds, so
     it carries its own busy state rather than the page's — the rest of the card
     stays usable while one goal is thinking. The ladder this replaced owned its
     spinner for the same reason. */
  const [thinking, setThinking] = useState(false);

  /* The goal, its linked work, and the one chart that work can support. Both
     memoised on the same inputs, so a card only re-picks when something it is
     drawn from actually changed. */
  const context = useMemo(() => visualContext(goal, tasks), [goal, tasks]);
  const visual = useMemo(() => pickVisual(context), [context]);

  /** Every task that is work toward this goal, by either route. */
  const mine = context.linked;

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

  /**
   * The tasks already on the account that the draft could be naming.
   *
   * Only open ones, and only ones that are not already this goal's work —
   * offering a task that is already linked is a row that does nothing when you
   * click it. An empty box offers the first few rather than nothing, so the
   * list is a way in rather than something you have to guess the opening
   * letters of, and a title that starts with what was typed sorts above one
   * that merely contains it.
   */
  const matches = useMemo(() => {
    if (!adding) return [];
    const query = draft.trim().toLowerCase();
    const linked = new Set(mine.map((task) => task.id));
    return tasks
      .filter(
        (task) =>
          task.status !== 'done' &&
          !linked.has(task.id) &&
          (!query || task.title.toLowerCase().includes(query)),
      )
      .sort((a, b) => {
        if (!query) return 0;
        return (
          Number(b.title.toLowerCase().startsWith(query)) -
          Number(a.title.toLowerCase().startsWith(query))
        );
      })
      .slice(0, MATCHES);
  }, [adding, draft, mine, tasks]);

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

  const closeAdd = () => {
    setDraft('');
    setAdding(false);
    setPick(-1);
  };

  /** Point an existing task at this goal, and at the checkpoint being worked on. */
  const link = (task: Task) => {
    onLinkTask(goal, task, focus?.id);
    closeAdd();
  };

  const submit = () => {
    const chosen = pick >= 0 ? matches[pick] : undefined;
    if (chosen) {
      link(chosen);
      return;
    }
    const title = draft.trim();
    if (!title) {
      closeAdd();
      return;
    }
    onAddAction(goal, title, focus?.id);
    closeAdd();
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
          {visual ? (
            <GoalVisual
              goal={goal}
              context={context}
              pick={visual}
              nameOf={nameOf}
              onOpen={() => onOpen(goal)}
            />
          ) : (
            /* Nothing fits, which on this page means one thing: no checkpoints
               and no work recorded against the goal. There is no chart to draw
               and pretending otherwise would be the one dishonest panel here, so
               the space asks for the thing that would fill it. */
            <>
              <header className="ag-panel-head">
                <h4>Nothing to chart yet</h4>
              </header>
              <p className="ag-empty">
                Break this into checkpoints and the percentage starts to mean something.
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
                <span className="ag-focus-when">{monthYear(focus.target_date)}</span>
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
                ? 'No checkpoints yet. The panel on the left is where they start.'
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
              Nothing open. Add one below — it pays the same XP.
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
                placeholder="Name a new action, or search for an existing task"
                role="combobox"
                aria-expanded={matches.length > 0}
                aria-autocomplete="list"
                aria-controls={`ag-found-${goal.id}`}
                aria-activedescendant={
                  pick >= 0 && matches[pick] ? `ag-found-${goal.id}-${matches[pick].id}` : undefined
                }
                onChange={(event) => {
                  setDraft(event.target.value);
                  setPick(-1);
                }}
                onBlur={submit}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    closeAdd();
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setPick((at) => Math.min(at + 1, matches.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setPick((at) => Math.max(at - 1, -1));
                  }
                }}
              />
              {matches.length > 0 && (
                /* The box searches as well as creates, so the work you already
                   wrote down on the tasks page can become this goal's work
                   without being typed a second time. Linking moves the task —
                   there is one of it, and now it counts here. */
                <ul className="ag-found" id={`ag-found-${goal.id}`} role="listbox">
                  {matches.map((task, at) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        id={`ag-found-${goal.id}-${task.id}`}
                        role="option"
                        aria-selected={at === pick}
                        className={`ag-found-row${at === pick ? ' is-on' : ''}`}
                        /* Keeps the click from blurring the box first, which
                           would submit the draft as a new task instead. */
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setPick(at)}
                        onClick={() => link(task)}
                      >
                        <span className="ag-found-name" title={task.title}>
                          {task.title}
                        </span>
                        <span className="ag-quiet">
                          {task.goal_id || task.milestone_id ? 'Linked elsewhere' : shortDate(task.due_date)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
