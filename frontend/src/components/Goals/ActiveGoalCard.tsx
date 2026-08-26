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
import { useEffect, useMemo, useState } from 'react';
import { GoalTile, HealthChip, categoryOf } from './Outcome';
import { GoalVisual } from './GoalVisual';
import { formatGoalDate, goalDate, goalNumbers, goalWeight, isOverdue } from './numbers';
import { goalHealth } from '@/utils/goalHealth';
import { pickVisual, visualContext } from '@/utils/goalVisuals';
import {
  MAX_STEPS,
  addStep,
  editStep,
  linkStep,
  promptFor,
  stepProgress,
  stepWindow,
  stepsComplete,
  toggleStep,
} from '@/utils/milestoneSteps';
import type { Goal, Milestone, MilestoneStatus, MilestoneStep, Task } from '@/types';

const DAY = 86_400_000;

/** Below this a goal is not "long term" — about a season. */
const LONG_TERM_DAYS = 120;

/** Priority at or above this wears the high-priority tag. */
const HIGH_PRIORITY = 7;

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
  /** Point a task that already exists at this goal, rather than making a new one. */
  onLinkTask: (goal: Goal, task: Task, milestoneId?: string) => void;
  /** Ask for a checkpoint list. Resolves null when the model could not answer. */
  onSuggest: (goal: Goal) => Promise<string[] | null>;
  /** Write a whole checkpoint list. Resolves false if the write failed. */
  onSaveStones: (goal: Goal, titles: string[]) => Promise<boolean>;
  /** Make one checkpoint the focus. */
  onFocusMilestone: (milestone: Milestone) => void;
  /** Tick or untick one of the focus checkpoint's steps. */
  onMilestoneSteps: (milestone: Milestone, steps: MilestoneStep[]) => void;
  /** Mark the focus checkpoint reached, once its checklist is clear. */
  onMilestoneStatus: (milestone: Milestone, status: MilestoneStatus) => void;
  /** Call the goal finished, once every checkpoint is. */
  onCompleteGoal: (goal: Goal) => void;
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
  onLinkTask,
  onSuggest,
  onSaveStones,
  onFocusMilestone,
  onMilestoneSteps,
  onMilestoneStatus,
  onCompleteGoal,
  nameOf,
}: ActiveGoalCardProps) {
  const category = categoryOf(goal);
  const numbers = goalNumbers(goal);
  const health = goalHealth(goal, tasks);
  const stones = goal.milestones ?? [];

  const [menuOpen, setMenuOpen] = useState(false);
  /* The focus picker, closed by default. It is a disclosure rather than a
     select because the options are checkpoint titles — full sentences, most of
     them — and a native select would truncate every one of them to the width
     of the panel. */
  const [picking, setPicking] = useState(false);
  /** Naming a step. `index` is -1 for a new one, or the row being filled in. */
  const [stepDraft, setStepDraft] = useState<{ index: number; text: string } | null>(null);
  /** Which step is choosing a task to link, or null. */
  const [linkAt, setLinkAt] = useState<number | null>(null);
  /** The card's own celebration, cleared by a timer. See `.ag-cheer`. */
  const [cheer, setCheer] = useState<'milestone' | 'goal' | null>(null);

  /* It lets go on its own. The click that starts it is also a write, and the
     card re-renders under the reader when the reply lands — a banner that
     needed dismissing would be a second thing to do at the moment they just
     finished doing something. Two seconds is long enough to read four words.

     Cleared on unmount as well, because completing a goal moves it out of the
     Active tab: the card that was celebrating is gone before the timer ends,
     and a setState after that is a leak. */
  useEffect(() => {
    if (!cheer) return undefined;
    const timer = window.setTimeout(() => setCheer(null), 2000);
    return () => window.clearTimeout(timer);
  }, [cheer]);
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

  /** The checkpoints the focus could be moved to — everything not yet reached. */
  const switchable = useMemo(() => stones.filter((stone) => stone.status !== 'done'), [stones]);

  /** How many of the focus checkpoint's named steps are ticked. */
  const focusSteps = useMemo(
    () => (focus ? stepProgress(focus.steps) : { done: 0, total: 0 }),
    [focus],
  );

  /** The three rows the card draws, and where in the list they start. */
  const shown = useMemo(() => {
    const window = focus ? stepWindow(focus.steps) : { from: 0, shown: [] as MilestoneStep[] };
    return { from: window.from, steps: window.shown };
  }, [focus]);

  /** Every named step ticked — the checkpoint has nothing left in it. */
  const readyToClose = Boolean(focus && focus.status !== 'done' && stepsComplete(focus.steps));

  /** Every checkpoint reached, on a goal that has some and is still open. */
  const readyToFinish =
    goal.status !== 'completed' &&
    stones.length > 0 &&
    stones.every((stone) => stone.status === 'done');

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
    if (linkAt === null) return [];
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
  }, [linkAt, draft, mine, tasks]);

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

  const closeLink = () => {
    setDraft('');
    setLinkAt(null);
    setPick(-1);
  };

  /**
   * Point an existing task at this goal, at the checkpoint being worked on,
   * and at the one step it is execution for.
   *
   * Two writes rather than one, because they say different things: the task
   * moves to this goal (it counts here now, and it is one task, not a copy),
   * and the step records which task that was. Either is useful without the
   * other — a task can be a checkpoint's work without being any one step's.
   */
  const link = (task: Task) => {
    const index = linkAt;
    onLinkTask(goal, task, focus?.id);
    if (focus && index !== null) onMilestoneSteps(focus, linkStep(focus.steps, index, task.id));
    closeLink();
  };

  /**
   * Write the step being named — a new row at the end, or one of the prompts
   * filled in. Blank abandons rather than adding an empty row, since the
   * checklist already keeps three of those.
   */
  const commitStep = () => {
    if (!stepDraft || !focus) return;
    const title = stepDraft.text.trim();
    if (!title) {
      setStepDraft(null);
      return;
    }
    const list = stepDraft.index >= 0 ? focus.steps : addStep(focus.steps);
    const at = stepDraft.index >= 0 ? stepDraft.index : list.length - 1;
    onMilestoneSteps(focus, editStep(list, at, title));
    setStepDraft(null);
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
            <>
              {/* The whole block is the control that changes which checkpoint
                  this is. It used to be a plain div showing whichever one the
                  card had guessed at — the first unfinished one — with no way
                  to say it had guessed wrong. */}
              <button
                type="button"
                className="ag-focus is-pickable"
                disabled={busy || switchable.length < 2}
                aria-expanded={picking}
                title={
                  switchable.length < 2
                    ? 'The only checkpoint left'
                    : 'Change which checkpoint this goal is on'
                }
                onClick={() => setPicking((on) => !on)}
              >
                <span className="ag-focus-ico" aria-hidden="true">
                  <GoalTile goal={goal} size={16} />
                </span>
                <div className="ag-focus-text">
                  <strong>{focus.title}</strong>
                  <span>{focus.note || health.reason}</span>
                </div>
                <span className="ag-focus-when">{monthYear(focus.target_date)}</span>
              </button>

              {picking && (
                <ul className="ag-focus-pick">
                  {switchable.map((stone) => (
                    <li key={stone.id}>
                      <button
                        type="button"
                        className={stone.id === focus.id ? 'is-current' : undefined}
                        disabled={busy}
                        onClick={() => {
                          if (stone.id !== focus.id) onFocusMilestone(stone);
                          setPicking(false);
                        }}
                      >
                        <span>{stone.title}</span>
                        {stone.id === focus.id && <em>current</em>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* ---- the checklist ------------------------------------------
                  Three at a time, numbered, in the shape the skill-tree panel
                  uses for a programme — because it is the same object: a short
                  ordered list of the work that finishes one thing. The window
                  sits on the first undone row rather than always at the top,
                  so a checkpoint half done opens on what is left. */}
              <header className="ag-panel-head ag-panel-head-tight">
                <h4>Checklist</h4>
                <span className="ag-quiet">
                  {focusSteps.done} of {focusSteps.total || focus.steps.length}
                </span>
              </header>

              {/* `start` numbers a native marker; this list draws its own
                  from a counter, so the window's offset goes in as a custom
                  property. Both are set: the attribute keeps the list correct
                  for anything reading the DOM rather than the stylesheet. */}
              <ol
                className="ag-steps"
                start={shown.from + 1}
                style={{ ['--ag-step-from' as string]: shown.from + 1 }}
              >
                {shown.steps.map((step, at) => {
                  const index = shown.from + at;
                  const linked = step.task_id
                    ? tasks.find((task) => task.id === step.task_id) ?? null
                    : null;
                  return (
                    <li
                      className={`ag-step${step.done ? ' is-done' : ''}${step.placeholder ? ' is-empty' : ''}`}
                      key={step.id}
                    >
                      <button
                        type="button"
                        className="ag-check ag-step-check"
                        disabled={busy || step.placeholder}
                        aria-label={
                          step.placeholder
                            ? 'Name this step before you can tick it'
                            : step.done
                              ? `Undo ${step.title}`
                              : `Finish ${step.title}`
                        }
                        onClick={() => {
                          onMilestoneSteps(focus, toggleStep(focus.steps, index));
                          // A step pointing at a task and being ticked here
                          // means that task is done — finishing it twice, once
                          // on each page, is the app asking the same question
                          // in two places. Only on the way to done: unticking a
                          // step is not a claim that the task was never done.
                          if (linked && !step.done && linked.status !== 'done') onComplete(linked);
                        }}
                      >
                        <span aria-hidden="true" />
                      </button>

                      {step.placeholder ? (
                        <button
                          type="button"
                          className="ag-step-name is-empty"
                          disabled={busy}
                          onClick={() => setStepDraft({ index, text: '' })}
                          title="Name this step"
                        >
                          {promptFor(index)}
                        </button>
                      ) : (
                        <span className="ag-step-name" title={step.title}>
                          {step.title}
                          {linked && <span className="ag-step-linked" title={linked.title}>· {linked.title}</span>}
                        </span>
                      )}

                      {/* One task per step. The button is the link and the
                          unlink both, because a step already pointing at
                          something has exactly one useful thing to do next. */}
                      <button
                        type="button"
                        className={`ag-step-link${step.task_id ? ' is-on' : ''}`}
                        disabled={busy || step.placeholder}
                        aria-label={
                          step.task_id ? `Unlink ${linked?.title ?? 'the task'}` : 'Link a task to this step'
                        }
                        title={
                          step.task_id
                            ? `Linked to "${linked?.title ?? 'a task'}" — click to unlink`
                            : 'Link an existing task to this step'
                        }
                        onClick={() => {
                          if (step.task_id) {
                            onMilestoneSteps(focus, linkStep(focus.steps, index, null));
                            return;
                          }
                          setLinkAt(linkAt === index ? null : index);
                          setDraft('');
                          setPick(-1);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {focus.steps.length > shown.steps.length && (
                <p className="ag-steps-rest ag-quiet">
                  {focus.steps.length - shown.steps.length} more —{' '}
                  <button type="button" className="ag-link-btn" onClick={() => onOpen(goal)}>
                    open the details
                  </button>
                </p>
              )}

              {/* ---- naming a step ------------------------------------------- */}
              {stepDraft ? (
                <form
                  className="ag-add"
                  onSubmit={(event) => {
                    event.preventDefault();
                    commitStep();
                  }}
                >
                  <input
                    autoFocus
                    value={stepDraft.text}
                    maxLength={120}
                    placeholder="Name a small piece of work"
                    onChange={(event) => setStepDraft({ ...stepDraft, text: event.target.value })}
                    onBlur={commitStep}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setStepDraft(null);
                      } else if (event.key === 'Enter') {
                        // Explicit rather than leaning on the form's implicit
                        // submission: this input is the form's only control
                        // and there is no submit button, which is exactly the
                        // shape browsers do not reliably submit.
                        event.preventDefault();
                        commitStep();
                      }
                    }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="ag-add-btn"
                  disabled={busy || focus.steps.length >= MAX_STEPS}
                  title={
                    focus.steps.length >= MAX_STEPS
                      ? `A checkpoint needing more than ${MAX_STEPS} steps is two checkpoints`
                      : undefined
                  }
                  onClick={() => setStepDraft({ index: -1, text: '' })}
                >
                  + Add another step
                </button>
              )}

              {/* ---- linking a task to one step ------------------------------ */}
              {linkAt !== null && (
                <div className="ag-link-box">
                  <input
                    autoFocus
                    value={draft}
                    placeholder="Search your tasks"
                    role="combobox"
                    aria-expanded={matches.length > 0}
                    aria-autocomplete="list"
                    aria-controls={`ag-found-${goal.id}`}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setPick(-1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        closeLink();
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setPick((at) => Math.min(at + 1, matches.length - 1));
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setPick((at) => Math.max(at - 1, -1));
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        const chosen = pick >= 0 ? matches[pick] : matches[0];
                        if (chosen) link(chosen);
                      }
                    }}
                  />
                  {matches.length > 0 ? (
                    <ul className="ag-found" id={`ag-found-${goal.id}`} role="listbox">
                      {matches.map((task, at) => (
                        <li key={task.id}>
                          <button
                            type="button"
                            id={`ag-found-${goal.id}-${task.id}`}
                            role="option"
                            aria-selected={at === pick}
                            className={`ag-found-row${at === pick ? ' is-on' : ''}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setPick(at)}
                            onClick={() => link(task)}
                          >
                            <span className="ag-found-name" title={task.title}>
                              {task.title}
                            </span>
                            <span className="ag-quiet">{shortDate(task.due_date)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ag-quiet ag-found-none">
                      No open task matches. Steps do not need one — a link is for work you
                      had already written down.
                    </p>
                  )}
                </div>
              )}

              {/* ---- the checkpoint is clear --------------------------------- */}
              {readyToClose && (
                <button
                  type="button"
                  className="ag-finish"
                  disabled={busy}
                  onClick={() => {
                    setCheer('milestone');
                    onMilestoneStatus(focus, 'done');
                  }}
                >
                  Complete Milestone?
                </button>
              )}
            </>
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

          {/* Every checkpoint reached and the goal still open. For a milestone
              goal the backend has already called it finished and this is the
              confirmation; for the rest it is the one thing arithmetic cannot
              decide. See `completeGoal` in pages/Goals. */}
          {readyToFinish && (
            <button
              type="button"
              className="ag-finish is-goal"
              disabled={busy}
              onClick={() => {
                setCheer('goal');
                onCompleteGoal(goal);
              }}
            >
              Complete Goal?
            </button>
          )}
        </section>
      </div>

      {cheer && (
        <div className="ag-cheer" role="status">
          <div className="ag-cheer-card">
            <span className="ag-cheer-mark" aria-hidden="true">✓</span>
            <strong>{cheer === 'goal' ? 'Goal complete' : 'Checkpoint reached'}</strong>
            <span>{cheer === 'goal' ? goal.title : 'On to the next one.'}</span>
          </div>
          {/* Twelve pieces, placed by nth-child in the stylesheet rather than
              by script — the burst is decoration and does not need a random
              seed to read as one. Hidden outright under reduced motion. */}
          <span className="ag-cheer-burst" aria-hidden="true">
            {Array.from({ length: 12 }, (_, at) => (
              <i key={at} />
            ))}
          </span>
        </div>
      )}

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
