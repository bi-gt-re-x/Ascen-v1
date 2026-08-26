/**
 * The editable checklist under one checkpoint, in the detail drawer.
 *
 * The drawer is the only place a step's text can be written — the card draws
 * the same three rows and lets you tick them, but not rename them. That split
 * is deliberate: ticking is something you do while working, and naming is
 * something you do while planning, and a card that scrolls past four goals is
 * the wrong place to be typing.
 *
 * ## Editing is local until it settles
 *
 * Each row is an uncontrolled-ish input holding its own draft, committed on
 * blur or Enter. Writing on every keystroke would put a request per character
 * behind a list that is rewritten whole, and the reply — which re-normalises,
 * re-pads and re-ids — would land back in the box mid-word.
 *
 * Escape abandons the draft. Enter commits and leaves the field, because the
 * next thing a reader does after naming step one is name step two, and a form
 * that keeps focus after submit makes that a click rather than a Tab.
 *
 * ## The floor is enforced here as well as in the API
 *
 * Delete on a list at `MIN_STEPS` empties the row instead of removing it, so
 * the three prompts are always on screen. See utils/milestoneSteps — every
 * mutation goes through that module and none of the arithmetic lives here.
 */
import { useState } from 'react';
import {
  MAX_STEPS,
  MIN_STEPS,
  STEP_MAX,
  addStep,
  editStep,
  promptFor,
  removeStep,
  stepProgress,
  toggleStep,
} from '@/utils/milestoneSteps';
import type { MilestoneStep } from '@/types';

export interface MilestoneChecklistProps {
  steps: MilestoneStep[];
  busy: boolean;
  onChange: (steps: MilestoneStep[]) => void;
}

export function MilestoneChecklist({ steps, busy, onChange }: MilestoneChecklistProps) {
  /** Which row is being typed in, and what is in it. One at a time. */
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const { done, total } = stepProgress(steps);

  const commit = () => {
    if (!editing) return;
    onChange(editStep(steps, editing.index, editing.text));
    setEditing(null);
  };

  return (
    <div className="gx-checklist">
      <div className="gx-checklist-head">
        <span className="gx-quiet">
          {total === 0
            ? `${MIN_STEPS} steps to name`
            : `${done} of ${total} step${total === 1 ? '' : 's'} done`}
        </span>
        <button
          type="button"
          className="gx-checklist-add"
          disabled={busy || steps.length >= MAX_STEPS}
          title={
            steps.length >= MAX_STEPS
              ? `A checkpoint needing more than ${MAX_STEPS} steps is two checkpoints`
              : 'Add a step'
          }
          onClick={() => onChange(addStep(steps))}
        >
          + step
        </button>
      </div>

      <ul className="gx-checklist-list">
        {steps.map((step, index) => (
          <li className={`gx-cstep${step.done ? ' is-done' : ''}${step.placeholder ? ' is-empty' : ''}`} key={step.id}>
            <button
              type="button"
              className="gx-cstep-tick"
              // Nothing to tick on a row nobody has written. See `toggleStep`.
              disabled={busy || step.placeholder}
              aria-label={
                // An unwritten row has no name to put in the label, and
                // "Finish " with nothing after it is what that reads as.
                step.placeholder
                  ? 'Name this step before you can tick it'
                  : step.done
                    ? `Undo ${step.title}`
                    : `Finish ${step.title}`
              }
              onClick={() => onChange(toggleStep(steps, index))}
            >
              <span aria-hidden="true">{step.done ? '✓' : ''}</span>
            </button>

            {editing?.index === index ? (
              <input
                autoFocus
                className="gx-cstep-input"
                value={editing.text}
                maxLength={STEP_MAX}
                placeholder={promptFor(index)}
                onChange={(event) => setEditing({ index, text: event.target.value })}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditing(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="gx-cstep-text"
                disabled={busy}
                onClick={() => setEditing({ index, text: step.title })}
              >
                {step.placeholder ? promptFor(index) : step.title}
              </button>
            )}

            <button
              type="button"
              className="gx-cstep-cut"
              disabled={busy || (step.placeholder && steps.length <= MIN_STEPS)}
              aria-label={steps.length <= MIN_STEPS ? 'Clear this step' : 'Remove this step'}
              title={
                steps.length <= MIN_STEPS
                  ? `Clears it — every checkpoint keeps at least ${MIN_STEPS} steps`
                  : 'Remove this step'
              }
              onClick={() => onChange(removeStep(steps, index))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
