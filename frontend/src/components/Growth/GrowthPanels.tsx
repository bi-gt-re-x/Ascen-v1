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
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
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
 * Seven rows, Sunday to Saturday, one column per week, month names along the
 * top: the shape a reader already knows how to read, and the one in which "I
 * do nothing at weekends" is visible at a glance as a pale row.
 *
 * **Weeks are the columns, not the rows.** `heatmapGrid` hands back weeks,
 * because a week is what a calendar is made of; this transposes them on the
 * way out. Seven rows is a constant and the week count is not, so a panel that
 * is wide and short — which is what the row this sits in gives it — fits
 * fourteen weeks across far more comfortably than fourteen down. Drawn the
 * other way up, the 90-day map was a 124px ribbon in a 400px card.
 *
 * The grid is remounted whenever the window changes — that is what `key` on it
 * is for — so the squares play their entrance again rather than swapping in
 * place. It deliberately does not replay on a refresh: the same map re-read is
 * a tic, not an entrance, which is the rule the chart follows too. The stagger
 * is per-square and comes from `--i`; styles/growth.css turns it into a delay,
 * and running it on `week * 2 + weekday` sweeps the map left to right, which
 * is the direction the time in it runs.
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
          <div
            className="gr-heat-body"
            key={windowKey}
            style={{
              ['--heat-cols' as string]: rows.length,
              ['--heat-max' as string]: `${shape.maxWidth}px`,
            }}
          >
            {/* The month names, each over the week its month opens in. */}
            <span className="gr-heat-corner" aria-hidden="true" />
            {rows.map((week, at) => (
              <span className="gr-heat-month" key={`month-${at}`} aria-hidden="true">
                {week.label}
              </span>
            ))}

            {/* Then a row per weekday, taking that day out of every week. */}
            {HEAT_WEEKDAYS.map((letter, weekday) => (
              <Fragment key={weekday}>
                <span className="gr-heat-day" aria-hidden="true">
                  {letter}
                </span>
                {rows.map((week, at) => {
                  const cell = week.days[weekday]!;
                  return (
                    <span
                      key={at}
                      className={`gr-heat-cell${cell.date ? ` lv-${cell.level}` : ' is-blank'}`}
                      style={{ ['--i' as string]: at * 2 + weekday }}
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
                  );
                })}
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
              <span className="gr-mile-reward">+{row.reward} XP</span>
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
          <ul className="gr-lt-legend">
            {data.lines.map((line) => (
              <li key={line.key}>
                <i className={`gr-lt-key tone-${line.key}`} aria-hidden="true" />
                <span className="gr-lt-name">{line.label}</span>
                <span className="gr-lt-total">{line.total}</span>
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
 * The design has five named skills at a level each — Problem Solving 4.2,
 * Algorithms 3.8 — and the account tracks no such thing. There is a growth
 * tree in the backend (`backend/tracking/tree.py`) that is a stub, and a
 * `/growth-tree` route that says so. Inventing levels out of subject XP would
 * put five confident numbers on the page that mean nothing, which is worse
 * than an empty card: a reader cannot tell a made-up 4.2 from a real one.
 *
 * So it says what it will be and what it is waiting on, the same bargain
 * pages/Unbuilt strikes for a whole route. Delete this component on the day
 * the tree returns rows.
 */
export function SkillsProgress({ onViewAll }: SkillsProgressProps) {
  return (
    <section className="gr-panel gr-skills">
      <h2 className="gr-panel-title">
        Skills Progress
        <Hint text="Waiting on the growth tree — see backend/tracking/tree.py." />
      </h2>

      <div className="gr-skills-empty">
        <span className="gr-skills-ico" aria-hidden="true">
          <Glyph name="chart" size={20} />
        </span>
        <p className="gr-skills-head">No skills tracked yet</p>
        <p className="gr-skills-hint">
          Levels per skill come from the growth tree, which isn’t built. Until
          it is, XP by Category beside this is the honest version of the same
          question.
        </p>
      </div>

      <button type="button" className="gr-panel-cta" onClick={onViewAll}>
        View the growth tree
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
