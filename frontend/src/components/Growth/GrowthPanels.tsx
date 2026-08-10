/**
 * The panels around the growth chart.
 *
 * The chart was the whole page; these are what turned it into one. Each takes
 * figures already worked out by utils/growthSummary (or utils/subjectXp) and
 * draws them — none of them fetch, none hold state beyond a menu being open or
 * a segmented control's choice, and none of them compute a number the page
 * could disagree with, because the page hands them all the same slice of the
 * same series.
 *
 * They live in one file because they are one screen's worth of small pieces
 * that are never used apart, and nine files of forty lines would hide that.
 * The two things that are genuinely reusable have moved out: the SVG shapes
 * are in MiniChart, and the arithmetic was never here.
 *
 * The icons are inline SVG rather than emoji. Emoji are a different typeface
 * on every platform, they carry their own colour, and a row of them at 12px is
 * a row of blobs — which is the whole of why the panels looked homemade beside
 * the design. One stroke weight, one size, `currentColor`, and the tone class
 * on the tile decides what colour that is.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { OTHER_KEY, type SubjectXp } from '@/utils/subjectXp';
import { LongTermChart, Sparkline, TrendChart } from './MiniChart';
import {
  HEAT_WEEKDAYS,
  HEAT_WINDOWS,
  LONG_TERM_WINDOWS,
  RANGES,
  type ChartStat,
  type GrowthTrend,
  type HeatRow,
  type HeatWindowKey,
  type Insight,
  type LongTermKey,
  type LongTermProgress,
  type Milestone,
  type RangeKey,
  type TileSeries,
} from '@/utils/growthSummary';
import type { GrowthSummaryFigures, SummaryFigure } from '@/utils/growthSummary';
import type { GrowthDay } from '@/types';

// --------------------------------------------------------------------------
// Icons
// --------------------------------------------------------------------------
/** One stroke weight, one box, `currentColor`. See the note at the top. */
const PATHS: Record<string, string> = {
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  spark: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  check: 'M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  flame: 'M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s1 1 2 1 2-3 2-7z',
  trophy: 'M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 20h6M12 13v7',
  award: 'M12 3a5 5 0 100 10 5 5 0 000-10zM9 13l-1 8 4-2 4 2-1-8',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
  alert: 'M12 3l9 16H3zM12 9v4M12 16.5v.5',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 7.5v.5',
  download: 'M12 4v11M8 11l4 4 4-4M4 19h16',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
};

function Glyph({ name, size = 15 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      className="gr-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.info!} />
    </svg>
  );
}

/** The ⓘ beside a panel title, explaining what the panel is counting. */
function Hint({ text }: { text: string }) {
  return (
    <span className="gr-hint" title={text} aria-hidden="true">
      <Glyph name="info" size={13} />
    </span>
  );
}

// --------------------------------------------------------------------------
// Dropdown
// --------------------------------------------------------------------------
interface DropdownOption<T extends string> {
  key: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: Array<DropdownOption<T>>;
  onChange: (value: T) => void;
  /** What the button reads, when it is not simply the chosen option's label. */
  display?: string;
  /** A glyph inside the button, before the label. */
  icon?: string;
  className?: string;
  label: string;
}

/**
 * The one interactive shape this page repeats: a button that opens a list.
 *
 * The range picker, the chart's metric and the chart's window are all this,
 * and they were three near-identical closures before. Escape and a click
 * outside close it; the list is a `listbox` so the chosen row is announced as
 * selected rather than merely looking it.
 */
function Dropdown<T extends string>({
  value,
  options,
  onChange,
  display,
  icon,
  className = '',
  label,
}: DropdownProps<T>) {
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

  const chosen = options.find((option) => option.key === value);

  return (
    <div className={`gr-drop ${className}`.trim()} ref={box}>
      <button
        type="button"
        className="gr-drop-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
      >
        {icon && <Glyph name={icon} size={14} />}
        <span className="gr-drop-value">{display ?? chosen?.label ?? ''}</span>
        <span className="gr-drop-caret" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <ul className="gr-drop-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                role="option"
                aria-selected={option.key === value}
                className={`gr-drop-item${option.key === value ? ' is-active' : ''}`}
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
  return (
    <Dropdown
      className="gr-range"
      label="Date range"
      icon="calendar"
      value={value}
      display={span}
      options={RANGES.map((option) => ({ key: option.key, label: option.label }))}
      onChange={onChange}
    />
  );
}

// --------------------------------------------------------------------------
// Export
// --------------------------------------------------------------------------
export interface ExportReportProps {
  /** The rows the range covers, in order — one line of CSV each. */
  rows: GrowthDay[];
  /** Goes in the filename, so a folder of these is readable. */
  span: string;
}

/**
 * The range on screen, as a file.
 *
 * A CSV of exactly the days the page is drawn from, built here rather than
 * asked of the server: the page already holds every row, and an export that
 * re-fetched could quietly hand back a different window than the one the
 * reader is looking at. The columns are the series' own fields, unrounded —
 * the panels round for display and a spreadsheet should not inherit that.
 */
export function ExportReport({ rows, span }: ExportReportProps) {
  const save = () => {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]!) as Array<keyof GrowthDay>;
    const escape = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [
      columns.join(','),
      ...rows.map((row) => columns.map((column) => escape(row[column] ?? '')).join(',')),
    ].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ascen-growth ${span.replace(/[^\w\s–-]/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className="gr-export"
      onClick={save}
      disabled={rows.length === 0}
      title="Download these days as a CSV"
    >
      <Glyph name="download" size={14} />
      Export Report
    </button>
  );
}

// --------------------------------------------------------------------------
// The chart panel's own head, and the strip under it
// --------------------------------------------------------------------------
export interface ChartHeadProps {
  title: string;
  hint: string;
  metric: string;
  metrics: Array<{ key: string; label: string }>;
  onMetric: (value: string) => void;
  range: RangeKey;
  onRange: (value: RangeKey) => void;
}

/**
 * A title, and the two things that decide what is under it.
 *
 * The window picker here is the *same state* as the header's range picker,
 * shown a second time where the eye is. Two controls that scope the same page
 * to different windows is how a page ends up comparing a fortnight against a
 * quarter — see the note at the top of pages/Growth — so this is a second
 * surface on one range, not a second range.
 */
export function ChartHead({
  title,
  hint,
  metric,
  metrics,
  onMetric,
  range,
  onRange,
}: ChartHeadProps) {
  return (
    <div className="gr-panel-head gr-chart-head">
      <h2 className="gr-panel-title">
        {title}
        <Hint text={hint} />
      </h2>
      <div className="gr-chart-tools">
        <Dropdown
          className="is-compact"
          label="Which series"
          value={metric}
          options={metrics}
          onChange={onMetric}
        />
        <Dropdown
          className="is-compact"
          label="How far back"
          value={range}
          options={RANGES.map((option) => ({ key: option.key, label: option.label }))}
          onChange={onRange}
        />
      </div>
    </div>
  );
}

export interface ChartStripProps {
  stats: ChartStat[];
}

/** Five facts the line above cannot answer. See `chartStats`. */
export function ChartStrip({ stats }: ChartStripProps) {
  return (
    <dl className="gr-strip">
      {stats.map((stat) => (
        <div className="gr-strip-cell" key={stat.key}>
          <dt>{stat.label}</dt>
          <dd>
            <strong>{stat.value}</strong>
            {stat.delta !== null && (
              <span className={`gr-chip${stat.delta >= 0 ? ' is-up' : ' is-down'}`}>
                {stat.delta >= 0 ? '+' : '−'}
                {Math.abs(stat.delta)}%
              </span>
            )}
            {stat.note && <span className="gr-strip-note">{stat.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// --------------------------------------------------------------------------
// Growth Summary
// --------------------------------------------------------------------------
/** An arrow and a percentage, or nothing at all. See `SummaryFigure.delta`. */
function Delta({ figure, days }: { figure: SummaryFigure; days: number }) {
  if (figure.delta === null || days <= 0) {
    return <span className="gr-tile-foot is-quiet">no earlier period</span>;
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
  series: TileSeries;
  trend: GrowthTrend;
  /** "vs. Last 30 Days" — what the deltas in here are measured against. */
  against: string;
}

/**
 * What the range came to, and the shape of getting there.
 *
 * Four totals and a curve, because four totals cannot distinguish a month that
 * climbed steadily from one that did everything in its last week — and that
 * distinction is most of what a reader wants from a summary. Each tile carries
 * its own days as a sparkline for the same reason at a smaller scale.
 */
export function GrowthSummary({ figures, series, trend, against }: GrowthSummaryProps) {
  const tiles = [
    { key: 'xp', tone: 'xp', label: 'Total XP Earned', figure: figures.xp, icon: 'spark', spark: series.xp },
    { key: 'tasks', tone: 'tasks', label: 'Tasks Completed', figure: figures.tasks, icon: 'check', spark: series.tasks },
    { key: 'perday', tone: 'perday', label: 'XP per Day (Avg)', figure: figures.xpPerDay, icon: 'target', spark: series.xp },
    { key: 'focus', tone: 'focus', label: 'Focus Hours', figure: figures.focusHours, icon: 'clock', spark: series.focusHours },
  ];

  return (
    <section className="gr-panel gr-summary">
      <div className="gr-panel-head">
        <h2 className="gr-panel-title">
          <span className="gr-panel-ico" aria-hidden="true">
            <Glyph name="trend" size={14} />
          </span>
          Growth Summary
          <Hint text="Every figure here covers the range in the header, compared against the same length of time before it." />
        </h2>
        <span className="gr-panel-note">{against}</span>
      </div>

      <div className="gr-tiles">
        {tiles.map((tile) => (
          <div className={`gr-tile tone-${tile.tone}`} key={tile.key}>
            <div className="gr-tile-top">
              <span className={`gr-tile-ico tone-${tile.tone}`} aria-hidden="true">
                <Glyph name={tile.icon} size={15} />
              </span>
              <strong className="gr-tile-value">
                {tile.figure.value.toLocaleString()}
              </strong>
            </div>
            <span className="gr-tile-label">{tile.label}</span>
            <Delta figure={tile.figure} days={figures.comparedDays} />
            <Sparkline values={tile.spark} tone={tile.tone} />
          </div>
        ))}
      </div>

      <div className="gr-trend">
        <span className="gr-trend-title">Growth Trend</span>
        <div className="gr-trend-row">
          <TrendChart trend={trend} />
          {trend.overall !== null && (
            <div className="gr-trend-badge">
              <strong className={trend.overall >= 0 ? 'is-up' : 'is-down'}>
                {trend.overall >= 0 ? '+' : '−'}
                {Math.abs(trend.overall)}%
              </strong>
              <span>Overall Growth</span>
              <span className="is-quiet">{against.replace('vs. ', 'vs ')}</span>
            </div>
          )}
        </div>
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
export interface XpHeatmapProps {
  rows: HeatRow[];
  /** Which window is drawn — the panel owns this, not the page's range. */
  windowKey: HeatWindowKey;
  onWindowChange: (value: HeatWindowKey) => void;
}

/**
 * The last 30 or 90 days as a calendar of squares.
 *
 * Seven columns, Sunday to Saturday, one row per week, month names down the
 * left where each month opens — the shape the design draws, and the one a
 * reader already knows from every wall calendar they have ever owned.
 *
 * **Weeks are the rows, which is the order `heatmapGrid` already hands them
 * back in.** It used to be transposed here, and the reason was height: seven
 * rows is a constant, fourteen columns is not, and a wide short panel took
 * fourteen weeks across more comfortably than down. What paid for the flip back
 * is the cells giving up their square aspect — they fill their grid cell now,
 * so fourteen rows simply make each one shorter instead of overflowing. The
 * width is a constant either way, because seven columns always is.
 *
 * The grid is remounted whenever the window changes — that is what `key` on it
 * is for — so the squares play their entrance again rather than swapping in
 * place. It deliberately does not replay on a refresh: the same map re-read is
 * a tic, not an entrance, which is the rule the chart follows too. The stagger
 * is per-square and comes from `--i`; styles/growth.css turns it into a delay,
 * and running it on `week * 3 + weekday` sweeps the map diagonally from the
 * oldest corner to the newest, which is the direction the time in it runs.
 */
export function XpHeatmap({ rows, windowKey, onWindowChange }: XpHeatmapProps) {
  const shape = HEAT_WINDOWS.find((entry) => entry.key === windowKey) ?? HEAT_WINDOWS[0]!;

  return (
    <section className="gr-panel gr-heat">
      <div className="gr-panel-head">
        <h2 className="gr-panel-title">
          XP Heatmap
          <Hint
            text={`One square per day for the last ${shape.days} days, shaded against the busiest of them.`}
          />
        </h2>
        <div className="gr-seg" role="group" aria-label="Heatmap window">
          {HEAT_WINDOWS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`gr-seg-opt${option.key === windowKey ? ' is-active' : ''}`}
              aria-pressed={option.key === windowKey}
              onClick={() => onWindowChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="gr-empty">Nothing to map yet.</p>
      ) : (
        <>
          <div className="gr-heat-body" key={windowKey}>
            {/* The weekday letters, each over its own column. */}
            <span className="gr-heat-corner" aria-hidden="true" />
            {HEAT_WEEKDAYS.map((letter, weekday) => (
              <span className="gr-heat-day" key={`day-${weekday}`} aria-hidden="true">
                {letter}
              </span>
            ))}

            {/* Then a row per week, named on the week its month opens in. */}
            {rows.map((week, at) => (
              <Fragment key={at}>
                <span className="gr-heat-month" aria-hidden="true">
                  {week.label}
                </span>
                {week.days.map((cell, weekday) => (
                  <span
                    key={weekday}
                    className={`gr-heat-cell${cell.date ? ` lv-${cell.level}` : ' is-blank'}`}
                    style={{ ['--i' as string]: at * 3 + weekday }}
                    title={
                      cell.date
                        ? `${new Date(`${cell.date}T00:00:00`).toLocaleDateString('en-US', {
                            weekday: 'short',
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
  onViewAll: () => void;
}

/** One icon per ladder, so the three rows are told apart before they are read. */
const MILESTONE_ICON: Record<Milestone['kind'], string> = {
  xp: 'trophy',
  focus: 'clock',
  streak: 'flame',
};

/**
 * The three things the account is working towards.
 *
 * The badge on the right is a label on the tier — what reaching it is *worth*
 * — and not XP that anything awards. Nothing here writes to the account, and
 * the dates are read back out of the history rather than recorded at the time;
 * see utils/growthSummary.
 */
export function Milestones({ rows, onViewAll }: MilestonesProps) {
  return (
    <section className="gr-panel gr-milestones">
      <div className="gr-panel-head">
        <h2 className="gr-panel-title">
          <span className="gr-panel-ico" aria-hidden="true">
            <Glyph name="award" size={14} />
          </span>
          Milestones
        </h2>
        <button type="button" className="gr-panel-link" onClick={onViewAll}>
          View all
        </button>
      </div>

      <ul className="gr-miles">
        {rows.map((row) => {
          const done = row.progress >= row.target;
          const percent = Math.min(100, Math.round((row.progress / row.target) * 100));
          return (
            <li className={`gr-mile tone-${row.kind}${done ? ' is-done' : ''}`} key={row.kind}>
              <span className={`gr-mile-ico tone-${row.kind}`} aria-hidden="true">
                <Glyph name={MILESTONE_ICON[row.kind]} size={15} />
              </span>
              <div className="gr-mile-body">
                <span className="gr-mile-name">{row.name}</span>
                <span className="gr-mile-sub">
                  {done && row.reachedOn
                    ? `Completed on ${new Date(`${row.reachedOn}T00:00:00`).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )}`
                    : row.sub}
                </span>
                <span className="gr-mile-track">
                  <i
                    className={`gr-mile-fill tone-${row.kind}`}
                    style={{ width: `${percent}%` }}
                  />
                </span>
              </div>
              <span className={`gr-mile-reward tone-${row.kind}`}>+{row.reward} XP</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --------------------------------------------------------------------------
// Long term progress
// --------------------------------------------------------------------------
export interface LongTermProps {
  data: LongTermProgress;
  windowKey: LongTermKey;
  onWindowChange: (value: LongTermKey) => void;
}

/**
 * Four running totals over months, at the account's own scale.
 *
 * Like the heatmap, this panel is not scoped by the header's range — a panel
 * called Long Term Progress showing the last seven days would be a joke — so
 * it carries its own 6M / 1Y / All Time control, and the totals in the legend
 * are what each line comes to at the end of *that* window.
 */
export function LongTerm({ data, windowKey, onWindowChange }: LongTermProps) {
  return (
    <section className="gr-panel gr-longterm">
      <div className="gr-panel-head">
        <h2 className="gr-panel-title">
          Long Term Progress
          <Hint text="Monthly running totals. The axis is XP; the other three lines are scaled to fit beside it, and carry their own totals in the legend." />
        </h2>
        <div className="gr-seg" role="group" aria-label="How far back">
          {LONG_TERM_WINDOWS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`gr-seg-opt${option.key === windowKey ? ' is-active' : ''}`}
              aria-pressed={option.key === windowKey}
              onClick={() => onWindowChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {data.lines.length === 0 ? (
        <p className="gr-empty">Not enough history to plot yet.</p>
      ) : (
        <>
          <LongTermChart data={data} />
          {/* Four names and their colours, as the design draws it. Three of the
              four lines are scaled to fit beside the XP axis and so have no
              readable magnitude on the plot; the total is what supplies it, and
              it rides on the row's tooltip rather than sitting beside the name.
              Hidden information is a poor second to printed information — but
              the alternative here is not printing it, and a legend that matches
              the design is what was asked for. */}
          <ul className="gr-lt-legend">
            {data.lines.map((line) => (
              <li key={line.key} title={`${line.label}: ${line.total}`}>
                <i className={`gr-lt-key tone-${line.key}`} aria-hidden="true" />
                <span className="gr-lt-name">{line.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Skills Progress
// --------------------------------------------------------------------------
export interface SkillsProgressProps {
  onViewAll: () => void;
}

/**
 * The one panel on this page with nothing behind it.
 *
 * ⚠ **These five rows are fixed placeholder copy, not data.** The account
 * tracks no skill levels: the growth tree that would produce them is a stub in
 * `backend/tracking/tree.py`, and `/growth-tree` is a route that says so. The
 * numbers below are the design's own, hard-coded, and they will read the same
 * for every account on every day — nothing here moves when the user does.
 *
 * That is a deliberate choice to match the design rather than an oversight, and
 * it is the reason for the "Sample" mark in the panel head and for the hint
 * spelling it out: a reader who is not told cannot tell a fixed 4.2 from a
 * measured one, and five confident invented numbers on a page of real ones is
 * the worst thing this panel could be.
 *
 * Replace `SAMPLE_SKILLS` with the tree's rows on the day it returns any, and
 * take the mark and the hint out with it.
 */
const SAMPLE_SKILLS = [
  { name: 'Problem Solving', level: '4.2', percent: 78, tone: 'purple' },
  { name: 'Algorithms', level: '3.8', percent: 65, tone: 'green' },
  { name: 'Calculus', level: '4.0', percent: 72, tone: 'green' },
  { name: 'Data Structures', level: '3.6', percent: 58, tone: 'blue' },
  { name: 'Writing', level: '3.2', percent: 45, tone: 'amber' },
] as const;

export function SkillsProgress({ onViewAll }: SkillsProgressProps) {
  return (
    <section className="gr-panel gr-skills">
      <div className="gr-panel-head">
        <h2 className="gr-panel-title">
          Skills Progress
          <Hint text="Sample figures. Skill levels come from the growth tree, which isn’t built yet — see backend/tracking/tree.py. Nothing in this panel is measured from your account." />
        </h2>
        <span className="gr-panel-tag">Sample</span>
      </div>

      <ul className="gr-skill-list">
        {SAMPLE_SKILLS.map((skill) => (
          <li className="gr-skill" key={skill.name}>
            <span className="gr-skill-name">{skill.name}</span>
            <span className="gr-skill-level">Level {skill.level}</span>
            <span className="gr-skill-track">
              <i
                className={`gr-skill-fill tone-${skill.tone}`}
                style={{ width: `${skill.percent}%` }}
              />
            </span>
            <span className="gr-skill-pct">{skill.percent}%</span>
          </li>
        ))}
      </ul>

      <button type="button" className="gr-panel-cta" onClick={onViewAll}>
        View all skills
        <span aria-hidden="true"> →</span>
      </button>
    </section>
  );
}

// --------------------------------------------------------------------------
// Insights
// --------------------------------------------------------------------------
export interface InsightsProps {
  insights: Insight[];
  onViewPlan: () => void;
}

const INSIGHT_ICON: Record<Insight['tone'], string> = {
  good: 'check',
  watch: 'alert',
  note: 'bulb',
};

export function Insights({ insights, onViewPlan }: InsightsProps) {
  return (
    <section className="gr-panel gr-insights">
      <h2 className="gr-panel-title">
        <span className="gr-panel-ico" aria-hidden="true">
          <Glyph name="bulb" size={14} />
        </span>
        Insights &amp; Recommendations
        <Hint text="Chosen from the range's own figures — nothing here is a fixed string." />
      </h2>

      <ul className="gr-insight-list">
        {insights.map((insight, index) => (
          <li className={`gr-insight tone-${insight.tone}`} key={index}>
            <span className={`gr-insight-ico tone-${insight.tone}`} aria-hidden="true">
              <Glyph name={INSIGHT_ICON[insight.tone]} size={15} />
            </span>
            <div>
              <p className="gr-insight-head">{insight.headline}</p>
              <p className="gr-insight-hint">{insight.hint}</p>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="gr-panel-cta" onClick={onViewPlan}>
        View personalized plan
        <span aria-hidden="true"> →</span>
      </button>
    </section>
  );
}
