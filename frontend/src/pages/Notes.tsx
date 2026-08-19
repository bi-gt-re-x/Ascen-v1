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
 * A workspace, in three columns: an index on the left, the note in the middle,
 * and what is true about it on the right. The editor is always showing
 * something — a note or a blank one. There is no "click a note to begin" state
 * because the first thing anybody does here is write, and a page whose main
 * panel is empty until you find the right button has put a step in front of
 * the only thing it does.
 *
 * ## Saving is still explicit
 *
 * The status pill reads like autosave and is not. Autosave is right for a
 * document you are living in and wrong for a panel that also holds a delete
 * button; the draft stays local until saved, and the list only moves once the
 * server has answered. What the pill does is stop the page being quiet about
 * it — "Unsaved changes" is a state the old footer only expressed by whether a
 * button happened to be disabled.
 *
 * ## The toolbar writes Markdown
 *
 * Not a rich-text engine. The body is a plain-text column in the database and
 * turning it into a document model is a migration, not a button — so the
 * toolbar does what a person would do by hand: wraps the selection in
 * asterisks, puts `## ` at the front of the line. That keeps the note readable
 * as itself, which is the property a notes table should not lose to a format
 * only this page can open.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ambient, ErrorState, Loading } from '@/components';
import { useAuth, useDocumentTitle, useSubjects } from '@/hooks';
import { notes as noteService } from '@/services';
import {
  NotebookPicker,
  SubjectPill,
  SubjectTags,
  subjectOf,
} from '@/components/Notes/SubjectTags';
import type { Note } from '@/services/notes';
import { isoDate } from '@/utils/dates';
import { render } from '@/utils/markdown';
import '@/styles/notes.css';

/** A draft that has never been saved. Its id is empty, which is what `save` reads. */
const BLANK = {
  id: '',
  title: '',
  body: '',
  note_date: '',
  subject_ids: '',
  notebook: '',
  pinned: false,
};

type Draft = typeof BLANK;

const asDraft = (note: Note): Draft => ({
  id: note.id,
  title: note.title,
  body: note.body,
  note_date: note.note_date ?? '',
  subject_ids: note.subject_ids ?? '',
  notebook: note.notebook ?? '',
  pinned: Boolean(note.pinned),
});

/**
 * A note's subject ids, as a list.
 *
 * The column is absent on every note older than it, and null-ish on some rows
 * ALTER TABLE filled in — so this is the only place the string is split, and
 * everything else takes the array.
 */
export function subjectIds(value: string | undefined | null): string[] {
  return (value ?? '').split(',').map((id) => id.trim()).filter(Boolean);
}

/** How many body edits back the toolbar's undo can reach. */
const HISTORY = 60;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "just now", "3h ago", "2d ago" — how the index says when.
 *
 * The list is scanned rather than read, and at that speed a distance is worth
 * more than a date: "2d ago" places a note against today without the reader
 * having to work out what today is. The full date is on the note itself, in
 * the rail, where somebody is actually looking at one thing.
 */
function ago(iso: string): string {
  const at = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(at.getTime())) return '';
  const gap = Date.now() - at.getTime();
  if (gap < 2 * MINUTE) return 'just now';
  if (gap < HOUR) return `${Math.round(gap / MINUTE)}m ago`;
  if (gap < DAY) return `${Math.round(gap / HOUR)}h ago`;
  if (gap < 7 * DAY) return `${Math.round(gap / DAY)}d ago`;
  if (gap < 30 * DAY) return `${Math.round(gap / (7 * DAY))}w ago`;
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Jul 18, 2024, 10:32 AM" — the rail's full stamp, where there is room for one. */
function stamp(iso: string): string {
  const at = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const words = (body: string) => body.trim() ? body.trim().split(/\s+/).length : 0;

// ---------------------------------------------------------------------------
// The toolbar
// ---------------------------------------------------------------------------
/**
 * One button's effect on the text.
 *
 * `wrap` puts the same string either side of the selection — bold, italic,
 * code. `prefix` puts one at the front of every selected line — headings,
 * lists, quotes. Between them they cover everything the toolbar offers, which
 * is why there is no third kind.
 */
type Tool =
  | { id: string; label: string; hint: string; wrap: string; text?: string }
  | { id: string; label: string; hint: string; prefix: string; text?: string };

const TOOLS: Tool[][] = [
  [
    { id: 'h1', label: 'H1', hint: 'Heading 1', prefix: '# ' },
    { id: 'h2', label: 'H2', hint: 'Heading 2', prefix: '## ' },
    { id: 'h3', label: 'H3', hint: 'Heading 3', prefix: '### ' },
  ],
  [
    { id: 'bold', label: 'B', hint: 'Bold', wrap: '**' },
    { id: 'italic', label: 'I', hint: 'Italic', wrap: '*' },
    { id: 'under', label: 'U', hint: 'Underline', wrap: '__' },
  ],
  [
    { id: 'bullet', label: '•', hint: 'Bulleted list', prefix: '- ' },
    { id: 'number', label: '1.', hint: 'Numbered list', prefix: '1. ' },
    { id: 'todo', label: '☑', hint: 'Checklist', prefix: '- [ ] ' },
  ],
  [
    { id: 'quote', label: '❝', hint: 'Quote', prefix: '> ' },
    { id: 'code', label: '</>', hint: 'Code', wrap: '`' },
    { id: 'link', label: '🔗', hint: 'Link', wrap: '', text: '[text](https://)' },
  ],
];

/**
 * What the New Note chevron offers.
 *
 * Four, and deliberately not more: a template list long enough to browse is a
 * decision in front of the blank page, which is the thing this page exists to
 * put you in front of. Each one is a heading and the prompts that go under it,
 * in the Markdown the toolbar writes, so a template is a note like any other
 * from the moment it opens.
 */
const TEMPLATES: Array<{ id: string; label: string; hint: string; title: string; body: string }> = [
  {
    id: 'blank',
    label: 'Blank note',
    hint: 'Nothing in it',
    title: '',
    body: '',
  },
  {
    id: 'log',
    label: 'Daily log',
    hint: 'What happened, what is next',
    title: '',
    body: '## What I did\n\n- \n\n## What worked\n\n- \n\n## Tomorrow\n\n- [ ] ',
  },
  {
    id: 'problem',
    label: 'Problem log',
    hint: 'A problem and what it taught you',
    title: '',
    body:
      '## The problem\n\n\n## What I tried\n\n- \n\n## The idea I was missing\n\n\n' +
      '## What to remember\n\n- ',
  },
  {
    id: 'book',
    label: 'Book notes',
    hint: 'Chapter by chapter',
    title: '',
    body: '## Source\n\n\n## Key ideas\n\n- \n\n## Quotes\n\n> \n\n## What I disagree with\n\n- ',
  },
];

/** How the index is narrowed. `subject` carries the id being filtered to. */
type Filter = { kind: 'all' | 'pinned' | 'untagged' | 'subject'; id?: string };

export default function Notes() {
  useDocumentTitle('Notes');

  const { username } = useAuth();
  const [rows, setRows] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  /**
   * Whether the body is being written or read.
   *
   * A saved note with something in it opens read: you came back to it to look
   * at it, and the formatting is the point of having written it that way. A
   * blank one opens write, because there is nothing to read.
   */
  const [mode, setMode] = useState<'write' | 'read'>('write');
  /** Collapsed index sections, by name. Both open until one is shut. */
  const [shut, setShut] = useState<Record<string, boolean>>({});

  const catalogue = useSubjects(username);
  const tags = useMemo(() => subjectIds(draft.subject_ids), [draft.subject_ids]);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /** Body edits, for the toolbar's undo and redo. See HISTORY. */
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);

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

  /* ⌘K / Ctrl-K puts the caret in the search box, which is what the hint in it
     promises. Bound on the page rather than on the input for the obvious
     reason: the whole point is to reach it from wherever you are. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* The "..." menu closes on the next click anywhere, the way every other menu
     in the app does — a menu that only closes on its own button is one the
     reader has to aim at twice. */
  useEffect(() => {
    if (!menuOpen && !tplOpen && !filterOpen) return;
    const close = () => {
      setMenuOpen(false);
      setTplOpen(false);
      setFilterOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [filterOpen, menuOpen, tplOpen]);

  /*
   * The list is the server's ordering, filtered. Not re-sorted here: the API
   * puts pinned first and most-recently-touched next because that is the only
   * ordering this page ever wants, and a second sort on the client is how a
   * list stops agreeing with itself the moment one of the two changes.
   */
  const shown = useMemo(() => {
    if (!rows) return [];
    const needle = query.trim().toLowerCase();
    return rows
      .filter((note) => {
        if (filter.kind === 'pinned') return note.pinned;
        if (filter.kind === 'untagged') return subjectIds(note.subject_ids).length === 0;
        if (filter.kind === 'subject') return subjectIds(note.subject_ids).includes(filter.id ?? '');
        return true;
      })
      .filter(
        (note) =>
          !needle ||
          note.title.toLowerCase().includes(needle) ||
          note.body.toLowerCase().includes(needle),
      );
  }, [filter, query, rows]);

  /** The subjects actually in use, for the filter menu. Nothing else is offered. */
  const inUse = useMemo(() => {
    const seen = new Map<string, number>();
    for (const note of rows ?? []) {
      for (const id of subjectIds(note.subject_ids)) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  /** What the index's header calls the current view. */
  const scopeLabel =
    filter.kind === 'pinned'
      ? 'Pinned'
      : filter.kind === 'untagged'
        ? 'Untagged'
        : filter.kind === 'subject'
          ? subjectOf(filter.id ?? '', catalogue)?.name ?? filter.id ?? 'Tagged'
          : 'All Notes';

  /** The index's two groups. Pinned notes are lifted out rather than marked. */
  const groups = useMemo(
    () => [
      { name: 'Pinned', notes: shown.filter((note) => note.pinned) },
      { name: 'Notes', notes: shown.filter((note) => !note.pinned) },
    ],
    [shown],
  );

  const dirty = useMemo(() => {
    if (!draft.id) return draft.title.trim() !== '' || draft.body.trim() !== '';
    const original = rows?.find((note) => note.id === draft.id);
    if (!original) return false;
    return (
      original.title !== draft.title ||
      original.body !== draft.body ||
      (original.note_date ?? '') !== draft.note_date ||
      (original.subject_ids ?? '') !== draft.subject_ids ||
      (original.notebook ?? '') !== draft.notebook ||
      Boolean(original.pinned) !== draft.pinned
    );
  }, [draft, rows]);

  /** Every body change goes through here, so undo has something to hold. */
  const setBody = useCallback((next: string, remember = true) => {
    setDraft((current) => {
      if (remember && current.body !== next) {
        past.current = [...past.current, current.body].slice(-HISTORY);
        future.current = [];
      }
      return { ...current, body: next };
    });
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.at(-1);
    if (previous === undefined) return;
    past.current = past.current.slice(0, -1);
    setDraft((current) => {
      future.current = [...future.current, current.body].slice(-HISTORY);
      return { ...current, body: previous };
    });
  }, []);

  const redo = useCallback(() => {
    const next = future.current.at(-1);
    if (next === undefined) return;
    future.current = future.current.slice(0, -1);
    setDraft((current) => {
      past.current = [...past.current, current.body].slice(-HISTORY);
      return { ...current, body: next };
    });
  }, []);

  /**
   * Run a toolbar button against the selection.
   *
   * The caret is put back deliberately rather than left where the browser
   * drops it: typing bold and then having to find your place again is worse
   * than not having the button.
   */
  const apply = useCallback(
    (tool: Tool) => {
      // Formatting the text you cannot see is not a thing anybody means to do,
      // so a toolbar press in read mode goes back to write first.
      if (mode === 'read') {
        setMode('write');
        return;
      }
      const field = bodyRef.current;
      if (!field) return;
      const from = field.selectionStart;
      const to = field.selectionEnd;
      const body = draft.body;
      const picked = body.slice(from, to);

      let next: string;
      let caret: number;

      if ('prefix' in tool) {
        // Back to the start of the first selected line, so a caret in the
        // middle of a word still prefixes the line it is in.
        const lineStart = body.lastIndexOf('\n', from - 1) + 1;
        const block = body.slice(lineStart, to);
        const marked = block
          .split('\n')
          .map((line) => (line.startsWith(tool.prefix) ? line.slice(tool.prefix.length) : tool.prefix + line))
          .join('\n');
        next = body.slice(0, lineStart) + marked + body.slice(to);
        caret = lineStart + marked.length;
      } else if (tool.text) {
        next = body.slice(0, from) + tool.text + body.slice(to);
        caret = from + tool.text.length;
      } else {
        const inner = picked || tool.hint.toLowerCase();
        next = body.slice(0, from) + tool.wrap + inner + tool.wrap + body.slice(to);
        caret = from + tool.wrap.length + inner.length + tool.wrap.length;
      }

      setBody(next);
      requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(caret, caret);
      });
    },
    [draft.body, mode, setBody],
  );

  const open = useCallback((note: Note) => {
    past.current = [];
    future.current = [];
    setDraft(asDraft(note));
    setMessage(null);
    setSavedAt(null);
    setMode(note.body.trim() ? 'read' : 'write');
  }, []);

  /** Open a new note with a template's text already in it. */
  const fromTemplate = useCallback((template: (typeof TEMPLATES)[number]) => {
    past.current = [];
    future.current = [];
    setDraft({ ...BLANK, title: template.title, body: template.body });
    setMessage(null);
    setSavedAt(null);
    setMode('write');
    setTplOpen(false);
    titleRef.current?.focus();
  }, []);

  const blank = useCallback(() => {
    past.current = [];
    future.current = [];
    setDraft(BLANK);
    setMessage(null);
    setSavedAt(null);
    setMode('write');
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
      subject_ids: draft.subject_ids,
      notebook: draft.notebook,
      pinned: draft.pinned,
    });
    setBusy(false);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setDraft(asDraft(result.note));
    setMessage(null);
    setSavedAt(Date.now());
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
    blank();
    await load();
  }, [blank, busy, draft.id, load, username]);

  if (loading) return <Loading label="Reading your notes" />;
  if (rows === null) {
    return <ErrorState message={error ?? 'Could not read your notes.'} onRetry={load} />;
  }

  const state = busy
    ? { tone: 'busy', text: 'Saving…' }
    : dirty
      ? { tone: 'dirty', text: 'Unsaved changes' }
      : savedAt
        ? { tone: 'saved', text: 'Saved just now' }
        : draft.id
          ? { tone: 'saved', text: `Updated ${ago(rows.find((n) => n.id === draft.id)?.updated_at ?? '')}` }
          : { tone: 'saved', text: 'New note' };

  return (
    <div className="nt-page">
      <Ambient />
      <div className="nt-shell page-shell">
        {/* ---- The page's own header ---- */}
        <header className="nt-head">
          <div className="nt-head-titles">
            <h1>Notes</h1>
            <p>Capture ideas. Organize knowledge. Fuel growth.</p>
          </div>

          <div className="nt-head-tools">
            <div className="nt-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                className="nt-search"
                placeholder="Search notes..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd className="nt-kbd">⌘K</kbd>
            </div>

            <div className="nt-new-group">
              <button type="button" className="nt-new" onClick={blank}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                New Note
              </button>
              <div className="nt-menu-wrap">
                <button
                  type="button"
                  className="nt-new-more"
                  aria-label="Start from a template"
                  aria-expanded={tplOpen}
                  title="Start from a template"
                  onClick={(event) => {
                    event.stopPropagation();
                    setTplOpen((on) => !on);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {tplOpen && (
                  <div className="nt-menu is-wide" onClick={(event) => event.stopPropagation()}>
                    {TEMPLATES.map((template) => (
                      <button key={template.id} type="button" onClick={() => fromTemplate(template)}>
                        <span>{template.label}</span>
                        <em>{template.hint}</em>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="nt-body">
          {/* ---- The index ---- */}
          <aside className="nt-list-panel">
            <div className="nt-list-head">
              <button
                type="button"
                className="nt-icon-btn"
                onClick={blank}
                title="Start a new note"
                aria-label="Start a new note"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <span className="nt-scope">
                {query.trim() ? `${shown.length} matching` : scopeLabel}
              </span>

              <div className="nt-menu-wrap">
                <button
                  type="button"
                  className={`nt-icon-btn${filter.kind !== 'all' ? ' is-on' : ''}`}
                  aria-label="Filter the index"
                  aria-expanded={filterOpen}
                  title="Filter the index"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFilterOpen((on) => !on);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 6h18M6 12h12M10 18h4" strokeLinecap="round" />
                  </svg>
                </button>

                {filterOpen && (
                  <div className="nt-menu" onClick={(event) => event.stopPropagation()}>
                    {([
                      { kind: 'all', label: 'All notes' },
                      { kind: 'pinned', label: 'Pinned only' },
                      { kind: 'untagged', label: 'Untagged' },
                    ] as const).map((entry) => (
                      <button
                        key={entry.kind}
                        type="button"
                        className={filter.kind === entry.kind ? 'is-on' : ''}
                        onClick={() => {
                          setFilter({ kind: entry.kind });
                          setFilterOpen(false);
                        }}
                      >
                        {entry.label}
                      </button>
                    ))}

                    {/* Only the subjects actually on a note. A filter listing a
                        hundred subjects, ninety of which match nothing, is a
                        menu you scroll rather than a filter you use. */}
                    {inUse.length > 0 && <hr />}
                    {inUse.map(([id, count]) => (
                      <button
                        key={id}
                        type="button"
                        className={filter.kind === 'subject' && filter.id === id ? 'is-on' : ''}
                        onClick={() => {
                          setFilter({ kind: 'subject', id });
                          setFilterOpen(false);
                        }}
                      >
                        <span>{subjectOf(id, catalogue)?.name ?? id}</span>
                        <em>{count}</em>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="nt-sections">
              {shown.length === 0 ? (
                <p className="nt-list-empty">
                  {rows.length === 0
                    ? 'Nothing written yet. The panel beside this one is already a blank note — start there.'
                    : `No note matches “${query.trim()}”.`}
                </p>
              ) : (
                groups.map((group) =>
                  group.notes.length === 0 ? null : (
                    <section className="nt-sec" key={group.name}>
                      <button
                        type="button"
                        className={`nt-sec-head${shut[group.name] ? ' is-shut' : ''}`}
                        onClick={() => setShut((open) => ({ ...open, [group.name]: !open[group.name] }))}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{group.name}</span>
                        <em>{group.notes.length}</em>
                      </button>

                      {!shut[group.name] && (
                        <ul className="nt-list">
                          {group.notes.map((note) => (
                            <li key={note.id}>
                              <button
                                type="button"
                                className={`nt-item${note.id === draft.id ? ' is-open' : ''}`}
                                onClick={() => open(note)}
                              >
                                <span className="nt-item-top">
                                  <span className="nt-item-title">{note.title || 'Untitled'}</span>
                                  {note.pinned && (
                                    <span className="nt-pin" aria-label="Pinned">
                                      <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M14 2 9 7H5l4 4-5 9 9-5 4 4V15l5-5-4-4V2Z" />
                                      </svg>
                                    </span>
                                  )}
                                </span>
                                {/* The subjects, so the index says what a note is
                                    about before you open it — which is the
                                    whole reason for tagging one. */}
                                {subjectIds(note.subject_ids).length > 0 && (
                                  <span className="nt-item-tags">
                                    {subjectIds(note.subject_ids).slice(0, 3).map((id) => (
                                      <SubjectPill key={id} id={id} catalogue={catalogue} />
                                    ))}
                                    {subjectIds(note.subject_ids).length > 3 && (
                                      <span className="nt-item-more">
                                        +{subjectIds(note.subject_ids).length - 3}
                                      </span>
                                    )}
                                  </span>
                                )}

                                <span className="nt-item-meta">
                                  {note.notebook && (
                                    <span className="nt-chip">{note.notebook}</span>
                                  )}
                                  <span className="nt-item-when">Updated {ago(note.updated_at)}</span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ),
                )
              )}
            </div>
          </aside>

          {/* ---- The note ---- */}
          <section className="nt-editor">
            <header className="nt-editor-head">
              <input
                ref={titleRef}
                className="nt-title"
                placeholder="Untitled"
                value={draft.title}
                maxLength={200}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />

              <span className={`nt-state is-${state.tone}`}>
                <i aria-hidden="true" />
                {state.text}
              </span>

              <div className="nt-editor-tools">
                <button
                  type="button"
                  className={`nt-icon-btn${draft.pinned ? ' is-on' : ''}`}
                  aria-pressed={draft.pinned}
                  title={draft.pinned ? 'Pinned to the top of the index' : 'Pin to the top'}
                  onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
                >
                  <svg viewBox="0 0 24 24" fill={draft.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m12 3 2.6 5.6 6.4.8-4.7 4.3 1.3 6.3L12 17l-5.6 3 1.3-6.3L3 9.4l6.4-.8L12 3Z" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="nt-icon-btn"
                  disabled={!draft.id || busy}
                  title="Save this note"
                  aria-label="Save this note"
                  onClick={() => void submit()}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12v7h14v-7M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div className="nt-menu-wrap">
                  <button
                    type="button"
                    className="nt-icon-btn"
                    aria-label="More"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen((on) => !on);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.7" />
                      <circle cx="12" cy="12" r="1.7" />
                      <circle cx="19" cy="12" r="1.7" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="nt-menu" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={blank}>Start a blank note</button>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
                      >
                        {draft.pinned ? 'Unpin' : 'Pin to the top'}
                      </button>
                      {/* Delete lives in here rather than beside Save. It is
                          the one irreversible control on the page and it does
                          not belong a few pixels from the one pressed most. */}
                      <button
                        type="button"
                        className="is-bad"
                        disabled={!draft.id || busy}
                        onClick={() => {
                          setMenuOpen(false);
                          void discard();
                        }}
                      >
                        Delete this note
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* ---- What the buttons write ---- */}
            <div className="nt-toolbar">
              {TOOLS.map((group, index) => (
                <div className="nt-tool-group" key={index}>
                  {group.map((tool) => (
                    <button
                      type="button"
                      key={tool.id}
                      className="nt-tool"
                      title={tool.hint}
                      aria-label={tool.hint}
                      data-tool={tool.id}
                      onClick={() => apply(tool)}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              ))}

              <div className="nt-tool-group nt-tool-end">
                <div className="nt-mode" role="group" aria-label="Write or read">
                  <button
                    type="button"
                    className={mode === 'write' ? 'is-on' : ''}
                    aria-pressed={mode === 'write'}
                    onClick={() => setMode('write')}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    className={mode === 'read' ? 'is-on' : ''}
                    aria-pressed={mode === 'read'}
                    onClick={() => setMode('read')}
                  >
                    Preview
                  </button>
                </div>

                <button
                  type="button"
                  className="nt-tool"
                  title="Undo"
                  aria-label="Undo"
                  onClick={undo}
                >
                  ↶
                </button>
                <button
                  type="button"
                  className="nt-tool"
                  title="Redo"
                  aria-label="Redo"
                  onClick={redo}
                >
                  ↷
                </button>
              </div>
            </div>

            {/* ---- The note, and what is true about it ---- */}
            <div className="nt-editor-body">
              {mode === 'read' ? (
                /* The rendered note. `render` escapes before it formats and
                   allows no tag it did not write itself — see
                   utils/markdown.ts, which is where the reasoning for that
                   lives rather than here. Double-click puts you back in the
                   text, which is what a reader who spots a typo will try. */
                <div
                  className="nt-preview"
                  onDoubleClick={() => setMode('write')}
                  dangerouslySetInnerHTML={{ __html: render(draft.body) }}
                />
              ) : (
                <textarea
                  ref={bodyRef}
                  className="nt-body-input"
                  placeholder="Write it here. Nothing on this page is counted, graded or shown anywhere else."
                  value={draft.body}
                  maxLength={20000}
                  onChange={(event) => setBody(event.target.value)}
                />
              )}

              <aside className="nt-meta">
                {/* Both are real columns now — see data/sql/notes.sql. Tags are
                    ids from the subject catalogue rather than free text, which
                    is what lets a note carry the same colour and the same name
                    the rest of Ascen gives that subject. The reasoning is in
                    components/Notes/SubjectTags. */}
                <section className="nt-meta-sec">
                  <h3>Tags</h3>
                  <SubjectTags
                    ids={tags}
                    catalogue={catalogue}
                    disabled={busy}
                    onChange={(next) => setDraft({ ...draft, subject_ids: next.join(',') })}
                  />
                </section>

                <section className="nt-meta-sec">
                  <h3>Notebook</h3>
                  <NotebookPicker
                    value={draft.notebook}
                    catalogue={catalogue}
                    disabled={busy}
                    onChange={(next) => setDraft({ ...draft, notebook: next })}
                  />
                </section>

                {/* The one anchor the page does offer. The table also holds
                    task_id and goal_id, and both are reachable from the API —
                    they are not here because a note is attached from the
                    *task*, which is where somebody is standing when they want
                    one. */}
                <section className="nt-meta-sec">
                  <h3>About a day</h3>
                  <input
                    type="date"
                    className="nt-date"
                    value={draft.note_date}
                    max={isoDate()}
                    onChange={(event) => setDraft({ ...draft, note_date: event.target.value })}
                  />
                </section>

                <section className="nt-meta-sec">
                  <h3>Created</h3>
                  <p className="nt-meta-value">
                    {draft.id
                      ? stamp(rows.find((note) => note.id === draft.id)?.created_at ?? '')
                      : 'Not saved yet'}
                  </p>
                </section>

                <section className="nt-meta-sec">
                  <h3>Updated</h3>
                  <p className="nt-meta-value">
                    {draft.id
                      ? ago(rows.find((note) => note.id === draft.id)?.updated_at ?? '')
                      : '—'}
                  </p>
                </section>
              </aside>
            </div>

            <footer className="nt-editor-foot">
              {message && <span className="nt-message">{message}</span>}
              <span className="nt-count">{words(draft.body).toLocaleString()} words</span>
              <span className="nt-count">{draft.body.length.toLocaleString()} characters</span>
              <button
                type="button"
                className="nt-save"
                disabled={busy || !dirty}
                onClick={() => void submit()}
              >
                {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Save note'}
              </button>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}
