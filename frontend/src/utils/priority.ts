/**
 * How hard a task is, from what it is worth.
 *
 * XP is the only thing a reader ever sets — no dialog in the app asks for a
 * priority — so the band has to follow from it, and it has to follow the same
 * way everywhere. It did not: the calendar's dialog banded a new task at 33
 * and 66 while the day panel labelled the same task off the same numbers, and
 * the dashboard's dialog sent no priority at all, so a 90 XP task created
 * there was stored as "medium" and drawn on the grid in the medium colour.
 *
 * One rule, in one place, on the boundaries the reader was given:
 *
 *   10–39   Easy    (low)
 *   40–69   Medium
 *   70–100  Hard    (high)
 *
 * The lower bound of each band is the one that belongs to it — 40 is Medium,
 * not the top of Easy — because that is how a range written "40-70" reads.
 */
import type { TaskPriority } from '@/types';

/** The XP a task may be worth. The dialogs' sliders run between these. */
export const MIN_TASK_XP = 10;
export const MAX_TASK_XP = 100;

/** Where Easy becomes Medium, and Medium becomes Hard. */
export const MEDIUM_FROM = 40;
export const HARD_FROM = 70;

export function xpToPriority(xp: number): TaskPriority {
  if (xp >= HARD_FROM) return 'high';
  if (xp >= MEDIUM_FROM) return 'medium';
  return 'low';
}

/** The same three bands, as the words the cards print. */
export function xpToDifficulty(xp: number): 'High' | 'Medium' | 'Low' {
  const priority = xpToPriority(xp);
  return priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
}
