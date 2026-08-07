/**
 * The Month view's overview column — everything below the day's plan.
 *
 * Three panels, and each is scoped to the month on screen rather than to
 * "now": stepping back a month steps all of them back, so every number in the
 * column is answering a question about the same thirty days as the grid beside
 * it. That is the whole reason the column is readable.
 *
 * Monthly Overview is four tiles of fact. Top Performing Days is the same
 * month's XP, ranked — the one panel that tells the reader *which* days did the
 * work, which is a question a grid of shaded squares can only gesture at.
 * Monthly Insights is one sentence about the month against the month before,
 * chosen from the figures rather than fixed (see utils/monthSummary).
 *
 * Nothing here has a "no data" state that hides the panel: a month with nothing
 * in it is a real answer and the panels say so, because a column that vanishes
 * when the month is empty is a column the reader learns not to trust.
 */
import { fmtHM } from '@/hooks/useFocusSession';
import { dates } from '@/utils';
import type { MonthDay, MonthInsight } from '@/utils/monthSummary';

export interface MonthSidebarProps {
  /** Tasks landing in the month, and how many are finished. */
  tasks: number;
  done: number;
  /** Focused against planned, in seconds. */
  focused: number;
  planned: number;
  xpEarned: number;
  best: MonthDay | null;
  /** The three best days by XP earned, best first. */
  top: MonthDay[];
  insight: MonthInsight;
  onViewAll: () => void;
}

/** "Aug 15 (Sat)" — how Top Performing Days names a day. */
function dayLabel(iso: string): string {
  const date = dates.fromIsoDate(iso);
  const short = dates.formatDate(date, { month: 'short', day: 'numeric' });
  const weekday = dates.formatDate(date, { weekday: 'short' });
  return `${short} (${weekday})`;
}

function Tile({
  tone,
  icon,
  label,
  value,
  sub,
}: {
  tone: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={`mv-tile tone-${tone}`}>
      <span className="mv-tile-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="mv-tile-label">{label}</span>
      <span className="mv-tile-value">{value}</span>
      <span className="mv-tile-sub">{sub}</span>
    </div>
  );
}

export function MonthSidebar({
  tasks,
  done,
  focused,
  planned,
  xpEarned,
  best,
  top,
  insight,
  onViewAll,
}: MonthSidebarProps) {
  // Every bar is a share of the best day, so the leader fills the track and
  // the rest are read against it. That is the comparison the panel exists for.
  const peak = top[0]?.earned ?? 0;

  return (
    <>
      <section className="mv-card">
        <h3 className="mv-card-title">Monthly Overview</h3>
        <div className="mv-tiles">
          <Tile
            tone="tasks"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 11.5 11 13.5 15.5 9" />
                <rect x="4" y="4" width="16" height="16" rx="4" />
              </svg>
            }
            label="Tasks"
            value={`${done} / ${tasks}`}
            sub="Completed"
          />
          <Tile
            tone="focus"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 1.8" />
              </svg>
            }
            label="Focus Time"
            /* Focused against planned. The tile said "Planned" alone for a
               while, which is the one figure that cannot be wrong and also
               cannot be interesting: it is what the reader typed in. */
            value={fmtHM(focused)}
            sub={`of ${fmtHM(planned)} planned`}
          />
          <Tile
            tone="xp"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z" />
              </svg>
            }
            label="XP Earned"
            value={xpEarned.toLocaleString()}
            sub="Total"
          />
          <Tile
            tone="best"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z" />
              </svg>
            }
            label="Best Day"
            value={best ? dates.formatDate(dates.fromIsoDate(best.iso), { month: 'short', day: 'numeric' }) : '—'}
            sub={best ? `${best.earned.toLocaleString()} XP` : 'Nothing yet'}
          />
        </div>
      </section>

      <section className="mv-card">
        <div className="mv-card-head">
          <h3 className="mv-card-title">Top Performing Days</h3>
          <button type="button" className="mv-card-link" onClick={onViewAll}>
            View all
          </button>
        </div>

        {top.length === 0 ? (
          <p className="mv-empty">No XP earned this month yet.</p>
        ) : (
          <ol className="mv-topdays">
            {top.map((day, index) => (
              <li key={day.iso}>
                <span className="mv-topday-rank">{index + 1}</span>
                <span className="mv-topday-name">{dayLabel(day.iso)}</span>
                <span className="mv-topday-track">
                  <i
                    className="mv-topday-fill"
                    style={{ width: `${peak > 0 ? Math.max(6, (day.earned / peak) * 100) : 0}%` }}
                  />
                </span>
                <span className="mv-topday-xp">{day.earned.toLocaleString()} XP</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mv-card">
        <h3 className="mv-card-title">Monthly Insights</h3>
        <div className="mv-insight">
          <span className="mv-insight-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9.5 18h5M10 21h4" />
              <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .9 1.6h5.2c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3Z" />
            </svg>
          </span>
          <span className="mv-insight-body">
            <span className="mv-insight-head">{insight.headline}</span>
            <span className="mv-insight-hint">{insight.hint}</span>
          </span>
        </div>
      </section>
    </>
  );
}
