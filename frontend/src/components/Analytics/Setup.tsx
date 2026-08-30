/**
 * The questions a new account answers before this page will draw anything.
 *
 * ## Why there is a wizard here at all, when the baseline argued against one
 *
 * The screen this replaces was three questions on one card, and the comment
 * above it said, in as many words, that the moment it needed a second screen
 * it had stopped being the thing somebody does on day one and become the
 * onboarding flow they skip. That argument was right about *those three
 * questions* and it does not survive what is being asked now.
 *
 * The three were all facts the reader already knew without thinking — how many
 * days, how long, which subject. What has been added is not more of those. It
 * is the four decisions that were previously made *for* the reader and buried:
 * how they record work, how blunt the page is allowed to be about a shortfall,
 * how much of the page they want drawn, and which tab it opens on. Those are
 * choices rather than recollections, and a choice needs its options laid out
 * and its consequence stated beside it. Seven of those on one card is a wall
 * of segmented controls that nobody reads and everybody clicks past — which is
 * the failure the old comment was actually worried about, arrived at from the
 * other direction.
 *
 * So: one question per screen, the consequence of each answer written under it
 * in the reader's own terms, and a step count that never goes above seven. The
 * subject question is dropped on an account with no subjects, so the flow is
 * six there — the count comes from the steps that exist rather than being
 * declared, because a "Step 4 of 7" that skips 4 is worse than either number.
 *
 * ## Nothing here is required to be right
 *
 * Every answer is editable afterwards — the four preferences from the settings
 * page, the three baseline figures from the panel this screen's answers feed.
 * The page says when the baseline was set so a stale one reads as stale. That
 * is what makes it reasonable to ask at all: none of this is a commitment, it
 * is the difference between the page measuring against an assumption and the
 * page measuring against something the reader said.
 *
 * ## One write, at the end
 *
 * The steps hold their answers here and nothing is sent until Finish. A wizard
 * that wrote each step as it went would leave an account that closed the tab on
 * step three with a tone but no baseline — half-configured, and no longer new
 * enough to be asked again. The whole set lands or none of it does.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BaselineValues } from './Baseline';
import { VIEWS } from './Header';
import type { AnalyticsHomeTab, AnalyticsDetail, AnalyticsTone, LogStyle, Prefs } from '@/services/settings';
import {
  DETAIL_HINT,
  DETAIL_LABEL,
  LOG_STYLE_HINT,
  LOG_STYLE_LABEL,
  TONE_HINT,
  TONE_LABEL,
} from '@/utils/analyticsPrefs';

/** The preferences this screen sets. The rest of analytics' are settings-only. */
export type SetupPrefs = Pick<
  Prefs,
  'analytics_log_style' | 'analytics_tone' | 'analytics_detail' | 'analytics_home_tab'
>;

export interface SetupAnswers {
  baseline: BaselineValues;
  prefs: SetupPrefs;
}

export interface AnalyticsSetupProps {
  /** The subjects this account has actually used, for the subject question. */
  subjects: Array<{ id: string; label: string }>;
  /** What the account already said, when this is an edit rather than a first run. */
  current?: BaselineValues | null;
  /** The day the current baseline was set, ISO. Empty on a first run. */
  setOn?: string;
  /** Where the four preference questions start from. */
  prefs: SetupPrefs;
  /** Writes everything at once. Returns whether it landed. */
  onSave: (answers: SetupAnswers) => Promise<boolean>;
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

const LOG_CHOICES: LogStyle[] = ['tasks', 'sessions', 'both'];
const TONE_CHOICES: AnalyticsTone[] = ['gentle', 'balanced', 'harsh'];
const DETAIL_CHOICES: AnalyticsDetail[] = ['essentials', 'standard', 'everything'];

/**
 * A question, and what it does with the answer.
 *
 * `body` is drawn inside the card; `title` and `lead` are the heading above it.
 * The type exists so the step count, the rail and the Back/Next arithmetic all
 * read one array — a flow whose length is declared in one place and rendered
 * in another is a flow that will one day say "Step 4 of 6" on the last screen.
 */
interface Step {
  key: string;
  title: string;
  lead: string;
  body: ReactNode;
}

/** The stacked-card control most of these questions use. */
function Choices<T extends string>({
  value,
  options,
  label,
  onPick,
}: {
  value: T;
  options: Array<{ key: T; label: string; hint: string }>;
  label: string;
  onPick: (next: T) => void;
}) {
  return (
    <div className="ax-setup-choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`ax-setup-choice${option.key === value ? ' is-on' : ''}`}
          aria-pressed={option.key === value}
          onClick={() => onPick(option.key)}
        >
          <strong>{option.label}</strong>
          <span>{option.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function AnalyticsSetup({
  subjects,
  current,
  setOn,
  prefs,
  onSave,
  onSkip,
}: AnalyticsSetupProps) {
  const [at, setAt] = useState(0);
  const [days, setDays] = useState(current?.active_days ?? 5);
  const [minutes, setMinutes] = useState(current?.session_minutes ?? 60);
  const [focus, setFocus] = useState(current?.focus_subject ?? '');
  const [logStyle, setLogStyle] = useState<LogStyle>(prefs.analytics_log_style);
  const [tone, setTone] = useState<AnalyticsTone>(prefs.analytics_tone);
  const [detail, setDetail] = useState<AnalyticsDetail>(prefs.analytics_detail);
  const [homeTab, setHomeTab] = useState<AnalyticsHomeTab>(prefs.analytics_home_tab);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const editing = Boolean(current);

  /* What the two numbers come to over a week, printed as they are chosen. The
     point of showing it is that a baseline is easy to set carelessly and this
     is the line that makes an unrealistic one obvious while it is still being
     chosen rather than three weeks later. */
  const weeklyHours = Math.round(((days * minutes) / 60) * 10) / 10;

  const steps: Step[] = useMemo(() => {
    const list: Step[] = [
      {
        key: 'log',
        title: 'How do you record what you do?',
        lead:
          'Everything on this page is counted off one of two things: the tasks you tick off, or '
          + 'the time you log. Which one leads the figures should be the one you actually keep.',
        body: (
          <Choices
            label="How you record work"
            value={logStyle}
            onPick={setLogStyle}
            options={LOG_CHOICES.map((key) => ({
              key,
              label: LOG_STYLE_LABEL[key],
              hint: LOG_STYLE_HINT[key],
            }))}
          />
        ),
      },
      {
        key: 'days',
        title: 'How many days a week do you mean to work?',
        lead:
          'Not how many you managed last week — how many a normal week has in it. Four days is '
          + 'excellent against a three-day aim and a miss against a six-day one, and until you '
          + 'say which, no total on this page can be good or bad.',
        body: (
          <>
            <div className="ax-setup-days" role="group" aria-label="Days a week">
              {DAY_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`ax-setup-day${choice === days ? ' is-on' : ''}`}
                  aria-pressed={choice === days}
                  onClick={() => setDays(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
            <p className="ax-setup-sum">
              <strong>{weeklyHours}h</strong> a week at your current answers
            </p>
          </>
        ),
      },
      {
        key: 'session',
        title: 'How long is a normal sitting?',
        lead:
          'Roughly. The difference between 45 and 50 minutes is noise against how accurately '
          + 'anybody can answer this, which is why these are four buttons and not a slider.',
        body: (
          <>
            <div className="ax-setup-sessions" role="group" aria-label="Session length">
              {SESSION_CHOICES.map((choice) => (
                <button
                  key={choice.minutes}
                  type="button"
                  className={`ax-setup-session${choice.minutes === minutes ? ' is-on' : ''}`}
                  aria-pressed={choice.minutes === minutes}
                  onClick={() => setMinutes(choice.minutes)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.hint}</span>
                </button>
              ))}
            </div>
            <p className="ax-setup-sum">
              <strong>{weeklyHours}h</strong> a week, against {days} {days === 1 ? 'day' : 'days'}
            </p>
          </>
        ),
      },
    ];

    /* Dropped rather than disabled on an account with no subjects. A question
       whose only answer is "none" is a step that costs a click and returns
       nothing, and the step count below is computed from this array so the
       rail says six rather than skipping a number. */
    if (subjects.length > 0) {
      list.push({
        key: 'subject',
        title: 'Is most of this for one subject?',
        lead:
          'Optional, and easy to change. It is what lets the page tell "you worked four days" '
          + 'apart from "you worked four days on the thing you said mattered".',
        body: (
          <select
            className="ax-setup-select"
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
        ),
      });
    }

    list.push(
      {
        key: 'tone',
        title: 'How blunt should this page be?',
        lead:
          'This never changes a figure — the score is the mean of the same five measures at '
          + 'every setting. It changes how much of a miss is called a miss, and how many '
          + 'problems are put in front of you at once.',
        body: (
          <Choices
            label="How blunt the page is"
            value={tone}
            onPick={setTone}
            options={TONE_CHOICES.map((key) => ({
              key,
              label: TONE_LABEL[key],
              hint: TONE_HINT[key],
            }))}
          />
        ),
      },
      {
        key: 'detail',
        title: 'How much of it do you want on screen?',
        lead:
          'Nothing is deleted by choosing less — every panel dropped here exists in full on the '
          + 'tab it belongs to. This is about what the Overview opens with.',
        body: (
          <Choices
            label="How much detail"
            value={detail}
            onPick={setDetail}
            options={DETAIL_CHOICES.map((key) => ({
              key,
              label: DETAIL_LABEL[key],
              hint: DETAIL_HINT[key],
            }))}
          />
        ),
      },
      {
        key: 'home',
        title: 'Which of these should open first?',
        lead:
          'Seven tabs, and which one you want first says what you come here for. Recommendations '
          + 'is the only one that ends in a button; Overview is the long view.',
        body: (
          <div className="ax-setup-tabs" role="group" aria-label="Which tab opens first">
            {VIEWS.map((view) => (
              <button
                key={view.key}
                type="button"
                className={`ax-setup-tab${view.key === homeTab ? ' is-on' : ''}`}
                aria-pressed={view.key === homeTab}
                onClick={() => setHomeTab(view.key)}
              >
                <strong>{view.label}</strong>
                <span>{view.purpose}</span>
              </button>
            ))}
          </div>
        ),
      },
    );

    return list;
  }, [days, detail, focus, homeTab, logStyle, minutes, subjects, tone, weeklyHours]);

  const total = steps.length;
  // Clamped rather than trusted: the subject step disappears when a catalogue
  // fails to arrive mid-flow, and an index past the end would render nothing.
  const index = Math.min(at, total - 1);
  const step = steps[index]!;
  const last = index === total - 1;

  const save = async () => {
    setSaving(true);
    setFailed(false);
    const done = await onSave({
      baseline: { active_days: days, session_minutes: minutes, focus_subject: focus },
      prefs: {
        analytics_log_style: logStyle,
        analytics_tone: tone,
        analytics_detail: detail,
        analytics_home_tab: homeTab,
      },
    });
    setSaving(false);
    if (!done) setFailed(true);
  };

  return (
    <section className="ax-setup" aria-label="Set up your analytics">
      <div className="ax-setup-body">
        <header className="ax-setup-head">
          <p className="ax-setup-eyebrow">
            {editing ? 'Your answers' : 'Start here'} · Step {index + 1} of {total}
          </p>
          {/* Clickable, because a reader on step six who wants to change their
              answer to step two should not have to press Back four times. */}
          <ol className="ax-setup-rail" aria-label={`Step ${index + 1} of ${total}`}>
            {steps.map((entry, slot) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`ax-setup-pip${slot === index ? ' is-on' : ''}${
                    slot < index ? ' is-done' : ''
                  }`}
                  aria-label={entry.title}
                  aria-current={slot === index ? 'step' : undefined}
                  onClick={() => setAt(slot)}
                />
              </li>
            ))}
          </ol>
          <h2>{step.title}</h2>
          <p className="ax-setup-lead">{step.lead}</p>
        </header>

        <div className="ax-setup-q">{step.body}</div>

        {failed && (
          <p className="ax-setup-failed" role="alert">
            Did not save. Try again.
          </p>
        )}

        <footer className="ax-setup-actions">
          <button
            type="button"
            className="ax-btn"
            disabled={index === 0}
            onClick={() => setAt(index - 1)}
          >
            Back
          </button>
          {last ? (
            <button
              type="button"
              className="ax-btn ax-btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : editing ? 'Update' : 'Open my analytics'}
            </button>
          ) : (
            <button
              type="button"
              className="ax-btn ax-btn-primary"
              onClick={() => setAt(index + 1)}
            >
              Next
            </button>
          )}
          {/* On every step, not only the first. A reader who decides on step
              five that they have answered enough questions should not have to
              walk back to the start to leave — and a reader who opened these
              again to change one answer needs a way out that is not a save. */}
          {onSkip && (
            <button type="button" className="ax-setup-skip" onClick={onSkip}>
              {editing ? 'Cancel' : 'Skip the rest'}
            </button>
          )}
        </footer>

        {editing && setOn && (
          <p className="ax-setup-set-on">
            Baseline set on{' '}
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
