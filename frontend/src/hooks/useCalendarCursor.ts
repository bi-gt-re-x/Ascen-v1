/**
 * The day the calendar is looking at, shared by all three views.
 *
 * The three views were three panes of one page and became three routes, and
 * each of them kept its own idea of where the reader was: the Day view read
 * `?date=` from the URL, the Week view held `useState(weekOf(new Date()))` and
 * the Month view held `useState(new Date())`. Two of those start at today and
 * stay wherever they are pushed to, and none of them could see the others.
 *
 * So the one gesture a three-view calendar exists for — look at this closer,
 * pull back from this — threw the reader's place away every time. Page forward
 * to the week of 3 November and press Month: this month. Pick the 14th in the
 * month grid and press Day: today. The switcher was a way of changing the
 * subject rather than the magnification.
 *
 * There is one cursor now and it lives in the URL, which is the only place all
 * three views can see and the only place that survives a reload, a bookmark or
 * a link to somebody else. `?date=` was already the Day view's; this is that
 * parameter promoted to the calendar's.
 *
 * ## What the parameter means
 *
 * **A day, never a week or a month.** The Week view shows the week containing
 * it and the Month view shows that month with that day selected, so one field
 * says where the reader is at all three magnifications and no view has to
 * translate another's units. It also means the day survives a round trip:
 * looking at Wednesday, stepping out to the week and back in lands on
 * Wednesday, not on the Monday the week happens to open with.
 *
 * **Absent means today.** A bare `/calendar/week` is the current week, and
 * arriving is not a navigation — nothing is written until the reader actually
 * moves. So the plain URL stays plain, and stays right tomorrow.
 *
 * ## Why a push and not a replace
 *
 * Stepping writes a history entry, so Back undoes it. The alternative — one
 * entry the arrows keep overwriting — means pressing Back after moving a few
 * weeks does not return to the week you started on, it leaves the calendar
 * altogether, which is the one thing Back should never do on a page whose
 * whole content is a date. The cost is that holding the next arrow fills the
 * history; that is the same trade every calendar on the web makes, and the
 * cheaper mistake of the two.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dates } from '@/utils';

export interface CalendarCursor {
  /** Local midnight on the day in the URL, or on today when there is none. */
  date: Date;
  /** The same day as `YYYY-MM-DD`. */
  iso: string;
  /** True while the URL says nothing and the cursor is standing on today. */
  isDefault: boolean;
  /** Move the calendar to a day. A no-op when it is already on it. */
  goTo: (date: Date) => void;
}

/** Local midnight, so two cursors on the same day are the same instant. */
function midnight(date: Date): Date {
  const at = new Date(date);
  at.setHours(0, 0, 0, 0);
  return at;
}

export function useCalendarCursor(): CalendarCursor {
  const [params, setParams] = useSearchParams();
  const asked = params.get('date');

  /* A `?date=` that is not a date is treated as no date at all rather than as
     an error: this is a hand-editable field in a URL bar, and the worst it
     should ever do is show today. */
  const date = useMemo(() => {
    if (!asked) return midnight(new Date());
    const at = dates.fromIsoDate(asked);
    return Number.isNaN(at.getTime()) ? midnight(new Date()) : midnight(at);
  }, [asked]);

  const iso = dates.isoDate(date);

  const goTo = useCallback(
    (to: Date) => {
      const next = dates.isoDate(to);
      if (next === iso) return;
      /* Rebuilt from the live params rather than from a captured copy, so a
         `?task=` the search put here — the Day view reads one — is carried
         across instead of being dropped by the step that follows it. */
      setParams((current) => {
        const draft = new URLSearchParams(current);
        draft.set('date', next);
        return draft;
      });
    },
    [iso, setParams],
  );

  return { date, iso, isDefault: !asked, goTo };
}
