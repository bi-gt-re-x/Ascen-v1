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
import { Loading, Rail } from '@/components';
import { RequireAccount } from './RequireAccount';
import { useAuth, usePinnedViewport } from '@/hooks';
import Dashboard from '@/pages/Dashboard';
// Not lazy, unlike every other page here: the routes below are generated from
// `UNBUILT_PATHS`, so the module has to be loaded to build the routing table at
// all. Splitting it would put the same few hundred bytes of strings in a second
// chunk that is always already fetched.
import Unbuilt, { PATHS as UNBUILT_PATHS } from '@/pages/Unbuilt';

const Homepage = lazy(() => import('@/pages/Homepage'));
const Goals = lazy(() => import('@/pages/Goals'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Growth = lazy(() => import('@/pages/Growth'));
const AboutUs = lazy(() => import('@/pages/AboutUs'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));

const CalendarDay = lazy(() => import('@/pages/Calendar/Day'));
const CalendarWeek = lazy(() => import('@/pages/Calendar/Week'));
const CalendarMonth = lazy(() => import('@/pages/Calendar/Month'));

/**
 * The front door.
 *
 * Signed in goes to the dashboard, everyone else lands on the home page — the
 * rule the server route at '/' used to apply before React owned that path too
 * (backend/routes/spa.py). Waiting on `status` matters for the same reason it
 * does in RequireAccount: treating "still asking" as signed out would flash the
 * landing page at an account on its way to the dashboard.
 */
function FrontDoor() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  return <Navigate to={status === 'signed-in' ? '/dashboard' : '/home'} replace />;
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
 * Growth came off the list for the same reason. It was one chart in one card,
 * which fits any screen; it is a chart and six panels now, which does not fit
 * most, and pinned it simply lost the bottom three.
 *
 * Analytics came off with the redesign, and it is the clearest case of the
 * three. It was a report card and a scoring panel side by side — one screen by
 * construction. It is fourteen panels down a scroll now, and the pinning was
 * hiding everything below the summary tiles.
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
      <main className="app-main">
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
              <Route path="/growth" element={<Growth />} />
              {/* One page, five tabs, five URLs. The analytics page reads the
                  pathname to decide which tab opens (VIEWS in
                  components/Analytics/Header), so the rail, the back button and
                  a pasted link all agree about what is showing — none of which
                  a local useState could have managed. */}
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/trends" element={<Analytics />} />
              <Route path="/habits" element={<Analytics />} />
              <Route path="/insights" element={<Analytics />} />
              <Route path="/recommendations" element={<Analytics />} />
              <Route path="/calendar" element={<Navigate to="/calendar/week" replace />} />
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
      </main>
    </>
  );
}
