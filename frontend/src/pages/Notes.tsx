/**
 * Notes — the one thing you write here that the app will not score.
 *
 * Every other page turns what you did into a number: a task has an XP value, a
 * goal has a percentage, a finished task gets two stars. That is the app's
 * whole argument, and it has a hole in it — Ascen can tell you that you worked
 * eleven days running and cannot tell you why the eleventh was the one where
 * it clicked. This is where that sentence goes.
 *
 * So there is no XP for writing one, no streak of days written, and no count of
 * notes anywhere near the report card. The moment a note is worth points it
 * stops being the honest one, and the reader starts writing for the counter.
 *
 * ## The shape
 *
 * A list on the left, an editor on the right, and the editor is always showing
 * something — a note or a blank one. There is no "click a note to begin" state
 * because the first thing anybody does here is write, and a page whose main
 * panel is empty until you find the right button has put a step in front of the
 * only thing it does.
 *
 * Saving is explicit. Autosave is right for a document you are living in and
 * wrong for a panel that also holds a delete button; the draft is local until
 * pressed, and the list only moves when the server has answered.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useAuth, useDocumentTitle } from '@/hooks';
import { notes as noteService } from '@/services';
import type { Note } from '@/services/notes';
import { isoDate } from '@/utils/dates';
import '@/styles/notes.css';

/** A draft that has never been saved. Its id is empty, which is what `save` reads. */
const BLANK = { id: '', title: '', body: '', note_date: '', pinned: false };

type Draft = typeof BLANK;

const asDraft = (note: Note): Draft => ({
  id: note.id,
  title: note.title,
  body: note.body,
  note_date: note.note_date ?? '',
  pinned: Boolean(note.pinned),
});

/** "16 Aug 2026, 19:12" — when a note was last touched. */
function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The first line of the body, for the list. Never the whole thing. */
function preview(body: string): string {
  const line = body.split('\n').find((entry) => entry.trim() !== '') ?? '';
  return line.length > 90 ? `${line.slice(0, 90)}…` : line;
}

export default function Notes() {
  useDocumentTitle('Notes');

  const { username } = useAuth();
  const [rows, setRows] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const result = await noteService.list(username);
    if (result.success) {
      setRows(result.notes);
      setError(null);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * The list is the server's ordering, filtered. Not re-sorted here: the API
   * puts pinned first and most-recently-touched next because that is the only
   * ordering this page ever wants, and a second sort on the client is how a
   * list stops agreeing with itself the moment one of the two changes.
   */
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!rows) return [];
    if (!needle) return rows;
    return rows.filter(
      (note) =>
        note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle),
    );
  }, [query, rows]);

  const dirty = useMemo(() => {
    if (!draft.id) return draft.title.trim() !== '' || draft.body.trim() !== '';
    const original = rows?.find((note) => note.id === draft.id);
    if (!original) return false;
    return (
      original.title !== draft.title ||
      original.body !== draft.body ||
      (original.note_date ?? '') !== draft.note_date ||
      Boolean(original.pinned) !== draft.pinned
    );
  }, [draft, rows]);

  const open = useCallback((note: Note) => {
    setDraft(asDraft(note));
    setMessage(null);
  }, []);

  const blank = useCallback(() => {
    setDraft(BLANK);
    setMessage(null);
    titleRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (!username || busy) return;
    if (draft.title.trim() === '' && draft.body.trim() === '') {
      setMessage('A note needs a title or something written in it.');
      return;
    }
    setBusy(true);
    const result = await noteService.save(username, {
      ...(draft.id ? { id: draft.id } : {}),
      title: draft.title,
      body: draft.body,
      note_date: draft.note_date,
      pinned: draft.pinned,
    });
    setBusy(false);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setDraft(asDraft(result.note));
    setMessage('Saved.');
    await load();
  }, [busy, draft, load, username]);

  const discard = useCallback(async () => {
    if (!username || !draft.id || busy) return;
    setBusy(true);
    const result = await noteService.remove(username, draft.id);
    setBusy(false);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setDraft(BLANK);
    setMessage(null);
    await load();
  }, [busy, draft.id, load, username]);

  if (loading) return <Loading label="Reading your notes" />;
  if (rows === null) {
    return <ErrorState message={error ?? 'Could not read your notes.'} onRetry={load} />;
  }

  return (
    <div className="nt-page">
      <Ambient />
      <div className="nt-shell page-shell">
        <header className="nt-head">
          <div>
            <h1>Notes</h1>
            <p>
              The one thing you write here that nothing scores. No XP, no streak, no count on
              the report card — write what the numbers cannot hold.
            </p>
          </div>
          <RefreshButton onRefresh={() => void load()} busy={busy} />
        </header>

        <div className="nt-body">
          {/* ---- The list ---- */}
          <aside className="nt-list-panel">
            <div className="nt-list-head">
              <input
                type="search"
                className="nt-search"
                placeholder={`Search ${rows.length} ${rows.length === 1 ? 'note' : 'notes'}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" className="nt-new" onClick={blank}>
                New note
              </button>
            </div>

            {shown.length === 0 ? (
              <p className="nt-list-empty">
                {rows.length === 0
                  ? 'Nothing written yet. The panel beside this one is already a blank note — start there.'
                  : `No note matches “${query.trim()}”.`}
              </p>
            ) : (
              <ul className="nt-list">
                {shown.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={`nt-item${note.id === draft.id ? ' is-open' : ''}`}
                      onClick={() => open(note)}
                    >
                      <span className="nt-item-top">
                        <span className="nt-item-title">{note.title || 'Untitled'}</span>
                        {note.pinned && (
                          <span className="nt-pin" title="Pinned" aria-label="Pinned">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M14 2 9 7H5l4 4-5 9 9-5 4 4V15l5-5-4-4V2Z" />
                            </svg>
                          </span>
                        )}
                      </span>
                      {preview(note.body) && (
                        <span className="nt-item-preview">{preview(note.body)}</span>
                      )}
                      <span className="nt-item-meta">
                        {note.note_date ? `About ${when(note.note_date)} · ` : ''}
                        {when(note.updated_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* ---- The editor ---- */}
          <section className="nt-editor">
            <div className="nt-editor-head">
              <input
                ref={titleRef}
                className="nt-title"
                placeholder="Title"
                value={draft.title}
                maxLength={200}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
              <button
                type="button"
                className={`nt-pin-btn${draft.pinned ? ' is-on' : ''}`}
                aria-pressed={draft.pinned}
                title={draft.pinned ? 'Pinned to the top of the list' : 'Pin to the top'}
                onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2 9 7H5l4 4-5 9 9-5 4 4V15l5-5-4-4V2Z" />
                </svg>
              </button>
            </div>

            <textarea
              className="nt-body-input"
              placeholder="Write it here. Nothing on this page is counted, graded or shown anywhere else."
              value={draft.body}
              maxLength={20000}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            />

            <div className="nt-editor-foot">
              <label className="nt-date">
                {/* The one anchor the page offers. The table also holds task_id
                    and goal_id, and both are reachable from the API — they are
                    not here because a note is attached from the *task*, which
                    is where somebody is standing when they want one. */}
                <span>About a day</span>
                <input
                  type="date"
                  value={draft.note_date}
                  max={isoDate()}
                  onChange={(event) => setDraft({ ...draft, note_date: event.target.value })}
                />
              </label>

              <div className="nt-actions">
                {message && <span className="nt-message">{message}</span>}
                {draft.id && (
                  <button
                    type="button"
                    className="nt-delete"
                    disabled={busy}
                    onClick={() => void discard()}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="nt-save"
                  disabled={busy || !dirty}
                  onClick={() => void submit()}
                >
                  {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Save note'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
