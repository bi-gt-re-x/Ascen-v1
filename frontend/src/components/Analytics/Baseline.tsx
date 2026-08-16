/**
 * The first thing a new account can actually do on this page.
 *
 * Every other panel here needs weeks of record before it means anything — a
 * fortnight for a recommendation, three for a habit or a trend, four for an
 * explanation. That is correct and it is not negotiable: the analysis is only
 * worth reading because it refuses to speak early. But it left a new reader
 * with a page of countdowns and no reason to be on it, which is a report they
 * cannot read yet rather than a tool they can use today.
 *
 * A baseline is the part that does not need history, because the account
 * states it rather than the page measuring it. Three questions, answerable on
 * day one, and from day two every tab has something to compare against: not
 * "you worked four days" but "you worked four of the five you meant to".
 *
 * **It is deliberately three questions and not a wizard.** Everything asked
 * here is something the reader already knows without thinking, it fits on one
 * screen with no steps, and none of it is required to be right — a baseline is
 * a stated intention, it is editable, and the page says when it was set so a
 * stale one reads as stale. The moment this needs a second screen it has
 * stopped being the thing somebody does before they have any data and started
 * being the onboarding flow they skip.
 */
import { useState } from 'react';
import { Panel } from './charts';

export interface BaselineValues {
  active_days: number;
  session_minutes: number;
  focus_subject: string;
}

export interface BaselineSetupProps {
  /** The subjects this account has actually used, for the third question. */
  subjects: Array<{ id: string; label: string }>;
  /** What the account already said, when this is an edit rather than a first run. */
  current?: BaselineValues | null;
  /** The day the current baseline was set, ISO. Empty on a first run. */
  setOn?: string;
  onSave: (values: BaselineValues) => Promise<boolean>;
  /** Shown as a way out on the first run — the page underneath still works. */
  onSkip?: () => void;
}

/** Days a week, as the seven buttons rather than a number input. */
const DAY_CHOICES = [1, 2, 3, 4, 5, 6, 7];

/**
 * Sitting lengths, as the four a person actually thinks in.
 *
 * Not a slider: the difference between 45 and 50 minutes is noise against how
 * accurately anybody can answer this, and a slider invites a precision the
 * answer does not have.
 */
const SESSION_CHOICES = [
  { minutes: 25, label: '25 min', hint: 'A pomodoro' },
  { minutes: 45, label: '45 min', hint: 'A class hour' },
  { minutes: 60, label: '1 hour', hint: 'A solid block' },
  { minutes: 120, label: '2 hours', hint: 'A deep session' },
];

export function BaselineSetup({
  subjects,
  current,
  setOn,
  onSave,
  onSkip,
}: BaselineSetupProps) {
  const [days, setDays] = useState(current?.active_days ?? 5);
  const [minutes, setMinutes] = useState(current?.session_minutes ?? 60);
  const [focus, setFocus] = useState(current?.focus_subject ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const editing = Boolean(current);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    const done = await onSave({
      active_days: days,
      session_minutes: minutes,
      focus_subject: focus,
    });
    setSaving(false);
    if (!done) setFailed(true);
  };

  /* What the two numbers come to over a week, printed as they are chosen. The
     point of showing it is that a baseline is easy to set carelessly and this
     is the line that makes an unrealistic one obvious while it is still being
     chosen rather than three weeks later. */
  const weeklyMinutes = days * minutes;
  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;

  return (
    <section className="ax-baseline">
      <div className="ax-baseline-body">
        <p className="ax-baseline-eyebrow">
          {editing ? 'Your baseline' : 'Start here'}
        </p>
        <h2>{editing ? 'What you are aiming at' : 'What does a normal week look like?'}</h2>
        <p className="ax-baseline-lead">
          {editing
            ? 'Every figure here is measured against this.'
            : 'Two minutes now. Everything on this page is measured against it from tomorrow.'}
        </p>

        <div className="ax-baseline-q">
          <h3>Days a week</h3>
          <div className="ax-baseline-days" role="group" aria-label="Days a week">
            {DAY_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`ax-baseline-day${choice === days ? ' is-on' : ''}`}
                aria-pressed={choice === days}
                onClick={() => setDays(choice)}
              >
                {choice}
              </button>
            ))}
          </div>

        </div>

        <div className="ax-baseline-q">
          <h3>A normal sitting</h3>
          <div className="ax-baseline-sessions" role="group" aria-label="Session length">
            {SESSION_CHOICES.map((choice) => (
              <button
                key={choice.minutes}
                type="button"
                className={`ax-baseline-session${choice.minutes === minutes ? ' is-on' : ''}`}
                aria-pressed={choice.minutes === minutes}
                onClick={() => setMinutes(choice.minutes)}
              >
                <strong>{choice.label}</strong>
                <span>{choice.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="ax-baseline-q">
            <h3>
              Mostly for <em>optional</em>
            </h3>
            <select
              className="ax-baseline-select"
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              aria-label="Main subject"
            >
              <option value="">No single subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>

          </div>
        )}

        <p className="ax-baseline-sum">
          <strong>{weeklyHours}h</strong> a week
        </p>

        {failed && (
          <p className="ax-baseline-failed" role="alert">
            Did not save. Try again.
          </p>
        )}

        <div className="ax-baseline-actions">
          <button
            type="button"
            className="ax-btn ax-btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : editing ? 'Update' : 'Set baseline'}
          </button>
          {onSkip && !editing && (
            <button type="button" className="ax-baseline-skip" onClick={onSkip}>
              Skip
            </button>
          )}
        </div>

        {editing && setOn && (
          <p className="ax-baseline-set-on">
            Set on{' '}
            {new Date(`${setOn}T00:00:00`).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            .
          </p>
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// What the baseline is for
// --------------------------------------------------------------------------
export interface BaselinePanelProps {
  /** What the account said it was aiming at. */
  aim: BaselineValues;
  /** The day the aim was set, ISO — a stale baseline should read as stale. */
  setOn: string;
  /** Days worked out of days in the window, 0-100. From `rhythmShape`. */
  activeRate: number;
  /** Focus minutes on a day that had any, averaged. From `rhythmShape`. */
  typicalSession: number;
  /** What the window covers, in the page's own words. */
  span: string;
  onEdit: () => void;
}

/** A ratio as a percentage of its target, capped for the bar but not the text. */
function against(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 100);
}

/**
 * The account's own aim, against what actually happened.
 *
 * This is the payoff for the setup screen and the reason the baseline is worth
 * storing at all. Every other figure on this page is an absolute — you worked
 * four days, your sittings ran 38 minutes — and an absolute cannot be good or
 * bad on its own. Four days is excellent against a three-day aim and a miss
 * against a six-day one, and until the account said which, the page had no way
 * to tell the difference and did not try.
 *
 * It states the comparison and stops. No grade, no encouragement, no colour
 * beyond the bar: the reader set the target, so they are the one qualified to
 * say whether missing it matters.
 */
export function BaselinePanel({
  aim,
  setOn,
  activeRate,
  typicalSession,
  span,
  onEdit,
}: BaselinePanelProps) {
  // The aim is days-a-week; the measurement is a percentage of days in a window
  // of any length. Both become "share of days", which is the only footing the
  // two actually share.
  const aimedRate = (aim.active_days / 7) * 100;
  const daysPct = against(activeRate, aimedRate);
  const sessionPct = against(typicalSession, aim.session_minutes);

  // Roughly how many of seven days were worked, for a sentence that reads in
  // the same unit the reader answered in.
  const workedPerWeek = Math.round((activeRate / 100) * 7 * 10) / 10;

  const rows = [
    {
      key: 'days',
      label: 'Days a week',
      actual: `${workedPerWeek}`,
      target: `aimed ${aim.active_days}`,
      pct: daysPct,
    },
    {
      key: 'session',
      label: 'Sitting',
      actual: typicalSession > 0 ? `${Math.round(typicalSession)} min` : '—',
      target: `aimed ${aim.session_minutes}`,
      pct: sessionPct,
    },
  ];

  return (
    <Panel
      title="Against your baseline"
      note={span}
      aside={
        <button type="button" className="ax-baseline-edit" onClick={onEdit}>
          Edit
        </button>
      }
    >
      <ul className="ax-baseline-rows">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="ax-baseline-row-head">
              <span className="ax-baseline-row-label">{row.label}</span>
              <span className="ax-baseline-row-actual">
                {row.actual} <em>({row.target})</em>
              </span>
            </div>
            <span className="ax-baseline-row-track">
              <i
                className={`ax-baseline-row-fill${row.pct >= 100 ? ' is-met' : ''}`}
                style={{ width: `${Math.max(2, Math.min(100, row.pct))}%` }}
              />
            </span>
            <span className="ax-baseline-row-pct">{row.pct}%</span>
          </li>
        ))}
      </ul>
      <p className="ax-baseline-row-foot">
        Set{' '}
        {setOn
          ? new Date(`${setOn}T00:00:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : 'earlier'}
      </p>
    </Panel>
  );
}
