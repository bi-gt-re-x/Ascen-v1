/**
 * How a notification is dressed, and how long ago it arrived.
 *
 * Both halves are here rather than in either component because the panel and
 * the pop-ups have to agree: the same notification, in the bell and floating
 * over the page, must be the same colour and carry the same word. Two copies
 * of this table is how they stop agreeing.
 */
import type { NotificationChannel, NotificationTone } from '@/services/notifications';

/**
 * The word under the title, which is the channel said out loud.
 *
 * A reader who has turned one of these off in Settings needs to be able to
 * tell which switch a notification came from, and the switch is named after
 * the channel — see the Notifications section in pages/Settings.tsx.
 */
export const CHANNEL_NAMES: Record<NotificationChannel, string> = {
  tasks: 'Tasks',
  calendar: 'Calendar',
  analytics: 'Analytics',
  goals: 'Goals',
  streak: 'Streak',
  progress: 'Progress',
};

/**
 * What each tone is for, and it is deliberately not four shades of red.
 *
 * Only `urgent` is painted as a problem. `warn` is a fact about the plan,
 * `info` is a fact about the record, and `good` is the app's only way of
 * saying something went well — colouring all four as alarms is how a reader
 * learns that the bell is never worth opening.
 */
export const TONE_NAMES: Record<NotificationTone, string> = {
  urgent: 'Needs you',
  warn: 'Soon',
  info: 'For information',
  good: 'Good news',
};

/** "just now" / "12m ago" / "3h ago" / "Tuesday" / "14 Aug". */
export function ago(iso: string, now: Date = new Date()): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';

  const seconds = Math.max(0, Math.round((now.getTime() - when.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  // Past a day the exact hour has stopped being the useful part of the
  // answer, and a weekday is easier to place than "31h ago".
  if (seconds < 7 * 86_400) return when.toLocaleDateString(undefined, { weekday: 'long' });
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
