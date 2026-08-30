/**
 * The app's navigation — a rail down the left-hand side.
 *
 * It was a bar across the top until the calendar was redesigned against a
 * mock-up that had a rail, and a rail on one page with a bar on every other is
 * two apps. So this replaces the bar everywhere: the way home, the
 * destinations, and — in the foot — how far the account has got. The theme
 * switch and the account menu stood here too until a bar came back across the
 * top and they went to it, which is where a reader looks for them.
 *
 * **The layout contract is a variable, not a shape.** Pages do not know what
 * the navigation looks like; they know that `--rail-w` is taken from the left
 * and `--topnav-h` from the top. `--topnav-h` sat at 0 through the years the
 * rail was the only navigation, kept because a dozen stylesheets size
 * themselves with `calc(100vh - var(--topnav-h))` — and subtracting nothing was
 * the right answer, not a shim, which is what let the navigation turn ninety
 * degrees without a single page's height arithmetic changing. `Topbar` gave it
 * a height again and those same pages gave the height back, untouched.
 *
 * Collapsing works the same way it always did, through the same class:
 * `html.nav-collapsed` drops `--rail-w` to a strip wide enough for the icons,
 * and every page widens into it without knowing why. What changed is where the
 * answer is kept. It is a preference on the account now (Settings, Appearance),
 * so a rail folded on the laptop is folded on the tablet — and the localStorage
 * key it used to live in alone is still written, as a cache: the account's
 * answer arrives a moment after the first paint, and without something to open
 * on, a collapsed rail would swing open and shut on every load.
 *
 * The rank and XP in the foot are the one thing here that reads account data,
 * and it reads `/api/stats` — six integers — rather than the account's whole
 * task list, which is what it used to arrive attached to. The rail is mounted
 * outside the router, so that is one call for the session rather than one per
 * page — and because it never unmounts, it would otherwise still be showing
 * the level you had when you opened the app. The dashboard
 * announces `ascen:stats-changed` when a completion moves the total, and this
 * listens. A custom event rather than shared state because that is the whole of
 * the dependency: one number, one direction, no reply.
 *
 * **The foot says what you are, not who you are.** It used to be an avatar and
 * a username — the name you already typed to get in, over a picture, above the
 * same level the bar below it was drawing. Now it is the rank the level earns
 * you and the bar that gets you to the next one, which is the only thing on
 * this screen that changes when you finish something. Who is signed in belongs
 * to the top bar's account menu, which is also where the avatar picker went
 * when the plate that used to open it stopped existing.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth, useMediaQuery, useSettings, useStats } from '@/hooks';
import { format } from '@/utils';
import { rankFor } from '@/utils/mastery';
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
  /**
   * Show this one in the phone's bottom bar.
   *
   * Four of the ten, because a bar is only as wide as the phone. All ten were
   * laid out across 375px and the last two — Records and Settings — were
   * simply off the end of the screen: measured at x 352-393 and 395-436, with
   * nothing to scroll. Two whole sections of the app were unreachable on a
   * phone. The other six are one tap away behind More.
   *
   * These four because they are the ones a phone is *for*: what is on today,
   * what is next, what is due, and what it is all toward. The reference pages
   * — analytics, records, the skill tree — are what a desk is for.
   */
  phone?: boolean;
}

/**
 * The width below which the rail lies down along the bottom of the screen.
 *
 * The same 640px as the `@media (max-width: 640px)` block in styles/rail.css,
 * and the duplication is the point of naming it: below this the rail is not a
 * narrower rail, it is a different component with four tabs and a sheet. CSS
 * cannot express "render six of these somewhere else", so the breakpoint has
 * to exist in both places. If one moves, move the other.
 */
const PHONE = '(max-width: 640px)';

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
    phone: true,
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
    phone: true,
    label: 'Calendar',
    icon: (
      <svg {...stroke}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    // Points at Recommendations rather than the Overview, which is a change and
    // a deliberate one: the rail's job is to put a reader somewhere useful, and
    // of the seven tabs it is the only one that ends in something to do. The
    // Overview is one click along the bar for anyone who wants the totals.
    to: '/recommendations',
    // The page calls itself Advanced Analytics; the rail says Analytics. The
    // rail is a column of one-word destinations and the odd two-word one
    // wraps — the heading is where the full name belongs.
    label: 'Analytics',
    // `/records` is gone from this list: it is the Records entry below now, and
    // leaving it here would light Analytics up while the reader is on a page
    // that has its own entry. The analytics tab of that name is
    // `/analytics/records`, which is here in its place.
    also: [
      '/analytics',
      '/analytics/records',
      '/analytics/goals',
      '/trends',
      '/habits',
      '/insights',
      '/subjects',
      '/growth',
    ],
    icon: (
      <svg {...stroke}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  // Growth had an entry here until its five tabs became four tabs of the
  // analytics page and one duplicate of its Overview. Insights and
  // Recommendations had entries before that, for the same reason and with the
  // same ending. The rail points at the one page once and the tab bar does the
  // rest — a rail entry per tab would be the same destination listed seven
  // times. Every one of those URLs still works and still opens the right tab;
  // see `Tab.also` above, and the `/growth` redirect in App.tsx.
  {
    to: '/tasks',
    phone: true,
    label: 'Tasks',
    icon: (
      <svg {...stroke}>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    to: '/goals',
    phone: true,
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
    // The one two-word label here, and the note above warns those wrap. This
    // one does not — it fits the open rail on a line and the collapsed rail
    // shows the icon alone like every other entry. "Skills" would have been
    // one word and the wrong one: the analytics page has a Skills tab
    // answering a different question, and two destinations sharing a name is
    // worse than a label a character longer than the rest.
    //
    // Singular, matching the page's own heading: the page is one graph with a
    // category picker, not a shelf of trees, and the rail saying otherwise
    // would promise a different screen from the one it opens.
    to: '/skill-trees',
    label: 'Skill Tree',
    // The path the placeholder reserved, kept so links to it still land.
    also: ['/growth-tree'],
    icon: (
      <svg {...stroke}>
        <path d="M12 21v-8" />
        <path d="M12 13 7.5 9.5M12 13l4.5-3.5" />
        <circle cx="12" cy="4" r="2.2" />
        <circle cx="5.5" cy="8" r="2.2" />
        <circle cx="18.5" cy="8" r="2.2" />
        <path d="M12 6.2v2.4" />
      </svg>
    ),
  },
  {
    to: '/notes',
    label: 'Notes',
    icon: (
      <svg {...stroke}>
        <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M15 3v5h5M8.5 13h7M8.5 17h4" />
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
    // Under Achievements, and beside it on purpose: both are the account
    // looking back at itself. An achievement is a thing the app decided was
    // worth marking; a record is the reader's own high score, which is theirs
    // whether or not anything was awarded for it.
    to: '/records',
    label: 'Records',
    icon: (
      <svg {...stroke}>
        <path d="M4 20V9M9.5 20V4M15 20v-8M20.5 20v-5" />
        <path d="M3 20h18" />
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
  const { status } = useAuth();
  const { stats, reload } = useStats();
  // Only for `Tab.also` — NavLink handles its own path on every other entry.
  const { pathname } = useLocation();

  const { prefs, ready, update } = useSettings();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false; // private mode: the rail just starts open
    }
  });

  // The account's answer, once it has arrived, is the one that counts — the
  // cache above was only ever a guess at it. This is also what makes the switch
  // on the settings page move the rail: the preference changes, and this hears.
  useEffect(() => {
    if (ready) setCollapsed(prefs.nav_collapsed);
  }, [prefs.nav_collapsed, ready]);

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

  /* Applied here and stored in the background. A rail that waited for a round
     trip before folding would feel broken on a slow connection, and there is
     nothing to roll back to if the write fails — the class is already right,
     and the next load reads the cache. */
  const flip = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    void update({ nav_collapsed: next });
  }, [collapsed, update]);

  // The level below is read once for the session; this is how it hears that
  // finishing something has moved it.
  useEffect(() => {
    const onChanged = () => reload();
    window.addEventListener(STATS_CHANGED, onChanged);
    return () => window.removeEventListener(STATS_CHANGED, onChanged);
  }, [reload]);

  const signedIn = status === 'signed-in';
  const level = stats ? format.levelForTotalXp(stats.xp) : null;
  /* The same twenty band names the skill trees use, read off the account level
     rather than a subject's. One ladder of names across the app: "Adept" has to
     mean the same distance travelled wherever it is printed, or it is
     decoration. */
  const rank = level ? rankFor(level.level) : null;

  /* Below the breakpoint the bar shows four tabs and a More sheet; above it,
     all ten in a column. See PHONE and the `phone` flag on Tab. */
  const phone = useMediaQuery(PHONE);
  const shown = phone ? TABS.filter((tab) => tab.phone) : TABS;
  const rest = phone ? TABS.filter((tab) => !tab.phone) : [];

  /* Closed on arrival, and closed again the moment the reader lands
     somewhere — a sheet still open over the page it just navigated to is a
     sheet the reader has to dismiss to see what they asked for. */
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <nav className="rail" aria-label="Main">
      {/* Mark and wordmark are both the link home. The mark used to be a bare
          span, because the easter egg counted clicks on it and had to cancel
          the navigation to do so — a logo that quietly stopped going home in
          dark mode. The egg's ten clicks live on the dashboard's daily quote
          now (hooks/useQuoteEgg.ts), which is not a link and has nothing to
          cancel, so the mark is a link again and behaves like one in both
          themes.

          The mark is drawn inline rather than loaded from /static/images: the
          file is a one-colour near-black glyph, which needed `mix-blend-mode:
          multiply` to sit on white and an `invert(1)` to survive the dark rail
          — two hacks to fake a colour it did not have. Inline, the A and its
          detached foot are two paths that take the brand's violet directly and
          lighten in dark like everything else. Same geometry as the file, so
          the two marks are still the same mark. */}
      <div className="rail-brand">
        <NavLink className="rail-brand-mark" to="/home" aria-label="Ascen home">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path
              className="rail-mark-body"
              fillRule="evenodd"
              d="M49 19 L81 80 L17 80 Z M49 49 L63 75 L37 75 Z"
            />
            <rect
              className="rail-mark-foot"
              x="57"
              y="57"
              width="31"
              height="15"
              rx="7.5"
              transform="rotate(30 72.5 64.5)"
            />
          </svg>
        </NavLink>
        <NavLink className="rail-brand-name" to="/home">
          Ascen
        </NavLink>

        {/* Three lines rather than the chevron it was. The chevron pointed at
            the edge it folded into, which is the honest icon for a panel and
            the wrong one for a rail that is never fully gone — it leaves a
            strip of icons behind, and a reader who has seen it do that once
            reads the lines as "the menu" and the chevron as "close". */}
        <button
          type="button"
          className="rail-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={flip}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <div className="rail-links">
        {shown.map((tab) => (
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

        {/* The other six, on a phone. Lit when the reader is on one of them,
            so the bar still answers "where am I" for every page in the app
            rather than only for the four it has room to name. */}
        {phone && (
          <button
            type="button"
            className={`rail-link rail-more${moreOpen ? ' is-open' : ''}${
              rest.some((tab) => tab.to === pathname || tab.also?.includes(pathname))
                ? ' active'
                : ''
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((was) => !was)}
          >
            <svg {...stroke}>
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
            <span>More</span>
          </button>
        )}
      </div>

      {phone && moreOpen && (
        <>
          {/* Tapping anywhere else closes it, which is what a sheet has to do
              on a device with no Escape key. */}
          <button
            type="button"
            className="rail-sheet-scrim"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="rail-sheet" role="menu">
            {rest.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                role="menuitem"
                className={({ isActive }) =>
                  `rail-sheet-link${
                    isActive || tab.also?.includes(pathname) ? ' active' : ''
                  }`
                }
                onClick={() => setMoreOpen(false)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </div>
        </>
      )}

      {/* The dark-mode switch stood here until it moved to the top bar, where
          the rest of the app's controls already were. See components/Topbar. */}
      <div className="rail-foot">
        {signedIn ? (
          /* Nothing at all until the account read lands. The alternative is a
             plate reading "Beginner, level 1" for a second on every load, which
             is a wrong answer rather than a missing one — and the reader it is
             wrong for is the one who has been playing longest. */
          level &&
          rank && (
            <div className="rail-rank">
              {/* The whole name when the rail is open, the level's number when
                  it is a strip. "Grand Champion" in 54px of usable width is an
                  ellipsis, and an ellipsis is not a rank. */}
              <span className="rail-rank-title" title={`${rank} · Level ${level.level}`}>
                {rank}
              </span>
              <span className="rail-rank-num" aria-hidden="true">
                {level.level}
              </span>

              <div className="rail-xp-row">
                <span>Level {level.level}</span>
                <span>{format.number(stats?.xp ?? 0)} XP</span>
              </div>
              <div
                className="rail-xp-bar"
                role="progressbar"
                aria-valuenow={Math.round(level.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${rank}, level ${level.level} progress`}
              >
                <i style={{ width: `${level.percent}%` }} />
              </div>
            </div>
          )
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
