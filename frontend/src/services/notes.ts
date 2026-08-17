/**
 * Notes — free-form writing, optionally attached to a day, a task or a goal.
 *
 * Backend: backend/api/notes.py, over the table in data/sql/notes.sql.
 *
 * Three calls, and `save` is deliberately one of them rather than two: create
 * and edit differ by whether an `id` is sent, the page has one form, and two
 * endpoints would have meant two client functions whose only difference was
 * which field they left out.
 */
import { get, post } from './api';
import type { ApiResult } from '@/types';

export interface Note {
  id: string;
  title: string;
  body: string;
  /** The day this is about, "2026-08-16". Absent on a note about no day. */
  note_date?: string;
  task_id?: string;
  goal_id?: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

/** What a save sends. Everything but the id is written as given. */
export interface NoteDraft {
  id?: string;
  title: string;
  body: string;
  note_date?: string;
  pinned?: boolean;
}

export function list(username: string): Promise<ApiResult<{ notes: Note[] }>> {
  return get<{ notes: Note[] }>('/api/notes', { username });
}

export function save(
  username: string,
  draft: NoteDraft,
): Promise<ApiResult<{ note: Note }>> {
  return post<{ note: Note }>('/api/notes/save', { username, ...draft });
}

export function remove(username: string, id: string): Promise<ApiResult<{ id: string }>> {
  return post<{ id: string }>('/api/notes/delete', { username, id });
}
