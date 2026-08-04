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
 * Colours are the one part that talks to the backend: `/api/get_event_colors`
 * is the list of hexes already handed out, and a new event's colour is posted
 * back so the next one can avoid it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { events as eventService } from '@/services';
import { generateDistinctColor } from '@/utils/calendarColors';
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

export function useCalendarStore(username: string | null): UseCalendarStore {
  const [data, setData] = useState<CalendarData>(() => loadCalendarData(username));
  const colorsInUse = useRef<string[]>([]);

  // A change of account is a different calendar, not the same one edited.
  useEffect(() => {
    setData(loadCalendarData(username));
  }, [username]);

  useEffect(() => {
    let live = true;
    void eventService.eventColors().then((result) => {
      if (live && result.success) colorsInUse.current = result.colors.slice();
    });
    return () => {
      live = false;
    };
  }, []);

  /** Every write goes through here, so nothing is saved without being shown. */
  const commit = useCallback(
    (next: CalendarData) => {
      saveCalendarData(username, next);
      setData(next);
    },
    [username],
  );

  const claimColor = useCallback(() => {
    const color = generateDistinctColor(colorsInUse.current);
    colorsInUse.current.push(color);
    void eventService.addEventColor(color).catch(() => {
      /* best effort: the next event may pick a nearer colour, nothing worse */
    });
    return color;
  }, []);

  const addEvent = useCallback(
    (dateKey: string, draft: EventDraft) => {
      const section: CalendarSection = {
        startTime: draft.startTime,
        endTime: draft.endTime,
        task: draft.name,
        recurrence: draft.recurrence,
        recurrenceDays: draft.recurrenceDays,
        xp: 10,
        color: claimColor(),
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
    [claimColor, commit, data],
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
