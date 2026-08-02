/**
 * The one-line note on a day — "Focus" — shared by all three calendar views.
 *
 * The Week view's per-day row, the Day view's field and the Month view's
 * "Today's focus…" box are the same note, and they were kept in step by a
 * global (`window.DayFocus`) that every script wrote through. A hook is the
 * same idea with the wiring visible: one cache, one writer, and any view that
 * calls it re-renders when the note changes.
 *
 * Three copies again, and the order matters. localStorage is the synchronous
 * one, under the Week view's historic key (`wkDayFocus:<user>:<iso>`) so a
 * page still served by Jinja reads the same note; the server copy follows the
 * account to another browser and is hydrated on mount; and React state is what
 * the views actually render. A keystroke writes the first two immediately and
 * the third after 800ms of quiet, because a note is typed a character at a
 * time and the endpoint should not be.
 *
 * Ported from frontend/js/calendar/day-focus.js.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { focus as focusService } from '@/services';

/** How long typing has to stop before the note is sent. */
const PUSH_DELAY_MS = 800;

function storageKey(username: string | null, iso: string): string {
  return `wkDayFocus:${username || 'Default'}:${iso}`;
}

function readCached(username: string | null, iso: string): string {
  try {
    return localStorage.getItem(storageKey(username, iso)) || '';
  } catch {
    return '';
  }
}

export interface UseDayFocus {
  /** The note for a day. Never null — a day with nothing on it is ''. */
  get: (iso: string) => string;
  set: (iso: string, text: string) => void;
}

export function useDayFocus(username: string | null): UseDayFocus {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Pull the account's saved notes over the local cache. The server is
  // authoritative here: it is the copy that followed the account from another
  // browser, and the local one may be this machine's stale idea of the week.
  useEffect(() => {
    if (!username) return;
    let live = true;

    void focusService.dayNotes(username).then((result) => {
      if (!live || !result.success) return;
      const fetched = result.day_focus || {};
      Object.entries(fetched).forEach(([iso, text]) => {
        try {
          localStorage.setItem(storageKey(username, iso), text);
        } catch {
          /* private mode: the server copy is still the one that matters */
        }
      });
      setNotes((current) => ({ ...fetched, ...current }));
    });

    return () => {
      live = false;
    };
  }, [username]);

  // Whatever is in flight when the page goes away should still be sent.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  const get = useCallback(
    (iso: string) => notes[iso] ?? readCached(username, iso),
    [notes, username],
  );

  const set = useCallback(
    (iso: string, text: string) => {
      setNotes((current) => ({ ...current, [iso]: text }));
      try {
        if (text) localStorage.setItem(storageKey(username, iso), text);
        else localStorage.removeItem(storageKey(username, iso));
      } catch {
        /* private mode: the note lives for this session only */
      }

      if (!username) return;
      clearTimeout(timers.current[iso]);
      timers.current[iso] = setTimeout(() => {
        void focusService.setDayNote(username, iso, text).catch(() => {
          /* offline: the local copy stands, and the next edit retries */
        });
      }, PUSH_DELAY_MS);
    },
    [username],
  );

  return { get, set };
}
