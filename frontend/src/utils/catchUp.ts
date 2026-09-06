/**
 * The days the dashboard has not been told about.
 *
 * ## The gap this closes
 *
 * Focus time is only ever recorded by a timer that was running, which means
 * the app knows about the work somebody remembered to press start for and
 * nothing else. Two hours at a desk with the tab shut is two hours that never
 * happened as far as consistency, the focus score, the growth series and every
 * "days you worked" count in the app are concerned — and those are the figures
 * the analytics page is built out of. An account that works hard and tracks
 * badly reads, on every one of them, as an account that does not work.
 *
 * So on the first visit of a day the dashboard asks, once, about the days
 * since the last one. What comes back goes into `focus_days` beside the timed
 * hours (services/focus `logDay`) and is thereafter indistinguishable from
 * them, which is the point: the record should be what happened, not what was
 * measured.
 *
 * ## Why this is a function and not a component
 *
 * "Which days" is the whole decision and it is made of four rules that
 * interact — the last visit, the window, what is already recorded, and today.
 * Written inline it would be four conditions inside a `useMemo` inside a
 * dialog, testable only by rendering a dashboard. Here it is a list in and a
 * list out.
 *
 * ## The four rules
 *
 * **Never today.** Today is not over and the timer is still the right way to
 * record it. The prompt only ever looks backwards.
 *
 * **Never before the last visit.** The reader was here on that day and every
 * day since is what they have not been asked about. Days before it were asked
 * about at the time, and asking again would be the app forgetting rather than
 * the reader.
 *
 * **Never more than `CATCHUP_WINDOW_DAYS` back.** Somebody returning after
 * three months does not want ninety rows, and would not remember them if they
 * did. A week is the longest stretch anybody can reconstruct honestly, and an
 * answer that is a guess is worse in the record than a gap.
 *
 * **Never a day that already has focus on it.** A day with tracked time was
 * not missed. This is the rule that keeps the prompt off the back of the
 * people who already use the timer — for them it should almost never appear,
 * and if it never appears at all that is the feature working.
 *
 * A day the reader is asked about and does not fill in is simply not logged.
 * The prompt is an offer and not a debt: `catchup_seen_on` moves to today
 * whether or not anything was entered, so nothing is asked twice.
 */
import { addDays, formatDate, fromIsoDate, isoDate } from './dates';

/** The furthest back the prompt will ever ask. See the note above. */
export const CATCHUP_WINDOW_DAYS = 7;

/** One row of the prompt: a day, named three ways because one is not enough. */
export interface CatchUpDay {
  iso: string;
  /**
   * Days back from today; 1 is yesterday.
   *
   * The reason all three of these travel together is that no single one of
   * them lands. "3 days ago" is how the reader holds it and is useless for
   * checking; "Wednesday" is what they will actually remember doing and is
   * ambiguous past a week; the date is exact and means nothing on its own.
   * Together they identify a day without the reader having to count.
   */
  ago: number;
  /** 'Wednesday'. */
  weekday: string;
  /** 'August 26'. */
  date: string;
}

export interface CatchUpInput {
  /** Today, ISO. Passed rather than read so this stays a pure function. */
  today: string;
  /** The last day the prompt was put, ISO, or '' for never. */
  seenOn: string;
  /** ISO days that already hold focus time. Days with zero do not count. */
  logged: ReadonlySet<string>;
}

/** Whether a string is a date this can reason about at all. */
function isIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * The days to ask about, most recent first.
 *
 * Empty on the first visit an account ever makes (`seenOn` is ''), on a second
 * visit the same day, and whenever the gap holds nothing that is not already
 * recorded. The caller stamps `catchup_seen_on` in every one of those cases —
 * see components/Dashboard/CatchUp — so "nothing to ask" and "asked" leave the
 * account in the same state.
 */
export function catchUpDays({ today, seenOn, logged }: CatchUpInput): CatchUpDay[] {
  if (!isIso(today) || !isIso(seenOn)) return [];
  // Already asked today, or a clock that has gone backwards — a stored date in
  // the future is not a gap, and treating it as one would ask about days that
  // have not happened.
  if (seenOn >= today) return [];

  const now = fromIsoDate(today);
  const floor = isoDate(addDays(now, -CATCHUP_WINDOW_DAYS));
  const from = seenOn > floor ? seenOn : floor;

  const days: CatchUpDay[] = [];
  for (let ago = 1; ago <= CATCHUP_WINDOW_DAYS; ago += 1) {
    const when = addDays(now, -ago);
    const iso = isoDate(when);
    if (iso < from) break;
    if (logged.has(iso)) continue;
    days.push({
      iso,
      ago,
      weekday: formatDate(when, { weekday: 'long' }),
      date: formatDate(when, { month: 'long', day: 'numeric' }),
    });
  }
  return days;
}

/** 'Yesterday', '3 days ago' — the phrase, so the dialog does not build it. */
export function agoLabel(ago: number): string {
  if (ago <= 1) return 'Yesterday';
  return `${ago} days ago`;
}
