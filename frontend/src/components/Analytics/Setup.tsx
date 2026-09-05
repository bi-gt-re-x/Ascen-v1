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
 * days, how many hours, which subject. What has been added is not more of
 * those. It is the decisions that were previously made *for* the reader and
 * buried:
 * how they record work, how blunt the page is allowed to be about a shortfall,
 * how much of the page they want drawn, which tab it opens on, and which
 * subjects are worth a page of their own. Those are choices rather than
 * recollections, and a choice needs its options laid out and its consequence
 * stated beside it. Eight of those on one card is a wall of segmented controls
 * that nobody reads and everybody clicks past — which is the failure the old
 * comment was actually worried about, arrived at from the other direction.
 *
 * So: one question per screen, the consequence of each answer written under it
 * in the reader's own terms, and a step count that never goes above eight. The
 * two subject questions are dropped together on an account with no subjects,
 * so the flow is six there — the count comes from the steps that exist rather
 * than being declared, because a "Step 4 of 8" that skips 4 is worse than
 * either number.
 *
 * ## The two subject questions are two questions
 *
 * They sit next to each other and they read alike, so it is worth saying why
 * both are here. **Followed subjects** decide what the app *offers*: each one
 * becomes a row under Analytics in the rail with a page behind it. **The focus
 * subject** decides what a *figure means*: it is what the week's hours are
 * aimed at, and it is what lets the page tell four days of work apart from
 * four days of the work that mattered. A reader can follow four subjects with
 * no single one the week is for, and a reader with one clear focus may want no
 * extra pages at all, so neither answer is derived from the other. They also
 * land in different stores — the follow list is a preference, the focus is
 * part of the baseline.
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
 * ## The week is asked for; the sitting is worked out
 *
 * The middle question used to be "how long is a normal sitting?", answered
 * from four buttons. It was the one question here nobody can actually answer:
 * a sitting length is a figure you would have to average to know, and the
 * four buttons made that worse by offering a shape rather than a number — a
 * reader whose week is nine hours over three days had no button.
 *
 * So the account states the week, in a field, and `sessionFor` divides. The
 * stored baseline is unchanged — `active_days` and `session_minutes`, the same
 * two the panel and the server have always read — because the change is to
 * which of the three related figures the reader is asked for, not to what a
 * baseline is.
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
  SUBJECTS_MAX,
  TONE_HINT,
  TONE_LABEL,
} from '@/utils/analyticsPrefs';

/** The preferences this screen sets. The rest of analytics' are settings-only. */
export type SetupPrefs = Pick<
  Prefs,
  | 'analytics_log_style'
  | 'analytics_tone'
  | 'analytics_detail'
  | 'analytics_home_tab'
  | 'analytics_subjects'
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
 * What a sitting is allowed to come to, in minutes.
 *
 * The same bounds the server holds (SESSION_MINUTES in backend/api/analytics.py),
 * repeated here because this screen derives the figure rather than asking for
 * it: a week of 40 hours over one day is a 40-hour sitting, and something has
 * to say so before the save does.
 */
const SESSION_MIN = 5;
const SESSION_MAX = 480;

/** As many hours as a week has. Beyond that the answer is not an answer. */
const WEEK_HOURS_MAX = 168;

/** Minutes as the reader would say them: 25 min, 1h, 2h 30m. */
function sittingLabel(minutes: number): string {
  const whole = Math.floor(minutes / 60);
  const rest = Math.round(minutes - whole * 60);
  if (!whole) return `${rest} min`;
  if (!rest) return whole === 1 ? '1 hour' : `${whole} hours`;
  return `${whole}h ${rest}m`;
}

/**
 * The sitting a week's hours come to, once it is spread over the days.
 *
 * Clamped rather than refused, for the same reason `_whole` clamps in
 * backend/api/settings.py: somebody who typed 90 hours a week over five days
 * meant "as much as it goes", and the alternative is a save that fails on the
 * last screen of a seven-screen flow.
 */
function sessionFor(weekHours: number, days: number): number {
  if (!(weekHours > 0) || days <= 0) return SESSION_MIN;
  const raw = Math.round((weekHours * 60) / days);
  return Math.max(SESSION_MIN, Math.min(SESSION_MAX, raw));
}

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
  /* The week's hours, held as the string that was typed rather than as a
     number. A number would make "1." unrepresentable and so unreachable, and
     a field that deletes the decimal point out from under the cursor is a
     field nobody can type 1.5 into. Parsed where it is read. */
  const [hours, setHours] = useState(() =>
    String(
      Math.round((((current?.active_days ?? 5) * (current?.session_minutes ?? 60)) / 60) * 10) / 10,
    ),
  );
  const [focus, setFocus] = useState(current?.focus_subject ?? '');
  /* The nominated subjects, held as the ids in the order they were picked —
     that order is the reader's and the rail draws the menu in it, so a Set
     would lose the one thing about this answer that is not a membership test.
     Trimmed to what the catalogue still has, for the reason `followedSubjects`
     gives: an account re-opening these questions a year on should not be shown
     four ticked boxes when one of the subjects has since been deleted. */
  const [followed, setFollowed] = useState<string[]>(() => {
    const known = new Set(subjects.map((subject) => subject.id));
    return prefs.analytics_subjects.filter((id) => known.has(id)).slice(0, SUBJECTS_MAX);
  });
  const [logStyle, setLogStyle] = useState<LogStyle>(prefs.analytics_log_style);
  const [tone, setTone] = useState<AnalyticsTone>(prefs.analytics_tone);
  const [detail, setDetail] = useState<AnalyticsDetail>(prefs.analytics_detail);
  const [homeTab, setHomeTab] = useState<AnalyticsHomeTab>(prefs.analytics_home_tab);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const editing = Boolean(current);

  /* The week's hours as a number, and the sitting they come to once spread
     over the days. The week is the answer and the sitting is derived, which is
     the way round the reader thinks: nobody knows their average sitting to the
     minute, and everybody knows roughly what a week of theirs holds.

     Printed under both questions as they are answered, because a baseline is
     easy to set carelessly and this is the line that makes an unrealistic one
     obvious while it is still being chosen rather than three weeks later. */
  const typed = Number.parseFloat(hours);
  const weeklyHours = Number.isFinite(typed)
    ? Math.max(0, Math.min(WEEK_HOURS_MAX, typed))
    : 0;
  const minutes = sessionFor(weeklyHours, days);
  /* True when the week asked for cannot be spread over the days at a sitting
     the server will accept, so the line below can say what will be stored
     instead of quietly storing something else. */
  const clamped = weeklyHours > 0 && Math.round((weeklyHours * 60) / days) !== minutes;

  /* On, off, and nothing else — the cap is enforced by the buttons being
     disabled rather than by this quietly dropping the oldest pick. A control
     that un-ticks something the reader ticked two clicks ago, without saying
     so, is a control they stop trusting. */
  const toggleFollowed = (id: string) => {
    setFollowed((was) =>
      was.includes(id)
        ? was.filter((entry) => entry !== id)
        : was.length >= SUBJECTS_MAX
          ? was
          : [...was, id],
    );
  };

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
              <strong>{weeklyHours}h</strong> a week at your current answers, about{' '}
              {sittingLabel(minutes)} a sitting
            </p>
          </>
        ),
      },
      {
        key: 'hours',
        title: 'How many hours a week does that come to?',
        lead:
          'Roughly, and typed rather than picked: a week is the unit people actually know their '
          + 'own answer in, and no list of four is going to hold yours. The sitting underneath '
          + 'is this figure spread over the days you just gave — it is what the page measures '
          + 'your sittings against, and you never have to work it out.',
        body: (
          <>
            <div className="ax-setup-hours">
              <input
                className="ax-setup-hours-field"
                type="number"
                inputMode="decimal"
                min={0}
                max={WEEK_HOURS_MAX}
                step={0.5}
                value={hours}
                aria-label="Hours a week"
                aria-describedby="ax-setup-hours-note"
                onChange={(event) => setHours(event.target.value)}
                /* Emptied, or left as a lone minus or decimal point, on the
                   way out of the field. Nothing is stored until Finish, so
                   the repair belongs here rather than in the keystroke — see
                   `hours` above on why the typed string is what is held. */
                onBlur={() => setHours(String(weeklyHours || 0))}
              />
              <span className="ax-setup-hours-unit">hours a week</span>
            </div>
            <p className="ax-setup-sum" id="ax-setup-hours-note">
              <strong>{sittingLabel(minutes)}</strong> a sitting, across {days}{' '}
              {days === 1 ? 'day' : 'days'}
              {/* Said out loud rather than silently applied. A week that will
                  not fit the days at a sitting the server accepts is stored
                  at the bound, and a reader who is about to be measured
                  against that figure is owed the sentence. */}
              {clamped && (
                <em>
                  {' '}— a sitting is held between {SESSION_MIN} minutes and{' '}
                  {sittingLabel(SESSION_MAX)}, so that is what is stored.
                </em>
              )}
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
      /* Two subject questions, and they are not the same question asked twice.
         This one asks what the reader wants to *work on* — it builds the menu
         under Analytics in the rail, and each answer gets a page of its own.
         The one below asks what the baseline is *for*, so that "you worked
         four days" can be told apart from "you worked four days on the thing
         you said mattered". A reader can follow four subjects and have no
         single one the week is aimed at, which is why neither answer is
         derived from the other.

         It goes first because it is the wider question: having named the
         handful that matter, picking the one that matters most is a choice
         out of four rather than out of a hundred. */
      list.push({
        key: 'followed',
        title: 'Which subjects do you most want to work on?',
        lead:
          `Up to ${SUBJECTS_MAX}. Each one you pick gets its own page under Analytics in the `
          + 'sidebar, so you can look at that subject on its own instead of reading it out of a '
          + 'total. Pick none and Analytics stays the single page it is now.',
        body: (
          <>
            <div className="ax-setup-picks" role="group" aria-label="Subjects to follow">
              {subjects.map((subject) => {
                const on = followed.includes(subject.id);
                /* Disabled rather than hidden at the cap, and only the ones
                   that are off. A row that vanishes when a fourth is picked
                   would make the list rearrange itself under the cursor. */
                const full = !on && followed.length >= SUBJECTS_MAX;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    className={`ax-setup-pick${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => toggleFollowed(subject.id)}
                  >
                    {/* The position in the reader's own order, not a tick.
                        The order is stored and the rail draws the menu in it,
                        so the number is a fact about the answer rather than
                        decoration. */}
                    <span className="ax-setup-pick-slot" aria-hidden="true">
                      {on ? followed.indexOf(subject.id) + 1 : ''}
                    </span>
                    <strong>{subject.label}</strong>
                  </button>
                );
              })}
            </div>
            <p className="ax-setup-sum">
              {followed.length === 0 ? (
                <>None picked — Analytics stays one page</>
              ) : (
                <>
                  <strong>
                    {followed.length} of {SUBJECTS_MAX}
                  </strong>{' '}
                  picked
                  {followed.length >= SUBJECTS_MAX && (
                    <em> — that is the most. Unpick one to swap it.</em>
                  )}
                </>
              )}
            </p>
          </>
        ),
      });

      list.push({
        key: 'subject',
        title: 'Is most of this for one subject?',
        lead:
          'Optional, and easy to change. It is what lets the page tell "you worked four days" '
          + 'apart from "you worked four days on the thing you said mattered". Different from '
          + 'the last question: that one chose which subjects get a page, this one is what the '
          + 'hours you just gave are aimed at.',
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
  }, [
    clamped, days, detail, focus, followed, homeTab, hours, logStyle, minutes, subjects,
    tone, weeklyHours,
  ]);

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
        analytics_subjects: followed,
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
