/**
 * Turning stored values into something readable.
 *
 * The rule throughout: never invent precision the data does not have, and
 * never show a zero where "nothing yet" is the truth.
 */
import { LEVEL_XP_STEP } from '@/services/constants';

// --------------------------------------------------------------------------
// Levels
// --------------------------------------------------------------------------
export interface LevelBreakdown {
  level: number;
  xpInLevel: number;
  xpRequired: number;
  /** 0-100. */
  percent: number;
}

/**
 * Break a lifetime XP total into its level and progress within it.
 *
 * Level N costs N * 100 XP, forever — there is no cap. This mirrors
 * `level_for_total_xp` in backend/tracking/xp.py, and the two must agree: the
 * backend's answer is authoritative and this exists only so a bar can move
 * before the round trip lands.
 */
export function levelForTotalXp(totalXp: number): LevelBreakdown {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp || 0));
  let needed = LEVEL_XP_STEP;

  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = level * LEVEL_XP_STEP;
  }

  return {
    level,
    xpInLevel: remaining,
    xpRequired: needed,
    percent: needed > 0 ? (remaining / needed) * 100 : 0,
  };
}

// --------------------------------------------------------------------------
// Time
// --------------------------------------------------------------------------
/** Seconds as "1h 24m", "24m", or "45s". */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

/**
 * Minutes as "1h 20m", "45m", or "2h".
 *
 * `duration` above says "0s" for nothing, which is right for a stopwatch and
 * wrong for a figure whose unit is minutes — the report card's focus row reads
 * "0m / 90m focused" the day before anything has been tracked.
 */
export function minutes(value: number): string {
  const total = Math.max(0, Math.round(value || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${rest}m`;
}

/** Seconds as "01:24:03" or "24:03" — for a running timer. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

// --------------------------------------------------------------------------
// Numbers
// --------------------------------------------------------------------------
/** 5928 as "5,928". */
export function number(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value || 0));
}

/** 3.5 as "4%". */
export function percent(value: number): string {
  return `${Math.round(value || 0)}%`;
}
