/**
 * The Goals tab — how the set of goals is doing, and what is missing from it.
 *
 * It replaced Trends, and the two answer different questions about the same
 * record: Trends asked which way each *measure* was heading, this asks whether
 * the things the reader actually aimed at are going to happen. The measures
 * are still on the page — the Overview leads with all three and their
 * direction, and the score panel draws them over time.
 *
 * ## What each panel is not
 *
 * The goals page has a card per goal and a drawer behind it, and every figure
 * about one goal is already there in higher resolution. So nothing here is a
 * goal card: this tab is about the *portfolio*, and every panel states
 * something that is only true of the set — the spread of health across it, how
 * much of the account's work is aimed at any of it, what it is missing. The
 * one place it names individual goals is where the set has a shape a name
 * explains ("three at risk, and this is the worst of them"), and those names
 * are links out to the page that can actually do something about them.
 *
 * ## Silence is a real answer here
 *
 * `Suggestions` is empty for a reader with well-covered, well-paced goals, and
 * that is the intended common case rather than a gap to fill — see
 * utils/goalSuggest. The same rule the rest of this page follows.
 */
import { Link } from 'react-router-dom';
import { Columns, Panel } from './charts';
import type { GoalNote, GoalsOverview } from '@/utils/goalAnalytics';
import type {
  EffortRow,
  GoalSuggestion,
  PacePoint,
  ReachedMonth,
} from '@/utils/goalSuggest';
import type { Goal, Task } from '@/types';
import { goalHealth, goalPace } from '@/utils/goalHealth';
import { goalNumbers } from '@/components/Goals/numbers';

// --------------------------------------------------------------------------
// The spread
// --------------------------------------------------------------------------
/** "in 3 days", "tomorrow", "2 days over". Days, because a fortnight is short. */
function dueWords(deadline: string, today: Date = new Date()): string {
  const at = Date.parse(`${String(deadline).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(at)) return '';
  const days = Math.round((at - new Date(today.toDateString()).getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} over`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export interface PortfolioPanelProps {
  overview: GoalsOverview;
}

/**
 * The set as four counts and one figure.
 *
 * The bar is stacked rather than four separate tiles because the question is
 * proportion — "how much of what I am aiming at is in trouble" — and four
 * numbers side by side make the reader do the division.
 */
export function PortfolioPanel({ overview }: PortfolioPanelProps) {
  const bands = [
    { key: 'on-track', label: 'On track', count: overview.onTrack, tone: 'good' },
    { key: 'at-risk', label: 'At risk', count: overview.atRisk, tone: 'warn' },
    { key: 'off-track', label: 'Off track', count: overview.offTrack, tone: 'bad' },
    { key: 'not-started', label: 'Not started', count: overview.notStarted, tone: 'flat' },
  ].filter((band) => band.count > 0);

  return (
    <Panel title="The set">
      {/* The figure is the weighted mean across live goals, so with none it is
          a mean of nothing — and a large "0%" above "nothing live" reads as a
          score rather than as an absence. The sentence carries it alone. */}
      {overview.active > 0 && (
        <div className="ax-goal-head">
          <strong className="ax-goal-figure">{Math.round(overview.overall)}%</strong>
          <p className="ax-muted">
            across <strong>{overview.active}</strong>{' '}
            {overview.active === 1 ? 'live goal' : 'live goals'}, weighted by the priority you
            gave each one
            {overview.completed > 0 ? `. ${overview.completed} finished.` : '.'}
          </p>
        </div>
      )}

      {overview.active === 0 ? (
        <p className="ax-empty">
          Nothing live{overview.completed > 0 ? `, and ${overview.completed} finished` : ''}. The
          figures on this page have no target to be read against until something here does.
        </p>
      ) : (
        <>
          <div className="ax-goal-bar" role="img" aria-label={bands.map((b) => `${b.count} ${b.label}`).join(', ')}>
            {bands.map((band) => (
              <i
                key={band.key}
                className={`is-${band.tone}`}
                style={{ flexGrow: band.count }}
                title={`${band.count} ${band.label.toLowerCase()}`}
              />
            ))}
          </div>
          <ul className="ax-goal-legend">
            {bands.map((band) => (
              <li key={band.key}>
                <i className={`is-${band.tone}`} aria-hidden="true" />
                <span>{band.label}</span>
                <strong>{band.count}</strong>
              </li>
            ))}
          </ul>

          {/* What lands next. `goalsOverview` has computed this since it was
              written and nothing had ever drawn it — it is the one thing about
              the set that is time-critical rather than descriptive, and it
              belongs beside the spread rather than in a panel of its own. */}
          <div className="ax-goal-soon">
            <h4>Due in the next fortnight</h4>
            {overview.dueSoon.length === 0 ? (
              <p className="ax-muted">
                Nothing lands in the next two weeks. The pace map is the longer view.
              </p>
            ) : (
              <ul>
                {overview.dueSoon.slice(0, 4).map((goal) => (
                  <li key={goal.id}>
                    <Link to="/goals" title={goal.title}>
                      {goal.title}
                    </Link>
                    <span className="ax-muted">{dueWords(goal.deadline)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Pace
// --------------------------------------------------------------------------
export interface PacePanelProps {
  goals: Goal[];
  tasks: Task[];
}

/**
 * Which goals land when they said they would, at the rate they are actually
 * going.
 *
 * Only the goals that can answer: a goal with no date has nothing to be early
 * or late against, and one with no work behind it has no rate. Both are
 * dropped rather than printed as a dash, so the panel is a list of real
 * readings or it is not there.
 */
/**
 * A drift in words.
 *
 * `goalPace` projects the current rate out to 100%, and a goal barely moving
 * projects a very long way — "795 days late" is arithmetically true and reads
 * as a broken number. Past a year the projection has stopped being a date and
 * become a statement that the rate is not going to get there, so it is printed
 * as one. The precise figure is on the goal's own drawer, where the rate it
 * came from is beside it.
 */
function driftWords(drift: number): string {
  if (drift === 0) return 'on the day';
  const late = drift > 0;
  const size = Math.abs(drift);
  if (size > 365) return late ? 'over a year late' : 'over a year early';
  if (size > 90) {
    const months = Math.round(size / 30);
    return `about ${months} months ${late ? 'late' : 'early'}`;
  }
  return `${size} days ${late ? 'late' : 'early'}`;
}

export function PacePanel({ goals, tasks }: PacePanelProps) {
  const rows = goals
    .filter((goal) => goal.status !== 'completed' && goal.deadline)
    .map((goal) => ({ goal, pace: goalPace(goal), health: goalHealth(goal, tasks) }))
    .filter((row) => row.pace.drift !== null)
    .sort((a, b) => (b.pace.drift ?? 0) - (a.pace.drift ?? 0))
    .slice(0, 6);

  if (rows.length === 0) {
    return (
      <Panel title="Pace against the dates">
        <p className="ax-empty">
          No goal here has both a date and enough finished work to read a rate from. Pace is
          measured, not estimated — see the goals page for what each one is waiting on.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Pace against the dates">
      <ul className="ax-goal-pace">
        {rows.map(({ goal, pace }) => {
          const drift = pace.drift ?? 0;
          const late = drift > 0;
          return (
            <li key={goal.id} className={late ? 'is-late' : 'is-early'}>
              <Link to="/goals" className="ax-goal-name" title={goal.title}>
                {goal.title}
              </Link>
              <span className="ax-goal-drift">{driftWords(drift)}</span>
              <span className="ax-muted">{Math.round(goalNumbers(goal).progress)}%</span>
            </li>
          );
        })}
      </ul>
      <p className="ax-muted ax-goal-foot">
        At the rate each one has actually been moving, not at the rate it would need.
      </p>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// What the set says
// --------------------------------------------------------------------------
export function NotesPanel({ notes }: { notes: GoalNote[] }) {
  if (notes.length === 0) return null;
  return (
    <Panel title="What stands out">
      <ul className="ax-goal-notes">
        {notes.map((note) => (
          <li key={note.headline} className={`is-${note.tone}`}>
            <strong>{note.headline}</strong>
            <span className="ax-muted">{note.hint}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// What is missing
// --------------------------------------------------------------------------
export function SuggestPanel({ suggestions }: { suggestions: GoalSuggestion[] }) {
  return (
    <Panel title="Worth setting">
      {suggestions.length === 0 ? (
        <p className="ax-empty">
          Nothing obvious missing. Your goals cover the subjects you are working in and the
          ones with dates are pacing — this panel stays quiet until that stops being true.
        </p>
      ) : (
        <>
          <ul className="ax-goal-suggest">
            {suggestions.map((row) => (
              <li key={row.id}>
                <span className={`ax-goal-kind is-${row.kind}`}>{row.kind}</span>
                <div>
                  <strong>{row.title}</strong>
                  <span className="ax-muted">{row.because}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="ax-muted ax-goal-foot">
            Each one is drawn from your own record, and nothing here creates a goal —{' '}
            <Link to="/goals" className="ax-link">
              the goals page
            </Link>{' '}
            does that.
          </p>
        </>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// The pace map
// --------------------------------------------------------------------------
export interface PaceMapProps {
  points: PacePoint[];
  /** Live goals with no deadline, counted out loud rather than plotted. */
  undated: number;
}

/** Where a state sits on the palette. One place, so the dots and the key agree. */
const STATE_TONE: Record<string, string> = {
  'on-track': 'var(--ax-green)',
  'at-risk': 'var(--ax-amber)',
  'off-track': 'var(--ax-pink)',
  'not-started': 'var(--ax-line)',
};

/**
 * Time gone against work done, with the diagonal that makes it mean something.
 *
 * The whole chart is the line: a goal exactly on pace sits where the two
 * shares are equal, so everything below the diagonal is behind and everything
 * above is ahead. That is the comparison a list of percentages cannot give,
 * because "40% done" says nothing until you know whether a fifth or nine
 * tenths of the time has gone.
 *
 * Drawn here rather than with `Scatter` because this needs three things that
 * primitive deliberately does not have: a colour per point (the health state),
 * a size per point (the priority), and a reference line. `Scatter`'s one tone
 * and no-line-unless-earned rule is right for a correlation cloud and wrong
 * for a chart whose entire content is the reference.
 *
 * The plot area runs to 1.2 on x so an overdue goal sits past the deadline
 * gridline rather than clamped onto it beside goals merely due today.
 */
export function PaceMapPanel({ points, undated }: PaceMapProps) {
  const W = 320;
  const H = 210;
  const pad = { top: 10, right: 10, bottom: 10, left: 10 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const X_MAX = 1.2;

  /* An inset the width of the biggest dot, so a goal at 0% or at (or past)
     100% sits inside the frame rather than half-clipped on its edge. Goals
     that have overshot their target are common and land exactly on 1. */
  const DOT = 8;
  const x = (v: number) => pad.left + (v / X_MAX) * plotW;
  const y = (v: number) => pad.top + DOT + (1 - v) * (plotH - DOT * 2);

  if (points.length === 0) {
    return (
      <Panel title="Time gone against work done">
        <p className="ax-empty">
          {undated > 0
            ? `${undated} live ${undated === 1 ? 'goal has' : 'goals have'} no deadline, so there is no window for time to be a share of. Put a date on one and it appears here.`
            : 'Nothing live with a date on it yet.'}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Time gone against work done">
      <svg
        className="ax-pacemap"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${points.length} goals plotted against how much of their time has passed`}
      >
        {/* The frame, then the deadline, then the diagonal — in that order so
            the line the chart is about is drawn over everything else. */}
        <rect x={pad.left} y={pad.top} width={plotW} height={plotH} className="ax-pacemap-plot" />
        {[0.25, 0.5, 0.75].map((at) => (
          <line key={at} x1={x(at)} y1={pad.top} x2={x(at)} y2={pad.top + plotH} className="ax-pacemap-grid" />
        ))}
        <line
          x1={x(1)}
          y1={pad.top}
          x2={x(1)}
          y2={pad.top + plotH}
          className="ax-pacemap-deadline"
        />
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="ax-pacemap-pace" />

        {points.map((point) => (
          <circle
            key={point.id}
            cx={x(point.elapsed)}
            cy={y(point.progress)}
            /* Priority as area rather than radius — a 10 is not ten times the
               dot of a 1, and radius would make it a hundred. */
            r={3.5 + Math.sqrt(point.weight) * 1.1}
            fill={STATE_TONE[point.state] ?? 'var(--ax-violet)'}
            className="ax-pacemap-dot"
          >
            <title>
              {point.title} — {Math.round(point.progress * 100)}% done,{' '}
              {Math.round(point.elapsed * 100)}% of the time gone
            </title>
          </circle>
        ))}

      </svg>

      {/* The axis labels are HTML, not <text> inside the chart. The svg scales
          to the panel, so a font-size in viewBox units renders at whatever the
          scale happens to be — 9px became 15px in a half-width panel and would
          become something else again in a wider one. Out here they are simply
          the size they say they are. */}
      <div className="ax-pacemap-axis">
        <span>start</span>
        <span>deadline</span>
      </div>

      <p className="ax-muted ax-goal-foot">
        The diagonal is on pace. Anything under it has used more of its time than it has
        finished of its work
        {undated > 0
          ? `. ${undated} more ${undated === 1 ? 'goal has' : 'goals have'} no date, so ${undated === 1 ? 'it is' : 'they are'} not plotted.`
          : '.'}
      </p>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Checkpoints reached
// --------------------------------------------------------------------------
export function CheckpointsPanel({ months }: { months: ReachedMonth[] }) {
  const total = months.reduce((sum, row) => sum + row.count, 0);
  const peak = Math.max(...months.map((row) => row.count), 0);
  /* Only when it is actually the best month. `Columns` marks the peak so the
     answer to "when" is visible before the numbers are read — and with every
     month tied there is no such answer, so marking all of them paints the
     whole row in the accent and says nothing. */
  const unique = months.filter((row) => row.count === peak).length === 1;

  return (
    <Panel title="Checkpoints reached">
      {total === 0 ? (
        <p className="ax-empty">
          No checkpoint has been ticked in the last {months.length} months. This is the only
          history goals keep — a goal's progress is not recorded over time, but the day you
          reach a checkpoint is.
        </p>
      ) : (
        <>
          <Columns
            columns={months.map((row) => ({
              label: row.label,
              value: row.count,
              text: row.count === 0 ? '—' : String(row.count),
              peak: unique && row.count > 0 && row.count === peak,
            }))}
            tone="green"
          />
          <p className="ax-muted ax-goal-foot">
            <strong>{total}</strong> in {months.length} months. Empty months are kept — a gap
            is the finding, and skipping them would draw four scattered checkpoints as a
            rhythm.
          </p>
        </>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Effort against priority
// --------------------------------------------------------------------------
export function EffortPanel({ rows }: { rows: EffortRow[] }) {
  if (rows.length === 0) {
    return (
      <Panel title="What you said against what you did">
        <p className="ax-empty">Nothing live to compare yet.</p>
      </Panel>
    );
  }

  /* The gap worth naming: highest priority, least of the work. Only called out
     when it is wide enough to be a finding rather than rounding. */
  const worst = [...rows].sort((a, b) => b.priority - b.effort - (a.priority - a.effort))[0];
  const gap = worst ? worst.priority - worst.effort : 0;

  return (
    <Panel title="What you said against what you did">
      <ul className="ax-goal-effort">
        {rows.map((row) => (
          <li key={row.id}>
            <span className="ax-goal-effort-name" title={row.title}>
              {row.title}
            </span>
            <span className="ax-goal-effort-bars">
              <i className="is-said" style={{ width: `${row.priority * 100}%` }} title={`Priority ${Math.round(row.priority * 10)} of 10`} />
              <i className="is-did" style={{ width: `${row.effort * 100}%` }} title={`${row.finished} finished tasks — ${Math.round(row.effort * 100)}% of your goal work`} />
            </span>
          </li>
        ))}
      </ul>
      <p className="ax-goal-key">
        <span><i className="is-said" /> priority you set</span>
        <span><i className="is-did" /> share of your goal work</span>
      </p>
      {worst && gap >= 0.35 && (
        <p className="ax-muted ax-goal-foot">
          <strong>{worst.title}</strong> is the widest gap: you rated it{' '}
          {Math.round(worst.priority * 10)} out of 10 and it has taken{' '}
          {Math.round(worst.effort * 100)}% of your goal work.
        </p>
      )}
    </Panel>
  );
}
