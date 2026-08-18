/**
 * The rail beside the goals, and the two questions it answers.
 *
 * The page below it is analysis — insights, health, timelines, ladders — and
 * all of it is about goals the reader wrote. The rail is the standing answer to
 * "what am I actually carrying", in the same place on every visit, the way the
 * calendar's rail holds the week's totals beside the grid rather than inside
 * it.
 *
 * Two tabs, because there are two kinds of goal in this account and they are
 * not the same kind of thing:
 *
 *   Big Goals    what the reader set — an outcome with a number or a set of
 *                milestones behind it. Up to seven; see `RAIL_GOALS`.
 *   System Goals what the app keeps for them — XP, streak, tasks, focus. The
 *                reader picks the target and never touches the figure again,
 *                because the app is the thing that moves it.
 *
 * They were one list before, and the counters sat at the foot of the page
 * under "Tracked counters" in cards drawn for a stylesheet this page no longer
 * uses — a `gx-legacy` wrapper existed only to give them back the dark surface
 * they were designed against. Splitting them by who maintains the number is
 * the distinction that was already there in `measureOf`, said out loud.
 */
import { fmtGoalNumber, goalNumbers } from './numbers';
import type { Goal, GoalType } from '@/types';

/** How many outcome goals the rail holds. */
export const RAIL_GOALS = 7;

/** One glyph per counter, so the four are told apart before they are read. */
const ICON: Record<GoalType, React.ReactNode> = {
  xp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  ),
  streak: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.5.7-2.8 1.7-4C9.5 9.5 11 7 12 3z" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h9" />
      <path d="m15.5 17.5 1.5 1.5 3-3" />
    </svg>
  ),
  focus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

function pct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * One system goal.
 *
 * Everything the old card said, in the shape the rest of the app is drawn in:
 * the counter's glyph and name, the reading over the target, a bar, and the
 * percentage. No buttons for progress — the whole point of these four is that
 * the reader does not move the number — so the only actions are the two that
 * are theirs, changing the target and dropping the goal, and they sit behind
 * the row rather than under it.
 */
function SystemCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const n = goalNumbers(goal);
  const done = pct(n.progress);
  const reached = done >= 100;

  return (
    <article className={`gx-sys${reached ? ' is-done' : ''}`}>
      <header className="gx-sys-head">
        <span className={`gx-sys-ico is-${n.goalType}`} aria-hidden="true">
          {ICON[n.goalType]}
        </span>
        <div className="gx-sys-name">
          <strong>{goal.title}</strong>
          <span className="gx-quiet">{n.label}</span>
        </div>
        <span className={`gx-sys-pct${reached ? ' is-done' : ''}`}>{done}%</span>
      </header>

      <div className="gx-sys-figures">
        <b>{fmtGoalNumber(n.current, n)}</b>
        <span className="gx-quiet">of {fmtGoalNumber(n.target, n)}</span>
      </div>

      <div className="gx-sys-track" role="presentation">
        <i className={`gx-sys-fill is-${n.goalType}`} style={{ width: `${done}%` }} />
      </div>

      <footer className="gx-sys-foot">
        <button type="button" onClick={() => onEdit(goal)}>
          Change target
        </button>
        <button type="button" className="is-bad" onClick={() => onDelete(goal)}>
          Remove
        </button>
      </footer>
    </article>
  );
}

/** One outcome goal, as a row: what it is, how far, and a bar under it. */
function GoalRow({ goal, onOpen }: { goal: Goal; onOpen: (goal: Goal) => void }) {
  const n = goalNumbers(goal);
  const done = pct(n.progress);

  return (
    <li>
      <button type="button" className="gx-railrow" onClick={() => onOpen(goal)}>
        <span className="gx-railrow-top">
          <span className="gx-railrow-title">{goal.title}</span>
          <span className="gx-railrow-pct">{done}%</span>
        </span>
        <span className="gx-railrow-sub gx-quiet">
          {n.numeric
            ? `${fmtGoalNumber(n.current, n)} of ${fmtGoalNumber(n.target, n)}${n.label ? ` ${n.label}` : ''}`
            : `${n.current} of ${n.target} ${n.label}`}
        </span>
        <span className="gx-railrow-track" aria-hidden="true">
          <i style={{ width: `${done}%` }} />
        </span>
      </button>
    </li>
  );
}

export interface GoalsSidebarProps {
  /** The outcome goals. Only the first `RAIL_GOALS` are drawn. */
  outcomes: Goal[];
  /** The four the app maintains. */
  counters: Goal[];
  tab: 'goals' | 'system';
  onTab: (tab: 'goals' | 'system') => void;
  onOpen: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onNew: () => void;
}

export function GoalsSidebar({
  outcomes,
  counters,
  tab,
  onTab,
  onOpen,
  onEdit,
  onDelete,
  onNew,
}: GoalsSidebarProps) {
  const shown = outcomes.slice(0, RAIL_GOALS);
  const rest = outcomes.length - shown.length;

  return (
    <aside className="gx-rail-col">
      <div className="gx-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'goals'}
          className={`gx-tab${tab === 'goals' ? ' is-on' : ''}`}
          onClick={() => onTab('goals')}
        >
          Big Goals
          <span className="gx-tab-count">{outcomes.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'system'}
          className={`gx-tab${tab === 'system' ? ' is-on' : ''}`}
          onClick={() => onTab('system')}
        >
          System Goals
          <span className="gx-tab-count">{counters.length}</span>
        </button>
      </div>

      {tab === 'goals' ? (
        <section className="gx-panel">
          {shown.length === 0 ? (
            <p className="gx-panel-empty">
              Nothing set yet. A goal is a number or a set of milestones with a date on it.
            </p>
          ) : (
            <ul className="gx-raillist">
              {shown.map((goal) => (
                <GoalRow key={goal.id} goal={goal} onOpen={onOpen} />
              ))}
            </ul>
          )}
          {/* Said rather than silently cut. Seven is where the rail stops
              drawing, not where the account stops having goals. */}
          {rest > 0 && (
            <p className="gx-panel-note">
              {rest.toLocaleString()} more below the top {RAIL_GOALS}.
            </p>
          )}
          <button type="button" className="gx-panel-cta" onClick={onNew}>
            + New goal
          </button>
        </section>
      ) : (
        <section className="gx-panel">
          {counters.length === 0 ? (
            <p className="gx-panel-empty">
              No system goals. These are the four the app fills in for you — XP, streak, tasks and
              focus time.
            </p>
          ) : (
            <div className="gx-syslist">
              {counters.map((goal) => (
                <SystemCard key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </section>
      )}
    </aside>
  );
}
