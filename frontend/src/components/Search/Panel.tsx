/**
 * The top bar's search: two categories, a cursor, and no Enter key.
 *
 * ## What it looks for
 *
 * **Tasks** — the account's own work, matched by the server
 * (`/api/tasks/search`), because the task list is the largest thing this app
 * owns and filtering it in the browser is what the top bar used to do.
 *
 * **Components** — the containers the app is made of: pages, the tabs inside
 * them, the sections of Settings. Matched locally against utils/siteIndex,
 * which is where the words a reader actually types are written down.
 *
 * Both are scored on one scale, so "the closest match" means something across
 * the two of them rather than within each.
 *
 * ## It takes you there rather than waiting for Enter
 *
 * The closest match is the cursor's first position and the app goes there.
 * `›` steps to the next match and goes there too; `‹` steps back. So the way
 * to use this is to type until you can see where you are, then walk the
 * matches until the page behind the panel is the one you wanted — which is
 * faster than reading a list, and is the whole reason the arrows are the
 * control rather than a highlighted row waiting on a keypress.
 *
 * Enter still works. It closes the panel, because by then you are already
 * where it would have sent you.
 *
 * ## Why the navigation is an effect on the cursor
 *
 * Every path into this — typing, the arrows, the keyboard, clicking a row —
 * ends in "the cursor is now at N". Navigating from each of those separately
 * is four chances to disagree; navigating from the cursor is one. It is also
 * what makes the behaviour honest while typing: the list is recomputed on
 * change, the cursor lands back on the closest match, and the effect moves the
 * page only when that match is somewhere the reader is not.
 *
 * Replaced rather than pushed. A dozen keystrokes must not become a dozen
 * entries in the history — the reader's Back should be the page they were on
 * before they opened the search, not the eleventh thing the search flew past.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tasks as taskService } from '@/services';
import { findPlaces, placePoints, score } from '@/utils/siteIndex';
import type { Place } from '@/utils/siteIndex';
import type { Task } from '@/types';
import '@/styles/search.css';

/** How many of each category the panel lists. Enough to choose from. */
const PER_CATEGORY = 6;

/** How long the typing has to settle before the server is asked. */
const SETTLE_MS = 180;

export interface Hit {
  key: string;
  kind: 'component' | 'task';
  name: string;
  /** The line under the name: where it lives, or what the task is worth. */
  meta: string;
  /** Where going to it means going. */
  to: string;
  points: number;
}

function taskHit(needle: string, task: Task): Hit {
  return {
    key: `task:${task.id}`,
    kind: 'task',
    name: task.title,
    meta: task.status === 'done'
      ? 'Done'
      : `${(Number(task.xp_value) || 0).toLocaleString()} XP`,
    /* The task's own id in the query, so stepping between two task matches is
       a move rather than the same page twice — pages/Tasks reads it, reveals
       the row and marks it. */
    to: `/tasks?task=${encodeURIComponent(task.id)}`,
    points: score(needle, task.title),
  };
}

function placeHit(needle: string, place: Place): Hit {
  return {
    key: `place:${place.id}`,
    kind: 'component',
    name: place.name,
    meta: place.where || 'Page',
    to: place.to,
    points: placePoints(needle, place),
  };
}

export interface SearchPanelProps {
  /** Close the panel — following a match by hand should not leave it open. */
  onClose: () => void;
}

export function SearchPanel({ onClose }: SearchPanelProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Task[]>([]);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const needle = query.trim();

  /*
   * The task half, from the server.
   *
   * Debounced rather than sent per keystroke, and the guard is a ticket rather
   * than a cancel: replies arrive out of order, and the one that matters is
   * the one for the text currently in the box.
   */
  const ticket = useRef(0);
  useEffect(() => {
    if (!needle) {
      setFound([]);
      return;
    }
    const mine = ++ticket.current;
    const timer = window.setTimeout(() => {
      void taskService.searchTasks(needle).then((result) => {
        if (mine !== ticket.current) return;
        setFound(result.success ? result.tasks.slice(0, PER_CATEGORY) : []);
      });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [needle]);

  /** The component half, which needs nobody's permission and is instant. */
  const places = useMemo(
    () => (needle ? findPlaces(needle, PER_CATEGORY) : []),
    [needle],
  );

  const components = useMemo(
    () => places.map((place) => placeHit(needle, place)),
    [places, needle],
  );

  const hits = useMemo(
    () => found.map((task) => taskHit(needle, task)),
    [found, needle],
  );

  /**
   * Both categories on one scale, closest first.
   *
   * A task the server returned that the scorer gives nothing to still counts —
   * the server matches on a substring the same way, so a zero here means the
   * two disagree about wording rather than that the task is not a match. It
   * sorts last rather than disappearing.
   */
  const all = useMemo(
    () => [...components, ...hits].sort((a, b) => b.points - a.points),
    [components, hits],
  );

  /* Back to the closest match whenever the matches change — which is what
     makes typing feel like steering rather than like a list refreshing under
     a selection that no longer means anything. */
  const shape = all.map((hit) => hit.key).join('|');
  useEffect(() => {
    setCursor(0);
  }, [shape]);

  const current = all[Math.min(cursor, Math.max(0, all.length - 1))];

  /*
   * The one place navigation happens.
   *
   * Guarded on the *destination* rather than on where the browser ended up,
   * and that distinction is load-bearing. Some of the app's paths are
   * redirects — `/calendar` sends you to whichever view the account prefers
   * (App.tsx) — so "navigate unless the location already matches" never
   * settles for those: the effect asks for `/calendar`, the router lands on
   * `/calendar/week`, the location no longer matches, and it asks again,
   * forever.
   *
   * Remembering what was last asked for ends it after one go. It also gets a
   * second thing right for free: a reader who clicks something on the page
   * while the panel is open is not dragged back to the match.
   *
   * `replace`, so a dozen keystrokes are one history entry rather than twelve
   * — Back should be the page they were on before they opened the search.
   *
   * And it waits for the typing to settle, on the same beat the task search
   * does. The list and the highlight move on every keystroke — that is what
   * makes it feel live — but the *page* does not, because "calendar" typed at
   * speed would otherwise drag the router through Calendar, Analytics,
   * Achievements and Notes on the way, fetching a lazy chunk for each. An arrow
   * press pays the same 180ms and nobody has ever noticed 180ms.
   */
  const here = pathname + search;
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!current || sent.current === current.to) return;
    const timer = window.setTimeout(() => {
      sent.current = current.to;
      if (current.to === here) return;
      navigate(current.to, { replace: true });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [current, here, navigate]);

  const step = useCallback(
    (by: number) => {
      if (all.length < 2) return;
      setCursor((at) => (at + by + all.length) % all.length);
    },
    [all.length],
  );

  const onKey = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onClose();
        return;
      }
      // Down and Up rather than Right and Left: the arrows on screen are
      // buttons, and Right in a text field belongs to the caret.
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        step(-1);
      }
    },
    [onClose, step],
  );

  const at = current ? all.indexOf(current) : -1;

  return (
    <div className="sf-panel">
      <input
        ref={inputRef}
        type="search"
        className="sf-input"
        placeholder="Search tasks and pages"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKey}
      />

      {!needle ? (
        <p className="sf-empty">
          Two things are searched: your <strong>tasks</strong>, and the{' '}
          <strong>components</strong> this app is made of — every page, tab and
          settings section. You are taken to the closest match as you type;{' '}
          <span className="sf-key">›</span> walks the rest.
        </p>
      ) : all.length === 0 ? (
        <p className="sf-empty">Nothing matches “{needle}”.</p>
      ) : (
        <>
          {/* Where you are, and the two controls that move it. */}
          <div className="sf-cursor">
            <button
              type="button"
              className="sf-step"
              aria-label="Previous match"
              disabled={all.length < 2}
              onClick={() => step(-1)}
            >
              ‹
            </button>
            <span className="sf-at">
              <strong>{current?.name}</strong>
              <em>
                {at + 1} of {all.length} ·{' '}
                {current?.kind === 'task' ? 'Tasks' : 'Components'}
              </em>
            </span>
            <button
              type="button"
              className="sf-step is-next"
              aria-label="Next match"
              disabled={all.length < 2}
              onClick={() => step(1)}
            >
              ›
            </button>
          </div>

          <Group
            label="Components"
            rows={components}
            current={current}
            all={all}
            onPick={setCursor}
            onClose={onClose}
          />
          <Group
            label="Tasks"
            rows={hits}
            current={current}
            all={all}
            onPick={setCursor}
            onClose={onClose}
          />
        </>
      )}
    </div>
  );
}

function Group({
  label,
  rows,
  current,
  all,
  onPick,
  onClose,
}: {
  label: string;
  rows: Hit[];
  current: Hit | undefined;
  all: Hit[];
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  if (!rows.length) return null;

  return (
    <div className="sf-group">
      <div className="sf-group-head">{label}</div>
      <ul className="sf-list">
        {rows.map((hit) => (
          <li key={hit.key}>
            <button
              type="button"
              className={`sf-row${hit.key === current?.key ? ' is-at' : ''}`}
              /* Moving the cursor rather than navigating, so a click goes
                 through the same one place every other path does. */
              onClick={() => {
                onPick(all.indexOf(hit));
                onClose();
              }}
            >
              <span className={`sf-mark is-${hit.kind}`} aria-hidden="true" />
              <span className="sf-row-name">{hit.name}</span>
              <span className="sf-row-meta">{hit.meta}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
