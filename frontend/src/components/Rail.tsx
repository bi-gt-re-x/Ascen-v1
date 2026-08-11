/**
 * The app's navigation — a rail down the left-hand side.
 *
 * It was a bar across the top until the calendar was redesigned against a
 * mock-up that had a rail, and a rail on one page with a bar on every other is
 * two apps. So this replaces the bar everywhere, and carries everything the bar
 * carried: the way home, the destinations, the theme, and the account menu with
 * its fifty pictures and its way out.
 *
 * **The layout contract is a variable, not a shape.** Pages do not know what
 * the navigation looks like; they know that `--rail-w` is taken from the left
 * and `--topnav-h` from the top. `--topnav-h` is 0 now and kept only because a
 * dozen stylesheets size themselves with `calc(100vh - var(--topnav-h))`, and
 * subtracting nothing is exactly right — the rail costs height nowhere. That is
 * what let the navigation turn ninety degrees without a single page's height
 * arithmetic changing.
 *
 * Collapsing works the same way it always did, through the same class and the
 * same localStorage key: `html.nav-collapsed` drops `--rail-w` to a strip wide
 * enough for the icons, and every page widens into it without knowing why.
 *
 * The level and XP under the avatar are the one thing here that reads account
 * data. The rail is mounted outside the router, so that is one call for the
 * session rather than one per page — and because it never unmounts, it would
 * otherwise still be showing the level you had when you opened the app. The
 * dashboard announces `ascen:stats-changed` when a completion moves the total,
 * and this listens. A custom event rather than shared state because that is the
 * whole of the dependency: one number, one direction, no reply.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth, useTheme, useUserData } from '@/hooks';
import { AVATARS, avatarPath } from '@/services/avatars';
import { auth } from '@/services';
import { format } from '@/utils';
import type { Theme } from '@/types';
import '@/styles/rail.css';

const COLLAPSE_KEY = 'topnavCollapsed';

/** Fired by the dashboard when a completion moves the XP total. */
export const STATS_CHANGED = 'ascen:stats-changed';

interface Tab {
  to: string;
  label: string;
  icon: React.ReactNode;
  /**
   * Other paths this entry should light up for.
   *
   * The analytics page is five tabs on five URLs and one rail entry, so without
   * this the rail would show nothing selected on four of them while the reader
   * is plainly on the analytics page.
   */
  also?: string[];
}

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * The app's own pages. Home is not among them — the wordmark at the top is the
 * way back to the landing page, and one route home is enough.
 *
 * Dashboard leads because it is where signing in puts you. The rest follow the
 * design's order, with Growth kept: it is a built page, and a built page with
 * no way to reach it is a deleted page with extra steps.
 */
const TABS: Tab[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg {...stroke}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: (
      <svg {...stroke}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    // The page calls itself Advanced Analytics; the rail says Analytics. The
    // rail is a column of one-word destinations and the odd two-word one
    // wraps — the heading is where the full name belongs.
    label: 'Analytics',
    also: ['/trends', '/habits', '/insights', '/recommendations'],
    icon: (
      <svg {...stroke}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    to: '/growth',
    label: 'Growth',
    icon: (
      <svg {...stroke}>
        <path d="M3 17L9 11l4 4 8-8" />
        <path d="M16 7h5v5" />
      </svg>
    ),
  },
  // Insights and Recommendations had entries of their own here while they were
  // separate pages. They are two tabs of the analytics page now, so the rail
  // points at that page once and the tab bar does the rest — a rail entry per
  // tab would have been the same destination listed three times. Their URLs
  // still work and still open the right tab; see `Tab.also` above.
  {
    to: '/tasks',
    label: 'Tasks',
    icon: (
      <svg {...stroke}>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    to: '/goals',
    label: 'Goals',
    icon: (
      <svg {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    to: '/achievements',
    label: 'Achievements',
    icon: (
      <svg {...stroke}>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export function Rail() {
  const { status, username, avatar, signOut, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data, reload } = useUserData();
  // Only for `Tab.also` — NavLink handles its own path on every other entry.
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false; // private mode: the rail just starts open
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // `nav-collapsed` on <html> is what shrinks --rail-w; every page sizes itself
  // off that variable, so the page grows into the space on its own.
  useEffect(() => {
    document.documentElement.classList.toggle('nav-collapsed', collapsed);
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* see above */
    }
  }, [collapsed]);

  // The level below is read once for the session; this is how it hears that
  // finishing something has moved it.
  useEffect(() => {
    const onChanged = () => reload();
    window.addEventListener(STATS_CHANGED, onChanged);
    return () => window.removeEventListener(STATS_CHANGED, onChanged);
  }, [reload]);

  // A click anywhere else closes the account menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

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

  const signedIn = status === 'signed-in';
  const level = data ? format.levelForTotalXp(data.stats.xp) : null;

  return (
    <nav className="rail" aria-label="Main">
      {/* The mark is a span, not a link: secret/easter-egg.js counts clicks on
          it. The wordmark beside it is the link home. */}
      <div className="rail-brand">
        <span className="rail-brand-mark" id="topnavBrandMark">
          <img src="/static/images/logo.svg" alt="" />
        </span>
        <NavLink className="rail-brand-name" to="/home">
          Ascen
        </NavLink>

        <button
          type="button"
          className="rail-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="rail-links">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `rail-link${isActive || tab.also?.includes(pathname) ? ' active' : ''}`
            }
            title={tab.label}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="rail-foot">
        {/* The theme, as the design's switch rather than the bar's select. Two
            themes is a yes/no, and a two-option dropdown was always a switch
            wearing a dropdown's clothes. */}
        <button
          type="button"
          className={`rail-theme${theme === 'dark' ? ' is-dark' : ''}`}
          role="switch"
          aria-checked={theme === 'dark'}
          onClick={() => setTheme((theme === 'dark' ? 'light' : 'dark') as Theme)}
          title="Dark mode"
        >
          <span className="rail-theme-ico" aria-hidden="true">
            <svg {...stroke}>
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          </span>
          <span className="rail-theme-label">Dark Mode</span>
          <span className="rail-switch" aria-hidden="true">
            <i />
          </span>
        </button>

        {signedIn ? (
          <div className="rail-account" ref={accountRef}>
            <button
              type="button"
              className="rail-account-btn"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <img
                className="rail-avatar"
                src={avatar}
                alt=""
                title={username ?? ''}
                width={38}
                height={38}
              />
              <span className="rail-account-body">
                <span className="rail-account-name">{username}</span>
                {level && <span className="rail-account-level">Level {level.level}</span>}
              </span>
            </button>

            {level && (
              <>
                <div className="rail-xp-row">
                  <span>Level {level.level}</span>
                  <span>{format.number(data?.stats.xp ?? 0)} XP</span>
                </div>
                <div
                  className="rail-xp-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(level.percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Level ${level.level} progress`}
                >
                  <i style={{ width: `${level.percent}%` }} />
                </div>
              </>
            )}

            {/* Opens up and to the right of the avatar: the rail sits at the
                bottom-left of the screen, so a menu below it would be off the
                bottom of the window. */}
            <div className="account-menu" hidden={!menuOpen}>
              <div className="account-menu-head">
                <span className="account-menu-name" title={username ?? ''}>
                  {username}
                </span>
                <button
                  type="button"
                  className="account-logout"
                  onClick={() => void signOut()}
                >
                  <svg {...stroke}>
                    <path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  <span>Log Out</span>
                </button>
              </div>

              <div
                className="account-avatar-row"
                role="radiogroup"
                aria-label="Profile picture"
              >
                {AVATARS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    className={`account-avatar-option${
                      name === currentAvatar ? ' is-current' : ''
                    }`}
                    aria-checked={name === currentAvatar}
                    title={name}
                    aria-label={name}
                    onClick={() => void chooseAvatar(name)}
                  >
                    <img
                      src={avatarPath(name)}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* A plain Link, not a NavLink: it points at /home, so on the landing
             page NavLink would mark it active and paint it as the "you are
             here" pill, which it is not. */
          <Link className="rail-link rail-signin" to="/home?auth=login" title="Log In">
            <svg {...stroke}>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
            <span>Log In</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
