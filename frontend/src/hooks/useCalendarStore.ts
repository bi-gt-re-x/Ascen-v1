/**
 * The event store, as something a component can hold.
 *
 * `utils/calendarStore.ts` is the shape and the file format; this is the live
 * copy plus every way the views change it. Each mutation writes localStorage
 * and sets state from the same new object, so what is on screen and what is
 * saved cannot drift — the original kept a module-level `dateContent` that
 * every function reached into and then re-rendered by hand, which is exactly
 * the arrangement where they do.
 *
 * Colours are the one part that talks to the backend, and they are not this
 * file's arithmetic: `utils/colorRegistry` holds what is spoken for and hands
 * out the next one. What happens here is the two ends of that — every event in
 * the store declares its colour as taken, so a colour is held for exactly as
 * long as the event using it is on the calendar, and a new event claims one.
 *
 * ## The calendar is on the server now, and it was not before
 *
 * Every event any user of this app had ever made lived in their own browser's
 * localStorage and nowhere else — the views never called the backend, so a
 * cleared site-data was a deleted calendar, a second browser was an empty one,
 * and nobody could take a backup because the server had never seen it.
 *
 * `/api/calendar_store` holds it now, as the same object this file already
 * keeps. Three rules make the change safe on a database full of accounts whose
 * only copy is local:
 *
 *   * **localStorage is still written, every time.** It is the offline copy
 *     and the thing that paints the calendar on the first frame, before any
 *     request has landed. Nothing was taken away.
 *   * **The server never overwrites a local calendar with nothing.** An empty
 *     answer means "never uploaded" — true of every account before this — and
 *     is read as *migrate*, not as *empty*. The local copy goes up.
 *   * **Nothing is uploaded until the first read has come back.** Otherwise an
 *     edit made in the first second would push a partial local calendar over a
 *     good server one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Family } from '@/utils/eventPalette';
import {
  claimFamily,
  primeColorRegistry,
  reserveFamilies,
  resetLiveColors,
} from '@/utils/colorRegistry';
import { familyForSection } from '@/utils/calendarColors';
import { events as eventService } from '@/services';
import {
  isSameEvent,
  loadCalendarData,
  recurringDateKeys,
  matchesRecurrence,
  saveCalendarData,
  type CalendarData,
  type CalendarSection,
  type RecurrenceType,
} from '@/utils/calendarStore';

/** What the add / edit dialog comes back with. */
export interface EventDraft {
  name: string;
  /** "HH:MM", 24-hour. */
  startTime: string;
  endTime: string;
  recurrence: RecurrenceType;
  /** Days of the week (0–6) or days of the month (1–31), per `recurrence`. */
  recurrenceDays: number[];
}

/** Whether an edit or a delete touches one occurrence or the whole series. */
export type Scope = 'one' | 'all';

export interface UseCalendarStore {
  data: CalendarData;
  addEvent: (dateKey: string, draft: EventDraft) => void;
  editEvent: (
    dateKey: string,
    original: CalendarSection,
    draft: EventDraft,
    scope: Scope,
  ) => void;
  removeEvent: (dateKey: string, section: CalendarSection, scope: Scope) => void;
  /** Edit one entry in place — the day panel's inline name and time fields. */
  patchSection: (dateKey: string, index: number, patch: Partial<CalendarSection>) => void;
  /**
   * Give one occurrence new times, and possibly a new day. What dragging an
   * event around the grid comes to: the entry itself is carried across, so its
   * colour and everything else about it survives the move.
   */
  retimeSection: (
    fromKey: string,
    section: CalendarSection,
    toKey: string,
    startTime: string,
    endTime: string,
  ) => void;
  removeSection: (dateKey: string, index: number) => void;
  /** How many days this event also lands on. 0 when it is a one-off. */
  occurrenceCount: (section: CalendarSection) => number;
}

/** How long a burst of edits is collected before one upload. */
const SAVE_DEBOUNCE_MS = 700;

function isEmptyCalendar(data: CalendarData): boolean {
  return Object.values(data).every((day) => !day?.timestamps?.length && !day?.focus);
}

export function useCalendarStore(username: string | null): UseCalendarStore {
  // Seeded from localStorage rather than from nothing: the calendar has to be
  // on screen in the first frame, and the server's answer is a round trip away.
  const [data, setData] = useState<CalendarData>(() => loadCalendarData(username));

  /*
   * Whether the server's copy has been read yet.
   *
   * Uploads are held until it has. Without that, an edit made before the read
   * lands would push whatever this browser happens to hold — possibly an empty
   * calendar, on a machine that has never opened this account — over a good
   * copy on the server.
   */
  const synced = useRef(false);

  // A change of account is a different calendar, not the same one edited — and
  // a different set of colours held, so the live reservations start again.
  useEffect(() => {
    resetLiveColors();
    synced.current = false;
    setData(loadCalendarData(username));
  }, [username]);

  /*
   * Reconcile the browser's copy with the server's.
   *
   * Three cases, and only one of them writes:
   *
   *   * the server has a calendar — it wins, and is mirrored back into
   *     localStorage so the next first frame is right;
   *   * the server has nothing and this browser does — the account predates
   *     the endpoint, so the local copy is the only copy and goes up;
   *   * neither has anything — a new account. Nothing to do.
   *
   * A failed read leaves `synced` false, so uploads stay off and the calendar
   * behaves exactly as it did before any of this: local, and on screen.
   */
  useEffect(() => {
    if (!username) return;
    let live = true;

    void eventService.calendarStore().then((result) => {
      if (!live || !result.success) return;
      const remote = (result.data ?? {}) as CalendarData;
      const local = loadCalendarData(username);

      if (!isEmptyCalendar(remote)) {
        saveCalendarData(username, remote);
        setData(remote);
      } else if (!isEmptyCalendar(local)) {
        void eventService.saveCalendarStore(local as Record<string, unknown>);
      }
      synced.current = true;
    });

    return () => {
      live = false;
    };
  }, [username]);

  useEffect(() => {
    void primeColorRegistry();
  }, []);

  // Every family on the calendar is one a new event should keep away from, for
  // as long as the event wearing it is there. Declared from the store itself
  // rather than tracked through the mutations, so a family cannot be held by an
  // event that was deleted, or missed on one that arrived in another tab.
  useEffect(() => {
    const seen = new Set<Family>();
    Object.values(data).forEach((day) => {
      day.timestamps.forEach((section) => {
        if (!section.isDashboardTask) seen.add(familyForSection(section));
      });
    });
    reserveFamilies(seen);
  }, [data]);

  /*
   * The upload, debounced.
   *
   * `commit` runs on every keystroke of the day panel's inline name field, and
   * a PUT per keystroke would be one request per letter. localStorage is still
   * written synchronously in `commit` — the local copy is never behind — so
   * what this delays is only the server catching up.
   */
  const pending = useRef<number | null>(null);
  const unsaved = useRef<CalendarData | null>(null);

  const flush = useCallback(() => {
    if (pending.current !== null) {
      window.clearTimeout(pending.current);
      pending.current = null;
    }
    const next = unsaved.current;
    unsaved.current = null;
    if (next) void eventService.saveCalendarStore(next as Record<string, unknown>);
  }, []);

  const upload = useCallback(
    (next: CalendarData) => {
      if (!username || !synced.current) return;
      unsaved.current = next;
      if (pending.current !== null) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => {
        pending.current = null;
        const latest = unsaved.current;
        unsaved.current = null;
        if (latest) void eventService.saveCalendarStore(latest as Record<string, unknown>);
      }, SAVE_DEBOUNCE_MS);
    },
    [username],
  );

  /*
   * Leaving the page inside the debounce window must not drop the upload.
   *
   * Cancelling the timer would not lose data — localStorage was written
   * synchronously — but it would leave the server a version behind until the
   * next edit, which is the state this whole change exists to get out of. So
   * the pending write is sent rather than cancelled, both on unmount and when
   * the tab is hidden, which is the one a phone actually takes.
   */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  /** Every write goes through here, so nothing is saved without being shown. */
  const commit = useCallback(
    (next: CalendarData) => {
      saveCalendarData(username, next);
      setData(next);
      upload(next);
    },
    [upload, username],
  );

  const addEvent = useCallback(
    (dateKey: string, draft: EventDraft) => {
      const section: CalendarSection = {
        startTime: draft.startTime,
        endTime: draft.endTime,
        task: draft.name,
        recurrence: draft.recurrence,
        recurrenceDays: draft.recurrenceDays,
        xp: 10,
        family: claimFamily(),
      };

      const next: CalendarData = { ...data };
      const write = (key: string) => {
        const day = next[key] ?? { timestamps: [] };
        // A recurrence that is already there is not written twice: the same
        // pattern applied to an overlapping range would otherwise stack copies.
        if (day.timestamps.some((existing) => isSameEvent(existing, section))) return;
        next[key] = { ...day, timestamps: [...day.timestamps, { ...section }] };
      };

      // The chosen day gets the event only if the pattern would have chosen it
      // too — asking for "Mondays" from a Thursday means Mondays, not Mondays
      // and this one Thursday.
      if (matchesRecurrence(dateKey, draft.recurrence, draft.recurrenceDays)) {
        write(dateKey);
      }
      recurringDateKeys(dateKey, draft.recurrence, draft.recurrenceDays).forEach(write);

      commit(next);
    },
    [commit, data],
  );

  const editEvent = useCallback(
    (dateKey: string, original: CalendarSection, draft: EventDraft, scope: Scope) => {
      const next: CalendarData = { ...data };
      const apply = (key: string) => {
        const day = next[key];
        if (!day) return;
        let touched = false;
        const timestamps = day.timestamps.map((section) => {
          if (!isSameEvent(section, original)) return section;
          touched = true;
          return {
            ...section,
            task: draft.name,
            startTime: draft.startTime,
            endTime: draft.endTime,
          };
        });
        if (touched) next[key] = { ...day, timestamps };
      };

      if (scope === 'one') apply(dateKey);
      else Object.keys(next).forEach(apply);

      commit(next);
    },
    [commit, data],
  );

  const removeEvent = useCallback(
    (dateKey: string, section: CalendarSection, scope: Scope) => {
      const next: CalendarData = { ...data };
      const drop = (key: string) => {
        const day = next[key];
        if (!day) return;
        const timestamps = day.timestamps.filter((entry) => !isSameEvent(entry, section));
        if (timestamps.length !== day.timestamps.length) {
          next[key] = { ...day, timestamps };
        }
      };

      if (scope === 'one') drop(dateKey);
      else Object.keys(next).forEach(drop);

      commit(next);
    },
    [commit, data],
  );

  const patchSection = useCallback(
    (dateKey: string, index: number, patch: Partial<CalendarSection>) => {
      const day = data[dateKey];
      if (!day?.timestamps[index]) return;
      const timestamps = day.timestamps.map((section, at) =>
        at === index ? { ...section, ...patch } : section,
      );
      commit({ ...data, [dateKey]: { ...day, timestamps } });
    },
    [commit, data],
  );

  const removeSection = useCallback(
    (dateKey: string, index: number) => {
      const day = data[dateKey];
      if (!day) return;
      commit({
        ...data,
        [dateKey]: {
          ...day,
          timestamps: day.timestamps.filter((_, at) => at !== index),
        },
      });
    },
    [commit, data],
  );

  const retimeSection = useCallback(
    (fromKey: string, section: CalendarSection, toKey: string, startTime: string, endTime: string) => {
      const from = data[fromKey];
      const index = from?.timestamps.findIndex((entry) => entry === section) ?? -1;
      if (!from || index < 0) return;

      // Everything else about the entry travels with it — its colour, its
      // subtasks, whatever the month view has hung on it. Only the two times
      // change, and possibly the day it is filed under.
      const moved: CalendarSection = { ...section, startTime, endTime };

      if (fromKey === toKey) {
        commit({
          ...data,
          [fromKey]: {
            ...from,
            timestamps: from.timestamps.map((entry, at) => (at === index ? moved : entry)),
          },
        });
        return;
      }

      const to = data[toKey] ?? { timestamps: [] };
      commit({
        ...data,
        [fromKey]: { ...from, timestamps: from.timestamps.filter((_, at) => at !== index) },
        [toKey]: { ...to, timestamps: [...to.timestamps, moved] },
      });
    },
    [commit, data],
  );

  const occurrenceCount = useCallback(
    (section: CalendarSection) =>
      Object.values(data).reduce(
        (count, day) =>
          count + day.timestamps.filter((entry) => isSameEvent(entry, section)).length,
        0,
      ),
    [data],
  );

  return {
    data,
    addEvent,
    editEvent,
    removeEvent,
    patchSection,
    retimeSection,
    removeSection,
    occurrenceCount,
  };
}
