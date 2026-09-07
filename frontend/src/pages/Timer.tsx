/**
 * Timer — the focus session with a shape over it.
 *
 * ## Why this is a page and not a bigger Focus panel
 *
 * The dashboard's Focus panel is a stopwatch: every minute it banks is a minute
 * somebody had to decide to keep sitting for. That is the right control beside
 * a task list and the wrong one to be the only one, because the hard part of a
 * long session is not starting it — it is knowing when to stop, and trusting
 * that stopping is part of the plan rather than giving up. A pomodoro answers
 * that by deciding in advance.
 *
 * ## It is the same hours
 *
 * A running focus phase runs the account's focus session, so what happens here
 * lands where a session started from the dashboard does — the Focus card, the
 * calendar, the focus metric. No second ledger. See hooks/usePomodoro.
 *
 * ## The page says as little as it can
 *
 * It was wordier: a subtitle, a sentence under the clock, a paragraph under the
 * stats, a lead over the picker, and three lines of prose on every one of the
 * ten cards. All of it was true and none of it was being read, because somebody
 * opening a timer is either about to start or already running and wants one
 * number either way.
 *
 * So the things that can be shown are shown — the ring is the phase and the
 * progress, the pips are the round, the bar is the day against its goal — and
 * what is left in words is one line per card. The rule for anything added here
 * is that a sentence has to earn its place against a shape that could say the
 * same thing.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth, useDocumentTitle, usePageEntrance } from '@/hooks';
import { fmtHM, useFocusSession } from '@/hooks/useFocusSession';
import { usePomodoro } from '@/hooks/usePomodoro';
import {
  NEARBY,
  RECOMMENDED,
  SITTINGS,
  STYLES,
  clock,
  focusShare,
  styleFor,
  type Phase,
  type Sitting,
} from '@/components/Timer/pomodoro';
import '@/styles/timer.css';

const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Focus',
  break: 'Break',
  long: 'Long break',
};

const SETUP_KEY = 'pomodoro:setup';

function setupDone(user: string): boolean {
  try {
    return window.localStorage.getItem(`${SETUP_KEY}:${user}`) === '1';
  } catch {
    return false;
  }
}

function markSetupDone(user: string): void {
  try {
    window.localStorage.setItem(`${SETUP_KEY}:${user}`, '1');
  } catch {
    // The wizard runs again next visit. Harmless.
  }
}

// --------------------------------------------------------------------------
// The setup
// --------------------------------------------------------------------------
function Setup({
  onPick,
  onSkip,
}: {
  onPick: (styleId: string) => void;
  onSkip: () => void;
}) {
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!sitting) {
    return (
      <section className="tm-setup" aria-labelledby="tm-setup-q">
        <p className="tm-step">
          <span className="tm-dot is-on" />
          <span className="tm-dot" />
        </p>
        <h2 id="tm-setup-q">How long can you sit?</h2>
        <div className="tm-choices">
          {SITTINGS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="tm-choice"
              onClick={() => {
                setSitting(option.id);
                setChosen(RECOMMENDED[option.id]);
              }}
            >
              <span className="tm-choice-label">{option.label}</span>
              <span className="tm-choice-hint">{option.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" className="tm-link" onClick={onSkip}>
          Skip
        </button>
      </section>
    );
  }

  return (
    <section className="tm-setup" aria-labelledby="tm-setup-q2">
      <p className="tm-step">
        <span className="tm-dot" />
        <span className="tm-dot is-on" />
      </p>
      <h2 id="tm-setup-q2">Start with one of these.</h2>
      <div className="tm-choices">
        {NEARBY[sitting].map((id) => {
          const style = styleFor(id);
          return (
            <button
              key={id}
              type="button"
              className={`tm-choice${chosen === id ? ' is-on' : ''}`}
              aria-pressed={chosen === id}
              onClick={() => setChosen(id)}
            >
              <span className="tm-choice-label">
                {style.name}
                {RECOMMENDED[sitting] === id && <em className="tm-tag">Suggested</em>}
              </span>
              <Numbers focus={style.focus} rest={style.rest} />
              <span className="tm-choice-hint">{style.who}</span>
            </button>
          );
        })}
      </div>
      <div className="tm-setup-foot">
        <button type="button" className="tm-link" onClick={() => setSitting(null)}>
          ← Back
        </button>
        <button
          type="button"
          className="tm-btn is-primary"
          disabled={!chosen}
          onClick={() => chosen && onPick(chosen)}
        >
          Start
        </button>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// Pieces
// --------------------------------------------------------------------------
/** The two figures that define a style, sized so they read before the name. */
function Numbers({ focus, rest }: { focus: number; rest: number }) {
  return (
    <span className="tm-nums">
      <span className="tm-num">
        <b>{focus}</b>
        <i>work</i>
      </span>
      <span className="tm-num-sep" aria-hidden="true" />
      <span className="tm-num is-rest">
        <b>{rest}</b>
        <i>break</i>
      </span>
    </span>
  );
}

/**
 * The ring, and the only moving thing on the page.
 *
 * Two arcs: a track, and the run drawn with `stroke-dashoffset` against a known
 * circumference so nothing reflows as it fills. The gradient is per phase and
 * defined here rather than in CSS because a stroke cannot take one from a
 * custom property — SVG wants a paint server, so there are three.
 */
function Dial({ percent, phase }: { percent: number; phase: Phase }) {
  const r = 88;
  const circumference = 2 * Math.PI * r;
  return (
    <svg className="tm-dial" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        {(['focus', 'break', 'long'] as Phase[]).map((name) => (
          <linearGradient key={name} id={`tm-g-${name}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`var(--tm-${name})`} />
            <stop offset="100%" stopColor={`var(--tm-${name}-2)`} />
          </linearGradient>
        ))}
      </defs>
      <circle className="tm-dial-track" cx="100" cy="100" r={r} />
      <circle
        className="tm-dial-run"
        cx="100"
        cy="100"
        r={r}
        stroke={`url(#tm-g-${phase})`}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
      />
    </svg>
  );
}

/** Rounds as pips. A style with one round has nothing to count, so nothing shows. */
function Pips({ rounds, done, phase }: { rounds: number; done: number; phase: Phase }) {
  if (rounds < 2) return null;
  return (
    <span className="tm-pips" aria-label={`Round ${Math.min(done + 1, rounds)} of ${rounds}`}>
      {Array.from({ length: rounds }, (_, at) => (
        <span
          key={at}
          className={`tm-pip${at < done ? ' is-done' : ''}${
            at === done && phase === 'focus' ? ' is-now' : ''
          }`}
        />
      ))}
    </span>
  );
}

// --------------------------------------------------------------------------
export default function Timer() {
  useDocumentTitle('Timer');

  const { username } = useAuth();
  const user = username || 'Default';
  const session = useFocusSession(username);
  const pomodoro = usePomodoro(username, session);

  const [setup, setSetup] = useState(() => !setupDone(user));
  useEffect(() => {
    setSetup(!setupDone(user));
  }, [user]);

  const entering = usePageEntrance(true);

  const finish = useCallback(
    (styleId?: string) => {
      if (styleId) pomodoro.choose(styleId);
      markSetupDone(user);
      setSetup(false);
    },
    [pomodoro, user],
  );

  const { style, phase, done, running, remaining, percent } = pomodoro;

  return (
    <div className={`tm-page${entering ? ' pg-enter' : ''}`}>
      <header className="tm-head">
        <h1 className="tm-title">Timer</h1>
        {!setup && (
          <button type="button" className="tm-link" onClick={() => setSetup(true)}>
            Set up again
          </button>
        )}
      </header>

      {setup ? (
        <Setup onPick={(id) => finish(id)} onSkip={() => finish()} />
      ) : (
        <>
          <section className={`tm-clock-card is-${phase}`}>
            <div className="tm-clock-wrap">
              <Dial percent={percent} phase={phase} />
              <div className="tm-clock-text" aria-live="polite">
                <span className="tm-phase">{PHASE_LABEL[phase]}</span>
                <span className="tm-time">{clock(remaining)}</span>
                <span className="tm-style-name">{style.name}</span>
              </div>
            </div>

            <Pips rounds={style.rounds} done={done} phase={phase} />

            <div className="tm-controls">
              <button
                type="button"
                className="tm-btn is-primary"
                onClick={running ? pomodoro.pause : pomodoro.start}
              >
                {running ? 'Pause' : 'Start'}
              </button>
              <button
                type="button"
                className="tm-btn is-icon"
                onClick={pomodoro.skip}
                aria-label={`Skip ${PHASE_LABEL[phase].toLowerCase()}`}
                title={`Skip ${PHASE_LABEL[phase].toLowerCase()}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 5l9 7-9 7V5Z" strokeLinejoin="round" />
                  <path d="M19 5v14" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                className="tm-btn is-icon"
                onClick={pomodoro.reset}
                aria-label="Reset"
                title="Reset"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12a8 8 0 1 0 2.5-5.8" strokeLinecap="round" />
                  <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* The day, as a bar rather than three figures and a paragraph.
                It is the one number here that is not about this sitting. */}
            <div className="tm-goal">
              <div className="tm-goal-top">
                <span>
                  <strong>{fmtHM(session.focused)}</strong> today
                </span>
                <span className="tm-goal-of">{fmtHM(session.goalHours * 3600)} goal</span>
              </div>
              <div
                className="tm-goal-bar"
                role="progressbar"
                aria-valuenow={session.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Focus goal"
              >
                <span style={{ width: `${session.percent}%` }} />
              </div>
            </div>
          </section>

          <section className="tm-styles" aria-labelledby="tm-styles-h">
            <h2 id="tm-styles-h">Ten ways to divide an hour</h2>
            <ul className="tm-grid">
              {STYLES.map((option) => {
                const on = option.id === style.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      className={`tm-card${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => pomodoro.choose(option.id)}
                    >
                      <span className="tm-card-top">
                        <span className="tm-card-name">{option.name}</span>
                        {on && <em className="tm-tag">In use</em>}
                      </span>
                      <Numbers focus={option.focus} rest={option.rest} />
                      <span className="tm-card-who">{option.who}</span>
                      <span className="tm-card-foot">
                        {option.rounds > 1 && <span>×{option.rounds}</span>}
                        <span>{focusShare(option)}% work</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
