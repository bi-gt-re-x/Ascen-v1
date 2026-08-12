/**
 * Creating a goal, one question at a time.
 *
 * The old modal was a form: title, type, target, deadline, priority, all at
 * once. That is the right shape for a counter and the wrong one for an
 * outcome, because the hard part of setting a real goal is not filling in
 * fields — it is answering, in order, what you are trying to do, why it
 * matters, when you want it, and how you will know. A form asks all four at
 * once and gets a title and three defaults.
 *
 * So it is five steps, and only the first is required. Every later one can be
 * skipped and added from the goal's own view afterwards, which is the honest
 * bargain: a goal you were made to fully specify before you could write it
 * down is a goal you did not write down.
 *
 * The old modal is still here and still works — see GoalModal. It is what
 * edits an existing goal, and what a reader who wants a plain XP counter gets.
 */
import { useCallback, useMemo, useState } from 'react';
import { CATEGORIES } from './Outcome';
import type { NewGoal } from '@/services/goals';
import type { GoalCategory, GoalMeasure } from '@/types';

const STEPS = [
  'What do you want to accomplish?',
  'Why does it matter?',
  'When do you want it?',
  'How will you know?',
  'Break it into checkpoints',
] as const;

export interface NewGoalWizardProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (goal: NewGoal) => void;
}

export function NewGoalWizard({ open, busy, onClose, onSave }: NewGoalWizardProps) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('other');
  const [why, setWhy] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState(5);
  const [measure, setMeasure] = useState<GoalMeasure>('milestones');
  const [unit, setUnit] = useState('');
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('');
  const [milestones, setMilestones] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const reset = useCallback(() => {
    setStep(0);
    setTitle('');
    setDescription('');
    setCategory('other');
    setWhy('');
    setDeadline('');
    setPriority(5);
    setMeasure('milestones');
    setUnit('');
    setCurrent('');
    setTarget('');
    setMilestones([]);
    setDraft('');
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  /** What each step needs before it will let you past it. */
  const blocked = useMemo(() => {
    if (step === 0) return !title.trim();
    // A number goal is the one place a later step can be wrong rather than
    // merely empty: measuring by a figure and not saying what the figure is
    // makes a goal that can never move.
    if (step === 3 && measure === 'number') return !Number(target);
    return false;
  }, [measure, step, target, title]);

  const save = useCallback(() => {
    onSave({
      title: title.trim(),
      description: description.trim(),
      // The column keeps its four values whatever the measure is; the backend
      // reads `measure`. See backend/api/goals.py.
      goal_type: 'xp',
      measure,
      category,
      why: why.trim(),
      deadline,
      priority,
      unit: unit.trim(),
      current_value: Number(current) || 0,
      target_number: Number(target) || 0,
      milestones,
    });
    reset();
  }, [
    category, current, deadline, description, measure, milestones, onSave,
    priority, reset, target, title, unit, why,
  ]);

  if (!open) return null;

  return (
    <div className="gx-drawer-backdrop" onClick={close} role="presentation">
      <div
        className="gx-wizard"
        role="dialog"
        aria-label="New goal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="gx-wizard-head">
          <span className="gx-wizard-step">
            Step {step + 1} of {STEPS.length}
          </span>
          <h2>{STEPS[step]}</h2>
          <button type="button" className="gx-close" onClick={close} aria-label="Close">
            ×
          </button>
        </header>

        <span className="gx-wizard-rail" aria-hidden="true">
          {STEPS.map((label, index) => (
            <i key={label} className={index <= step ? 'is-on' : ''} />
          ))}
        </span>

        <div className="gx-wizard-body">
          {step === 0 && (
            <>
              <label htmlFor="gx-title">The outcome, not the activity</label>
              <input
                id="gx-title"
                value={title}
                autoFocus
                placeholder="Reach USACO Gold"
                onChange={(event) => setTitle(event.target.value)}
              />
              <p className="gx-hint">
                &ldquo;Reach USACO Gold&rdquo;, not &ldquo;practise more&rdquo;. A goal is
                something you either got to or did not.
              </p>

              <label htmlFor="gx-desc">Anything worth remembering about it</label>
              <textarea
                id="gx-desc"
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />

              <label>What is it about?</label>
              <div className="gx-chips">
                {CATEGORIES.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`gx-chip tone-${entry.tone}${entry.id === category ? ' is-on' : ''}`}
                    onClick={() => setCategory(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <label htmlFor="gx-why">Why this one</label>
              <textarea
                id="gx-why"
                rows={4}
                autoFocus
                value={why}
                placeholder="What changes for you if this happens?"
                onChange={(event) => setWhy(event.target.value)}
              />
              <p className="gx-hint">
                This is the line you will read in four months when you have stopped wanting to do
                the work. It is the only field on this page that is for you rather than for the app
                — nothing is computed from it.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <label htmlFor="gx-deadline">Target date</label>
              <input
                id="gx-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
              <p className="gx-hint">
                Optional, and it changes what the app can tell you: with a date it can say whether
                you are on pace, and without one it can only say whether you are still working on
                it.
              </p>

              <label htmlFor="gx-priority">How much does it matter? ({priority} / 10)</label>
              <input
                id="gx-priority"
                type="range"
                min={1}
                max={10}
                value={priority}
                onChange={(event) => setPriority(Number(event.target.value))}
              />
              <p className="gx-hint">
                Weights it in the overall figure at the top of the page, so a goal you care about
                moves that number more than one you do not.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <label>How will you know you got there?</label>
              <div className="gx-choices">
                <button
                  type="button"
                  className={`gx-choice${measure === 'milestones' ? ' is-on' : ''}`}
                  onClick={() => setMeasure('milestones')}
                >
                  <strong>By checkpoints</strong>
                  <span>
                    There is no number. You get there by passing a handful of states — the next
                    step is where you list them.
                  </span>
                </button>
                <button
                  type="button"
                  className={`gx-choice${measure === 'number' ? ' is-on' : ''}`}
                  onClick={() => setMeasure('number')}
                >
                  <strong>By a number</strong>
                  <span>
                    A rating, a score, a count — something you will read off somewhere else and
                    type in here.
                  </span>
                </button>
              </div>

              {measure === 'number' && (
                <div className="gx-number-row">
                  <span>
                    <label htmlFor="gx-cur">Where you are now</label>
                    <input
                      id="gx-cur"
                      type="number"
                      value={current}
                      onChange={(event) => setCurrent(event.target.value)}
                    />
                  </span>
                  <span>
                    <label htmlFor="gx-tgt">Target</label>
                    <input
                      id="gx-tgt"
                      type="number"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                    />
                  </span>
                  <span>
                    <label htmlFor="gx-unit">What it counts</label>
                    <input
                      id="gx-unit"
                      value={unit}
                      placeholder="rating"
                      onChange={(event) => setUnit(event.target.value)}
                    />
                  </span>
                </div>
              )}
              <p className="gx-hint">
                The app will not fill a number goal in for you — it has no way to see a Codeforces
                rating. You update the figure and it does the pace arithmetic.
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <label>The checkpoints, in the order you will hit them</label>
              <ol className="gx-draft-list">
                {milestones.map((entry, index) => (
                  <li key={`${entry}-${index}`}>
                    <span>{entry}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry}`}
                      onClick={() => setMilestones(milestones.filter((_, at) => at !== index))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
              <form
                className="gx-ms-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = draft.trim();
                  if (!next) return;
                  setMilestones([...milestones, next]);
                  setDraft('');
                }}
              >
                <input
                  value={draft}
                  autoFocus
                  placeholder="Finish the Bronze curriculum"
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button type="submit" className="gx-btn" disabled={!draft.trim()}>
                  Add
                </button>
              </form>
              <p className="gx-hint">
                A checkpoint is a state the goal reaches, not a thing you do on a Tuesday.
                &ldquo;Reach Silver&rdquo; is a checkpoint; &ldquo;solve ten problems&rdquo; is a
                task, and tasks get linked to a checkpoint afterwards. Skip this if you do not know
                them yet — you can add them from the goal at any point.
              </p>
            </>
          )}
        </div>

        <footer className="gx-wizard-foot">
          <button
            type="button"
            className="gx-btn is-quiet"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="gx-btn is-primary"
              disabled={blocked}
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="gx-btn is-primary"
              disabled={busy || !title.trim()}
              onClick={save}
            >
              Create goal
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
