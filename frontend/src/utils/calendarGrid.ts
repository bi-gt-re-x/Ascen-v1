/**
 * The time grid: what a day's blocks are, and where they sit.
 *
 * The Week view and the Day view are the same grid — seven columns or one —
 * so this is the arithmetic both of them share, with no React in it: given a
 * date, the account's tasks and the event store, it returns the blocks that
 * day is carrying, already positioned.
 *
 * **The day runs 6 AM to 5 AM.** Hours after midnight are counted on past 24
 * (29 is 5 AM the next morning), which is what keeps an evening block that
 * runs past midnight in one piece on the column it started on instead of
 * breaking in two across the boundary.
 *
 * Ported from the rendering half of calendar-week.js.
 */
import { eventBlockColors, type BlockColors } from './calendarColors';
import { isoOf, monthKey, type CalendarData } from './calendarStore';
import type { Task } from '@/types';

// --------------------------------------------------------------------------
// Geometry
// --------------------------------------------------------------------------
export const START_HOUR = 6;
/** 5 AM the next day. */
export const END_HOUR = 29;
/**
 * Pixels per hour. The stylesheets are sized to match.
 *
 * 48, which is the scale the design draws: seventeen labels from 6 AM to 10 PM
 * across about 800px of grid. It was 141, nearly three times that, and the
 * consequence was not a roomier grid but a much smaller one — four hours on
 * screen at a time out of a day the reader is trying to see the shape of.
 */
export const HOUR_H = 48;
/** The floor for a very short block, so its name is not clipped to nothing. */
const COMPACT_MIN_H = 18;
/** At or under this many minutes a block drops to its one-row layout. */
const COMPACT_MINUTES = 20;
/**
 * Under this many minutes a block is too short for all three of its lines.
 *
 * At 48px an hour a 45-minute block is 36 pixels, which holds a title and one
 * line under it. The XP is what goes: the time is what a calendar is for, and
 * a block that cannot say when it runs is not worth drawing.
 */
const SNUG_MINUTES = 60;

export const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_H;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --------------------------------------------------------------------------
// Labels
// --------------------------------------------------------------------------
/** "6 AM" for a grid hour, counting 24–29 back into the small hours. */
export function hourLabel(hour: number): string {
  const normalised = ((hour % 24) + 24) % 24;
  const suffix = normalised < 12 ? 'AM' : 'PM';
  const twelve = normalised % 12 || 12;
  return `${twelve} ${suffix}`;
}

/** "6:40 PM". */
export function timeLabel(date: Date): string {
  const hours = date.getHours();
  const suffix = hours < 12 ? 'AM' : 'PM';
  const twelve = hours % 12 || 12;
  return `${twelve}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/** "6 PM" on the hour, "6:40 PM" otherwise — the compact layout's form. */
export function timeLabelShort(date: Date): string {
  const minutes = date.getMinutes();
  const hours = date.getHours();
  const suffix = hours < 12 ? 'AM' : 'PM';
  const twelve = hours % 12 || 12;
  return minutes
    ? `${twelve}:${String(minutes).padStart(2, '0')} ${suffix}`
    : `${twelve} ${suffix}`;
}

/** "Jul 15, 6:40 PM" — a task block's due date. */
export function dueLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${timeLabel(date)}`;
}

/** "Jul 15 6:40 PM" — a completion that happened on another day. */
export function shortDateTime(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()} ${timeLabel(date)}`;
}

/** "6:40 PM" from a stored "18:40". */
export function hmLabel(hm: string): string {
  const [hours = 0, minutes = 0] = String(hm).split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const twelve = hours % 12 || 12;
  return `${twelve}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** As above, dropping ":00" on the hour. */
export function hmLabelShort(hm: string): string {
  const [hours = 0, minutes = 0] = String(hm).split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const twelve = hours % 12 || 12;
  return minutes ? `${twelve}:${String(minutes).padStart(2, '0')} ${suffix}` : `${twelve} ${suffix}`;
}

/** "18:40" as 18.667 — hours, for placing a block. */
export function hmToHour(hm: string): number {
  const [hours = 0, minutes = 0] = String(hm).split(':').map(Number);
  return hours + minutes / 60;
}

/** Minutes past midnight as "18:40". */
export function minutesToHm(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// --------------------------------------------------------------------------
// Pixels ↔ time — what dragging on the grid is made of
// --------------------------------------------------------------------------
/** One five-minute step, in pixels. Everything a drag produces lands on one. */
export const MIN_STEP_PX = HOUR_H / 12;

/**
 * The gap a block is drawn short by, so neighbours do not touch.
 *
 * `layOut` above takes 4px off every block's height. A drag has to work in the
 * **true** span — the rendered height plus this — or a drop lands a minute or
 * two inside its neighbour and the grid meets it with the overlap dialog the
 * moment it redraws.
 */
export const BLOCK_GAP = 4;

/** Round a pixel offset to the nearest five minutes. */
export function snapPx(px: number): number {
  return Math.round(px / MIN_STEP_PX) * MIN_STEP_PX;
}

/**
 * Pixels down a column as minutes past midnight, snapped to five.
 *
 * The column starts at START_HOUR, so pixels past the 18-hour mark wrap into
 * the small hours — 6 AM plus 19 hours is 1 AM, not 25 o'clock.
 */
export function pxToClockMinutes(px: number): number {
  const gridMinutes = START_HOUR * 60 + (px / HOUR_H) * 60;
  const snapped = Math.round(gridMinutes / 5) * 5;
  return ((snapped % 1440) + 1440) % 1440;
}

/**
 * Pixels down a column as the real moment they stand for.
 *
 * Unlike `pxToClockMinutes` this keeps the date, which is what an overnight
 * task needs: 11 PM plus three hours is 2 AM *tomorrow*, and a task whose
 * due_date says otherwise is a task on the wrong day.
 */
export function pxToDate(iso: string, px: number): Date {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number);
  const at = new Date(year, month - 1, day, START_HOUR, 0, 0, 0);
  const minutes = Math.round(((px / HOUR_H) * 60) / 5) * 5;
  return new Date(at.getTime() + minutes * 60000);
}

/** "2026-08-04T09:15:00" — the shape the task API stores times in. */
export function isoStamp(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  );
}

// --------------------------------------------------------------------------
// Blocks
// --------------------------------------------------------------------------
interface BlockBase {
  /** Grid hours, 6…29. */
  start: number;
  end: number;
  /** Filled in by `layOut`. */
  top: number;
  height: number;
  compact: boolean;
  /** Room for a title and one line under it, but not for all three. */
  snug: boolean;
}

export interface TaskBlock extends BlockBase {
  kind: 'task';
  id: string;
  title: string;
  xp: number;
  done: boolean;
  priority: string;
  startDT: Date;
  dueDT: Date | null;
  completedDT: Date | null;
  /** Set when the task runs past this column: the day it continues on. */
  contDT: Date | null;
  /** True when the task began before this column — this is its tail. */
  cont: boolean;
}

export interface EventBlock extends BlockBase {
  kind: 'event';
  name: string;
  startHM: string;
  endHM: string;
  colors: BlockColors;
}

export type Block = TaskBlock | EventBlock;

export function blockLabel(block: Block): string {
  return block.kind === 'event' ? block.name : block.title;
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The account's tasks that fall in this column, sized by their real span.
 *
 * A task runs from when it was created to when it is due, shrinking to the
 * completion time if it was finished early — but never growing past the due
 * time when it was finished late, because a block is what was scheduled, not
 * how long it overran. Only tasks placed on the calendar are here at all: a
 * dashboard to-do is a list item, not an appointment.
 */
export function dayTaskBlocks(iso: string, tasks: Task[]): TaskBlock[] {
  const gridStart = new Date(`${iso}T00:00:00`);
  gridStart.setHours(START_HOUR, 0, 0, 0);
  const gridEnd = new Date(gridStart.getTime() + (END_HOUR - START_HOUR) * 3_600_000);

  const out: TaskBlock[] = [];

  tasks.forEach((task) => {
    if (!isCalendarPlaced(task)) return;

    const startDT = toDate(task.created_at) || toDate(task.due_date);
    if (!startDT) return;

    const dueDT = toDate(task.due_date);
    const completedDT = task.status === 'done' ? toDate(task.completed_at) : null;

    let endDT = completedDT || dueDT || new Date(startDT.getTime() + 3_600_000);
    if (dueDT && endDT > dueDT) endDT = dueDT;
    if (endDT <= startDT) endDT = new Date(startDT.getTime() + 3_600_000);
    if (endDT <= gridStart || startDT >= gridEnd) return;

    const hourInColumn = (date: Date) =>
      START_HOUR + (date.getTime() - gridStart.getTime()) / 3_600_000;
    const clamp = (hour: number) => Math.max(START_HOUR, Math.min(hour, END_HOUR));

    out.push({
      kind: 'task',
      id: String(task.id),
      start: clamp(startDT < gridStart ? START_HOUR : hourInColumn(startDT)),
      end: clamp(endDT > gridEnd ? END_HOUR : hourInColumn(endDT)),
      top: 0,
      height: 0,
      compact: false,
      snug: false,
      title: task.title || 'Task',
      xp: Number(task.xp_value) || 0,
      done: task.status === 'done',
      priority: String(task.priority || '').toLowerCase(),
      startDT,
      dueDT,
      completedDT,
      contDT: endDT > gridEnd ? new Date(gridStart.getTime() + 86_400_000) : null,
      cont: startDT < gridStart,
    });
  });

  return out.sort((a, b) => a.start - b.start);
}

/**
 * Only a task placed on the calendar may be drawn on one.
 *
 * The flag arrives as a boolean from the API and as `1` or `"true"` from
 * older rows, so it is compared loosely on purpose — the alternative is a
 * calendar that silently loses everything created before the column was
 * normalised.
 */
export function isCalendarPlaced(task: Pick<Task, 'show_on_calendar'>): boolean {
  const value = task.show_on_calendar as unknown;
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** The events stored on this day, sized by their times. */
export function dayEventBlocks(iso: string, data: CalendarData): EventBlock[] {
  const day = data[monthKey(iso)];
  if (!day?.timestamps) return [];

  const clamp = (hour: number) => Math.max(START_HOUR, Math.min(hour, END_HOUR));
  const out: EventBlock[] = [];

  day.timestamps.forEach((section) => {
    if (section.isDashboardTask) return;
    if (!section.startTime || !section.endTime) return;

    // Both ends are lifted past midnight together, so an event that starts at
    // 10:35 PM and ends at 12:05 AM stays one block on this column.
    let startHour = hmToHour(section.startTime);
    if (startHour < START_HOUR) startHour += 24;
    let endHour = hmToHour(section.endTime);
    if (endHour < START_HOUR) endHour += 24;
    if (endHour <= startHour) endHour = startHour + 1;

    out.push({
      kind: 'event',
      start: clamp(startHour),
      end: clamp(endHour),
      top: 0,
      height: 0,
      compact: false,
      snug: false,
      name: section.task || 'Event',
      startHM: section.startTime,
      endHM: section.endTime,
      colors: eventBlockColors(section),
    });
  });

  return out;
}

/**
 * Position a day's blocks, and say whether two of them clash.
 *
 * Everything keeps full width and layers where it overlaps, longer blocks
 * beneath so a short one is never buried. The clash is reported rather than
 * drawn around: the views stop the reader and make them delete one side,
 * because two things booked at once is not something the grid should quietly
 * paint over.
 */
export function layOut(blocks: Block[]): { blocks: Block[]; conflict: [Block, Block] | null } {
  const positioned = blocks.map((block) => {
    const minutes = (block.end - block.start) * 60;
    const height = Math.max(2, (block.end - block.start) * HOUR_H - 4);
    return {
      ...block,
      top: (block.start - START_HOUR) * HOUR_H,
      height: minutes <= COMPACT_MINUTES ? Math.max(height, COMPACT_MIN_H) : height,
      compact: minutes <= COMPACT_MINUTES,
      snug: minutes > COMPACT_MINUTES && minutes < SNUG_MINUTES,
    };
  });

  // A completed task is a record of what happened, not a claim on the time,
  // so it cannot clash with anything.
  const live = positioned.filter(
    (block) => block.kind === 'event' || !block.done,
  );
  let conflict: [Block, Block] | null = null;
  for (let i = 0; i < live.length && !conflict; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (a && b && overlaps(a, b)) {
        conflict = [a, b];
        break;
      }
    }
  }

  // Longer blocks first, so they paint beneath; ties keep the earlier start
  // underneath, which staggers the titles rather than stacking them.
  positioned.sort((a, b) =>
    a.height !== b.height ? b.height - a.height : a.top - b.top,
  );

  return { blocks: positioned, conflict };
}

/** A real overlap, not two blocks merely touching at 2–3 and 3–4. */
function overlaps(a: Block, b: Block): boolean {
  const EPSILON = 0.001;
  return Math.min(a.end, b.end) - Math.max(a.start, b.start) > EPSILON;
}

// --------------------------------------------------------------------------
// The clock
// --------------------------------------------------------------------------
/** Where "now" sits on the grid, or null when it is outside the window. */
export function nowOffset(now: Date = new Date()): number | null {
  let hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  if (hour < START_HOUR) hour += 24;
  if (hour > END_HOUR) return null;
  return (hour - START_HOUR) * HOUR_H;
}

/** "6:40 PM" for the label beside the now line. */
export function nowLabel(now: Date = new Date()): string {
  return timeLabel(now);
}

/** Every hour the grid draws a label for. */
export function gridHours(): number[] {
  const hours: number[] = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) hours.push(hour);
  return hours;
}

/** The seven ISO dates of the week a date falls in, Monday first. */
export function weekDays(monday: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    out.push(isoOf(`${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`));
  }
  return out;
}
