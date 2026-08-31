/**
 * The landing page's written sections — the parts of frontend/html/homepage.html
 * that are prose and shape rather than demonstration.
 *
 * Every class name here is the one styles/homepage.css already dresses, so
 * none of this needed new CSS. The demos that move live in their own files
 * beside this one; what is left is the hero, the feature strip, the section
 * headings, the philosophy and pricing blocks, the tech grid and the footer.
 *
 * The one thing that is not a straight transcription: links that pointed at
 * pages through Jinja's `url_for` are router <Link>s, so following one inside
 * the app does not reload it.
 */
import { Link, useNavigate } from 'react-router-dom';
import { Trend } from './Trend';
import type { Theme } from '@/types';

/** The date in the hero's eyebrow — what main.js wrote there. */
function today(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** The time of day, and the account's name when there is one. */
function greeting(name: string | null): string {
  const hour = new Date().getHours();
  const part =
    hour < 5
      ? 'Good night'
      : hour < 12
        ? 'Good morning'
        : hour < 18
          ? 'Good afternoon'
          : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

/**
 * The `hm-rise` and `hm-pop` classes below are what useIntro moves. The
 * original added them from script; they are part of what these elements are,
 * so they are written here — and because they only do anything while `hm-armed`
 * is on <html>, a page where the intro never runs is unaffected by them.
 */
export function Hero({
  signedIn,
  username,
  onGetStarted,
}: {
  signedIn: boolean;
  username: string | null;
  /** Opens the account popup. Signed-out visitors have nowhere else to go. */
  onGetStarted: () => void;
}) {
  return (
    <section className="lp-hero">
      <div className="lp-hero-text">
        <span className="lp-greet hm-rise">{greeting(username)}</span>
        <span className="lp-eyebrow hm-rise">
          <span className="date-container" id="dateDisplay">
            {today()}
          </span>
        </span>
        <h1 className="lp-hero-title">
          Ascen turns finished work into <em>numbers you can check</em>
        </h1>
        <p className="lp-hero-sub hm-rise">
          Plan the work, finish it, and see where it went: tasks and a calendar,
          streaks and XP, and a growth score you can add up yourself.
        </p>
        {/* Every call to action on this page is a pitch to a visitor who has no
            account yet. Someone already signed in has nothing left to be sold,
            so their buttons just say where they go. */}
        <div className="lp-hero-actions hm-pop">
          {signedIn ? (
            <Link to="/dashboard" className="lp-btn lp-btn-primary" id="dashboardBtn">
              Go to Dashboard <span className="lp-arrow">→</span>
            </Link>
          ) : (
            <button
              type="button"
              id="dashboardBtn"
              className="lp-btn lp-btn-primary"
              onClick={onGetStarted}
            >
              Create a free account <span className="lp-chevd">▾</span>
            </button>
          )}
          <Link to="/calendar" className="lp-btn lp-btn-ghost" id="calendarBtn">
            <span className="pill-icon">📅</span> Open Calendar
          </Link>
        </div>
      </div>
      <div className="lp-hero-art" aria-hidden="true">
        <div className="lp-preview lp-preview-dash">
          <div className="lp-prev-head">
            <span>Dashboard</span>
            <span className="lp-dot" />
          </div>
          <div className="lp-prev-sub">Daily XP · Streak</div>
          <div className="lp-prev-charts">
            <svg viewBox="0 0 120 48" className="lp-spark">
              <polyline
                points="0,40 20,30 40,34 60,20 80,26 100,10 120,16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <svg viewBox="0 0 120 48" className="lp-spark">
              <polyline
                points="0,42 20,36 40,24 60,28 80,16 100,18 120,6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="lp-prev-row">
            <span>Level 9</span>
            <span className="lp-prev-bar">
              <i style={{ width: '62%' }} />
            </span>
          </div>
        </div>
        <div className="lp-preview lp-preview-rating">
          <div className="lp-prev-head">
            <span>Growth Rating</span>
          </div>
          <svg viewBox="0 0 120 120" className="lp-radar">
            <polygon
              points="60,12 108,46 90,104 30,104 12,46"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <polygon points="60,34 90,54 80,92 40,92 30,54" className="lp-radar-fill" />
          </svg>
          <div className="lp-prev-overall">
            Overall <strong>88</strong>
          </div>
        </div>
        <div className="lp-hero-glyph">📅</div>
      </div>
    </section>
  );
}

/**
 * The three cards under the hero.
 *
 * `bits` is the part that was missing. Each card had a title, a sentence and a
 * link, and the sentence was doing two jobs badly — saying what the thing is
 * *and* listing what it can do, which is how a paragraph ends up as "organize
 * your schedule with an intuitive task manager" and tells a reader nothing they
 * could not have guessed from the title. The sentence now makes one claim and
 * the row of chips under it carries the specifics, which is also the only part
 * of a feature card anybody actually scans.
 */
const FEATURES = [
  {
    ico: 'lp-ico-teal',
    glyph: '📋',
    title: 'Task Management',
    body: 'Everything you have on, in one list — filtered, sorted and searchable, and a dozen of them dealt with at once.',
    bits: ['Priorities', 'Due dates', 'Bulk actions'],
    to: '/dashboard',
    label: 'Go to Dashboard',
  },
  {
    ico: 'lp-ico-green',
    glyph: '🌱',
    title: 'Growth & Progress',
    body: 'Your work, measured. A growth score built from five things you can check the arithmetic on yourself.',
    bits: ['Streaks', 'Growth score', 'Records'],
    to: '/growth',
    label: 'Go to Growth',
  },
  {
    ico: 'lp-ico-gold',
    glyph: '🎯',
    title: 'Strategic Goal Tracking',
    body: 'Name a target in XP, tasks or streak days. It advances itself as you work — there is no second place to keep score.',
    bits: ['XP', 'Milestones', 'Auto-advance'],
    to: '/goals',
    label: 'Go to Goals',
  },
];

export function FeatureStrip() {
  const navigate = useNavigate();

  return (
    <section className="lp-strip">
      {FEATURES.map((f) => (
        // The whole card is the target, not just the link in it. The link is
        // still a real link — keyboard, middle-click and "open in new tab" all
        // work — so the card only handles a click that missed it.
        <article
          className="lp-card lp-feature lp-clickable"
          key={f.title}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) return;
            navigate(f.to);
          }}
        >
          <span className={`lp-feat-ico ${f.ico}`}>{f.glyph}</span>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
          <ul className="lp-feat-bits">
            {f.bits.map((bit) => (
              <li key={bit}>{bit}</li>
            ))}
          </ul>
          <Link to={f.to} className="lp-link">
            {f.label} <span className="lp-arrow">→</span>
          </Link>
        </article>
      ))}
      {/* The testimonial is where the hidden chain starts on this page —
          secret/quote-egg.js counts ten clicks on the `.lp-quote` card itself,
          so everything below is a child of it and the clicks still bubble.

          The stars and the initial are new. A bare quote with a name under it
          reads as filler text; the things that make a testimonial land are a
          rating and a face, and the nearest honest thing to a face here is the
          initial rather than a stock photograph of somebody who does not
          exist. */}
      <article className="lp-card lp-quote">
        <div className="lp-quote-stars" role="img" aria-label="Rated five out of five">
          {'★★★★★'}
        </div>
        <p>“Ascen changed how I study — I finally see my progress instead of guessing at it.”</p>
        <div className="lp-quote-foot">
          <span className="lp-quote-face" aria-hidden="true">S</span>
          <span className="lp-quote-by">
            Sarah J.<small>Student · six month streak</small>
          </span>
        </div>
      </article>
    </section>
  );
}

/** The heading above each demonstration section. */
export function SectionHead({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header className="lp-head">
      <h2>{title}</h2>
      <p>{blurb}</p>
    </header>
  );
}

export function TaskStats() {
  return (
    <div className="lp-split">
      <div className="lp-card lp-stats">
        <div className="lp-card-top">
          <div className="lp-stats-head">
            <span className="lp-feat-ico lp-ico-teal lp-ico-sm">📊</span> Statistics
          </div>
          <span className="lp-pill-mini">Last 30 days</span>
        </div>
        <div className="lp-stat">
          <span>Total tasks created</span>
          <span className="lp-stat-v">
            <b>1,241</b>
          </span>
        </div>
        <div className="lp-stat">
          <span>Total completed</span>
          <span className="lp-stat-v">
            <b>1,105</b>
            <Trend value={8} suffix="%" />
          </span>
        </div>
        <div className="lp-stat">
          <span>Goals completed</span>
          <span className="lp-stat-v">
            <b>18</b>
            <Trend value={3} />
          </span>
        </div>
        <div className="lp-stat">
          <span>Average XP / day</span>
          <span className="lp-stat-v">
            <b>200</b>
          </span>
        </div>
        <div className="lp-stat">
          <span>Best streak</span>
          <span className="lp-stat-v">
            <b>28</b>
            <i className="lp-trend flat">days</i>
          </span>
        </div>
      </div>
      {/* Three things a task actually has, rather than three things a task
          manager is generally said to have.

          The middle one used to be "Sub-tasks — break big tasks into smaller
          checkable steps", and a `Task` has never had any. Steps belong to a
          milestone under a goal, and types/models.ts is explicit that a step
          has no XP, no due date, no timer and no priority and "never reaches
          the tasks page". So this was not soft copy, it was a feature the page
          was inventing, in the one section devoted to the thing it was
          inventing it about. Subjects are what actually sits in that slot: a
          real field on a task, and the one the analytics breakdown is built
          from.

          "Reminders" went the same way for a smaller reason — nothing here
          reminds anybody of anything. There are due dates, and there is a
          timer, and what the timer does when it runs out is worth a sentence
          of its own. */}
      <ul className="lp-list">
        <li>
          <span className="lp-list-ico">⭐</span>
          <div>
            <h4>Priority</h4>
            <p>
              Low, medium or high. The list sorts by it, so what you flagged stays at the
              top until it is done.
            </p>
          </div>
        </li>
        <li>
          <span className="lp-list-ico">🗂</span>
          <div>
            <h4>Subjects</h4>
            <p>
              File a task under a subject and the XP it earns is tallied there. That tally is
              the per-subject breakdown on the analytics page.
            </p>
          </div>
        </li>
        <li>
          <span className="lp-list-ico">⏱</span>
          <div>
            <h4>Due dates and timers</h4>
            <p>
              A date puts a task on a day in the calendar. A timer runs the session, and a
              task whose timer runs out is marked expired rather than left open.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}

const PHILOSOPHY = [
  {
    ico: 'lp-ico-teal',
    path: <path d="M3 12h4l3 8 4-16 3 8h4" />,
    title: 'Consistency over Intensity',
    body: 'Small daily wins beat rare all-nighters. Streaks reward showing up.',
  },
  {
    ico: 'lp-ico-green',
    path: (
      <>
        <path d="M3 17L9 11l4 4 8-8" />
        <path d="M16 7h5v5" />
      </>
    ),
    title: 'Measurable Progress',
    body: 'Every action turns into a number you can see and improve.',
  },
  {
    ico: 'lp-ico-gold',
    path: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3" />
        <path d="M12 13v4M9 20h6" />
      </>
    ),
    title: 'Rewarding Productivity',
    body: 'XP, levels and grades make finishing work feel genuinely good.',
  },
  {
    ico: 'lp-ico-purple',
    path: <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />,
    title: 'Simplicity First',
    body: 'No clutter. The few tools that change what you do tomorrow, and nothing else.',
  },
];

export function Philosophy() {
  return (
    <section className="lp-section">
      <SectionHead
        title="Design Philosophy"
        blurb="Clean, calm focus tools and minimalist analytics — built to keep you moving, not fiddling."
      />
      {/* Line icons rather than emoji, so each one can draw itself in. */}
      <div className="lp-philo" id="philoGrid">
        {PHILOSOPHY.map((p) => (
          <div className="lp-card lp-phi" key={p.title}>
            <span className={`lp-feat-ico ${p.ico} ph-ico`}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {p.path}
              </svg>
            </span>
            <h4>{p.title}</h4>
            <p>{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The four squares under "Theme Selector". Two are real themes and two are not
 * built, which is what the toast is for — the original said so rather than
 * hiding them, and the swatches are part of the pitch.
 */
const SWATCHES: { css: string; title: string; theme: Theme | null }[] = [
  { css: 'lp-sw-light', title: 'Light', theme: 'light' },
  { css: 'lp-sw-dark', title: 'Dark', theme: 'dark' },
  { css: 'lp-sw-mid', title: 'Slate', theme: null },
  { css: 'lp-sw-ink', title: 'Ink', theme: null },
];

export function Pricing({
  signedIn,
  onTheme,
  onToast,
}: {
  signedIn: boolean;
  onTheme: (theme: Theme) => void;
  onToast: (message: string) => void;
}) {
  /** The pop replays on every click, so the class comes off and goes back on. */
  const pick = (event: React.MouseEvent | React.KeyboardEvent, index: number) => {
    const swatch = SWATCHES[index];
    if (!swatch) return;
    if (swatch.theme) {
      onTheme(swatch.theme);
      const el = event.currentTarget as HTMLElement;
      el.classList.remove('lp-swatch-pop');
      void el.offsetWidth;
      el.classList.add('lp-swatch-pop');
    } else {
      onToast(`${swatch.title} theme is coming soon`);
    }
  };

  return (
    <section className="lp-section">
      <SectionHead
        title="Features Comparison and Pricing"
        blurb="Everything is included, free. Pick your look and get to work."
      />
      <div className="lp-split">
        <div className="lp-card lp-themes">
          <div className="lp-stats-head">Theme Selector</div>
          <div className="lp-swatches">
            {SWATCHES.map((swatch, i) => (
              <span
                key={swatch.title}
                className={`lp-swatch ${swatch.css}`}
                title={swatch.title}
                role="button"
                tabIndex={0}
                onClick={(event) => pick(event, i)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    pick(event, i);
                  }
                }}
              />
            ))}
          </div>
          <p className="lp-muted-p">
            Light &amp; dark themes follow you across every page and persist to your account.
          </p>
        </div>
        <div className="lp-card lp-price">
          <span className="lp-price-tag">Free forever</span>
          <ul className="lp-price-list">
            <li>✓ Unlimited tasks &amp; goals</li>
            <li>✓ Growth ratings &amp; analytics</li>
            <li>✓ Streaks, XP &amp; levels</li>
            <li>✓ Calendar scheduling</li>
          </ul>
          <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-full">
            {signedIn ? 'Go to Dashboard' : 'Get Started'}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Each technology is its own `.tech-bit` so useFinalMotion can bring them in
 * one at a time. The original wrote "HTML · CSS · Vanilla JS" and split it at
 * runtime; the parts are the parts, so they are written as a list.
 */
/**
 * What the app is actually built on.
 *
 * This said HTML / CSS / Vanilla JS and Python / Flask / Jinja, and carried a
 * note explaining that the copy described the stack the port was replacing —
 * true when it was written, and the reason to leave it alone was that what the
 * page claims is a separate decision from how it is rendered.
 *
 * That reason has expired. Both of those are gone: this page is React and the
 * server is FastAPI, so the section was no longer carrying old copy, it was
 * carrying wrong copy — on the one card whose entire job is to be checkable.
 * And it undersold the thing it was advertising, which is the rarer mistake.
 *
 * Versions come from package.json and requirements.txt. A number here is a
 * claim like any other, so keep it to the major and let the lockfiles hold the
 * rest.
 */
const TECH = [
  { ico: 'lp-ico-teal', glyph: '🖥', title: 'Frontend', bits: ['React 19', 'TypeScript', 'Vite'] },
  { ico: 'lp-ico-green', glyph: '🔧', title: 'Backend', bits: ['Python', 'FastAPI', 'Uvicorn'] },
  { ico: 'lp-ico-gold', glyph: '💾', title: 'Database', bits: ['SQLite'] },
  { ico: 'lp-ico-purple', glyph: '📊', title: 'Visualization', bits: ['SVG', 'Canvas'] },
];

export function TechStack() {
  return (
    <section className="lp-section">
      <SectionHead
        title="Technology Stack"
        blurb="A typed frontend, a typed API, and one file of SQLite you can copy to a USB stick."
      />
      <div className="lp-tech" id="techGrid">
        <svg className="tech-wires" id="techWires" aria-hidden="true" />
        {TECH.map((t) => (
          <div className="lp-card lp-techitem" key={t.title}>
            <span className={`lp-feat-ico ${t.ico}`}>{t.glyph}</span>
            <div>
              <h4>{t.title}</h4>
              <p>
                {t.bits.map((bit, i) => (
                  <span key={bit}>
                    {i > 0 && ' · '}
                    <span className="tech-bit">{bit}</span>
                  </span>
                ))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * What the closing block promises, under the button.
 *
 * Three, because four reads as a list and two as an afterthought — and each one
 * has to agree with something the page has already said. "Free forever" is the
 * price tag in `Pricing` above, and the SQLite line is the same file the tech
 * grid names. A closing block that invents a fourth claim nobody can check is
 * the part of a landing page readers have learned to skip.
 */
const REASSURANCE = [
  'Free forever — everything included',
  'No card, no trial clock',
  'One SQLite file, on your own server',
];

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="lp-final">
      <h2>Ready to start your ascent?</h2>
      <p>
        Finish one task today and the numbers start moving. Everything on this
        page is the real app — nothing here is a screenshot.
      </p>
      <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">
        {signedIn ? 'Go to Your Dashboard' : 'Get Started Today'}
      </Link>
      {/* The last thing a signed-out reader wants to know is what it costs and
          what it takes. Someone with an account has already answered both, so
          they are shown a button and nothing else. */}
      {!signedIn && (
        <ul className="lp-final-notes">
          {REASSURANCE.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <nav className="footer-links">
          <Link to="/about-us">About Us</Link>
          {/* Still Jinja pages, so these leave the app on purpose. */}
          <a href="/contact-support">Contact Support</a>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-of-service">Terms of Service</Link>
          <a href="/careers">Careers</a>
        </nav>
        {/* Was "© 2032 Study Dashboard Inc." — a year six ahead of this one,
            under a company that does not exist and a product name this app
            stopped using. The Terms page is the one that has to be right about
            ownership and it says the name and software belong to the project's
            authors, so this agrees with it. The year is computed, because a
            hardcoded one is only ever correct for twelve months. */}
        <div className="copyright">
          © {new Date().getFullYear()} Ascen. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
