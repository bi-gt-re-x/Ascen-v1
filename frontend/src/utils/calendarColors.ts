/**
 * What colour an event is.
 *
 * One colour per event, copied to every one of its recurrences, and chosen to
 * sit a good distance from the colours already in use — the backend tracks
 * every hex ever handed out (`/api/get_event_colors`) precisely so a new event
 * can be given one that is visibly different from the rest.
 *
 * Two things are deliberately avoided. The task-difficulty colours, so an
 * event never reads as a task; and, by weighting, the rarer families — an
 * account's calendar should look mostly like oranges, greens, yellows, reds
 * and blues, with purple, pink, grey and brown as accents rather than half the
 * page.
 *
 * Ported from the colour half of frontend/js/calendar/calendar-month.js. The
 * palette below it is the one events had before hex colours; legacy events
 * still carry only a `colorIndex`, so it has to stay.
 */
import type { CalendarSection } from './calendarStore';

export type Rgb = [number, number, number];

/** The pre-hex palette. Kept for events created before colours were tracked. */
const LEGACY_PALETTE: Rgb[] = [
  [139, 92, 246], // violet
  [236, 72, 153], // pink
  [20, 184, 166], // teal
  [249, 115, 22], // orange
  [217, 70, 239], // fuchsia
  [34, 211, 238], // cyan
  [124, 58, 237], // purple
  [244, 63, 94], // rose
];

/** [hue, saturation, lightness, family] — the colours an event may be given. */
const CANDIDATES: Array<[number, number, number, string]> = [
  // browns (warm, muted, darker)
  [22, 0.55, 0.34, 'brown'], [28, 0.45, 0.4, 'brown'], [33, 0.5, 0.3, 'brown'],
  [16, 0.42, 0.38, 'brown'], [30, 0.35, 0.46, 'brown'], [25, 0.6, 0.44, 'brown'],
  // greys (near-zero saturation, light to dark)
  [30, 0.05, 0.45, 'gray'], [30, 0.05, 0.56, 'gray'], [210, 0.06, 0.5, 'gray'],
  [210, 0.05, 0.64, 'gray'], [30, 0.05, 0.7, 'gray'],
  // oranges
  [30, 0.85, 0.55, 'orange'], [38, 0.8, 0.52, 'orange'], [23, 0.78, 0.5, 'orange'],
  [43, 0.75, 0.58, 'orange'],
  // greens
  [95, 0.45, 0.45, 'green'], [120, 0.42, 0.42, 'green'], [140, 0.45, 0.4, 'green'],
  [105, 0.55, 0.5, 'green'], [150, 0.34, 0.46, 'green'], [82, 0.5, 0.48, 'green'],
  // reds, shifted off the task red (brick / rose)
  [8, 0.6, 0.45, 'red'], [12, 0.55, 0.52, 'red'], [350, 0.42, 0.46, 'red'],
  // yellows, shifted off the task yellow (mustard / gold)
  [48, 0.68, 0.48, 'yellow'], [52, 0.6, 0.55, 'yellow'], [45, 0.55, 0.44, 'yellow'],
  // blues, shifted off the task blue (steel / indigo)
  [200, 0.5, 0.48, 'blue'], [225, 0.45, 0.52, 'blue'], [210, 0.42, 0.42, 'blue'],
  [235, 0.34, 0.56, 'blue'],
  // purples and pinks, deliberately rarer
  [270, 0.45, 0.52, 'purple'], [285, 0.4, 0.48, 'purple'], [258, 0.42, 0.56, 'purple'],
  [330, 0.6, 0.6, 'pink'], [340, 0.55, 0.66, 'pink'], [318, 0.5, 0.58, 'pink'],
];

/** How often each family should come up. */
const FAMILY_WEIGHT: Record<string, number> = {
  orange: 3, green: 3, yellow: 3, red: 3, blue: 3,
  purple: 1, pink: 1, gray: 1, brown: 1,
};

/** Low, medium and high task colours — an event must not be mistaken for one. */
const TASK_RGB: Rgb[] = [
  [56, 132, 255],
  [245, 196, 92],
  [240, 90, 95],
];

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return [f(0), f(8), f(4)];
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (x: number) => x.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!match) return null;
  return [
    parseInt(match[1] ?? '0', 16),
    parseInt(match[2] ?? '0', 16),
    parseInt(match[3] ?? '0', 16),
  ];
}

function distanceSquared(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/**
 * A colour for a new event, given the ones already spoken for.
 *
 * Weighted rather than simply farthest-away: a common family can still win
 * when its nearest neighbour is a little closer, which is what keeps the
 * calendar from drifting into all-purple as it fills up.
 */
export function generateDistinctColor(inUse: string[]): string {
  const avoid = inUse
    .map(hexToRgb)
    .filter((rgb): rgb is Rgb => rgb !== null)
    .concat(TASK_RGB);

  const scored = CANDIDATES.map(([h, s, l, family]) => {
    const rgb = hslToRgb(h, s, l);
    let nearest = Infinity;
    avoid.forEach((other) => {
      nearest = Math.min(nearest, distanceSquared(rgb, other));
    });
    return { rgb, family, nearest: Number.isFinite(nearest) ? nearest : 1 };
  });

  const furthest = scored.reduce((max, item) => Math.max(max, item.nearest), 1) || 1;
  const weighted = scored.map((item) => ({
    ...item,
    weight: (FAMILY_WEIGHT[item.family] ?? 1) * (0.3 + 0.7 * (item.nearest / furthest)),
  }));

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return rgbToHex(item.rgb);
  }
  return rgbToHex(weighted[weighted.length - 1]?.rgb ?? [128, 128, 128]);
}

/** The legacy palette index for an event with no hex: its own, or a hash of its name. */
function legacyIndex(section: Pick<CalendarSection, 'colorIndex' | 'task'>): number {
  const count = LEGACY_PALETTE.length;
  if (typeof section.colorIndex === 'number') {
    return ((section.colorIndex % count) + count) % count;
  }
  const name = String(section.task || '');
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

/** An event's colour, as RGB. Its stored hex, else its palette colour. */
export function eventRgb(
  section: Pick<CalendarSection, 'color' | 'colorIndex' | 'task'>,
): Rgb {
  const fromHex = section.color ? hexToRgb(section.color) : null;
  return fromHex ?? LEGACY_PALETTE[legacyIndex(section)] ?? [139, 92, 246];
}

export interface BlockColors {
  fill: string;
  border: string;
  /** Near-solid, for the accent down the block's left edge. */
  left: string;
}

/** The three colours a grid block is painted with. */
export function eventBlockColors(
  section: Pick<CalendarSection, 'color' | 'colorIndex' | 'task'>,
): BlockColors {
  const [r, g, b] = eventRgb(section);
  return {
    fill: `rgba(${r}, ${g}, ${b}, 0.4)`,
    border: `rgba(${r}, ${g}, ${b}, 0.62)`,
    left: `rgba(${r}, ${g}, ${b}, 0.95)`,
  };
}
