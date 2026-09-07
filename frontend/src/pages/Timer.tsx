/**
 * Timer — the focus page: pick a session, run it, and see what it added up to.
 *
 * ## It is the same hours, and the same XP
 *
 * A running focus phase runs the account's own focus session, so what happens
 * here lands where a session started from the dashboard does — the Focus card,
 * the calendar, the focus metric on the report card. Nothing on this page mints
 * XP and no setting on it multiplies any: the intensity level changes how many
 * sittings you are *aiming* at, and the extra XP that follows a harder day is
 * the extra work, counted the ordinary way. See LEVELS in components/Timer.
 *
 * ## Every figure is read, not written
 *
 * The tiles, the week's bars, the ratings, the goals and the upcoming tasks are
 * all the account's own record, pulled from the endpoints that already serve
 * them elsewhere. Where there is nothing yet, the figure is a zero rather than
 * a placeholder — an empty week is a true thing to say about a new account, and
 * inventing a busy one would make every other number here suspect.
 */
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useApi, useAuth, useDocumentTitle, usePageEntrance, useSettings, useStats, useUserData,
} from '@/hooks';
import { fmtHM, useFocusSession } from '@/hooks/useFocusSession';
import { usePomodoro } from '@/hooks/usePomodoro';
import { focus as focusService, goals as goalService, growth as growthService } from '@/services';
import { StyleGrid } from '@/components/Timer/Styles';
import {
  LEVELS,
  NEARBY,
  RECOMMENDED,
  SITTINGS,
  STYLES,
  clock,
  styleFor,
  type Phase,
  type Sitting,
} from '@/components/Timer/pomodoro';
import * as format from '@/utils/format';
import '@/styles/timer.css';

const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Focus',
  break: 'Break',
  long: 'Long break',
};

const SETUP_KEY = 'pomodoro:setup';
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function iso(date: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Monday of the week `date` falls in. */
function weekStart(date: Date): Date {
  const out = new Date(date);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  out.setHours(0, 0, 0, 0);
  return out;
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// --------------------------------------------------------------------------
// The setup
// --------------------------------------------------------------------------
function Setup({ onPick, onSkip }: { onPick: (id: string) => void; onSkip: () => void }) {
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!sitting) {
    return (
      <section className="pom-setup">
        <p className="pom-steps"><span className="is-on" /><span /></p>
        <h2>How long can you sit?</h2>
        <div className="pom-choices">
          {SITTINGS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="pom-choice"
              onClick={() => {
                setSitting(option.id);
                setChosen(RECOMMENDED[option.id]);
              }}
            >
              <span className="pom-choice-label">{option.label}</span>
              <span className="pom-choice-hint">{option.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" className="pom-link" onClick={onSkip}>Skip</button>
      </section>
    );
  }

  return (
    <section className="pom-setup">
      <p className="pom-steps"><span /><span className="is-on" /></p>
      <h2>Start with one of these.</h2>
      <div className="pom-choices">
        {NEARBY[sitting].map((id) => {
          const style = styleFor(id);
          return (
            <button
              key={id}
              type="button"
              className={`pom-choice${chosen === id ? ' is-on' : ''}`}
              aria-pressed={chosen === id}
              onClick={() => setChosen(id)}
            >
              <span className="pom-choice-label">
                {style.name}
                {RECOMMENDED[sitting] === id && <em className="pom-tag">Suggested</em>}
              </span>
              <span className="pom-choice-nums">{style.focus} work · {style.rest} break</span>
              <span className="pom-choice-hint">{style.who}</span>
            </button>
          );
        })}
      </div>
      <div className="pom-setup-foot">
        <button type="button" className="pom-link" onClick={() => setSitting(null)}>← Back</button>
        <button
          type="button"
          className="pom-btn is-primary"
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
/** The ring. A gradient per phase, because a stroke cannot take one from a token. */
function Ring({ percent, phase }: { percent: number; phase: Phase }) {
  const r = 92;
  const c = 2 * Math.PI * r;
  return (
    <svg className="pom-ring" viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        {(['focus', 'break', 'long'] as Phase[]).map((name) => (
          <linearGradient key={name} id={`pom-g-${name}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={`var(--pom-${name})`} />
            <stop offset="100%" stopColor={`var(--pom-${name}-2)`} />
          </linearGradient>
        ))}
      </defs>
      <circle className="pom-ring-track" cx="110" cy="110" r={r} />
      <circle
        className="pom-ring-run"
        cx="110" cy="110" r={r}
        stroke={`url(#pom-g-${phase})`}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
      />
    </svg>
  );
}

/** A donut for one percentage. The number lives in the middle of it. */
function Donut({ percent, label, sub }: { percent: number; label: string; sub: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="pom-donut">
      <svg viewBox="0 0 130 130" aria-hidden="true">
        <circle className="pom-donut-track" cx="65" cy="65" r={r} />
        <circle
          className="pom-donut-run" cx="65" cy="65" r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, percent) / 100)}
        />
      </svg>
      <div className="pom-donut-text">
        <strong>{percent}%</strong>
        <span>{label}</span>
        <em>{sub}</em>
      </div>
    </div>
  );
}

function Tile({
  tone, icon, label, value, delta,
}: { tone: string; icon: ReactElement; label: string; value: string; delta?: string }) {
  return (
    <div className="pom-tile">
      <span className={`pom-tile-icon pom-tone-${tone}`} aria-hidden="true">{icon}</span>
      <span className="pom-tile-label">{label}</span>
      <strong className="pom-tile-value">{value}</strong>
      {delta && <span className="pom-tile-delta">{delta}</span>}
    </div>
  );
}

/** Grade discs for the four measures the report card already computes. */
function Rating({ name, grade, score }: { name: string; grade: string; score: number }) {
  return (
    <div className={`pom-rating pom-grade-${grade.replace('+', 'plus').toLowerCase()}`}>
      <span className="pom-rating-disc">{grade}</span>
      <span className="pom-rating-name">{name}</span>
      <span className="pom-rating-score">{score}%</span>
    </div>
  );
}

// --------------------------------------------------------------------------
export default function Timer() {
  useDocumentTitle('Timer');

  const { username } = useAuth();
  const user = username || 'Default';
  const account = useUserData();
  const { stats } = useStats();
  const { displayName } = useSettings();
  const session = useFocusSession(username);
  const pomodoro = usePomodoro(username, session);

  const [setup, setSetup] = useState(() => !setupDone(user));
  useEffect(() => setSetup(!setupDone(user)), [user]);

  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => weekStart(today), [today]);

  const historyCall = useCallback(
    () => focusService.history(iso(monday), iso(today)),
    [monday, today],
  );
  const history = useApi(historyCall, [monday, today]);
  const ratings = useApi(useCallback(() => growthService.ratings(), []), []);
  const goals = useApi(useCallback(() => goalService.getGoals(), []), []);

  const entering = usePageEntrance(true);

  const finish = useCallback(
    (styleId?: string) => {
      if (styleId) pomodoro.choose(styleId);
      markSetupDone(user);
      setSetup(false);
    },
    [pomodoro, user],
  );

  const { style, phase, running, remaining, percent, level, doneToday } = pomodoro;

  // ---- the week, from the account's own focus record ----------------------
  const week = useMemo(() => {
    const days = history.data?.days ?? {};
    return DAY_NAMES.map((name, at) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + at);
      const record = days[iso(date)];
      return { name, hours: (Number(record?.seconds) || 0) / 3600 };
    });
  }, [history.data, monday]);

  const weekPeak = Math.max(1, ...week.map((d) => d.hours));
  const weekTotal = week.reduce((sum, d) => sum + d.hours, 0);
  const workedDays = week.filter((d) => d.hours > 0).length;

  const tasks = account.data?.tasks ?? [];
  const doneThisWeek = tasks.filter(
    (task) => task.status === 'done' && (task.completed_at ?? '') >= iso(monday),
  ).length;

  const upcoming = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== 'done')
        .sort((a, b) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9'))
        .slice(0, 5),
    [tasks],
  );

  const activeGoals = (goals.data?.goals ?? [])
    .filter((goal) => goal.status === 'active')
    .slice(0, 4);

  const levelNow = stats ? format.levelForTotalXp(stats.xp) : null;
  const metrics = ratings.data?.metrics;
  const goalSeconds = session.goalHours * 3600;
  const goalPercent = goalSeconds
    ? Math.min(100, Math.round((session.focused / goalSeconds) * 100))
    : 0;

  return (
    <div className={`pom-page${entering ? ' pg-enter' : ''}`}>
      <header className="pom-head">
        <div className="pom-head-text">
          <h1>
            {greeting(today.getHours())}, {displayName || username || 'there'}
          </h1>
          <p>Focus today. Build the future you want.</p>
        </div>
        <span className="pom-date">
          {today.toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      </header>

      {setup ? (
        <Setup onPick={(id) => finish(id)} onSkip={() => finish()} />
      ) : (
        <>
          {/* ---- Hero -------------------------------------------------- */}
          <section className={`pom-hero is-${phase}`}>
            <div className="pom-hero-left">
              <span className="pom-badge">Focus mode</span>
              <h2>Pick your focus</h2>
              <p>Choose how hard you want to work and what type of pomodoro fits your goals.</p>

              <div className="pom-picks">
                <label className="pom-pick">
                  <span className="pom-pick-top">
                    <b>{level.name}</b>
                    <i>{level.hint}</i>
                  </span>
                  <select
                    value={level.id}
                    onChange={(event) => pomodoro.setLevel(Number(event.target.value))}
                    aria-label="Intensity"
                  >
                    {LEVELS.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
                <label className="pom-pick">
                  <span className="pom-pick-top">
                    <b>{style.name}</b>
                    <i>{style.focus} min work · {style.rest} min break</i>
                  </span>
                  <select
                    value={style.id}
                    onChange={(event) => pomodoro.choose(event.target.value)}
                    aria-label="Pomodoro style"
                  >
                    {STYLES.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="pom-start"
                onClick={running ? pomodoro.pause : pomodoro.start}
              >
                {running ? 'Pause Focus' : 'Start Focus'}
              </button>

              <ul className="pom-perks">
                <li>Earns XP</li>
                <li>Tracks progress</li>
                <li>Builds streak</li>
              </ul>
            </div>

            <div className="pom-hero-mid">
              <div className="pom-ring-wrap">
                <Ring percent={percent} phase={phase} />
                <div className="pom-ring-text" aria-live="polite">
                  <span className="pom-ring-phase">{PHASE_LABEL[phase]}</span>
                  <span className="pom-ring-time">{clock(remaining)}</span>
                  <span className="pom-ring-sub">{style.name}</span>
                </div>
              </div>
              <div className="pom-ring-controls">
                <button
                  type="button"
                  className="pom-round is-primary"
                  onClick={running ? pomodoro.pause : pomodoro.start}
                  aria-label={running ? 'Pause' : 'Start'}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    {running ? <path d="M8 5h3v14H8zm5 0h3v14h-3z" />
                      : <path d="M7 4.5v15l13-7.5z" />}
                  </svg>
                </button>
                <button type="button" className="pom-round" onClick={pomodoro.reset} aria-label="Reset">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" />
                  </svg>
                </button>
                <button type="button" className="pom-round" onClick={() => setSetup(true)} aria-label="Set up again">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="pom-hero-side">
              <div className="pom-side-card">
                <span className="pom-side-icon pom-tone-amber" aria-hidden="true">◉</span>
                <span className="pom-side-label">Today&apos;s Focus</span>
                <strong>{doneToday} / {level.target}</strong>
                <em>pomodoros</em>
              </div>
              <div className="pom-side-card">
                <span className="pom-side-icon pom-tone-rose" aria-hidden="true">▲</span>
                <span className="pom-side-label">Current Streak</span>
                <strong>{stats?.current_streak ?? 0}</strong>
                <em>days</em>
              </div>
              <div className="pom-side-card">
                <span className="pom-side-icon pom-tone-violet" aria-hidden="true">★</span>
                <span className="pom-side-label">Next Level</span>
                <strong>Level {(levelNow?.level ?? 1) + 1}</strong>
                <em>
                  {levelNow ? `${(levelNow.xpRequired - levelNow.xpInLevel).toLocaleString()} XP to go` : '—'}
                </em>
              </div>
            </div>
          </section>

          {/* ---- Progress ---------------------------------------------- */}
          <section className="pom-panel">
            <header className="pom-panel-head">
              <h2>Your Progress</h2>
              <span className="pom-quiet">This week</span>
            </header>
            <div className="pom-progress">
              <Donut
                percent={goalPercent}
                label="Daily Goal"
                sub={`${fmtHM(session.focused)} / ${fmtHM(goalSeconds)}`}
              />
              <div className="pom-tiles">
                <Tile
                  tone="blue" label="Total Focus Time" value={fmtHM(weekTotal * 3600)}
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>}
                />
                <Tile
                  tone="rose" label="Pomodoros Today" value={String(doneToday)}
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="7" /><path d="M9 3h6" strokeLinecap="round" /></svg>}
                />
                <Tile
                  tone="amber" label="Days Worked" value={`${workedDays} / 7`}
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" strokeLinecap="round" /></svg>}
                />
                <Tile
                  tone="green" label="Tasks Completed" value={String(doneThisWeek)}
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                />
              </div>
            </div>

            <div className="pom-week">
              <h3>Focus Time This Week</h3>
              <div className="pom-bars">
                {week.map((day) => (
                  <div className="pom-bar" key={day.name}>
                    <span
                      className="pom-bar-fill"
                      style={{ height: `${Math.round((day.hours / weekPeak) * 100)}%` }}
                      title={`${day.name}: ${fmtHM(day.hours * 3600)}`}
                    />
                    <span className="pom-bar-name">{day.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---- The ten ----------------------------------------------- */}
          <section className="pom-panel">
            <header className="pom-panel-head">
              <h2>Ten Ways to Divide an Hour</h2>
              <span className="pom-quiet">{style.name} in use</span>
            </header>
            <StyleGrid current={style.id} onPick={pomodoro.choose} />
          </section>

          {/* ---- Ratings and goals ------------------------------------- */}
          <div className="pom-split">
            <section className="pom-panel">
              <header className="pom-panel-head">
                <h2>Growth Ratings</h2>
                <Link className="pom-link" to="/analytics">View details →</Link>
              </header>
              {metrics ? (
                <>
                  <div className="pom-ratings">
                    <Rating name="Consistency" grade={metrics.consistency.grade} score={metrics.consistency.score} />
                    <Rating name="Quality" grade={metrics.quality.grade} score={metrics.quality.score} />
                    <Rating name="Productivity" grade={metrics.productivity.grade} score={metrics.productivity.score} />
                    <Rating name="Efficiency" grade={metrics.efficiency.grade} score={metrics.efficiency.score} />
                  </div>
                  <div className="pom-overall">
                    <span>Overall Score</span>
                    <strong>{ratings.data?.overall.score}%</strong>
                    <div className="pom-overall-bar">
                      <span style={{ width: `${ratings.data?.overall.score ?? 0}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="pom-empty">
                  {ratings.error ? 'Could not read your ratings.' : 'Reading your ratings…'}
                </p>
              )}
            </section>

            <section className="pom-panel">
              <header className="pom-panel-head">
                <h2>Active Goals</h2>
                <Link className="pom-link" to="/goals">View all →</Link>
              </header>
              {activeGoals.length ? (
                <ul className="pom-goals">
                  {activeGoals.map((goal) => (
                    <li key={goal.id}>
                      <span className="pom-goal-title">{goal.title}</span>
                      <span className="pom-goal-bar">
                        <span style={{ width: `${Math.min(100, goal.progress)}%` }} />
                      </span>
                      <span className="pom-goal-pct">{Math.round(goal.progress)}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pom-empty">Nothing you are aiming at yet.</p>
              )}
            </section>
          </div>

          {/* ---- Upcoming ---------------------------------------------- */}
          <section className="pom-panel">
            <header className="pom-panel-head">
              <h2>Upcoming Tasks</h2>
              <Link className="pom-link" to="/tasks">View all →</Link>
            </header>
            {upcoming.length ? (
              <ul className="pom-tasks">
                {upcoming.map((task) => (
                  <li key={task.id}>
                    <span className="pom-tasks-dot" aria-hidden="true" />
                    <span className="pom-tasks-title">{task.title}</span>
                    {task.subject && <span className="pom-tasks-tag">{task.subject}</span>}
                    <span className="pom-tasks-xp">+{task.xp_value ?? 0} XP</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pom-empty">Nothing on your plate.</p>
            )}
          </section>

          {/* ---- Level ------------------------------------------------- */}
          <section className="pom-level">
            <div className="pom-level-text">
              <h2>Level Up Your Focus</h2>
              <p>Finish sessions, earn XP, and get closer to your goals.</p>
            </div>
            <div className="pom-level-meter">
              <span className="pom-level-name">Level {levelNow?.level ?? 1}</span>
              <div className="pom-level-bar">
                <span style={{ width: `${levelNow?.percent ?? 0}%` }} />
              </div>
              <span className="pom-level-xp">
                {(stats?.xp ?? 0).toLocaleString()} XP
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
