/**
 * Home — the landing page.
 *
 * Ported from frontend/html/homepage.html and the eleven home-*.js
 * files, with the account popup from auth-flow.js. It is the last
 * and largest of the ports, and the shape it lands in is the same one the
 * original had: the page is the running order, and each thing that moves is its
 * own file beside this one, named after the script it came from.
 *
 * What this file itself owns is only what spans the whole page:
 *
 *   * whether the account popup is up, and on which panel. A gated page bounces
 *     a signed-out visitor to /home?auth=login&next=/dashboard and the
 *     verification link lands on /home?auth=profile, so the URL is what decides
 *     that on arrival — and the hero's call to action decides it after.
 *   * the four page-wide motions, as hooks over the rendered tree: the opening,
 *     the scroll reveals, the count-ups, the charts drawing themselves, and the
 *     closing flourishes. Each measures something that only exists once the
 *     page is laid out, which is why they are hooks over a ref and not markup.
 *   * the toast, which belongs to no section.
 *
 *   * its own Log In / Sign Up row, and the theme select beside it. There is no
 *     bar above them: the page opens straight on the hero. It carried one for a
 *     while — a brand mark and the theme select, the pair the server-rendered
 *     header held — but the mark linked to the page it was already on, and a
 *     strip of chrome between the reader and the first thing the page has to
 *     say is a strip of chrome. The app's navigation is a rail down the left
 *     and App.tsx leaves this route without that too, since a rail offering the
 *     dashboard and the goals page to someone who cannot open either is not
 *     navigation.
 *
 * The one thing the server-rendered page had that is still deliberately not
 * here: it wrote the signed-in username into localStorage from the template.
 * `useAuth` asks the server, which is the same answer without the copy that can
 * go stale.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ambient } from '@/components';
import {
  AuthModal,
  CalendarDemo,
  DashboardDemo,
  DEEP_LINKED,
  FeatureStrip,
  FinalCta,
  Footer,
  Hero,
  Performance,
  Philosophy,
  Pricing,
  SectionHead,
  StreakLevel,
  TaskDemo,
  TaskStats,
  TechStack,
  useCharts,
  useCountUps,
  useFinalMotion,
  useIntro,
  useReveals,
} from '@/components/Home';
import { useAuth, useDocumentTitle, useTheme } from '@/hooks';
import { useSecretScripts } from '@/hooks/useSecretScripts';
import type { AuthStep } from '@/components/Home';
import type { Theme } from '@/types';
import '@/styles/homepage.css';
import '@/styles/home-motion.css';

/**
 * Where the flow finishes. Only a path on this site, never somewhere else.
 *
 * With nothing to go back to the answer is the front door, not the dashboard.
 * `/` is the one route that reads the account's chosen start page (FrontDoor
 * in App.tsx) — naming the dashboard here instead meant signing in from the
 * landing page always landed on the dashboard, whatever the account had asked
 * for, and the preference only appeared to work if you happened to arrive via
 * a gated link.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export default function Homepage() {
  useDocumentTitle('Home');

  const [params] = useSearchParams();
  const { status, username, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const signedIn = status === 'signed-in';

  /* The two stages of the hidden chain this page carries, and the void they
     both lead into. They are the original scripts, bound to markup rendered
     below — the testimonial card in components/Home/sections.tsx and the
     pentagon in the Growth Rating preview beside it — and hooks/useSecretScripts
     explains why they are loaded rather than ported. Nothing here is reachable
     without the clue from the dashboard, except the testimonial, which is the
     short way in for a visitor who has no account to put a dashboard behind.

     **Not until the account is known**, which is why this sits below `status`
     rather than at the top with the other page-wide hooks.
     frontend/secret/pentagon-egg.js reads whose unlock to look for once, at
     load, and binds nothing at all if it does not find one — so loading it
     while the session check is still in flight asks it about 'Default' and
     leaves a pentagon that is inert for the rest of the visit. The session is
     a round trip and the script is in cache, so that race is not close: it
     loses almost every time. 'loading' is the only state worth waiting on —
     signed out is an answer, and the testimonial's door is open to it. */
  useSecretScripts(
    status === 'loading'
      ? []
      : ['void.css', 'void.js', 'quote-egg.js', 'pentagon-egg.js'],
  );

  const page = useRef<HTMLDivElement>(null);
  useIntro(page);
  useReveals(page);
  useCountUps(page);
  useCharts(page);
  useFinalMotion(page);

  // --- the account popup ---------------------------------------------------
  const wanted = params.get('auth');
  const next = safeNext(params.get('next'));
  const [step, setStep] = useState<AuthStep | null>(null);

  // The URL opens the popup, and re-opens it if the URL changes underneath —
  // which is what happens when a gated route bounces a visitor here.
  useEffect(() => {
    if (wanted && DEEP_LINKED.includes(wanted as AuthStep)) {
      setStep(wanted as AuthStep);
    }
  }, [wanted]);

  /** The line the popup opens with, when the URL is reporting a failure. */
  const notice = params.get('verify') === 'invalid'
    ? { text: 'That verification link has already been used or expired.', kind: 'error' as const }
    : params.get('oauth') === 'unconfigured'
      ? { text: 'Google sign-in is not configured on this server yet.', kind: 'error' as const }
      : params.get('oauth')
        ? { text: 'Google sign-in did not complete. Try again.', kind: 'error' as const }
        : params.get('next')
          ? { text: 'You need an account to open that page.', kind: 'info' as const }
          : null;

  useEffect(() => {
    if (params.get('verify') === 'invalid' || params.get('oauth')) setStep('login');
  }, [params]);

  // --- the toast -----------------------------------------------------------
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  return (
    <>
      <Ambient cursor />

      {/* Which pair this shows is decided from the server's answer rather than
          from localStorage, which is what the original got wrong: an account
          signed in on the server but with no localStorage — cleared storage,
          another browser — was being offered Log In and Sign Up.

          The theme select sits on this row now. It used to have a bar of its
          own across the top of the page, with the brand mark beside it; the bar
          is gone, so the one control it carried joins the row that was already
          here rather than going with it — the landing page is the one place a
          reader can pick a theme before they have an account. */}
      <div className="account-row">
        <select
          className="theme-select"
          aria-label="Theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value as Theme)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        {signedIn ? (
          <div className="user-greeting">
            <span>Hello, {username}</span>
            <button type="button" className="logout-btn" onClick={() => void signOut()}>
              Log Out
            </button>
          </div>
        ) : (
          <div className="auth-buttons">
            <button type="button" className="auth-btn" onClick={() => setStep('login')}>
              Log In
            </button>
            <button
              type="button"
              className="auth-btn auth-btn-primary"
              onClick={() => setStep('create')}
            >
              Sign Up
            </button>
          </div>
        )}
      </div>

      <div className="home-main" ref={page}>
        <div className="lp">
          <Hero
            signedIn={signedIn}
            username={username}
            onGetStarted={() => setStep('choose')}
          />

          <FeatureStrip />

          {/* Not a screenshot: a working mock the reader watches fill in. */}
          <section className="lp-section">
            <SectionHead
              title="Your dashboard, as you would use it"
              blurb="Finish work, and the numbers move. Nothing here is a picture — this is the real thing, running."
            />
            <DashboardDemo />
          </section>

          <section className="lp-section">
            <SectionHead
              title="Deep Dive on Task Management"
              blurb="Organize your study schedule with an intuitive task manager, set priorities, and track progress effortlessly."
            />
            {/* The workflow, played out: a task gets checked off, the list
                closes over it, and the XP it earned lands on the bar. */}
            <TaskDemo />
            <TaskStats />
          </section>

          <section className="lp-section">
            <SectionHead
              title="Performance Metrics"
              blurb="See your growth and achievements — hours logged, completion rates, and daily XP visualized."
            />
            <Performance />
          </section>

          <section className="lp-section">
            <SectionHead
              title="A calendar that works with you"
              blurb="Organize your study schedule with simple drag-and-drop. Tasks sync onto the day you plan them."
            />
            <CalendarDemo />
          </section>

          <section className="lp-section">
            <SectionHead
              title="Streak & Level System"
              blurb="Break large goals into achievable steps. Every completed task earns XP toward your next level."
            />
            <StreakLevel />
          </section>

          <Philosophy />
          <Pricing signedIn={signedIn} onTheme={setTheme} onToast={say} />
          <TechStack />
          <FinalCta signedIn={signedIn} />
        </div>
      </div>

      <Footer />

      <div className={`hfx-toast${toast ? ' is-shown' : ''}`}>{toast}</div>

      <AuthModal
        step={step}
        notice={notice}
        next={next}
        onStep={setStep}
        onClose={() => setStep(null)}
      />
    </>
  );
}
