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
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading, Navbar } from '@/components';
import { RequireAccount } from './RequireAccount';
import { useAuth } from '@/hooks';
import Dashboard from '@/pages/Dashboard';

const Homepage = lazy(() => import('@/pages/Homepage'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Goals = lazy(() => import('@/pages/Goals'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Growth = lazy(() => import('@/pages/Growth'));
const GrowthTree = lazy(() => import('@/pages/GrowthTree'));
const Focus = lazy(() => import('@/pages/Focus'));
const Achievements = lazy(() => import('@/pages/Achievements'));
const Notes = lazy(() => import('@/pages/Notes'));
const Library = lazy(() => import('@/pages/Library'));
const History = lazy(() => import('@/pages/History'));
const Settings = lazy(() => import('@/pages/Settings'));
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

export default function App() {
  return (
    <>
      <Navbar />
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
              <Route path="/goals" element={<Goals />} />
              <Route path="/growth" element={<Growth />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/calendar" element={<Navigate to="/calendar/week" replace />} />
              <Route path="/calendar/day" element={<CalendarDay />} />
              <Route path="/calendar/week" element={<CalendarWeek />} />
              <Route path="/calendar/month" element={<CalendarMonth />} />
            </Route>

            {/* Not built yet, but routed, so the structure is real and the
                links resolve. Gated with the rest — every one of them shows
                personal data once it exists. */}
            <Route element={<RequireAccount />}>
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/growth-tree" element={<GrowthTree />} />
              <Route path="/focus" element={<Focus />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/library" element={<Library />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
