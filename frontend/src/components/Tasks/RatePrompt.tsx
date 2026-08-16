/**
 * "Rate your performance on this task" — the one question the app asks back.
 *
 * Everything else on a task is measured: what it was worth, how long it took,
 * whether it beat its deadline. None of that knows whether the work was hard or
 * whether it went well, and those are the two things the person who did it
 * knows and the database never will.
 *
 * ## Two rows, not one
 *
 * Difficulty and execution are independent, and collapsing them into a single
 * "how did that go" loses the distinction that makes either worth having: an
 * easy task done badly and a brutal one done well both land on three stars, and
 * they are not the same week. Asked apart, they stay apart in the record.
 *
 * ## Nothing here is required
 *
 * The task is already done and its XP is already banked before this appears —
 * see `rateTask` in services/tasks for why the two are separate calls. So this
 * dialog can be dismissed, ignored, or half-answered, and all three are fine.
 * Escape closes it, the backdrop closes it, and Skip closes it; only the stars
 * that were actually clicked are sent. A prompt that blocked the reward it
 * follows would be a toll booth, and people learn to click through those
 * without reading, which would poison the very data it exists to collect.
 */
import { useCallback, useEffect, useState } from 'react';
import '@/styles/rate-prompt.css';

/** The five stars, and what each one means. Hover and focus print the word. */
const SCALE = 5;

const DIFFICULTY_WORDS = ['Trivial', 'Easy', 'Fair', 'Hard', 'Brutal'];
const EXECUTION_WORDS = ['Poor', 'Patchy', 'Solid', 'Strong', 'Excellent'];

export interface RatePromptProps {
  /** What was finished, so the dialog names the thing it is asking about. */
  taskName: string;
  /** Sends whatever was answered. Only the answered halves are passed. */
  onSubmit: (ratings: { difficulty?: number; execution?: number }) => void;
  /** Dismissal, by any of its three routes. */
  onClose: () => void;
}

interface StarsProps {
  label: string;
  hint: string;
  words: string[];
  value: number;
  onChange: (value: number) => void;
}

/**
 * One row of five stars.
 *
 * Radios under the hood rather than buttons, because that is what this is: five
 * options, one choice, and a keyboard user gets arrow keys and a group label
 * for free. The visible stars are the labels; the inputs themselves are hidden
 * without being removed from the tree.
 *
 * Clicking the star already chosen clears the row. That is the only way back to
 * "I would rather not say" once something has been clicked, and without it a
 * misclick becomes a permanent answer.
 */
function Stars({ label, hint, words, value, onChange }: StarsProps) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className="tk-rate-row">
      <legend className="tk-rate-label">
        {label}
        <span>{hint}</span>
      </legend>

      <div className="tk-rate-stars" onMouseLeave={() => setHovered(0)}>
        {Array.from({ length: SCALE }, (_, index) => {
          const star = index + 1;
          const on = star <= shown;
          return (
            <label
              key={star}
              className={`tk-rate-star${on ? ' is-on' : ''}`}
              onMouseEnter={() => setHovered(star)}
            >
              <input
                type="radio"
                name={label}
                checked={value === star}
                onChange={() => onChange(star)}
                onClick={() => {
                  if (value === star) onChange(0);
                }}
              />
              <span aria-hidden="true">★</span>
              <span className="tk-rate-sr">
                {star} of {SCALE} — {words[index]}
              </span>
            </label>
          );
        })}
        {/* The word for whatever is under the cursor, or whatever was chosen.
            A row of five identical stars says nothing about what three means;
            this is where that lives, and it holds the row's height whether or
            not anything is chosen so the dialog does not jump. */}
        <span className="tk-rate-word">{shown ? words[shown - 1] : ''}</span>
      </div>
    </fieldset>
  );
}

export function RatePrompt({ taskName, onSubmit, onClose }: RatePromptProps) {
  const [difficulty, setDifficulty] = useState(0);
  const [execution, setExecution] = useState(0);

  // Escape closes, like every other dialog in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useCallback(() => {
    // Only what was answered. A zero here means "not answered" and must not
    // reach the server, which would reject it anyway — see `RATING_RANGE`.
    onSubmit({
      ...(difficulty > 0 ? { difficulty } : {}),
      ...(execution > 0 ? { execution } : {}),
    });
  }, [difficulty, execution, onSubmit]);

  const answered = difficulty > 0 || execution > 0;

  return (
    <div
      className="tk-rate-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="tk-rate-popup" role="dialog" aria-modal="true" aria-labelledby="tk-rate-title">
        <h3 className="tk-rate-title" id="tk-rate-title">
          Rate your performance on this task
        </h3>
        <p className="tk-rate-task" title={taskName}>
          {taskName}
        </p>

        <Stars
          label="Difficulty"
          hint="How hard was it?"
          words={DIFFICULTY_WORDS}
          value={difficulty}
          onChange={setDifficulty}
        />
        <Stars
          label="Execution"
          hint="How well did it go?"
          words={EXECUTION_WORDS}
          value={execution}
          onChange={setExecution}
        />

        <div className="tk-rate-actions">
          <button type="button" className="tk-rate-skip" onClick={onClose}>
            Skip
          </button>
          <button type="button" className="tk-rate-save" onClick={save} disabled={!answered}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
