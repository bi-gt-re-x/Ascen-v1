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
          Make your study time <em>add up</em>
        </h1>
        <p className="lp-hero-sub hm-rise">
          Tasks, streaks, analytics and goals in one place.
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
              Get started <span className="lp-chevd">▾</span>
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

const FEATURES = [
  {
    ico: 'lp-ico-teal',
    glyph: '📋',
    title: 'Tasks',
    body: 'Set priorities, add notes, and see what is done.',
    to: '/dashboard',
    label: 'Go to Dashboard',
  },
  {
    ico: 'lp-ico-green',
    glyph: '🌱',
    title: 'Growth',
    body: 'Your streaks, your finished work, your best stretches.',
    to: '/growth',
    label: 'Go to Growth',
  },
  {
    ico: 'lp-ico-gold',
    glyph: '🎯',
    title: 'Goals',
    body: 'Set a target. It moves as you finish work.',
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
          <Link to={f.to} className="lp-link">
            {f.label} <span className="lp-arrow">→</span>
          </Link>
        </article>
      ))}
      {/* The testimonial is where the hidden chain starts on this page —
          secret/quote-egg.js counts ten clicks on it. */}
      <article className="lp-card lp-quote">
        <p>“Ascen changed how I study — I finally see my progress instead of guessing at it.”</p>
        <span className="lp-quote-by">Sarah J. · Student</span>
      </article>
    </section>
  );
}

/** The heading above each demonstration section. */
export function SectionHead({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <header className="lp-head">
      <h2>{title}</h2>
      {blurb && <p>{blurb}</p>}
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
      <ul className="lp-list">
        <li>
          <span className="lp-list-ico">⭐</span>
          <div>
            <h4>Prioritization</h4>
            <p>Flag a task and it rises to the top.</p>
          </div>
        </li>
        <li>
          <span className="lp-list-ico">✅</span>
          <div>
            <h4>Sub-tasks</h4>
            <p>Break a big task into steps you can tick off.</p>
          </div>
        </li>
        <li>
          <span className="lp-list-ico">🔔</span>
          <div>
            <h4>Reminders</h4>
            <p>Due dates and timers, so nothing slips.</p>
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
    body: 'No clutter. Just the few tools that actually move the needle.',
  },
];

export function Philosophy() {
  return (
    <section className="lp-section">
      <SectionHead
        title="Design"
        blurb="Calm tools and plain analytics. Nothing to fiddle with."
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
        title="Features and pricing"
        blurb="All of it, free."
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
const TECH = [
  { ico: 'lp-ico-teal', glyph: '🖥', title: 'Frontend', bits: ['HTML', 'CSS', 'Vanilla JS'] },
  { ico: 'lp-ico-green', glyph: '🔧', title: 'Backend', bits: ['Python', 'Flask', 'Jinja'] },
  { ico: 'lp-ico-gold', glyph: '💾', title: 'Database', bits: ['SQLite'] },
  { ico: 'lp-ico-purple', glyph: '📊', title: 'Visualization', bits: ['SVG', 'Canvas'] },
];

export function TechStack() {
  return (
    <section className="lp-section">
      <SectionHead title="Built with" />
      {/* The copy here describes the stack this port is replacing — it says
          Vanilla JS and Flask, and both are on their way out. It is carried
          across unchanged for the same reason About Us was: what the page
          claims is a separate decision from how it is rendered. */}
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

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="lp-final">
      <h2>Ready to start your ascent?</h2>
      <p>Join and turn today&apos;s effort into tomorrow&apos;s momentum.</p>
      <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">
        {signedIn ? 'Go to Your Dashboard' : 'Get Started Today'}
      </Link>
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
        <div className="copyright">© 2032 Study Dashboard Inc. All rights reserved.</div>
      </div>
    </footer>
  );
}
