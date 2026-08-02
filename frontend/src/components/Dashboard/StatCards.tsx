/**
 * The four cards across the top of the dashboard.
 *
 * One row, one question each: how today is going, where the level is, how much
 * focus time has been banked, and whether the streak is alive. They are small
 * on purpose — anything that needs a sentence to explain belongs in the panels
 * below, not here.
 *
 * All four read from what the page already has. Nothing in this file fetches.
 */
import { format } from '@/utils';
import type { UseFocusSession } from '@/hooks/useFocusSession';
import type { DaySummary } from './summary';
import type { UserStats } from '@/types';

// --------------------------------------------------------------------------
// The ring
// --------------------------------------------------------------------------
/** Stroke width and radius, in the 120-unit box the ring is drawn in. */
const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

/**
 * A donut showing one percentage.
 *
 * Drawn with `stroke-dasharray` on a circle rotated a quarter turn, so the arc
 * starts at twelve o'clock and fills clockwise. `pathLength` is not used —
 * Safari has historically ignored it on circles — so the dash figures are
 * computed from the real circumference instead.
 */
function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * RING_C;

  return (
    <div className="dash-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${percent}% complete`}>
        <circle className="dash-ring-track" cx="60" cy="60" r={RING_R} />
        <circle
          className="dash-ring-fill"
          cx="60"
          cy="60"
          r={RING_R}
          strokeDasharray={`${filled} ${RING_C - filled}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="dash-ring-centre">
        <span className="dash-ring-pct">{percent}%</span>
        <span className="dash-ring-label">{label}</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Today's Progress
// --------------------------------------------------------------------------
/**
 * The ring, and the three counts it is drawn from.
 *
 * "On Track" under the percentage is a claim, so it is only made when there is
 * something to be on track with: a day with nothing on it reads "Nothing due",
 * not 0% On Track.
 */
export function TodayCard({ day }: { day: DaySummary }) {
  const caption = day.total === 0 ? 'Nothing due' : day.percent >= 60 ? 'On Track' : 'In Progress';

  return (
    <section className="card dash-stat dash-stat-today">
      <h2 className="dash-stat-title">Today&apos;s Progress</h2>
      <div className="dash-today-body">
        <ProgressRing percent={day.percent} label={caption} />
        <dl className="dash-today-figures">
          <div className="dash-figure">
            <dt>Tasks</dt>
            <dd>{format.number(day.total)}</dd>
          </div>
          <div className="dash-figure">
            <dt>Completed</dt>
            <dd>{format.number(day.done)}</dd>
          </div>
          <div className="dash-figure">
            <dt>XP Earned</dt>
            <dd>{format.number(day.xp)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// XP Overview
// --------------------------------------------------------------------------
/**
 * Level and progress toward the next one.
 *
 * The level is derived from the lifetime total rather than read from
 * `stats.level`, so the bar and the number underneath it can never disagree —
 * `format.levelForTotalXp` mirrors `level_for_total_xp` in
 * backend/tracking/xp.py, and the backend stays the authority on both.
 */
export function XpCard({ stats, xpToday }: { stats: UserStats; xpToday: number }) {
  const level = format.levelForTotalXp(stats.xp);

  return (
    <section className="card dash-stat">
      <h2 className="dash-stat-title">XP Overview</h2>
      <div className="dash-xp-head">
        <span className="dash-xp-level">Level {level.level}</span>
        <span className="dash-xp-count">
          {format.number(level.xpInLevel)} / {format.number(level.xpRequired)} XP
        </span>
      </div>
      <div className="dash-bar">
        <div
          className="dash-bar-fill"
          style={{ width: `${level.percent}%` }}
          role="progressbar"
          aria-valuenow={Math.round(level.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Level ${level.level} progress`}
        />
      </div>
      <p className="dash-xp-today">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
        <strong>+{format.number(xpToday)} XP</strong> today
      </p>
    </section>
  );
}

// --------------------------------------------------------------------------
// Focus Time
// --------------------------------------------------------------------------
/**
 * Time focused today, against the goal set for today.
 *
 * Both figures come from the *same* session object the Focus panel below is
 * driven by, passed down rather than re-read. Two `useFocusSession` calls would
 * each hold their own copy of the day's localStorage record, and pressing + on
 * the panel would move its goal while this card went on showing the old one.
 */
export function FocusCard({ session }: { session: UseFocusSession }) {
  const hours = session.focused / 3600;

  return (
    <section className="card dash-stat">
      <h2 className="dash-stat-title">
        <span className="dash-stat-ico dash-ico-focus" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        Focus Time
      </h2>
      <p className="dash-big">
        {hours.toFixed(1)} <span className="dash-big-unit">hrs</span>
      </p>
      <p className="dash-stat-sub">Today</p>
      <p className="dash-stat-foot">Daily Goal: {session.goalHours.toFixed(1)} hrs</p>
      <div className="dash-bar dash-bar-green">
        <div
          className="dash-bar-fill"
          style={{ width: `${session.percent}%` }}
          role="progressbar"
          aria-valuenow={session.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Focus goal progress"
        />
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// Current Streak
// --------------------------------------------------------------------------
/**
 * The streak, and a line of encouragement pitched at where it is.
 *
 * The number is whatever `/api/get_user_data` last said, and that call decays a
 * streak that went stale overnight while answering — so a streak shown here is
 * one the backend still considers alive.
 */
export function StreakCard({ stats }: { stats: UserStats }) {
  const current = Number(stats.current_streak) || 0;
  const best = Number(stats.best_streak) || 0;

  return (
    <section className="card dash-stat">
      <h2 className="dash-stat-title">
        <span className="dash-stat-ico dash-ico-streak" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3" />
          </svg>
        </span>
        Current Streak
      </h2>
      <p className="dash-big">
        {current} <span className="dash-big-unit">{current === 1 ? 'day' : 'days'}</span>
      </p>
      <p className="dash-stat-sub">{current === 0 ? 'Keep it going!' : 'Nice run — keep it up.'}</p>
      <p className="dash-stat-foot">
        Best Streak: {best} {best === 1 ? 'day' : 'days'}
      </p>
    </section>
  );
}
