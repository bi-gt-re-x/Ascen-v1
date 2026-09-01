/**
 * What a day amounts to: how much of it is spoken for, what is next, and what
 * finishing the rest is worth.
 *
 * The Day view already draws every block on a grid, and a grid is very good at
 * "when is this" and very bad at "how much of my day is left". The three
 * questions here are the ones a reader answers by squinting at the column and
 * counting, which is exactly the kind of arithmetic a page should do for them:
 *
 *   * **What is next** — the block that has not started yet, or the one running
 *     now. On the grid this is wherever the red line happens to be.
 *   * **Where the room is** — the day's blocks merged into bands, and the
 *     longest stretch with nothing in it. Overlaps count once, which a naive
 *     sum of block lengths gets wrong on exactly the days it matters.
 *   * **What is still on the table** — the XP of the unfinished tasks. The
 *     Day view has always shown what was earned; this is the other half, and
 *     it is the number that answers "is it worth staying at the desk".
 *
 * Hours are grid hours — 6…29, where 25 is 1 AM the next morning, the same
 * scale `dayTaskBlocks` lays blocks out on (utils/calendarGrid). Nothing here
 * converts to a clock, because the caller draws them and the two would drift.
 */
import type { Block } from './calendarGrid';

/** One merged, non-overlapping run of booked time, as grid hours. */
export interface Band {
  start: number;
  end: number;
  /** Every block in the run is finished. A day's progress, drawn. */
  done: boolean;
}

export interface UpNext {
  title: string;
  start: number;
  end: number;
  /** It has begun and has not ended. */
  running: boolean;
  /** Hours until it starts, or 0 while it is running. */
  away: number;
}

export interface DayShape {
  /** The window the bands are measured in: first start to last end. */
  from: number;
  to: number;
  /** Booked time, overlaps counted once. */
  booked: number;
  /** The merged runs, in order. */
  bands: Band[];
  /** The longest stretch inside the window with nothing on it. */
  gap: number;
  /** Where that stretch begins, or null when there is none. */
  gapAt: number | null;
  /** The next thing, or the one running. Null on a day with nothing left. */
  next: UpNext | null;
  /** XP the day's unfinished tasks are still worth. */
  onTheTable: number;
  /** Unfinished task blocks. `onTheTable` is what they add up to. */
  left: number;
}

const EMPTY: DayShape = {
  from: 0,
  to: 0,
  booked: 0,
  bands: [],
  gap: 0,
  gapAt: null,
  next: null,
  onTheTable: 0,
  left: 0,
};

function label(block: Block): string {
  return block.kind === 'event' ? block.name : block.title;
}

/**
 * @param blocks The day's laid-out blocks, in any order.
 * @param now    The reader's position in the day as a grid hour, or null on a
 *               day that is not today — where "next" means the first thing on
 *               it rather than the next thing to happen.
 */
export function dayShape(blocks: Block[], now: number | null): DayShape {
  if (!blocks.length) return EMPTY;

  const order = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const from = order[0]!.start;
  const to = order.reduce((latest, block) => Math.max(latest, block.end), from);

  // Merged rather than summed. Two blocks over the same hour are one booked
  // hour, and a day whose blocks overlap is precisely the day where the
  // difference between the two answers is worth having.
  const bands: Band[] = [];
  order.forEach((block) => {
    const last = bands[bands.length - 1];
    const done = block.kind === 'task' ? block.done : false;
    if (last && block.start <= last.end) {
      last.end = Math.max(last.end, block.end);
      last.done = last.done && done;
      return;
    }
    bands.push({ start: block.start, end: block.end, done });
  });

  const booked = bands.reduce((sum, band) => sum + (band.end - band.start), 0);

  let gap = 0;
  let gapAt: number | null = null;
  bands.forEach((band, index) => {
    const following = bands[index + 1];
    if (!following) return;
    const room = following.start - band.end;
    if (room > gap) {
      gap = room;
      gapAt = band.end;
    }
  });

  /* What is next. On today that is the first block that has not ended — so a
     block being worked on is the answer rather than being skipped past, which
     is what a reader glancing at this actually wants to be told. On any other
     day it is simply the first thing on it. */
  const ahead =
    now === null
      ? order[0]
      : order.find((block) => block.end > now);

  const next: UpNext | null = ahead
    ? {
        title: label(ahead),
        start: ahead.start,
        end: ahead.end,
        running: now !== null && ahead.start <= now,
        away: now === null ? 0 : Math.max(0, ahead.start - now),
      }
    : null;

  const unfinished = order.filter(
    (block): block is Extract<Block, { kind: 'task' }> =>
      block.kind === 'task' && !block.done,
  );

  return {
    from,
    to,
    booked,
    bands,
    gap,
    gapAt,
    next,
    onTheTable: unfinished.reduce((sum, block) => sum + (Number(block.xp) || 0), 0),
    left: unfinished.length,
  };
}

/** A band's place in the window, as percentages, for drawing it. */
export function bandStyle(shape: DayShape, band: Band): { left: string; width: string } {
  const span = shape.to - shape.from;
  if (span <= 0) return { left: '0%', width: '100%' };
  return {
    left: `${((band.start - shape.from) / span) * 100}%`,
    width: `${Math.max(1, ((band.end - band.start) / span) * 100)}%`,
  };
}

/** A grid hour as a short clock label: 9 → "9 AM", 14.5 → "2:30 PM". */
export function hourLabel(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const whole = Math.floor(wrapped);
  const minutes = Math.round((wrapped - whole) * 60);
  const suffix = whole < 12 ? 'AM' : 'PM';
  const clock = whole % 12 === 0 ? 12 : whole % 12;
  return minutes ? `${clock}:${String(minutes).padStart(2, '0')} ${suffix}` : `${clock} ${suffix}`;
}

/** "2h 30m", "45m", "3h" — a span of grid hours, said the way the app says it. */
export function spanLabel(hours: number): string {
  const total = Math.round(hours * 60);
  const whole = Math.floor(total / 60);
  const minutes = total % 60;
  if (!whole) return `${minutes}m`;
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}
