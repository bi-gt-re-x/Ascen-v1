/**
 * The growth page's canvas charts — the drawing half of growth.js.
 *
 * Five charts share one renderer and differ only by which series they read and
 * how they label a value: cumulative XP, daily XP, average task XP, cumulative
 * focus and daily focus. Everything here is pure in the sense that matters —
 * given a canvas, a series and a view, it paints. It holds no state, reads no
 * globals and knows nothing about React; the component above it owns the
 * canvas, the zoom window and the animation clock.
 *
 * That split is the point. The original kept the canvases, contexts, zoom
 * state, animation progress and the fetched data as eleven module-level
 * variables that every function reached into, which is why `drawChart` could
 * not be called without the whole file having been initialised first.
 */
import type { GrowthDay } from '@/types';

export const CHART_PAD = { left: 54, right: 24, top: 24, bottom: 38 };

export const CHART_TYPES = [
  'cumulative',
  'daily',
  'avgTask',
  'cumulativeFocus',
  'dailyFocus',
] as const;

export type ChartType = (typeof CHART_TYPES)[number];

/**
 * The tabs do not all name their chart the way the chart names itself: the
 * "Average Task XP Daily" tab is `average`, its chart is `avgTask`. One map, so
 * a tab name can always be turned into the type the drawing code knows.
 */
export const TAB_TO_TYPE: Record<string, ChartType> = {
  cumulative: 'cumulative',
  daily: 'daily',
  average: 'avgTask',
  avgTask: 'avgTask',
  cumulativeFocus: 'cumulativeFocus',
  dailyFocus: 'dailyFocus',
};

/** The entrance, in ms. */
export const ANIM_MS = 780;

// --------------------------------------------------------------------------
// The series, flattened out of the day rows
// --------------------------------------------------------------------------
export interface ChartData {
  labels: string[];
  dates: string[];
  values: number[];
  cumulativeValues: number[];
  avgTaskValues: number[];
  focusValues: number[];
  cumulativeFocusValues: number[];
  tasks: number[];
}

export function emptyChartData(): ChartData {
  return {
    labels: [],
    dates: [],
    values: [],
    cumulativeValues: [],
    avgTaskValues: [],
    focusValues: [],
    cumulativeFocusValues: [],
    tasks: [],
  };
}

/**
 * Day rows into parallel arrays, de-duplicated by day number.
 *
 * With nothing to show, seven flat days ending today — a chart with an axis
 * and no line reads better than an empty box, and it is what a new account
 * saw before.
 */
export function processData(rows: GrowthDay[] | null | undefined): ChartData {
  const out = emptyChartData();

  if (!rows || rows.length === 0) {
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (7 - i));
      out.labels.push(`Day ${i}`);
      out.dates.push(d.toISOString().slice(0, 10));
      out.values.push(0);
      out.cumulativeValues.push(0);
      out.avgTaskValues.push(0);
      out.focusValues.push(0);
      out.cumulativeFocusValues.push(0);
      out.tasks.push(0);
    }
    return out;
  }

  const seen = new Set<number>();
  rows.forEach((d) => {
    if (seen.has(d.day_number)) return;
    seen.add(d.day_number);
    out.labels.push(`Day ${d.day_number}`);
    out.dates.push(d.date || '');
    out.values.push(d.xp_earned);
    out.cumulativeValues.push(d.cumulative_xp);
    out.avgTaskValues.push(d.avg_task_xp || 0);
    out.focusValues.push(d.focus_minutes || 0);
    out.cumulativeFocusValues.push(d.cumulative_focus_minutes || 0);
    out.tasks.push(d.tasks_completed || 0);
  });
  return out;
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------
export function formatInt(value: number): string {
  return Math.round(value || 0).toLocaleString('en-US');
}

export function formatMinutes(mins: number): string {
  const m = Math.round(mins || 0);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h && rem) return `${h}h ${rem}m`;
  if (h) return `${h}h`;
  return `${rem}m`;
}

/** Short axis label, e.g. "Aug 14". */
export function formatDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Full tooltip label, e.g. "Aug 14, 2023". */
export function formatDateFull(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Evenly-rounded y-axis ticks up to just above `maxValue`. */
export function niceTicks(
  maxValue: number,
  targetCount: number,
): { ticks: number[]; niceMax: number } {
  if (!(maxValue > 0)) return { ticks: [0, 1], niceMax: 1 };
  const rawStep = maxValue / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  step *= mag;
  const niceMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step * 0.001; v += step)
    ticks.push(Math.round(v));
  return { ticks, niceMax };
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// --------------------------------------------------------------------------
// Canvas helpers
// --------------------------------------------------------------------------
/** Rounded rectangle path — ctx.roundRect is not in every browser. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Point {
  x: number;
  y: number;
  value: number;
  index: number;
}

/** A smooth curve through the points, via quadratic midpoints. */
function traceCurve(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  const first = pts[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  if (pts.length < 3) {
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p) ctx.lineTo(p.x, p.y);
    }
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  const last = pts[pts.length - 1];
  if (last) ctx.lineTo(last.x, last.y);
}

// --------------------------------------------------------------------------
// Colours
// --------------------------------------------------------------------------
export interface ChartColors {
  grid: string;
  axis: string;
  line: string;
  areaTop: string;
  areaBottom: string;
  marker: string;
  markerRing: string;
  crosshair: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
  tooltipDate: string;
  tooltipXp: string;
  empty: string;
}

/**
 * The palette, by theme.
 *
 * The original read `document.body.classList.contains('dark')`, which is the
 * legacy pages' way of saying dark. The React app sets `html[data-theme]` and
 * carries the body class too, so this asks the attribute first and falls back
 * to the class — both frontends get the same colours either way.
 *
 * The line and its fill are the accent, matching `--accent` in styles/growth.css
 * — the design draws one purple curve, not a neutral one under a purple page.
 * They are literals rather than a `getComputedStyle` read of the variable
 * because this runs inside the draw loop, on every frame of the entrance
 * animation and on every mousemove, and a style resolution per frame is a
 * layout read per frame. If the accent moves, move both.
 */
export function chartColors(): ChartColors {
  const dark =
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    document.body.classList.contains('dark');

  return dark
    ? {
        grid: 'rgba(255, 255, 255, 0.10)',
        axis: '#98a1b2',
        line: '#a78bfa',
        areaTop: 'rgba(124, 92, 245, 0.42)',
        areaBottom: 'rgba(124, 92, 245, 0.02)',
        marker: '#a78bfa',
        markerRing: '#151b24',
        crosshair: 'rgba(167, 139, 250, 0.45)',
        tooltipBg: '#1b2230',
        tooltipBorder: 'rgba(255, 255, 255, 0.18)',
        tooltipShadow: 'rgba(0, 0, 0, 0.5)',
        tooltipDate: '#e6e8f0',
        tooltipXp: '#c9d1d9',
        empty: '#9aa0b5',
      }
    : {
        grid: 'rgba(44, 48, 46, 0.08)',
        axis: '#9297ab',
        line: '#6d4fd0',
        areaTop: 'rgba(109, 79, 208, 0.30)',
        areaBottom: 'rgba(109, 79, 208, 0.02)',
        marker: '#6d4fd0',
        markerRing: '#ffffff',
        crosshair: 'rgba(109, 79, 208, 0.35)',
        tooltipBg: '#ffffff',
        tooltipBorder: 'rgba(44, 48, 46, 0.18)',
        tooltipShadow: 'rgba(44, 48, 46, 0.2)',
        tooltipDate: '#2C302E',
        tooltipXp: '#5a6072',
        empty: '#9aa0b5',
      };
}

// --------------------------------------------------------------------------
// Geometry
// --------------------------------------------------------------------------
interface TypeConfig {
  key: keyof ChartData;
  minStep: number;
  fmtValue: (v: number) => string;
  empty?: string;
}

const fmtXp = (v: number) => `XP: ${formatInt(v)}`;
const fmtFocus = (v: number) => `Focus: ${formatMinutes(v)}`;

const CONFIGS: Record<ChartType, TypeConfig> = {
  cumulative: { key: 'cumulativeValues', minStep: 1000, fmtValue: fmtXp },
  daily: { key: 'values', minStep: 50, fmtValue: fmtXp },
  avgTask: { key: 'avgTaskValues', minStep: 5, fmtValue: fmtXp },
  cumulativeFocus: {
    key: 'cumulativeFocusValues',
    minStep: 30,
    fmtValue: fmtFocus,
    empty: 'Run a focus session for growth to show',
  },
  dailyFocus: {
    key: 'focusValues',
    minStep: 15,
    fmtValue: fmtFocus,
    empty: 'Run a focus session for growth to show',
  },
};

/** The visible window into the series. */
export interface ZoomWindow {
  startIndex: number;
  endIndex: number;
}

export interface Geometry {
  dates: string[];
  values: number[];
  ticks: number[];
  baseY: number;
  xStep: number;
  yScale: number;
  points: Point[];
  startIndex: number;
  fmtValue: (v: number) => string;
  emptyMsg: string;
}

/**
 * Plot geometry for one chart, shared by the painter and the hover handler so
 * the crosshair lines up with the curve exactly.
 *
 * `progress` scales every height, so a chart mid-entrance is drawn — line,
 * fill, marker and all — at the height it has reached rather than the one it
 * is heading for.
 */
export function computeGeometry(
  canvas: HTMLCanvasElement,
  data: ChartData,
  type: ChartType,
  zoom: ZoomWindow,
  progress = 1,
): Geometry | null {
  const cfg = CONFIGS[type];
  if (!cfg || zoom.startIndex > zoom.endIndex) return null;

  const dates = data.dates.slice(zoom.startIndex, zoom.endIndex + 1);
  const series = data[cfg.key] as number[];
  const values = series.slice(zoom.startIndex, zoom.endIndex + 1);

  const positive = values.filter((v) => v > 0);
  const maxValue = positive.length ? Math.max(...positive) : 0;

  // A little headroom above the peak, rounded to clean ticks.
  const rawMax =
    maxValue > 0 ? maxValue * 1.1 : cfg.minStep >= 1000 ? 200 : cfg.minStep * 4;
  const { ticks, niceMax } = niceTicks(rawMax, 6);
  const finalMax = niceMax > 0 ? niceMax : 1;

  const plotW = canvas.width - CHART_PAD.left - CHART_PAD.right;
  const plotH = canvas.height - CHART_PAD.top - CHART_PAD.bottom;
  const baseY = canvas.height - CHART_PAD.bottom;
  const xStep = values.length > 1 ? plotW / (values.length - 1) : 0;
  const yScale = plotH / finalMax;

  const points: Point[] = values.map((v, i) => ({
    x: CHART_PAD.left + xStep * i,
    y: baseY - Math.max(0, v) * yScale * progress,
    value: v,
    index: i,
  }));

  return {
    dates,
    values,
    ticks,
    baseY,
    xStep,
    yScale,
    points,
    startIndex: zoom.startIndex,
    fmtValue: cfg.fmtValue,
    emptyMsg: cfg.empty || 'Do a task for growth to show',
  };
}

// --------------------------------------------------------------------------
// Painting
// --------------------------------------------------------------------------
/** A blank chart area with a centred message, for accounts under three days old. */
export function drawPlaceholder(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const col = chartColors();
  ctx.save();
  ctx.fillStyle = col.empty;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px Quicksand, sans-serif';
  const lines = [
    'Growth Chart will show up 3 days',
    'after you create your account.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(
      line,
      canvas.width / 2,
      canvas.height / 2 + (i - (lines.length - 1) / 2) * 24,
    );
  });
  ctx.restore();
}

export function drawChart(canvas: HTMLCanvasElement, geo: Geometry): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { dates, values, ticks, baseY, yScale, points } = geo;
  const col = chartColors();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!values.length) {
    ctx.fillStyle = col.empty;
    ctx.font = '16px Quicksand';
    ctx.textAlign = 'center';
    ctx.fillText(geo.emptyMsg, canvas.width / 2, canvas.height / 2);
    return;
  }

  // Gridlines and y-axis labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '12px Arial';
  for (const val of ticks) {
    const y = baseY - val * yScale;
    ctx.strokeStyle = col.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CHART_PAD.left, y);
    ctx.lineTo(canvas.width - CHART_PAD.right, y);
    ctx.stroke();
    ctx.fillStyle = col.axis;
    ctx.fillText(formatInt(val), CHART_PAD.left - 8, y);
  }

  // X-axis date labels, evenly sampled
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = col.axis;
  const n = points.length;
  const maxXLabels = Math.min(8, n);
  const step = Math.max(1, Math.round((n - 1) / Math.max(1, maxXLabels - 1)));
  for (let i = 0; i < n; i += step) {
    const p = points[i];
    if (p) ctx.fillText(formatDateShort(dates[i] ?? ''), p.x, baseY + 8);
  }

  const first = points[0];
  const last = points[n - 1];
  if (!first || !last) return;

  // Gradient area fill under the curve
  const grad = ctx.createLinearGradient(0, CHART_PAD.top, 0, baseY);
  grad.addColorStop(0, col.areaTop);
  grad.addColorStop(1, col.areaBottom);
  ctx.beginPath();
  traceCurve(ctx, points);
  ctx.lineTo(last.x, baseY);
  ctx.lineTo(first.x, baseY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // The smooth line on top
  ctx.beginPath();
  traceCurve(ctx, points);
  ctx.strokeStyle = col.line;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (values.every((v) => v === 0)) {
    ctx.fillStyle = col.empty;
    ctx.font = '16px Quicksand';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(geo.emptyMsg, canvas.width / 2, (CHART_PAD.top + baseY) / 2);
  }
}

/** The hover crosshair, marker dot and date/value tooltip. */
export function drawHover(
  canvas: HTMLCanvasElement,
  geo: Geometry,
  idx: number,
): void {
  const ctx = canvas.getContext('2d');
  const p = geo.points[idx];
  if (!ctx || !p) return;
  const col = chartColors();

  ctx.save();

  ctx.strokeStyle = col.crosshair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, CHART_PAD.top);
  ctx.lineTo(p.x, geo.baseY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = col.marker;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = col.markerRing;
  ctx.stroke();

  const dateStr =
    formatDateFull(geo.dates[idx] ?? '') || `Day ${geo.startIndex + idx + 1}`;
  const valueStr = geo.fmtValue(geo.values[idx] ?? 0);

  ctx.font = 'bold 12.5px Arial';
  const w1 = ctx.measureText(dateStr).width;
  ctx.font = '12px Arial';
  const w2 = ctx.measureText(valueStr).width;
  const boxW = Math.max(w1, w2 + 14) + 20;
  const boxH = 44;

  let bx = p.x + 14;
  if (bx + boxW > canvas.width - 4) bx = p.x - boxW - 14;
  if (bx < 4) bx = 4;
  let by = p.y - boxH - 12;
  if (by < CHART_PAD.top) by = p.y + 14;

  ctx.beginPath();
  roundRectPath(ctx, bx, by, boxW, boxH, 8);
  ctx.fillStyle = col.tooltipBg;
  ctx.shadowColor = col.tooltipShadow;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = col.tooltipBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = col.tooltipDate;
  ctx.font = 'bold 12.5px Arial';
  ctx.fillText(dateStr, bx + 10, by + 15);

  // The value line, with a small colour swatch
  ctx.fillStyle = col.line;
  ctx.beginPath();
  roundRectPath(ctx, bx + 10, by + 30 - 4, 8, 8, 2);
  ctx.fill();
  ctx.fillStyle = col.tooltipXp;
  ctx.font = '12px Arial';
  ctx.fillText(valueStr, bx + 22, by + 30);

  ctx.restore();
}

// --------------------------------------------------------------------------
// Zoom
// --------------------------------------------------------------------------
/** The narrowest window the wheel will zoom to. */
const MIN_RANGE = 5;

/**
 * A new window after a zoom step, or the old one if it cannot move.
 *
 * Zooming in keeps the window exactly as wide as asked even when the anchor is
 * near an edge: if one side hits a boundary the other shifts to preserve the
 * width. Letting it collapse instead over-zoomed at the edges, and took many
 * extra clicks to undo.
 */
export function zoomWindow(
  current: ZoomWindow,
  direction: 'in' | 'out',
  total: number,
  anchorIndex?: number,
): ZoomWindow {
  if (total === 0) return current;
  const range = current.endIndex - current.startIndex;

  if (direction === 'in') {
    if (range <= MIN_RANGE) return current;
    const centre =
      anchorIndex ?? Math.floor((current.startIndex + current.endIndex) / 2);
    const newRange = Math.max(MIN_RANGE, Math.floor(range * 0.8));
    const half = Math.floor(newRange / 2);
    let start = centre - half;
    let end = start + newRange;
    if (start < 0) {
      end -= start;
      start = 0;
    }
    if (end > total - 1) {
      start -= end - (total - 1);
      end = total - 1;
    }
    return {
      startIndex: Math.max(0, start),
      endIndex: Math.min(total - 1, end),
    };
  }

  if (current.startIndex === 0 && current.endIndex === total - 1)
    return current;

  const target = Math.min(total - 1, Math.floor(range * 1.25));
  const leftSpace = current.startIndex;
  const rightSpace = total - 1 - current.endIndex;
  const available = leftSpace + rightSpace;
  if (available === 0) return current;

  const needed = target - range;
  if (available <= needed) return { startIndex: 0, endIndex: total - 1 };

  // Share the widening between the sides in proportion to the room each has.
  const leftGrow = Math.floor(needed * (leftSpace / available));
  const rightGrow = needed - leftGrow;
  return {
    startIndex: Math.max(0, current.startIndex - leftGrow),
    endIndex: Math.min(total - 1, current.endIndex + rightGrow),
  };
}

/** The point index nearest an x position, for hover and wheel-anchored zoom. */
export function indexAt(geo: Geometry, x: number): number {
  let closest = 0;
  let best = Infinity;
  geo.points.forEach((p, i) => {
    const d = Math.abs(x - p.x);
    if (d < best) {
      best = d;
      closest = i;
    }
  });
  return closest;
}
