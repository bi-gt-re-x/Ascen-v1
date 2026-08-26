/**
 * One goal, in full — the view a card opens into.
 *
 * The page above answers "which of these should I be worried about". This
 * answers "what is actually going on with this one", in the order the spec
 * lays out: what it is and why, how far, the checkpoints in execution order,
 * what the record says about the rate, and what to do about it.
 *
 * A panel over the page rather than a route of its own. The reader arrived
 * from a card and their next move is almost always back to the other cards;
 * a route would put a page load and a scroll position between those two
 * moments for no gain.
 */
import { useCallback, useState } from 'react';
import { HealthChip, MilestoneTrack, ProgressBar, categoryOf } from './Outcome';
import { fmtGoalNumber, formatGoalDate, goalNumbers } from './numbers';
import { goalHealth, goalPace } from '@/utils/goalHealth';
import { bottleneckOf, goalActions, goalReading } from '@/utils/goalAnalytics';
import { MilestoneChecklist } from './MilestoneChecklist';
import type { Goal, Milestone, MilestoneStatus, MilestoneStep, Task } from '@/types';

export interface GoalDetailProps {
  goal: Goal;
  tasks: Task[];
  busy: boolean;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onAddMilestone: (goal: Goal, title: string) => void;
  onMilestoneStatus: (milestone: Milestone, status: MilestoneStatus) => void;
  /** Make this the checkpoint the goal is currently on. */
  onFocusMilestone: (milestone: Milestone) => void;
  /** Write this checkpoint's checklist, whole. */
  onMilestoneSteps: (milestone: Milestone, steps: MilestoneStep[]) => void;
  onDeleteMilestone: (milestone: Milestone) => void;
  onReorder: (goal: Goal, order: string[]) => void;
  /** Raise the figure on a number goal. */
  onValue: (goal: Goal, value: number) => void;
}

export function GoalDetail(props: GoalDetailProps) {
  const { goal, tasks, busy } = props;
  const numbers = goalNumbers(goal);
  const health = goalHealth(goal, tasks);
  const reading = goalReading(goal, tasks);
  const pace = goalPace(goal);
  const stuck = bottleneckOf(goal, tasks);
  const actions = goalActions(goal, tasks);
  const category = categoryOf(goal);
  const rows = goal.milestones ?? [];
  const linked = tasks.filter((task) => task.goal_id === goal.id);

  const [draft, setDraft] = useState('');
  const [value, setValue] = useState('');

  const move = useCallback(
    (index: number, by: number) => {
      const next = [...rows];
      const target = index + by;
      if (target < 0 || target >= next.length) return;
      const [row] = next.splice(index, 1);
      if (row) next.splice(target, 0, row);
      props.onReorder(goal, next.map((entry) => entry.id));
    },
    [goal, props, rows],
  );

  return (
    <div className="gx-drawer-backdrop" onClick={props.onClose} role="presentation">
      <aside
        className={`gx-drawer tone-${category.tone}`}
        role="dialog"
        aria-label={goal.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="gx-drawer-head">
          <div>
            <span className="gx-cat">{category.label}</span>
            <h2>{goal.title}</h2>
            {goal.description && <p className="gx-quiet">{goal.description}</p>}
          </div>
          <button type="button" className="gx-close" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </header>

        {goal.why && (
          <p className="gx-why">
            <span className="gx-why-label">Why it matters</span>
            {goal.why}
          </p>
        )}

        {/* ---- How far ---------------------------------------------------- */}
        <section className="gx-panel">
          <div className="gx-detail-progress">
            <strong className="gx-big">{Math.round(numbers.progress)}%</strong>
            <div>
              <ProgressBar pct={numbers.progress} tone={category.tone} />
              <p className="gx-quiet">
                {numbers.numeric && numbers.target > 0 ? (
                  <>
                    {fmtGoalNumber(numbers.current, numbers)} of{' '}
                    {fmtGoalNumber(numbers.target, numbers)} {numbers.label}
                  </>
                ) : (
                  <>
                    {numbers.current} of {numbers.target} checkpoints reached
                  </>
                )}
              </p>
            </div>
            <HealthChip health={health} />
          </div>
          <p className="gx-quiet gx-detail-reason">{health.reason}</p>

          {numbers.measure === 'number' && (
            <div className="gx-value-row">
              <label htmlFor="gx-value">Update the figure</label>
              <input
                id="gx-value"
                type="number"
                value={value}
                placeholder={String(numbers.current)}
                onChange={(event) => setValue(event.target.value)}
              />
              <button
                type="button"
                className="gx-btn"
                disabled={busy || value === ''}
                onClick={() => {
                  const next = Number(value);
                  if (Number.isFinite(next)) props.onValue(goal, next);
                  setValue('');
                }}
              >
                Save
              </button>
            </div>
          )}

          <dl className="gx-facts">
            <div>
              <dt>Started</dt>
              <dd>{formatGoalDate(goal.start_date || goal.created_at) || '—'}</dd>
            </div>
            <div>
              <dt>Target date</dt>
              <dd>{goal.deadline ? formatGoalDate(goal.deadline) : 'open-ended'}</dd>
            </div>
            <div>
              <dt>Days left</dt>
              <dd>
                {health.signals.daysLeft === null
                  ? '—'
                  : health.signals.daysLeft < 0
                    ? `${Math.abs(health.signals.daysLeft)} over`
                    : health.signals.daysLeft}
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{goal.priority} / 10</dd>
            </div>
          </dl>
        </section>

        {/* ---- The checkpoints -------------------------------------------- */}
        <section className="gx-panel">
          <header className="gx-panel-head">
            <h3>Milestones</h3>
            <span className="gx-quiet">
              {rows.filter((row) => row.status === 'done').length} of {rows.length} reached
            </span>
          </header>

          {rows.length > 0 && <MilestoneTrack rows={rows} />}

          <ol className="gx-milestones">
            {rows.map((row, index) => (
              <li className={`gx-ms is-${row.status}`} key={row.id}>
                <button
                  type="button"
                  className="gx-ms-tick"
                  disabled={busy}
                  aria-label={row.status === 'done' ? 'Reopen this checkpoint' : 'Mark reached'}
                  onClick={() =>
                    props.onMilestoneStatus(row, row.status === 'done' ? 'pending' : 'done')
                  }
                >
                  {row.status === 'done' ? '✓' : index === rows.findIndex((r) => r.status !== 'done') ? '→' : '○'}
                </button>
                {/* The body is the focus control. The tick beside it already
                    owns "reached / not reached", so clicking the title had no
                    meaning to take — and "which one am I on" was previously
                    unsayable: the card guessed at the first unfinished one and
                    the reader had no way to disagree with it. A finished
                    checkpoint is not a thing you can be working on, so it
                    renders as plain text rather than as a dead button. */}
                {row.status === 'done' ? (
                  <div className="gx-ms-body">
                    <span className="gx-ms-title">{row.title}</span>
                    {row.completed_at ? (
                      <span className="gx-quiet">reached {formatGoalDate(row.completed_at)}</span>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="gx-ms-body is-pickable"
                    disabled={busy}
                    aria-pressed={row.status === 'active'}
                    title={row.status === 'active' ? 'This is the current focus' : 'Make this the current focus'}
                    onClick={() => props.onFocusMilestone(row)}
                  >
                    <span className="gx-ms-title">{row.title}</span>
                    {row.status === 'active' ? (
                      <span className="gx-ms-focus-tag">current focus</span>
                    ) : row.target_date ? (
                      <span className="gx-quiet">due {formatGoalDate(row.target_date)}</span>
                    ) : null}
                  </button>
                )}
                <span className="gx-ms-tools">
                  <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === rows.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button type="button" disabled={busy} onClick={() => props.onDeleteMilestone(row)} aria-label="Delete">
                    ×
                  </button>
                </span>
                <MilestoneChecklist
                  steps={row.steps}
                  busy={busy}
                  onChange={(steps) => props.onMilestoneSteps(row, steps)}
                />
              </li>
            ))}
          </ol>

          <form
            className="gx-ms-add"
            onSubmit={(event) => {
              event.preventDefault();
              const title = draft.trim();
              if (!title) return;
              props.onAddMilestone(goal, title);
              setDraft('');
            }}
          >
            <input
              value={draft}
              placeholder="Add a checkpoint — a state this goal reaches, not a task"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="gx-btn" disabled={busy || !draft.trim()}>
              Add
            </button>
          </form>
        </section>

        {/* ---- Why it is moving at this rate ------------------------------ */}
        <section className="gx-panel">
          <header className="gx-panel-head">
            <h3>Why it is going at this rate</h3>
          </header>

          <div className="gx-readings">
            <div>
              <span className="gx-quiet">Direction</span>
              <strong className={`is-${reading.direction}`}>
                {reading.direction === 'stalled'
                  ? 'Stalled'
                  : reading.direction === 'accelerating'
                    ? 'Accelerating'
                    : reading.direction === 'slowing'
                      ? 'Slowing'
                      : 'Steady'}
              </strong>
              <span className="gx-quiet">
                {reading.change === null
                  ? `${reading.now} finished in the last fortnight`
                  : `${reading.now} this fortnight against ${reading.before} before`}
              </span>
            </div>
            <div>
              <span className="gx-quiet">Consistency</span>
              <strong>{Math.round((reading.activeDays / 14) * 100)}%</strong>
              <span className="gx-quiet">
                worked on {reading.activeDays} of the last 14 days
              </span>
            </div>
            <div>
              <span className="gx-quiet">Work recorded</span>
              <strong>{reading.finished}</strong>
              <span className="gx-quiet">
                tasks finished{reading.xp > 0 ? `, ${reading.xp.toLocaleString()} XP` : ''}
              </span>
            </div>
            <div>
              <span className="gx-quiet">At this rate</span>
              <strong>
                {pace.lands ? formatGoalDate(pace.lands) : '—'}
              </strong>
              <span className="gx-quiet">
                {pace.drift === null
                  ? pace.lands
                    ? 'no target date to compare'
                    : 'not moving yet'
                  : pace.drift > 0
                    ? `about ${pace.drift} days after the date on it`
                    : `about ${Math.abs(pace.drift)} days early`}
              </span>
            </div>
          </div>

          {stuck && (
            <p className="gx-bottleneck">
              <strong>Current bottleneck: {stuck.milestone.title}</strong>
              {stuck.waitingDays !== null
                ? ` It has been the next checkpoint for ${stuck.waitingDays} days`
                : ' It is the next checkpoint'}
              {stuck.tasks > 0
                ? `, with ${stuck.done} of its ${stuck.tasks} tasks done.`
                : ', and nothing is linked to it.'}
            </p>
          )}

          {reading.bestDay && (
            <p className="gx-quiet gx-pattern">
              Most of the work on this lands on a {reading.bestDay}
              {reading.weekendShare !== null && reading.weekendShare >= 0.5
                ? `, and ${Math.round(reading.weekendShare * 100)}% of it at weekends.`
                : '.'}
            </p>
          )}

          <p className="gx-quiet gx-caveat">
            Counted from the {linked.length} task{linked.length === 1 ? '' : 's'} linked to this
            goal, not estimated.
          </p>
        </section>

        {/* ---- What to do about it ---------------------------------------- */}
        {actions.length > 0 && (
          <section className="gx-panel">
            <header className="gx-panel-head">
              <h3>What to do about it</h3>
            </header>
            <ul className="gx-actions">
              {actions.map((action) => (
                <li className={`gx-action is-${action.tone}`} key={action.id}>
                  <strong>{action.title}</strong>
                  <span className="gx-quiet">{action.because}</span>
                  {action.effect && <span className="gx-effect">{action.effect}</span>}
                </li>
              ))}
            </ul>
            <p className="gx-quiet gx-caveat">
              Nothing here changes on its own. Moving a target is your call.
            </p>
          </section>
        )}

        <footer className="gx-drawer-foot">
          <button type="button" className="gx-btn" onClick={() => props.onEdit(goal)}>
            Edit goal
          </button>
          <button type="button" className="gx-btn is-danger" onClick={() => props.onDelete(goal)}>
            Delete
          </button>
        </footer>
      </aside>
    </div>
  );
}
