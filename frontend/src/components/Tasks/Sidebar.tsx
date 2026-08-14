/**
 * The right-hand column: a timer, what is next, what is running, and a box.
 *
 * All four are about *now* rather than about the list — which is why they sit
 * beside it rather than in it, and why none of them takes the page's filters.
 * Searching for "physics" should not empty the panel telling you what is due at
 * four o'clock.
 */
import { useEffect, useState } from 'react';
import { useFocusSession } from '@/hooks';
import type { Task } from '@/types';
import type { Streak } from './board';
import { timeLabel } from './board';

// --------------------------------------------------------------------------
// Focus timer
// --------------------------------------------------------------------------
/** The length of one sitting, in seconds. */
const POMODORO = 25 * 60;

/**
 * A twenty-five minute countdown that banks its time like everything else.
 *
 * **It is not a second clock.** Starting it starts the account's real focus
 * session — the same `useFocusSession` the dashboard and the calendar read, the
 * same localStorage day, the same minute totals that end up on the growth
 * chart and in the report card's focus metric. What this adds is a *shape* for
 * the sitting: the day total answers "how much have I done", which is not the
 * question somebody sitting down to work has.
 *
 * The countdown is derived from the clock rather than counted in ticks, for the
 * same reason the session underneath it is: a tab in the background stops
 * getting timers and a counted clock would silently lose the minutes.
 */
function FocusTimer({ username }: { username: string | null }) {
  const session = useFocusSession(username);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);

  // Only while running, and only once a second — a countdown that re-rendered
  // the page on an animation frame would cost more than the panel is worth.
  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
  const left = Math.max(0, POMODORO - elapsed);
  const done = startedAt !== null && left === 0;

  // Stop the underlying session the moment the sitting is up, so the banked
  // total is the sitting rather than however long the tab stayed open after it.
  useEffect(() => {
    if (done && session.running) session.stop();
  }, [done, session]);

  const start = () => {
    setStartedAt(Date.now());
    if (!session.running) session.start();
  };
  const reset = () => {
    setStartedAt(null);
    if (session.running) session.stop();
  };

  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  const share = 1 - left / POMODORO;

  // A ring drawn as one stroked circle with a dash pattern. `pathLength` is
  // safe here and nowhere near the charts' problem: the box is square, scaled
  // uniformly, and the stroke is not exempted from that scaling.
  const radius = 52;

  return (
    <section className="tk-side tk-timer">
      <header className="tk-side-head">
        <span className="tk-side-ico is-violet" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" />
          </svg>
        </span>
        <h2>Focus Timer</h2>
      </header>

      <div className="tk-dial">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="tk-dial-track" cx="60" cy="60" r={radius} pathLength={100} />
          <circle
            className="tk-dial-fill"
            cx="60"
            cy="60"
            r={radius}
            pathLength={100}
            strokeDasharray={`${(share * 100).toFixed(2)} 100`}
          />
        </svg>
        <div className="tk-dial-face">
          <strong>
            {minutes}:{String(seconds).padStart(2, '0')}
          </strong>
          <span>{done ? 'Done' : startedAt === null ? 'Focus' : 'Working'}</span>
        </div>
      </div>

      <div className="tk-dial-tools">
        <button
          type="button"
          className="tk-play"
          aria-label={startedAt === null ? 'Start a focus sitting' : 'Stop the sitting'}
          onClick={startedAt === null ? start : reset}
        >
          {startedAt === null ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="6" width="4" height="12" rx="1" /><rect x="13" y="6" width="4" height="12" rx="1" /></svg>
          )}
        </button>
        <button type="button" className="tk-reset" aria-label="Reset the timer" onClick={reset}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 12a8 8 0 1 1-2.3-5.6" />
            <path d="M20 4v4h-4" />
          </svg>
        </button>
      </div>
      <p className="tk-dial-note">
        {session.focused > 0
          ? `${Math.round(session.focused / 60)}m focused today`
          : 'Nothing banked today yet'}
      </p>
    </section>
  );
}

// --------------------------------------------------------------------------
// What is next
// --------------------------------------------------------------------------
function Upcoming({
  tasks,
  subjectName,
  onAll,
}: {
  tasks: Task[];
  subjectName: (id: string | undefined) => string | null;
  onAll: () => void;
}) {
  return (
    <section className="tk-side">
      <header className="tk-side-head">
        <span className="tk-side-ico is-blue" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
          </svg>
        </span>
        <h2>Upcoming Tasks</h2>
        <button type="button" className="tk-side-all" onClick={onAll}>
          View all
        </button>
      </header>
      {tasks.length === 0 ? (
        <p className="tk-side-empty">Nothing dated ahead of you.</p>
      ) : (
        <ul className="tk-next">
          {tasks.map((task) => (
            <li key={task.id} className={`is-${task.priority}`}>
              <span className="tk-next-at">{timeLabel(task.due_date) ?? '—'}</span>
              <span className="tk-next-body">
                <strong>{task.title}</strong>
                <span>{subjectName(task.subject) ?? 'No subject'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Streaks
// --------------------------------------------------------------------------
/** Flames drawn per streak. Past this the row would be a wall of emoji. */
const FLAMES = 7;

function Streaks({ rows, onAll }: { rows: Streak[]; onAll: () => void }) {
  return (
    <section className="tk-side">
      <header className="tk-side-head">
        <span className="tk-side-ico is-amber" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-1.5 1-3 1-3s.5 2 2 2c0-3 2-7 2-7z" />
          </svg>
        </span>
        <h2>Task Streaks</h2>
        <button type="button" className="tk-side-all" onClick={onAll}>
          View all
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="tk-side-empty">
          Nothing on a run yet. A task done two days together starts one.
        </p>
      ) : (
        <ul className="tk-streaks">
          {rows.map((row) => (
            <li key={row.title}>
              <span className="tk-streak-name" title={row.title}>
                {row.title}
              </span>
              <span className="tk-streak-days">{row.days} days</span>
              <span className="tk-streak-flames" aria-hidden="true">
                {Array.from({ length: FLAMES }, (_, index) => (
                  <i key={index} className={index < row.days ? 'is-lit' : undefined}>
                    🔥
                  </i>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
// Quick add
// --------------------------------------------------------------------------
/**
 * One line in, one task out.
 *
 * The four buttons set the fields a task most often needs and the box sets the
 * name, which is the split that keeps this to one line: anything needing a form
 * belongs behind New Task, and anything needing nothing belongs here.
 */
function QuickAdd({
  busy,
  onAdd,
  onOpenFull,
}: {
  busy: boolean;
  onAdd: (name: string, due: string | null, priority: 'high' | 'medium' | 'low') => void;
  onOpenFull: () => void;
}) {
  const [name, setName] = useState('');
  const [when, setWhen] = useState<'none' | 'today' | 'tomorrow'>('none');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const send = () => {
    const title = name.trim();
    if (!title || busy) return;
    const at = new Date();
    if (when === 'tomorrow') at.setDate(at.getDate() + 1);
    onAdd(title, when === 'none' ? null : at.toISOString().slice(0, 10), priority);
    setName('');
    setWhen('none');
    setPriority('medium');
  };

  const dates: Array<{ key: typeof when; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
  ];

  return (
    <section className="tk-side">
      <header className="tk-side-head">
        <span className="tk-side-ico is-violet" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
          </svg>
        </span>
        <h2>Quick Add</h2>
      </header>

      <input
        className="tk-quick-box"
        value={name}
        placeholder="What needs to get done?"
        aria-label="New task"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') send();
        }}
      />

      <div className="tk-quick-tools">
        {dates.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={`tk-quick-tool${when === entry.key ? ' is-on' : ''}`}
            title={`Due ${entry.label.toLowerCase()}`}
            onClick={() => setWhen(when === entry.key ? 'none' : entry.key)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <span className="tk-sr">{entry.label}</span>
          </button>
        ))}

        <button
          type="button"
          className={`tk-quick-tool is-${priority}`}
          title={`Priority: ${priority}`}
          onClick={() =>
            setPriority(priority === 'medium' ? 'high' : priority === 'high' ? 'low' : 'medium')
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M5 21V4h11l-1.5 3.5L16 11H5" />
          </svg>
          <span className="tk-sr">Priority</span>
        </button>

        <button type="button" className="tk-quick-tool" title="More fields" onClick={onOpenFull}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <span className="tk-sr">More fields</span>
        </button>

        <button
          type="button"
          className="tk-quick-send"
          disabled={busy || name.trim() === ''}
          aria-label="Add this task"
          onClick={send}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M4 12l16-8-6 16-2.5-6z" />
          </svg>
        </button>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
export interface SidebarProps {
  username: string | null;
  upcoming: Task[];
  streaks: Streak[];
  busy: boolean;
  subjectName: (id: string | undefined) => string | null;
  onAdd: (name: string, due: string | null, priority: 'high' | 'medium' | 'low') => void;
  onOpenFull: () => void;
  onShowUpcoming: () => void;
  onShowStreaks: () => void;
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="tk-rail">
      <FocusTimer username={props.username} />
      <Upcoming
        tasks={props.upcoming}
        subjectName={props.subjectName}
        onAll={props.onShowUpcoming}
      />
      <Streaks rows={props.streaks} onAll={props.onShowStreaks} />
      <QuickAdd busy={props.busy} onAdd={props.onAdd} onOpenFull={props.onOpenFull} />
    </aside>
  );
}
