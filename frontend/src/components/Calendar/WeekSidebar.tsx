/**
 * The Week view's overview column.
 *
 * Every panel is scoped to the week on screen rather than to "now" — stepping
 * back a week steps all of them back. That is what makes the column readable:
 * every number on it answers a question about the same seven days.
 *
 * The shape follows the design, and now follows it exactly: This Week Progress
 * leads with a ring and the week's three figures over a per-day XP sparkline,
 * then the XP breakdown, then Streaks as seven dots, then what is coming and
 * the way through to the month.
 *
 * Weekly Focus Time is not here. It was, for a while — a figure about the week
 * belongs with the figures about the week — but the design pins it to the
 * bottom-left corner of the grid, and that is where it is: `WeekFocusCard`
 * below, placed by pages/Calendar/Week.tsx.
 *
 * Two panels this column used to carry, the weekly focus note and Top
 * Priorities, are gone with them. Neither is in the design, and Top Priorities
 * is a card the dashboard already draws.
 */
import { useMemo } from 'react';
import { fmtHM } from '@/hooks/useFocusSession';

export interface WeekStats {
  total: number;
  done: number;
  rate: number;
  xp: number;
}

/** Focused against planned across the week, in seconds. */
export interface WeekFocus {
  focused: number;
  planned: number;
}

/** One day of the week, for the sparkline and the streak dots. */
export interface WeekDay {
  /** Mon…Sun, single letter. */
  initial: string;
  /** XP earned that day. */
  xp: number;
  /** Whether anything was completed. Drives the streak dot. */
  active: boolean;
  /** A day that has not happened yet is drawn hollow, not missed. */
  future: boolean;
  today: boolean;
}

export interface UpcomingEntry {
  id: string;
  icon: string;
  title: string;
  /** "Aug 4, 2026" */
  date: string;
  /** "4:30 PM", or "All Day". */
  when: string;
}

export interface WeekSidebarProps {
  stats: WeekStats;
  streak: number;
  /** Focused against planned across the week — the last card in the column. */
  focus: WeekFocus;
  days: WeekDay[];
  upcoming: UpcomingEntry[];
  /** The way out of the week — the design's "View Full Calendar". */
  onViewMonth: () => void;
  onViewAnalytics: () => void;
  collapsed: boolean;
}

/**
 * The XP breakdown's rows.
 *
 * **These are placeholders and not this account's data.** Splitting XP by
 * subject needs a subject on a task, and there is no such column: tasks carry
 * title, description, priority, status, xp_value, due_date and the timer pair
 * (data/sql/tasks.sql) and nothing else. Making this real means adding a
 * category to the table, to the API, and to the Add Task dialog, and then
 * counting `xp_value` by it here — at which point this constant and the
 * `is-sample` tag beside the heading both come out.
 */
const SAMPLE_BREAKDOWN = [
  { label: 'Math', xp: 160, tone: 'blue' },
  { label: 'Coding', xp: 140, tone: 'green' },
  { label: 'Physics', xp: 110, tone: 'gold' },
  { label: 'Writing', xp: 80, tone: 'purple' },
  { label: 'Other', xp: 56, tone: 'grey' },
];

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Weekly Focus Time.
 *
 * The design floats this over the foot of the grid, and it was floated for a
 * while. It is the fifth panel of the same overview, written in the same
 * furniture as the four above it, so it now simply sits with them — which also
 * gives back the corner of Sunday evening it was covering.
 */
function WeekFocusCard({
  focus,
  onViewAnalytics,
}: {
  focus: WeekFocus;
  onViewAnalytics: () => void;
}) {
  const percent =
    focus.planned > 0 ? Math.min(100, Math.round((focus.focused / focus.planned) * 100)) : 0;

  return (
    <section className="wk-panel">
      <h3 className="wk-panel-title">⏱️ Weekly Focus Time</h3>
      <p className="wk-focustime">
        {fmtHM(focus.focused)} <span className="wk-focustime-of">/ {fmtHM(focus.planned)}</span>
      </p>
      <div className="wk-progress">
        <div
          className="wk-progress-bar"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Weekly focus goal progress"
        />
      </div>
      <p className="wk-focustime-sub">{percent}% Goal Progress</p>
      <button type="button" className="wk-panel-link" onClick={onViewAnalytics}>
        View Analytics<span aria-hidden="true"> →</span>
      </button>
    </section>
  );
}

/**
 * The sparkline's path, and the dot on each day.
 *
 * Drawn in a 100x34 box the SVG scales to the panel, so nothing here needs to
 * know how wide the column is. A week with no XP at all is a flat line along
 * the bottom rather than a divide by zero.
 */
function sparkPoints(days: WeekDay[]): { x: number; y: number }[] {
  const peak = Math.max(1, ...days.map((day) => day.xp));
  const step = 100 / days.length;
  return days.map((day, index) => ({
    // The centre of the day's share of the width, not its left edge — the day
    // initials below are a seven-column grid, and a point on the boundary
    // between two of them would sit under neither letter.
    x: (index + 0.5) * step,
    // 3 and 31 rather than 0 and 34, so the stroke and the dots have room to
    // sit inside the box instead of being clipped by it.
    y: 31 - (day.xp / peak) * 28,
  }));
}

export function WeekSidebar({
  stats,
  streak,
  focus,
  days,
  upcoming,
  onViewMonth,
  onViewAnalytics,
  collapsed,
}: WeekSidebarProps) {
  const points = useMemo(() => sparkPoints(days), [days]);
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  // The fill drops to the floor under the first and last points rather than at
  // the edges of the box, so it sits under the line instead of flaring past it.
  const area = `${points[0]?.x ?? 0},34 ${line} ${points[points.length - 1]?.x ?? 100},34`;

  const ringFilled = (Math.max(0, Math.min(100, stats.rate)) / 100) * RING_C;

  const breakdownPeak = Math.max(1, ...SAMPLE_BREAKDOWN.map((row) => row.xp));
  const breakdownTotal = SAMPLE_BREAKDOWN.reduce((sum, row) => sum + row.xp, 0);

  return (
    <aside className="wk-sidebar" id="wkSidebar" hidden={collapsed}>
      {/* --- This Week Progress ------------------------------------------- */}
      <section className="wk-panel">
        <h3 className="wk-panel-title">This Week Progress</h3>

        <div className="wk-weekly">
          <div className="wk-ring">
            <svg viewBox="0 0 64 64" role="img" aria-label={`${stats.rate}% complete`}>
              <circle className="wk-ring-track" cx="32" cy="32" r={RING_R} />
              <circle
                className="wk-ring-fill"
                cx="32"
                cy="32"
                r={RING_R}
                strokeDasharray={`${ringFilled} ${RING_C - ringFilled}`}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <div className="wk-ring-centre">
              <span className="wk-ring-pct">{stats.rate}%</span>
              <span className="wk-ring-label">On Track</span>
            </div>
          </div>

          <dl className="wk-weekly-figures">
            <div>
              <dd>{stats.total}</dd>
              <dt>Tasks</dt>
            </div>
            <div>
              <dd>{stats.done}</dd>
              <dt>Completed</dt>
            </div>
            <div>
              <dd>{stats.xp.toLocaleString()}</dd>
              <dt>XP Earned</dt>
            </div>
          </dl>
        </div>

        {/* XP per day across the week. The reader is being shown a shape, not
            asked to read values off it, so there are no axes and no labels
            beyond the day initials. */}
        <div className="wk-spark">
          <svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
            <polygon className="wk-spark-area" points={area} />
            <polyline className="wk-spark-line" points={line} />
            {points.map((point, index) => (
              /* Keyed by position, not by the day's initial: Tuesday and
                 Thursday are both "T", and Saturday and Sunday both "S". */
              <circle
                key={index}
                className={`wk-spark-dot${days[index]?.today ? ' is-today' : ''}`}
                cx={point.x}
                cy={point.y}
                r={1.6}
              />
            ))}
          </svg>
          <div className="wk-spark-days" aria-hidden="true">
            {days.map((day, index) => (
              <span key={index} className={day.today ? 'is-today' : undefined}>
                {day.initial}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* --- XP Breakdown -------------------------------------------------- */}
      <section className="wk-panel">
        <h3 className="wk-panel-title">
          XP Breakdown
          {/* Says outright that the rows below are not this account's. See
              SAMPLE_BREAKDOWN — a panel of invented figures that looks exactly
              like the real ones beside it is worse than no panel. */}
          <span className="wk-sample" title="Tasks have no subject yet — these rows are sample data">
            Sample
          </span>
        </h3>
        <div className="wk-break-total">
          <span>Total XP</span>
          <strong>{breakdownTotal.toLocaleString()}</strong>
        </div>
        <ul className="wk-break">
          {SAMPLE_BREAKDOWN.map((row) => (
            <li key={row.label}>
              <span className="wk-break-label">{row.label}</span>
              <span className="wk-break-track">
                <i
                  className={`wk-break-fill tone-${row.tone}`}
                  style={{ width: `${(row.xp / breakdownPeak) * 100}%` }}
                />
              </span>
              <span className="wk-break-xp">{row.xp} XP</span>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Streaks ------------------------------------------------------- */}
      <section className="wk-panel">
        <h3 className="wk-panel-title">🔥 Streaks</h3>
        <div className="wk-streak-num">
          🔥 {streak} Day {streak === 1 ? 'Streak' : 'Streak'}
        </div>
        <div className="wk-streak-sub">Keep it up!</div>
        <div className="wk-dots">
          {days.map((day, index) => (
            <span key={index} className="wk-dot-cell">
              <span
                className={`wk-dot${day.active ? ' is-done' : ''}${day.future ? ' is-future' : ''}`}
                aria-hidden="true"
              >
                {day.active ? '✓' : ''}
              </span>
              <span className="wk-dot-day">{day.initial}</span>
            </span>
          ))}
        </div>
      </section>

      {/* --- Upcoming ------------------------------------------------------ */}
      <section className="wk-panel">
        <h3 className="wk-panel-title">
          Upcoming{' '}
          <span className="wk-priorities-count">
            {upcoming.length ? `(${upcoming.length})` : ''}
          </span>
        </h3>
        {upcoming.length === 0 ? (
          <p className="wk-empty">Nothing scheduled after this week.</p>
        ) : (
          <ul className="wk-upcoming">
            {upcoming.map((entry) => (
              <li key={entry.id}>
                <span className="wk-upcoming-ico" aria-hidden="true">
                  {entry.icon}
                </span>
                <span className="wk-upcoming-body">
                  <span className="wk-upcoming-name">{entry.title}</span>
                  <span className="wk-upcoming-when">
                    {entry.date} · {entry.when}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Where the list runs out: the month, which is the only view that
            shows what comes after the seven days beside this. */}
        <button type="button" className="wk-fullcal" onClick={onViewMonth}>
          View Full Calendar<span aria-hidden="true"> →</span>
        </button>
      </section>

      {/* --- Weekly Focus Time -------------------------------------------- */}
      <WeekFocusCard focus={focus} onViewAnalytics={onViewAnalytics} />
    </aside>
  );
}
