/**
 * The top bar.
 *
 * The React counterpart of frontend/html/partials/topnav.html, and it emits
 * the **same markup with the same class names on purpose** — `.topnav-inner`,
 * `.topnav-link`, `.topnav-right`, `.account-menu` — because both frontends
 * are dressed by the one src/styles/navbar.css. Rename a class here and the
 * bar loses its styling; rename it in the stylesheet and the old pages lose
 * theirs. They move together until the old pages are gone.
 *
 * Three behaviours the template delegated to frontend/js/topnav.js are done
 * here instead, in React rather than by hand:
 *
 *   * the collapse toggle, whose state is remembered in localStorage under the
 *     same key (`topnavCollapsed`) and applied as `nav-collapsed` on <html>,
 *     so collapsing on an old page and landing on a React one agrees;
 *   * the account menu's open/closed state, and closing it on an outside click;
 *   * the avatar picker.
 *
 * The fifty avatar names are not fetched: the server-rendered version had them
 * inline so the menu opens instantly, and there is no reason for this one to
 * be slower. They are in src/services/avatars.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, useTheme } from '@/hooks';
import { AVATARS, avatarPath } from '@/services/avatars';
import { auth } from '@/services';
import type { Theme } from '@/types';

const COLLAPSE_KEY = 'topnavCollapsed';

interface Tab {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// The app's own pages, and only those. Home is not among them: the wordmark
// in the brand is the way back to the landing page, and one route home in the
// bar is enough. See partials/topnav.html, which lists the same five.
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
    to: '/growth',
    label: 'Growth',
    icon: (
      <svg {...stroke}>
        <path d="M3 17L9 11l4 4 8-8" />
        <path d="M16 7h5v5" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: (
      <svg {...stroke}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
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
];

export function Navbar() {
  const { status, username, avatar, signOut, refresh } = useAuth();
  const { theme, setTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false; // private mode: the bar just starts open
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // `nav-collapsed` on <html> is what shrinks --topnav-h; every page sizes
  // itself off that variable, so the page grows into the space on its own.
  useEffect(() => {
    document.documentElement.classList.toggle('nav-collapsed', collapsed);
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* see above */
    }
  }, [collapsed]);

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

  return (
    <nav className="topnav" aria-label="Main">
      <div className="topnav-inner" id="topnavInner">
        {/* The mark is a span, not a link: secret/easter-egg.js counts clicks
            on it. The wordmark beside it is the link home. */}
        <div className="topnav-brand">
          <span className="topnav-brand-mark" id="topnavBrandMark">
            <img src="/static/images/logo.svg" alt="" />
          </span>
          <NavLink className="topnav-brand-name" to="/home">
            Ascen
          </NavLink>
        </div>

        <div className="topnav-links">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `topnav-link${isActive ? ' active' : ''}`
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="topnav-right">
          <div className="topnav-theme">
            <svg
              className="topnav-sun"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
            <select
              id="themeSelect"
              aria-label="Theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {signedIn && (
            <div className="topnav-account" ref={accountRef}>
              <button
                type="button"
                className="topnav-avatar-btn"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <img
                  className="topnav-avatar"
                  src={avatar}
                  alt=""
                  title={username ?? ''}
                  width={38}
                  height={38}
                />
              </button>

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
          )}

          {!signedIn && (
            <NavLink className="topnav-link" to="/home?auth=login">
              <span>Log In</span>
            </NavLink>
          )}

          <button
            type="button"
            className="topnav-toggle"
            aria-expanded={!collapsed}
            aria-controls="topnavInner"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={() => setCollapsed((value) => !value)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 15 6-6 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
