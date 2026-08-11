/**
 * Which colour every block on one week gets, decided once for the whole week.
 *
 * `utils/eventPalette` says what a thing's colour *means* — a subject's family,
 * an event's own. That is the right answer for one block and the wrong one for
 * a week: file five things under Mathematics and the grid draws five identical
 * indigo rectangles, and a reader looking for one of them has to read all five.
 *
 * So the meaning is a *preference*, not a verdict. This plans the week: every
 * distinct thing on it gets its own family where the palette has one to give,
 * and two things share only when all twelve are already spoken for. Nothing on
 * a week is the same colour as its neighbour until the week has thirteen things
 * on it, which is the point at which sharing is not a choice.
 *
 * **A recurrence is one thing, not five.** Every Monday's stand-up is one
 * entry here and gets one colour, which every occurrence of it wears — the
 * alternative is a repeat that changes colour down the week, which reads as
 * five unrelated blocks and defeats the reason anybody made it a repeat.
 * Recurrences are also planned *first*, so a series never has its colour taken
 * by a one-off: that is what "except previously already recurring tasks" comes
 * to. See `Entry.repeats`.
 *
 * **The plan is per week, and that is a real cost.** A task can be teal this
 * week and green the next, because what it is sharing a grid with is different.
 * The alternative — a colour fixed to the task forever — is what the account
 * had before this file, and it is what produced the five identical rectangles.
 * Within a week the plan is entirely deterministic: same blocks in, same
 * colours out, however many times it is recomputed, so nothing flickers and a
 * refresh changes nothing.
 *
 * The Day view plans the same seven days as the Week view rather than its one,
 * so a task does not change colour when the reader switches views.
 */
import { monthKey, type CalendarData } from './calendarStore';
import { familyForSection } from './calendarColors';
import {
  FAMILIES,
  familyForSubject,
  familyGap,
  type Family,
} from './eventPalette';
import { taskCalendarDay } from './calendarIntensity';
import type { Task } from '@/types';

/** What one distinct thing on the week needs, before a family is chosen. */
interface Entry {
  key: string;
  /** The family it would have if nothing else were on the calendar. */
  preferred: Family;
  /** True when it lands on the week more than once. Planned first. */
  repeats: boolean;
  /** Earliest appearance, so the order is the reader's own reading order. */
  at: string;
}

/** "18:40" for the time-of-day part of a stored timestamp. */
function hmOf(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * What makes two blocks the same thing.
 *
 * A task has no recurrence column, so a series is what looks like one: the same
 * name at the same times on different days — the rule `useBlockActions` already
 * groups by, and it has to stay the same rule or a repeat would be one thing
 * to the edit dialog and five to the palette.
 */
export function taskFamilyKey(task: Task): string {
  return `task:${task.title || ''}|${hmOf(task.created_at)}|${hmOf(task.due_date)}`;
}

/** The same, for an event: name and both times, as `isSameEvent` compares them. */
export function eventFamilyKey(name: string, startTime: string, endTime: string): string {
  return `event:${name}|${startTime}|${endTime}`;
}

/** The seven ISO days of the week containing `iso`, Monday first. */
export function weekOf(iso: string): string[] {
  const date = new Date(`${iso}T00:00:00`);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: 7 }, (_, day) => {
    const at = new Date(date);
    at.setDate(at.getDate() + day);
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  });
}

/**
 * The colour of everything on these days, keyed by `taskFamilyKey` /
 * `eventFamilyKey`.
 *
 * Greedy, in one pass: recurrences first and then one-offs in start order, each
 * taking its preferred family when it is free. When it is not, it takes the
 * free family that sits furthest from everything already used — so the week
 * spreads across the palette instead of walking round it — and only once all
 * twelve are used does anything share, at which point the least-used family
 * wins and ties go to the palette's own order. Every step is decided by a rule,
 * so the same week always plans the same way.
 */
export function planFamilies(
  isos: string[],
  tasks: Task[],
  data: CalendarData,
): Map<string, Family> {
  const days = new Set(isos.map(monthKey));
  const entries = new Map<string, Entry>();

  const note = (key: string, preferred: Family, at: string) => {
    const existing = entries.get(key);
    if (existing) {
      existing.repeats = true;
      if (at < existing.at) existing.at = at;
      return;
    }
    entries.set(key, { key, preferred, repeats: false, at });
  };

  tasks.forEach((task) => {
    const day = taskCalendarDay(task);
    if (!day || !days.has(day)) return;
    note(taskFamilyKey(task), familyForSubject(task.subject), String(task.created_at || ''));
  });

  isos.forEach((iso) => {
    data[monthKey(iso)]?.timestamps.forEach((section) => {
      if (section.isDashboardTask || !section.startTime || !section.endTime) return;
      note(
        eventFamilyKey(section.task || 'Event', section.startTime, section.endTime),
        familyForSection(section),
        `${iso}T${section.startTime}`,
      );
    });
  });

  const order = [...entries.values()].sort((a, b) => {
    if (a.repeats !== b.repeats) return a.repeats ? -1 : 1;
    return a.at.localeCompare(b.at) || a.key.localeCompare(b.key);
  });

  const plan = new Map<string, Family>();
  const used = new Map<Family, number>();
  const take = (entry: Entry, family: Family) => {
    plan.set(entry.key, family);
    used.set(family, (used.get(family) ?? 0) + 1);
  };

  order.forEach((entry) => {
    if (!used.has(entry.preferred)) {
      take(entry, entry.preferred);
      return;
    }

    const free = FAMILIES.filter((family) => !used.has(family));
    if (free.length > 0) {
      // The one furthest from everything already on the week, so the colours
      // spread out rather than crowding one corner of the wheel.
      let best: Family = free[0]!;
      let bestGap = -1;
      free.forEach((family) => {
        const gap = familyGap(family, used.keys());
        if (gap > bestGap) {
          bestGap = gap;
          best = family;
        }
      });
      take(entry, best);
      return;
    }

    // Thirteen or more distinct things on one week: sharing is no longer a
    // choice. The family carrying the fewest takes one more, and the palette's
    // own order breaks the tie — so the duplicates are spread rather than piled
    // onto whichever colour happened to be first.
    let best: Family = FAMILIES[0]!;
    let fewest = Infinity;
    FAMILIES.forEach((family) => {
      const count = used.get(family) ?? 0;
      if (count < fewest) {
        fewest = count;
        best = family;
      }
    });
    take(entry, best);
  });

  return plan;
}
