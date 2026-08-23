/**
 * The five subjects somebody is working on at the moment.
 *
 * ## Why five, and why chosen rather than derived
 *
 * The rail under them offers all hundred subjects, which is the right number to
 * be able to reach and the wrong number to be shown first. Five is what fits
 * across the top as something to read rather than scan, and it is enough to
 * hold a term of work: two subjects being studied, one being practised, one for
 * the job and one for the house.
 *
 * They start derived and become chosen. Until somebody picks, the five are the
 * subjects this account has actually filed the most tasks under — which is the
 * best available guess and is right often enough that most readers will never
 * open the picker. The moment one is changed, the whole set is stored: a
 * half-chosen set that kept re-deriving the other four would move under the
 * reader every time they finished a task.
 *
 * ## Where it is kept, and why not the database
 *
 * The browser, under an account-scoped key, exactly as utils/skillProgress
 * keeps practice. There is no table for it, and inventing one would be
 * inventing the schema for a preference whose shape is a week old. This module
 * is the only thing that touches the storage, so the day it becomes a column
 * the change is here and nowhere else.
 *
 * What is stored is subject ids — the catalogue's own ids, the same strings a
 * task carries — and never the tree they resolve to. The routing in
 * skills/subjectMap is free to change; a stored `mandarin` still means Mandarin
 * afterwards, where a stored `foreign-language` would have silently become an
 * answer to a question nobody asked.
 */
import { userScopedKey } from './calendarStore';

const KEY = 'skillFocusTopics';

/** How many the band across the top holds. */
export const FOCUS_COUNT = 5;

/** The stored ids, or null where this account has never chosen. */
export function loadFocus(username: string | null): string[] | null {
  try {
    const raw = localStorage.getItem(userScopedKey(KEY, username));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Anything that is not a string is dropped rather than trusted: this is a
    // store a person can edit by hand, and one bad value should cost one slot.
    const clean = parsed.filter((value): value is string => typeof value === 'string');
    return clean.length > 0 ? clean.slice(0, FOCUS_COUNT) : null;
  } catch {
    // Private-mode storage, a quota error, or JSON that is not ours. Falling
    // back to the derived five is a far better failure than an empty band.
    return null;
  }
}

export function saveFocus(username: string | null, ids: string[]): void {
  try {
    localStorage.setItem(userScopedKey(KEY, username), JSON.stringify(ids.slice(0, FOCUS_COUNT)));
  } catch {
    // The click has already worked on screen; the state above this is the
    // source of truth for the session.
  }
}

/**
 * The five to show: what was chosen, topped up from what is used most.
 *
 * `candidates` arrives in the order the catalogue endpoint sent it, which is
 * this account's own usage — so the top-up is "the subjects you work on",
 * without this module knowing that is what the order means. Duplicates are
 * dropped and the result is always exactly five where there are five to have,
 * because a band that sometimes holds four is a band with a hole in it.
 */
export function resolveFocus(chosen: string[] | null, candidates: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...(chosen ?? []), ...candidates]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === FOCUS_COUNT) break;
  }
  return out;
}
