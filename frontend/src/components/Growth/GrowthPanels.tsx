/**
 * The panels around the growth chart.
 *
 * The chart was the whole page; these are what turned it into one. Each takes
 * figures already worked out by utils/growthSummary (or utils/subjectXp) and
 * draws them — none of them fetch, none hold state beyond a menu being open,
 * and none of them compute a number the page could disagree with, because the
 * page hands them all the same slice of the same series.
 *
 * They live in one file because they are one screen's worth of small pieces
 * that are never used apart, and six files of forty lines would hide that.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { iconUrl, type Subject } from '@/services/subjects';
import { OTHER_KEY, type SubjectXp } from '@/utils/subjectXp';
import { RANGES, type HeatWeek, type Insight, type Milestone, type RangeKey } from '@/utils/growthSummary';
import type { GrowthSummaryFigures, SummaryFigure } from '@/utils/growthSummary';

// --------------------------------------------------------------------------
// Range picker
// --------------------------------------------------------------------------
export interface RangePickerProps {
  value: RangeKey;
  /** "Jul 3 – Jul 31, 2026" — what the current choice actually covers. */
  span: string;
  onChange: (value: RangeKey) => void;
}

/**
 * The one control that decides what the whole page is about.
 *
 * It shows the dates rather than the choice — "Jul 3 – Jul 31, 2026" and not
 * "Last 30 days" — because the dates are the thing every figure below is
 * scoped to, and a reader checking whether a number covers the week they have
 * in mind should not have to do the subtraction.
 */
export function RangePicker({ value, span, onChange }: RangePickerProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="gr-range" ref={box}>
      <button
        type="button"
        className="gr-range-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span className="gr-range-span">{span}</span>
        <span className="gr-range-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul className="gr-range-menu" role="listbox" aria-label="Date range">
          {RANGES.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                role="option"
                aria-selected={option.key === value}
                className={`gr-range-item${option.key === value ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Growth Summary
// --------------------------------------------------------------------------
/** An arrow and a percentage, or nothing at all. See `SummaryFigure.delta`. */
function Delta({ figure, days }: { figure: SummaryFigure; days: number }) {
  if (figure.delta === null || days <= 0) {
    return <span className="gr-tile-foot is-quiet">no earlier period to compare</span>;
  }
  const up = figure.delta >= 0;
  return (
    <span className={`gr-tile-foot${up ? ' is-up' : ' is-down'}`}>
      <span aria-hidden="true">{up ? '↑' : '↓'}</span> {Math.abs(figure.delta)}% vs
      last {days} days
    </span>
  );
}

export interface GrowthSummaryProps {
  figures: GrowthSummaryFigures;
}

export function GrowthSummary({ figures }: GrowthSummaryProps) {
  const tiles = [
    { key: 'xp', tone: 'xp', label: 'Total XP Earned', figure: figures.xp, icon: '↗' },
    { key: 'tasks', tone: 'tasks', label: 'Tasks Completed', figure: figures.tasks, icon: '🏆' },
    { key: 'perday', tone: 'perday', label: 'XP per Day (Avg)', figure: figures.xpPerDay, icon: '◎' },
    { key: 'focus', tone: 'focus', label: 'Focus Hours', figure: figures.focusHours, icon: '◷' },
  ];

  return (
    <section className="gr-panel gr-summary">
      <h2 className="gr-panel-title">
        <span className="gr-panel-ico" aria-hidden="true">↗</span> Growth Summary
      </h2>
      <div className="gr-tiles">
        {tiles.map((tile) => (
          <div className="gr-tile" key={tile.key}>
            <span className={`gr-tile-ico tone-${tile.tone}`} aria-hidden="true">
              {tile.icon}
            </span>
            <div className="gr-tile-body">
              <strong className="gr-tile-value">
                {tile.figure.value.toLocaleString()}
              </strong>
              <span className="gr-tile-label">{tile.label}</span>
              <Delta figure={tile.figure} days={figures.comparedDays} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// XP by Category
// --------------------------------------------------------------------------
const DONUT_R = 54;
const DONUT_C = 2 * Math.PI * DONUT_R;

export interface CategoryDonutProps {
  breakdown: SubjectXp;
}

/**
 * Where the XP went, by subject.
 *
 * "Category" in the design; subject in the data, which is the thing a task
 * actually carries. Five named subjects and one Other, the same split the week
 * calendar's breakdown uses — see utils/subjectXp for why Other holds both the
 * sixth-and-below and everything unfiled, and why it is always last.
 *
 * The ring is drawn with one circle per slice and a `stroke-dasharray` — a
 * length of arc and a gap for the rest — rotated into place by the lengths
 * before it. Every slice is also a labelled, numbered row in the legend, so
 * nothing here rests on colour alone.
 */
export function CategoryDonut({ breakdown }: CategoryDonutProps) {
  const { rows, total } = breakdown;

  let offset = 0;
  const slices = rows.map((row, index) => {
    const share = total > 0 ? row.xp / total : 0;
    const slice = {
      key: row.key,
      tone: row.key === OTHER_KEY ? 'other' : String(index + 1),
      length: share * DONUT_C,
      offset,
      percent: Math.round(share * 100),
      row,
    };
    offset += slice.length;
    return slice;
  });

  return (
    <section className="gr-panel gr-category">
      <h2 className="gr-panel-title">XP by Category</h2>
      {total === 0 ? (
        <p className="gr-empty">No XP earned in this range yet.</p>
      ) : (
        <div className="gr-donut-row">
          <div className="gr-donut">
            <svg viewBox="0 0 140 140" role="img" aria-label={`XP by subject: ${rows
              .map((row) => `${row.label} ${row.xp}`)
              .join(', ')}`}>
              <circle className="gr-donut-track" cx="70" cy="70" r={DONUT_R} />
              {slices.map((slice) => (
                <circle
                  key={slice.key}
                  className={`gr-donut-slice tone-sub-${slice.tone}`}
                  cx="70"
                  cy="70"
                  r={DONUT_R}
                  strokeDasharray={`${slice.length} ${DONUT_C - slice.length}`}
                  strokeDashoffset={-slice.offset}
                  transform="rotate(-90 70 70)"
                >
                  <title>{`${slice.row.name ?? slice.row.label}: ${slice.row.xp} XP (${slice.percent}%)`}</title>
                </circle>
              ))}
            </svg>
            <div className="gr-donut-centre">
              <strong>{total.toLocaleString()}</strong>
              <span>Total XP</span>
            </div>
          </div>

          <ul className="gr-legend">
            {slices.map((slice) => (
              <li key={slice.key}>
                <span
                  className={`gr-legend-dot tone-sub-${slice.tone}`}
                  aria-hidden="true"
                />
                <span className="gr-legend-name">{slice.row.label}</span>
                <span className="gr-legend-value">
                  {slice.row.xp.toLocaleString()} XP ({slice.percent}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// XP Heatmap
// --------------------------------------------------------------------------
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface XpHeatmapProps {
  weeks: HeatWeek[];
}

export function XpHeatmap({ weeks }: XpHeatmapProps) {
  return (
    <section className="gr-panel gr-heat">
      <h2 className="gr-panel-title">
        XP Heatmap
        <span
          className="gr-hint"
          title="One square per day, shaded against the busiest day in this range."
          aria-hidden="true"
        >
          ⓘ
        </span>
      </h2>

      {weeks.length === 0 ? (
        <p className="gr-empty">Nothing to map yet.</p>
      ) : (
        <>
          <div className="gr-heat-grid">
            <span className="gr-heat-corner" />
            {DAY_INITIALS.map((initial, index) => (
              /* Keyed by position: two Ts and two Ss. */
              <span className="gr-heat-dow" key={index} aria-hidden="true">
                {initial}
              </span>
            ))}

            {weeks.map((week, index) => (
              <Fragment key={`${week.label}-${index}`}>
                <span className="gr-heat-week">{week.label}</span>
                {week.days.map((cell, at) => (
                  <span
                    key={at}
                    className={`gr-heat-cell${cell.date ? ` lv-${cell.level}` : ' is-blank'}`}
                    title={
                      cell.date
                        ? `${new Date(`${cell.date}T00:00:00`).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}: ${cell.xp} XP`
                        : undefined
                    }
                  />
                ))}
              </Fragment>
            ))}
          </div>

          <div className="gr-heat-key">
            <span>Less XP</span>
            <span className="gr-heat-ramp" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((level) => (
                <i className={`gr-heat-cell lv-${level}`} key={level} />
              ))}
            </span>
            <span>More XP</span>
          </div>
        </>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Milestones
// --------------------------------------------------------------------------
export interface MilestonesProps {
  rows: Milestone[];
}

/**
 * The XP ladder, and where the account is on it.
 *
 * The badge on the right is a label on the tier — what reaching it is *worth*
 * — and not XP that anything awards. Nothing here writes to the account, and
 * the dates are read back out of the XP history rather than recorded at the
 * time; see utils/growthSummary.
 */
export function Milestones({ rows }: MilestonesProps) {
  return (
    <section className="gr-panel gr-milestones">
      <h2 className="gr-panel-title">
        <span className="gr-panel-ico" aria-hidden="true">⚑</span> Milestones
      </h2>
      <ul className="gr-miles">
        {rows.map((row) => {
          const done = row.reachedOn !== null;
          const percent = Math.min(100, Math.round((row.progress / row.target) * 100));
          return (
            <li className={`gr-mile${done ? ' is-done' : ''}`} key={row.target}>
              <span className="gr-mile-mark" aria-hidden="true">
                {done ? '✓' : '🔒'}
              </span>
              <div className="gr-mile-body">
                <span className="gr-mile-name">
                  Earn {row.target.toLocaleString()} XP
                </span>
                <span className="gr-mile-sub">
                  {done
                    ? `Completed on ${new Date(`${row.reachedOn as string}T00:00:00`).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )}`
                    : `${row.progress.toLocaleString()} / ${row.target.toLocaleString()} XP`}
                </span>
                {!done && (
                  <span className="gr-mile-track">
                    <i className="gr-mile-fill" style={{ width: `${percent}%` }} />
                  </span>
                )}
              </div>
              <span className="gr-mile-reward">+{row.reward} XP</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --------------------------------------------------------------------------
// Recent XP Activity
// --------------------------------------------------------------------------
export interface ActivityEntry {
  id: string;
  title: string;
  /** The subject it was filed under, for the icon and the line under the name. */
  subject: Subject | null;
  xp: number;
  /** "Today, 7:35 AM". */
  when: string;
}

export interface RecentXpActivityProps {
  entries: ActivityEntry[];
  onViewAll: () => void;
}

export function RecentXpActivity({ entries, onViewAll }: RecentXpActivityProps) {
  return (
    <section className="gr-panel gr-activity">
      <div className="gr-panel-head">
        <h2 className="gr-panel-title">Recent XP Activity</h2>
        <button type="button" className="gr-panel-link" onClick={onViewAll}>
          View all activity<span aria-hidden="true"> →</span>
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="gr-empty">Nothing finished in this range.</p>
      ) : (
        <ul className="gr-acts">
          {entries.map((entry) => (
            <li className="gr-act" key={entry.id}>
              <span className="gr-act-ico" aria-hidden="true">
                {entry.subject ? (
                  <i
                    className="cal-ico"
                    style={{ ['--ico' as string]: `url(${iconUrl(entry.subject)})` }}
                  />
                ) : (
                  <span className="gr-act-dot" />
                )}
              </span>
              <div className="gr-act-body">
                <span className="gr-act-name">
                  Completed &ldquo;{entry.title}&rdquo;
                </span>
                <span className="gr-act-sub">{entry.subject?.label ?? 'No subject'}</span>
              </div>
              <div className="gr-act-right">
                <span className="gr-act-xp">+{entry.xp} XP</span>
                <span className="gr-act-when">{entry.when}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Insights
// --------------------------------------------------------------------------
export interface InsightsProps {
  insights: Insight[];
}

export function Insights({ insights }: InsightsProps) {
  return (
    <section className="gr-panel gr-insights">
      <h2 className="gr-panel-title">
        <span className="gr-panel-ico" aria-hidden="true">💡</span> Insights
      </h2>
      <ul className="gr-insight-list">
        {insights.map((insight, index) => (
          <li className="gr-insight" key={index}>
            <span className="gr-insight-ico" aria-hidden="true">💡</span>
            <div>
              <p className="gr-insight-head">{insight.headline}</p>
              <p className="gr-insight-hint">{insight.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
