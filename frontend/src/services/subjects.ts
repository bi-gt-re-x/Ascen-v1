/**
 * Subjects — the hundred things a task can be about, plus the account's own.
 *
 * The hundred are the backend's (backend/config/subjects.py) and they arrive
 * already ordered: the subjects this account files the most tasks under come
 * first, so the picker's opening row is the reader's own habits rather than an
 * alphabet. Ahead of all of them come the subjects the account made itself,
 * however little they have been used — somebody who went and made one did so
 * because the hundred did not have it. The client does not re-sort any of it.
 *
 * A subject also carries the colour the account chose for it, when it chose
 * one. That is a *family* name rather than a hex — see utils/eventPalette for
 * the twelve and why six shades of each is the unit the calendar works in.
 *
 * Backend: backend/api/subjects.py.
 */
import { del, get, patch, post } from './api';
import type { ApiResult } from '@/types';
import type { Family } from '@/utils/eventPalette';

export interface Subject {
  /** What is stored on the task. Never shown. */
  id: string;
  /** "Environmental Science" — the full name, for titles and screen readers. */
  name: string;
  /** The short form, when the name needed one. */
  abbr: string | null;
  /** What a pill prints: `abbr` when there is one, `name` otherwise. */
  label: string;
  /** The icon's file name under /static/icons/. */
  icon: string;
  /**
   * Which of the nine groups it belongs to — "Computing", "Creative".
   *
   * Sent on every subject rather than as a separate group→ids map, so a client
   * grouping the list never has to join two responses. The names come from
   * backend/config/subjects.py, where they were section comments until the
   * skill trees needed a category column.
   */
  group: string;
  /** How many of this user's tasks carry it. Drives the ordering. */
  used: number;
  /**
   * The colour this account chose, or null for "whatever the palette says".
   *
   * Null rather than the palette's own answer on purpose: the two are
   * different facts, and only the library needs to tell them apart — it draws
   * the palette's answer as the current colour either way, but only an
   * explicit choice gets a "back to default" to undo.
   */
  family: Family | null;
  /** True for a subject this account made. They sort ahead of the hundred. */
  custom: boolean;
}

export function list(username: string): Promise<ApiResult<{ subjects: Subject[] }>> {
  return get<{ subjects: Subject[] }>('/api/subjects', { username });
}

/** Add a subject of the account's own. The id is derived from the name. */
export function create(
  username: string,
  name: string,
  family: Family | null,
): Promise<ApiResult<{ subject: Subject }>> {
  return post<{ subject: Subject }>('/api/subjects', { username, name, family });
}

/** Choose a colour for any subject. `null` hands it back to the palette. */
export function setColor(
  username: string,
  subjectId: string,
  family: Family | null,
): Promise<ApiResult<{ subject_id: string; family: Family | null }>> {
  return patch<{ subject_id: string; family: Family | null }>(
    `/api/subjects/${encodeURIComponent(subjectId)}/color`,
    { username, family },
  );
}

/** Delete one of the account's own. Tasks already filed under it keep the id. */
export function remove(
  username: string,
  subjectId: string,
): Promise<ApiResult<{ subject_id: string }>> {
  return del<{ subject_id: string }>(`/api/subjects/${encodeURIComponent(subjectId)}`, {
    username,
  });
}

/** Where an icon lives. The same convention the calendar's block icons use. */
export function iconUrl(subject: Pick<Subject, 'icon'>): string {
  return `/static/icons/${subject.icon}.svg`;
}
