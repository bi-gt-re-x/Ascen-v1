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
import { Panel } from './charts';
import type { GoalNote, GoalsOverview } from '@/utils/goalAnalytics';
import type { GoalSuggestion } from '@/utils/goalSuggest';
import type { Goal, Task } from '@/types';
import { goalHealth, goalPace } from '@/utils/goalHealth';
import { goalNumbers } from '@/components/Goals/numbers';

// --------------------------------------------------------------------------
// The spread
// --------------------------------------------------------------------------
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
