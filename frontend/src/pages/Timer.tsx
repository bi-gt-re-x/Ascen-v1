/**
 * Timer — the focus session with a shape over it.
 *
 * ## Why this is a page and not a bigger Focus panel
 *
 * The dashboard's Focus panel is a stopwatch: it starts, it counts, it stops,
 * and every minute it banks is a minute somebody had to decide to keep sitting
 * for. That is the right control to have beside a task list, and it is the
 * wrong one to be the only one, because the hard part of a long session is not
 * starting it — it is knowing when to stop, and trusting that stopping is part
 * of the plan rather than giving up.
 *
 * A pomodoro answers that by deciding in advance. So this page is the same
 * session with a cycle over it, and it is a page because choosing the cycle,
 * watching it, and reading what it has banked are three things that want room.
 *
 * ## It is the same hours
 *
 * A running focus phase runs the account's focus session, so what happens here
 * lands in the same place a session started from the dashboard does — the
 * Focus card, the calendar, the focus metric on the report card. There is no
 * second ledger and no "timer XP". See hooks/usePomodoro for how the phase
 * drives it.
 *
 * ## The setup asks one question
 *
 * How long can you sit? Everything else about these ten styles follows from
 * that, and a second question would be asking somebody to specify something
 * they can only find out by trying it. It runs once, remembers, and stays
 * reachable from the header afterwards — a reader whose answer changes in
 * October should not have to clear their browser storage to say so.
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
  cycleMinutes,
  focusShare,
  styleFor,
  type Phase,
  type Sitting,
} from '@/components/Timer/pomodoro';
import '@/styles/timer.css';

/** What the phase is called on screen. */
const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Focus',
  break: 'Break',
  long: 'Long break',
};

/** One line under the clock, saying what this phase is for. */
const PHASE_NOTE: Record<Phase, string> = {
  focus: 'Work on one thing until this runs out.',
  break: 'Stand up. This one is short on purpose.',
  long: 'Properly away from it. The next round starts fresh.',
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
        <p className="tm-step">Setting up · step 1 of 2</p>
        <h2 id="tm-setup-q">How long can you sit before you need to stop?</h2>
        <p className="tm-setup-lead">
          Not how long you wish you could — how long you actually last on a normal
          day. Every one of these methods is an answer to that, and picking the
          wrong one is why the famous twenty-five minutes does not work for
          everybody.
        </p>
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
          Skip — just show me the timer
        </button>
      </section>
    );
  }

  const offered = NEARBY[sitting];
  return (
    <section className="tm-setup" aria-labelledby="tm-setup-q2">
      <p className="tm-step">Setting up · step 2 of 2</p>
      <h2 id="tm-setup-q2">Start with this one.</h2>
      <p className="tm-setup-lead">
        The middle one is the usual answer for that. The other two are the same
        idea shorter and longer — you can change it any time, and the picker
        below the timer has all ten.
      </p>
      <div className="tm-choices">
        {offered.map((id) => {
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
                {RECOMMENDED[sitting] === id && (
                  <em className="tm-tag">Suggested</em>
                )}
              </span>
              <span className="tm-choice-nums">
                {style.focus} min work · {style.rest} min break
              </span>
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
          Use {chosen ? styleFor(chosen).name : 'this'}
        </button>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// The dial
// --------------------------------------------------------------------------
/** The ring. Stroke-dashoffset against a known circumference, so no layout. */
function Dial({ percent, phase }: { percent: number; phase: Phase }) {
  const r = 86;
  const circumference = 2 * Math.PI * r;
  return (
    <svg className="tm-dial" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="tm-dial-track" cx="100" cy="100" r={r} />
      <circle
        className={`tm-dial-run is-${phase}`}
        cx="100"
        cy="100"
        r={r}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
      />
    </svg>
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
  const goalSeconds = session.goalHours * 3600;

  return (
    <div className={`tm-page${entering ? ' pg-enter' : ''}`}>
      <header className="tm-head">
        <div>
          <h1 className="tm-title">Timer</h1>
          <p className="tm-sub">
            A shape for a session. The hours it banks are the same ones the rest
            of the app counts.
          </p>
        </div>
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
          <section className="tm-clock-card" aria-live="polite">
            <div className="tm-clock-wrap">
              <Dial percent={percent} phase={phase} />
              <div className="tm-clock-text">
                <span className={`tm-phase is-${phase}`}>{PHASE_LABEL[phase]}</span>
                <span className="tm-time">{clock(remaining)}</span>
                <span className="tm-round">
                  {style.rounds > 1
                    ? `Round ${Math.min(done + 1, style.rounds)} of ${style.rounds}`
                    : style.name}
                </span>
              </div>
            </div>

            <p className="tm-phase-note">{PHASE_NOTE[phase]}</p>

            <div className="tm-controls">
              <button
                type="button"
                className="tm-btn is-primary"
                onClick={running ? pomodoro.pause : pomodoro.start}
              >
                {running ? 'Pause' : 'Start'}
              </button>
              <button type="button" className="tm-btn" onClick={pomodoro.skip}>
                Skip {PHASE_LABEL[phase].toLowerCase()}
              </button>
              <button type="button" className="tm-btn" onClick={pomodoro.reset}>
                Reset
              </button>
            </div>

            <dl className="tm-today">
              <div>
                <dt>Focused today</dt>
                <dd>{fmtHM(session.focused)}</dd>
              </div>
              <div>
                <dt>Daily goal</dt>
                <dd>{fmtHM(goalSeconds)}</dd>
              </div>
              <div>
                <dt>Of goal</dt>
                <dd>{session.percent}%</dd>
              </div>
            </dl>
            <p className="tm-today-note">
              Counted into the same day the dashboard and the calendar show. A
              break does not count, which is the point of calling it one.
            </p>
          </section>

          <section className="tm-styles" aria-labelledby="tm-styles-h">
            <h2 id="tm-styles-h">Ten ways to divide an hour</h2>
            <p className="tm-styles-lead">
              Sorted by how long you sit. Changing one starts its cycle from the
              beginning — you are choosing a method, not editing this round.
            </p>
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
                      <span className="tm-card-nums">
                        <strong>{option.focus}</strong> min work
                        <span className="tm-card-sep">·</span>
                        <strong>{option.rest}</strong> min break
                      </span>
                      <span className="tm-card-who">{option.who}</span>
                      <span className="tm-card-foot">
                        {option.rounds > 1
                          ? `${option.rounds} rounds, then ${option.long} min`
                          : `${option.long} min break`}
                        <span className="tm-card-sep">·</span>
                        {focusShare(option)}% of {cycleMinutes(option)} min is work
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
