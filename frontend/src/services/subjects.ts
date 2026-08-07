/**
 * Subjects — the hundred things a task can be about.
 *
 * The list is the backend's (backend/config/subjects.py) and it arrives
 * already ordered: the subjects this account files the most tasks under come
 * first, so the picker's opening row is the reader's own habits rather than an
 * alphabet. The client does not re-sort it.
 *
 * Backend: backend/api/subjects.py.
 */
import { get } from './api';
import type { ApiResult } from '@/types';

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
  /** How many of this user's tasks carry it. Drives the ordering. */
  used: number;
}

export function list(username: string): Promise<ApiResult<{ subjects: Subject[] }>> {
  return get<{ subjects: Subject[] }>('/api/subjects', { username });
}

/** Where an icon lives. The same convention the calendar's block icons use. */
export function iconUrl(subject: Pick<Subject, 'icon'>): string {
  return `/static/icons/${subject.icon}.svg`;
}
