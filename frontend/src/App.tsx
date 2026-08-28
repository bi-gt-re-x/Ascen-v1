/**
 * The routing table, and the shell every page renders inside.
 *
 * The paths deliberately match the ones the server-rendered pages already use
 * — `/dashboard`, `/calendar`, `/goals`, `/growth`. That is what lets the two
 * frontends swap over a page at a time: nothing outside this file has to
 * change when a page moves from Jinja to React, and no link anywhere breaks.
 *
 * Pages are lazy so a route nobody visits costs nothing. `Dashboard` is the
 * exception — it is where a signed-in visitor lands, and a spinner on the
 * first paint of the landing page is exactly the wrong first impression.
 */
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppBoundary, Loading, Rail, Topbar } from '@/components';
import { RequireAccount } from './RequireAccount';
import { useAuth, usePinnedViewport, useSettings } from '@/hooks';
import Dashboard from '@/pages/Dashboard';
// Not lazy, unlike every other page here: the routes below are generated from
// `UNBUILT_PATHS`, so the module has to be loaded to build the routing table at
// all. Splitting it would put the same few hundred bytes of strings in a second
// chunk that is always already fetched.
import Unbuilt, { PATHS as UNBUILT_PATHS } from '@/pages/Unbuilt';
import type { Prefs } from '@/services/settings';

const Homepage = lazy(() => import('@/pages/Homepage'));
const Goals = lazy(() => import('@/pages/Goals'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const SkillTrees = lazy(() => import('@/pages/SkillTrees'));
const Notes = lazy(() => import('@/pages/Notes'));
const Records = lazy(() => import('@/pages/Records'));
const Settings = lazy(() => import('@/pages/Settings'));
const Achievements = lazy(() => import('@/pages/Achievements'));
const AboutUs = lazy(() => import('@/pages/AboutUs'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));

const CalendarDay = lazy(() => import('@/pages/Calendar/Day'));
const CalendarWeek = lazy(() => import('@/pages/Calendar/Week'));
const CalendarMonth = lazy(() => import('@/pages/Calendar/Month'));

/**
 * The front door.
 *
 * Signed in goes to whichever page the account opens on — the dashboard unless
 * they have said otherwise (Settings, General) — and everyone else lands on the
 * home page, the rule the server route at '/' used to apply before React owned
 * that path too (backend/routes/spa.py). Waiting on `status` matters for the
 * same reason it does in RequireAccount: treating "still asking" as signed out
 * would flash the landing page at an account on its way in. It waits on the
 * preferences too, and for the reason CalendarHome does: a redirect cannot be
 * taken back, so opening on the default and correcting a moment later would
 * make somebody who chose Tasks watch the dashboard load first.
 */
const HOME_PATHS: Record<Prefs['home_page'], string> = {
  dashboard: '/dashboard',
  tasks: '/tasks',
  calendar: '/calendar',
  goals: '/goals',
  analytics: '/analytics',
  notes: '/notes',
};
/**
 * `/calendar` itself, which is a redirect to whichever view the account
 * prefers. It waits for `ready` rather than redirecting on the default and
 * correcting: a navigation cannot be taken back, and a reader who chose Month
 * would watch the week open and then jump.
 */
function CalendarHome() {
  const { prefs, ready } = useSettings();
  if (!ready) return <Loading />;
  return <Navigate to={`/calendar/${prefs.calendar_view}`} replace />;
}

function FrontDoor() {
  const { status } = useAuth();
  const { prefs, ready } = useSettings();
  if (status === 'loading') return <Loading />;
  if (status !== 'signed-in') return <Navigate to="/home" replace />;
  if (!ready) return <Loading />;
  return <Navigate to={HOME_PATHS[prefs.home_page] ?? '/dashboard'} replace />;
}

/**
 * The routes that fill the viewport rather than scrolling it.
 *
 * Everything else — the landing page, the written pages, and the stubs that
 * are not built yet — is a document and scrolls. That is the safe default:
 * a page wrongly pinned loses everything below the fold with no way to reach
 * it, while a page wrongly left scrolling just scrolls.
 *
 * The dashboard is deliberately not on this list. It is four rows tall now and
 * whether it fits depends on the screen, so pinning it would mean guessing a
 * viewport height to pin above — and a guess that is too low does not shorten
 * the page, it hides the bottom of it. Left alone, the browser answers exactly
 * the question that matters: taller than the window, it scrolls; shorter, no
 * scrollbar appears. Its task list still scrolls inside its own card, which is
 * what the pinning was really for — see .dash-main in styles/dashboard-home.css.
 *
 * Analytics came off with the redesign, and it is the clearest case. It was a
 * report card and a scoring panel side by side — one screen by construction. It
 * is seven tabs of panels down a scroll now, and the pinning was hiding
 * everything below the summary tiles. Growth had come off before it for the
 * same reason, back when it was a page of its own; its chapters are tabs of
 * Analytics now and inherit the ruling.
 *
 * Goals came off for the fourth time in the same story. It was a shell with a
 * list scrolling inside it; it is a ladder of goals, a stats row and a timeline
 * per goal now, which is taller than any screen on purpose. Pinned, the page
 * ended at whatever the first viewport could hold and the timelines could not
 * be reached at all — `body.pins-viewport` sets `overflow: hidden` on the
 * document, so there was no scrollbar to find them with.
 */
const PINNED = ['/calendar'];

function pinsViewport(pathname: string): boolean {
  return PINNED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * The landing page is not an app page and does not get the app's chrome.
 *
 * It is the one route a signed-out visitor is meant to read rather than work
 * in, and it carries its own header and its own Log In / Sign Up row — the ones
 * it had before React, which styles/homepage.css still dresses. The rail beside
 * that would be a second navigation for pages the reader cannot open yet.
 */
function isLanding(pathname: string): boolean {
  return pathname === '/home';
}

export default function App() {
  const { pathname } = useLocation();
  usePinnedViewport(pinsViewport(pathname));

  // `has-rail` is what reserves the rail's width; index.html sets it because
  // every page but this one wants it. Off here, so the landing page gets the
  // full width back.
  const landing = isLanding(pathname);
  useEffect(() => {
    document.body.classList.toggle('has-rail', !landing);
    return () => document.body.classList.add('has-rail');
  }, [landing]);

  return (
    <>
      {!landing && <Rail />}
      {/* Beside the rail rather than above it: the rail owns the full height
          and the bar starts at `--rail-w`. Outside the router with the rail,
          so neither is torn down and rebuilt on every navigation. The account
          read they both show is not theirs any more — it belongs to
          UserDataProvider above them, and happens once for the session. */}
      {!landing && <Topbar />}
      <main className="app-main">
        {/* Inside the shell, so a page that throws loses the page and not the
            rail, the top bar and the way back. Keyed on the path: navigating
            away from a broken screen clears the error rather than pinning it
            over the route the reader just chose. See components/ErrorBoundary. */}
        <AppBoundary resetKey={pathname}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<FrontDoor />} />
            <Route path="/home" element={<Homepage />} />
            <Route path="/about-us" element={<AboutUs />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />

            {/* Account required — the same four the backend gates.
                See backend/middleware/gate.py GATED_PATHS. */}
            <Route element={<RequireAccount />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/goals" element={<Goals />} />
              {/* One page, seven tabs, seven URLs. The analytics page reads the
                  pathname to decide which tab opens (VIEWS in
                  components/Analytics/Header), so the rail, the back button and
                  a pasted link all agree about what is showing — none of which
                  a local useState could have managed. */}
              <Route path="/recommendations" element={<Analytics />} />
              <Route path="/analytics" element={<Analytics />} />
              {/* The Goals tab. `/trends` was this slot and redirects rather
                  than 404s, because it was a tab with its own URL for long
                  enough to be bookmarked. */}
              <Route path="/analytics/goals" element={<Analytics />} />
              <Route path="/trends" element={<Navigate to="/analytics/goals" replace />} />
              <Route path="/habits" element={<Analytics />} />
              <Route path="/insights" element={<Analytics />} />
              <Route path="/subjects" element={<Analytics />} />
              {/* The analytics tab called Records used to be `/records`. It
                  moved down a level when Records became a page of its own: the
                  tab asks where the last thirty days *stand* — the percentile,
                  the goal pacing, the round numbers cleared — and the page asks
                  what the high scores actually are. Two different questions, and
                  the shorter path belongs to the one a reader means when they
                  say "my records". Anyone arriving on an old `/records` link
                  lands on that page, which is the better half of the pair to be
                  wrong about. */}
              <Route path="/analytics/records" element={<Analytics />} />
              {/* The growth page was the other half of the original growth.js
                  and had five tabs of its own, four of which are now tabs above
                  and the fifth of which was a lower-resolution copy of the
                  Overview. The path stays and redirects, because it is the one
                  the server-rendered app used and links to it exist. */}
              <Route path="/growth" element={<Navigate to="/analytics" replace />} />
              {/* The skill trees. `/growth-tree` was the placeholder's path and
                  redirects, for the same reason `/growth` does: it was routed,
                  it was described in the app's structure, and links to it
                  exist. Its entry in pages/Unbuilt.tsx is gone — building one
                  for real is exactly the exit that file's instructions
                  describe. */}
              <Route path="/skill-trees" element={<SkillTrees />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/records" element={<Records />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/:section" element={<Settings />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/growth-tree" element={<Navigate to="/skill-trees" replace />} />
              <Route path="/calendar" element={<CalendarHome />} />
              <Route path="/calendar/day" element={<CalendarDay />} />
              <Route path="/calendar/week" element={<CalendarWeek />} />
              <Route path="/calendar/month" element={<CalendarMonth />} />
            </Route>

            {/* Not built yet, but routed, so the structure is real and the
                links resolve. Gated with the rest — every one of them shows
                personal data once it exists. Building one for real means giving
                it its own module and its own line here, and dropping its entry
                from pages/Unbuilt.tsx. */}
            <Route element={<RequireAccount />}>
              {UNBUILT_PATHS.map((path) => (
                <Route key={path} path={path} element={<Unbuilt />} />
              ))}
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
        </AppBoundary>
      </main>
    </>
  );
}
