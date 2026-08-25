/**
 * The bar across the top of every app page — search, alerts, and the account.
 *
 * The rail turned ninety degrees a while ago and took the top bar with it,
 * which left `--topnav-h` declared and set to zero. This gives it a value
 * again, and that is the whole of the layout change: a dozen stylesheets size
 * themselves with `calc(100vh - var(--topnav-h))`, so the pinned pages gave the
 * bar its height back without one of them being edited. See styles/rail.css,
 * where the variable and the reason it survived are written down.
 *
 * **Everything in it does something.** A chrome bar is the easiest place in an
 * app to put three shapes that look like features, and the badge is the worst
 * offender — a red 3 that is always 3 trains people to ignore every badge you
 * will ever show them. So:
 *
 *   **Search** reads the account's own tasks and goes to the one you pick. Not
 *   a global search over a corpus that does not exist; the placeholder says
 *   which, so nobody types a subject into it and concludes the app is broken.
 *   **Alerts** are counted from the record — work that is late, work due today,
 *   and a streak that will break tonight. Nothing is generated on a schedule,
 *   so an account in good order gets no badge at all, which is what makes the
 *   badge worth looking at on the day it appears.
 *   **Dark mode** is a switch, not a two-option dropdown — it stood in the
 *   rail's foot until the foot became the rank and the XP bar, and it belongs
 *   with the rest of the app's controls anyway.
 *   **The account menu** is now the only one: who is signed in, the level, the
 *   fifty pictures, and the way out. It inherited the avatar picker from the
 *   rail, whose account plate is gone — a picker with no way to open it is a
 *   deleted feature with extra steps.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useSettings, useTheme, useUserData } from '@/hooks';
import { AVATARS, avatarPath } from '@/services/avatars';
import { auth } from '@/services';
import { format } from '@/utils';
import { isoDate } from '@/utils/dates';
import type { Task, Theme } from '@/types';
import '@/styles/topbar.css';

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** How many matches the search drops down. Enough to choose from, few enough to scan. */
const RESULTS = 6;

// --------------------------------------------------------------------------
// Alerts
// --------------------------------------------------------------------------
interface Alert {
  id: string;
  tone: 'late' | 'today' | 'streak';
  title: string;
  detail: string;
  to: string;
}

/**
 * What the record says is worth interrupting somebody about.
 *
 * Three kinds, and each is a fact rather than a nudge: a task whose deadline
 * has passed, a task due today, and a streak with nothing on the board yet.
 * The last one is the only one with any urgency built in, and it earns it —
 * a streak is the one thing in the app that can be lost by doing nothing, and
 * it is lost at midnight rather than gradually.
 *
 * Deliberately not here: anything about how much was done, how it compared to
 * last week, or what the reader could be doing better. That is what the
 * analytics page is for, it is never urgent, and a bell that rings about it is
 * a bell people turn off.
 */
function alertsFrom(tasks: Task[], streak: number): Alert[] {
  const today = isoDate();
  const out: Alert[] = [];

  const open = tasks.filter((task) => task.status !== 'done');
  const dueDay = (task: Task) => String(task.due_date || '').slice(0, 10);

  const late = open.filter((task) => dueDay(task) && dueDay(task) < today);
  const due = open.filter((task) => dueDay(task) === today);

  if (late.length > 0) {
    out.push({
      id: 'late',
      tone: 'late',
      title:
        late.length === 1
          ? '1 task is past its date'
          : `${late.length} tasks are past their dates`,
      detail:
        late.length === 1
          ? late[0]!.title
          : `Oldest: ${[...late].sort((a, b) => dueDay(a).localeCompare(dueDay(b)))[0]!.title}`,
      to: '/tasks',
    });
  }

  if (due.length > 0) {
    out.push({
      id: 'today',
      tone: 'today',
      title: `${due.length} ${due.length === 1 ? 'task is' : 'tasks are'} due today`,
      detail: due.length === 1 ? due[0]!.title : `Including ${due[0]!.title}`,
      to: '/tasks',
    });
  }

  // Nothing finished today, and something to lose by leaving it that way.
  const finishedToday = tasks.some(
    (task) => task.status === 'done' && String(task.completed_at || '').slice(0, 10) === today,
  );
  if (streak > 0 && !finishedToday) {
    out.push({
      id: 'streak',
      tone: 'streak',
      title: `Your ${streak}-day streak has nothing on it yet`,
      detail: 'Anything finished today keeps it. It resets at midnight.',
      to: '/dashboard',
    });
  }

  return out;
}

// --------------------------------------------------------------------------
// The bar
// --------------------------------------------------------------------------
export function Topbar() {
  const { username, avatar, signOut, refresh } = useAuth();
  /* The name the account calls itself, which is the one the dashboard greets
     it by. The bar used to show `username` while the greeting under it showed
     `displayName`, so an account named "temu" with the username "Alpha" read
     as two people on one screen. One name on the surface; the username is in
     the menu below, which is where "which account am I in" belongs. */
  const { displayName } = useSettings();
  const { theme, setTheme } = useTheme();
  /*
   * A second read of /api/get_user_data — the rail makes the first, for the
   * level under the avatar. Two small GETs per page load rather than a store
   * shared between two components that mount once each and never unmount: the
   * shared version is the right answer the moment a third caller appears, and
   * inventing it for the second is more machinery than the call costs.
   */
  const { data } = useUserData();
  const navigate = useNavigate();

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const streak = data?.stats?.current_streak ?? 0;
  const level = data ? format.levelForTotalXp(data.stats.xp) : null;

  const alerts = useMemo(() => alertsFrom(tasks, streak), [streak, tasks]);

  const [open, setOpen] = useState<'search' | 'alerts' | 'account' | null>(null);
  const [query, setQuery] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A click anywhere else closes whatever is open. One listener for all three
  // panels, because only one is ever open at a time.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open === 'search') inputRef.current?.focus();
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return tasks
      .filter((task) => task.title.toLowerCase().includes(needle))
      // Unfinished first: a search on a to-do list is nearly always somebody
      // looking for something they still have to do.
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
      .slice(0, RESULTS);
  }, [query, tasks]);

  const toggle = useCallback(
    (panel: 'search' | 'alerts' | 'account') =>
      setOpen((current) => (current === panel ? null : panel)),
    [],
  );

  const chooseAvatar = useCallback(
    async (name: string) => {
      const result = await auth.setAvatar(name);
      // Re-ask rather than assuming: the server is what decides which picture
      // an account has, and it rejects a name that is not one of the fifty.
      if (result.success) await refresh();
    },
    [refresh],
  );

  /** Which of the fifty is currently the account's, by filename. */
  const currentAvatar = avatar.split('/').pop()?.replace('.svg', '') ?? '';

  return (
    <header className="topbar" ref={barRef}>
      <div className="topbar-actions">
        {/* ---- Search ---- */}
        <div className="topbar-slot">
          <button
            type="button"
            className={`topbar-btn${open === 'search' ? ' is-on' : ''}`}
            aria-label="Search your tasks"
            aria-expanded={open === 'search'}
            onClick={() => toggle('search')}
          >
            <svg {...stroke}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          {open === 'search' && (
            <div className="topbar-panel topbar-search">
              <input
                ref={inputRef}
                type="search"
                className="topbar-search-input"
                placeholder="Search your tasks"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && matches[0]) {
                    setOpen(null);
                    navigate('/tasks');
                  }
                }}
              />
              {query.trim() === '' ? (
                <p className="topbar-empty">
                  Find a task by name.
                </p>
              ) : matches.length === 0 ? (
                <p className="topbar-empty">No task matches “{query.trim()}”.</p>
              ) : (
                <ul className="topbar-results">
                  {matches.map((task) => (
                    <li key={task.id}>
                      <Link to="/tasks" onClick={() => setOpen(null)}>
                        <span className={`topbar-dot is-${task.status === 'done' ? 'done' : 'open'}`} />
                        <span className="topbar-result-name">{task.title}</span>
                        <span className="topbar-result-meta">
                          {task.status === 'done' ? 'Done' : `${task.xp_value} XP`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ---- Alerts ---- */}
        <div className="topbar-slot">
          <button
            type="button"
            className={`topbar-btn${open === 'alerts' ? ' is-on' : ''}`}
            aria-label={
              alerts.length === 0 ? 'Notifications: nothing waiting' : `Notifications: ${alerts.length}`
            }
            aria-expanded={open === 'alerts'}
            onClick={() => toggle('alerts')}
          >
            <svg {...stroke}>
              <path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {/* No badge at zero. A count that is always showing is furniture. */}
            {alerts.length > 0 && <span className="topbar-badge">{alerts.length}</span>}
          </button>

          {open === 'alerts' && (
            <div className="topbar-panel topbar-alerts">
              <div className="topbar-panel-head">Needs you</div>
              {alerts.length === 0 ? (
                <p className="topbar-empty">
                  Nothing late, nothing due today, streak safe.
                </p>
              ) : (
                <ul className="topbar-alert-list">
                  {alerts.map((alert) => (
                    <li key={alert.id}>
                      <Link to={alert.to} onClick={() => setOpen(null)}>
                        <span className={`topbar-alert-dot is-${alert.tone}`} aria-hidden="true" />
                        <span>
                          <strong>{alert.title}</strong>
                          <em>{alert.detail}</em>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ---- Dark mode ---- */}
        {/* The only control here that opens nothing, so it is the only one that
            does not sit in a `topbar-slot` — there is no panel to anchor. The
            icon shows the theme you would be switching to, which is the one
            question a reader has when they look at it. */}
        <button
          type="button"
          className={`topbar-btn topbar-theme${theme === 'dark' ? ' is-dark' : ''}`}
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label="Dark mode"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme((theme === 'dark' ? 'light' : 'dark') as Theme)}
        >
          {theme === 'dark' ? (
            <svg {...stroke}>
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
            </svg>
          ) : (
            <svg {...stroke}>
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          )}
        </button>

        {/* ---- Account ---- */}
        <div className="topbar-slot">
          <button
            type="button"
            className={`topbar-account${open === 'account' ? ' is-on' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === 'account'}
            onClick={() => toggle('account')}
          >
            <img className="topbar-avatar" src={avatar} alt="" width={34} height={34} />
            <span className="topbar-name">{displayName || username}</span>
            <svg className="topbar-caret" {...stroke} strokeWidth={2.2}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {open === 'account' && (
            <div className="topbar-panel topbar-account-menu" role="menu">
              <div className="topbar-account-head">
                <strong>{displayName || username}</strong>
                {/* The username, where it is an answer rather than a label:
                    the menu is where somebody checks which account they are
                    signed in to. Only shown when it differs from the name
                    above it, so an account that never set one does not read
                    its own username twice. */}
                {displayName && displayName !== username && <span>@{username}</span>}
                {level && (
                  <span>
                    Level {level.level} · {format.number(data?.stats.xp ?? 0)} XP
                  </span>
                )}
              </div>
              {/* All fifty in one scrolling line, as they were in the rail.
                  A wrapping grid would be ten rows deep and turn a menu into a
                  page; the row is the shape that fits a menu. */}
              <div
                className="topbar-avatar-row"
                role="radiogroup"
                aria-label="Profile picture"
              >
                {AVATARS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    className={`topbar-avatar-option${
                      name === currentAvatar ? ' is-current' : ''
                    }`}
                    aria-checked={name === currentAvatar}
                    title={name}
                    aria-label={name}
                    onClick={() => void chooseAvatar(name)}
                  >
                    <img src={avatarPath(name)} alt="" width={34} height={34} loading="lazy" />
                  </button>
                ))}
              </div>

              <Link to="/dashboard" onClick={() => setOpen(null)}>
                Dashboard
              </Link>
              <Link to="/notes" onClick={() => setOpen(null)}>
                Notes
              </Link>
              <Link to="/settings" onClick={() => setOpen(null)}>
                Settings
              </Link>
              <button type="button" className="topbar-signout" onClick={() => void signOut()}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
