/**
 * The goal list at the top of the page: every goal, with its five checkpoints.
 *
 * ## Why five
 *
 * Not a rendering limit — a shape. A goal broken into two checkpoints is a
 * goal that has not been thought about, and one broken into fifteen is a task
 * list wearing a plan's clothes. Five is enough rungs to see a route and few
 * enough to hold in your head, and because every goal has the same number, two
 * goals side by side can actually be compared: the third rung is the middle of
 * both.
 *
 * The count is the same one the model is asked for and the same one
 * /api/set_milestones will accept, so the number lives in one place —
 * `RUNGS` — and the page, the endpoint and the prompt all mean it.
 *
 * ## Where the plan comes from
 *
 * Three ways, and the goal does not care which: the model writes five and the
 * user keeps them, the model writes five and the user rewrites some, or the
 * user writes all five and never asks. `Suggest` fills the five boxes and
 * saves nothing; `Save` is the only thing that writes. That ordering is the
 * whole reason suggestion is safe — a proposal that overwrote the plan the
 * moment it arrived would be a plan you have to undo rather than one you
 * accept.
 *
 * ## Editing is a mode, not a screen
 *
 * The rungs read as a ladder and edit in place. A drawer would be the fourth
 * place on this page that a milestone can be changed, and the checkpoint you
 * are looking at is the one you want to fix.
 *
 * A goal that already carries more than five checkpoints is drawn but not
 * editable here: saving five over seven would delete two, and the goal detail
 * drawer is where a list that long is managed. Reading stays the same
 * everywhere; only this shortcut is withheld.
 */
import { useEffect, useState } from 'react';
import { useCountUp } from '@/hooks';
import type { Goal, Milestone, MilestoneStatus } from '@/types';
import { GoalTile, ProgressBar, categoryOf } from './Outcome';
import { formatGoalDate, goalNumbers, isOverdue } from './numbers';

/** How many checkpoints a goal is broken into. See the note above. */
export const RUNGS = 5;

export interface GoalLadderProps {
  goal: Goal;
  busy: boolean;
  /** Open the goal's own drawer — everything this row does not do. */
  onOpen: (goal: Goal) => void;
  /** Tick or untick one checkpoint. */
  onStatus: (milestone: Milestone, status: MilestoneStatus) => void;
  /** Write the whole list, in order. Resolves false if the write failed. */
  onSave: (goal: Goal, titles: string[]) => Promise<boolean>;
  /** Ask the model for five. Resolves null and reports its own error. */
  onSuggest: (goal: Goal) => Promise<string[] | null>;
}

/** The five slots this goal edits: its own titles, padded out to five. */
function draftOf(goal: Goal): string[] {
  const rows = goal.milestones ?? [];
  return Array.from({ length: RUNGS }, (_, index) => rows[index]?.title ?? '');
}

export function GoalLadder({
  goal,
  busy,
  onOpen,
  onStatus,
  onSave,
  onSuggest,
}: GoalLadderProps) {
  const rows = goal.milestones ?? [];
  const numbers = goalNumbers(goal);
  const category = categoryOf(goal);
  // The bar below runs the same figure through the same hook, so the reading
  // and the fill arrive together. Ticking a checkpoint moves both.
  const pct = Math.round(useCountUp(Math.round(numbers.progress)));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(() => draftOf(goal));
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Every write on this page is followed by a re-read rather than a patch, so
  // the goal arrives back as a new object. Re-seed from it while the editor is
  // closed; while it is open the draft is the user's and nothing may touch it.
  useEffect(() => {
    if (!editing) setDraft(draftOf(goal));
  }, [goal, editing]);

  /** A list this long cannot be expressed in five boxes — see the note above. */
  const overfull = rows.length > RUNGS;
  const done = rows.filter((row) => row.status === 'done').length;
  const next = rows.find((row) => row.status !== 'done');
  const overdue = isOverdue(goal);

  const suggest = async () => {
    setThinking(true);
    setNote(null);
    const titles = await onSuggest(goal);
    setThinking(false);
    if (!titles) return;
    setDraft(titles.slice(0, RUNGS));
    setEditing(true);
  };

  const save = async () => {
    const titles = draft.map((title) => title.trim()).filter(Boolean);
    if (titles.length === 0) {
      setNote('A goal needs at least one checkpoint.');
      return;
    }
    const saved = await onSave(goal, titles);
    if (saved) {
      setEditing(false);
      setNote(null);
    }
  };

  return (
    <li className={`gx-ladder tone-${category.tone}${overdue ? ' is-overdue' : ''}`}>
      <header className="gx-ladder-head">
        <GoalTile goal={goal} />
        <button type="button" className="gx-ladder-name" onClick={() => onOpen(goal)}>
          <span className="gx-ladder-title">{goal.title}</span>
          <span className="gx-quiet">
            {category.label}
            {goal.deadline ? ` · ${formatGoalDate(goal.deadline)}` : ''}
            {overdue ? ' · overdue' : ''}
          </span>
        </button>

        {/* Progress, twice: the figure to read and the bar to glance at. The
            percentage is the server's — this row never computes one. */}
        <div className="gx-ladder-pct">
          <strong>{pct}%</strong>
          <span className="gx-quiet">
            {rows.length > 0
              ? `${done}/${rows.length} checkpoints`
              : numbers.numeric
                ? `${numbers.current} / ${numbers.target} ${numbers.label}`
                : 'not broken down'}
          </span>
        </div>
      </header>

      <ProgressBar pct={Math.round(numbers.progress)} />

      {editing ? (
        <>
          <ol className="gx-rungs is-editing">
            {draft.map((title, index) => (
              // The five slots are positions, not rows: index is the only
              // stable identity a blank one has.
              // eslint-disable-next-line react/no-array-index-key
              <li className="gx-rung" key={index}>
                <span className="gx-rung-no" aria-hidden="true">{index + 1}</span>
                <input
                  className="gx-rung-input"
                  value={title}
                  placeholder={`Checkpoint ${index + 1}`}
                  aria-label={`Checkpoint ${index + 1} of ${goal.title}`}
                  onChange={(event) => {
                    const copy = [...draft];
                    copy[index] = event.target.value;
                    setDraft(copy);
                  }}
                />
              </li>
            ))}
          </ol>
          <div className="gx-ladder-tools">
            <button type="button" className="gx-btn is-primary" disabled={busy} onClick={() => void save()}>
              Save checkpoints
            </button>
            <button
              type="button"
              className="gx-btn is-quiet"
              disabled={busy || thinking}
              onClick={() => {
                setEditing(false);
                setNote(null);
                setDraft(draftOf(goal));
              }}
            >
              Cancel
            </button>
            <button type="button" className="gx-btn" disabled={busy || thinking} onClick={() => void suggest()}>
              {thinking ? 'Thinking…' : 'Suggest again'}
            </button>
          </div>
        </>
      ) : (
        <>
          <ol className="gx-rungs">
            {rows.slice(0, RUNGS).map((row, index) => (
              <li
                className={`gx-rung${row.status === 'done' ? ' is-done' : ''}${row.id === next?.id ? ' is-next' : ''}`}
                key={row.id}
              >
                <button
                  type="button"
                  className="gx-rung-tick"
                  disabled={busy}
                  aria-pressed={row.status === 'done'}
                  aria-label={`${row.status === 'done' ? 'Reopen' : 'Complete'} ${row.title}`}
                  onClick={() => onStatus(row, row.status === 'done' ? 'pending' : 'done')}
                >
                  {row.status === 'done' ? '✓' : index + 1}
                </button>
                <span className="gx-rung-title">{row.title}</span>
                {row.target_date && (
                  <span className="gx-quiet gx-rung-when">{formatGoalDate(row.target_date)}</span>
                )}
              </li>
            ))}
            {rows.length === 0 && (
              <li className="gx-rung is-empty">
                <span className="gx-quiet">
                  No checkpoints yet. Suggest five, or write your own.
                </span>
              </li>
            )}
          </ol>

          <div className="gx-ladder-tools">
            {overfull ? (
              <span className="gx-quiet">
                {rows.length} checkpoints — open the goal to edit a list this long.
              </span>
            ) : (
              <>
                <button type="button" className="gx-btn" disabled={busy || thinking} onClick={() => void suggest()}>
                  {thinking ? 'Thinking…' : `Suggest ${RUNGS} milestones`}
                </button>
                <button
                  type="button"
                  className="gx-btn is-quiet"
                  disabled={busy || thinking}
                  onClick={() => {
                    setDraft(draftOf(goal));
                    setEditing(true);
                  }}
                >
                  Edit checkpoints
                </button>
              </>
            )}
          </div>
        </>
      )}

      {note && <p className="gx-ladder-note">{note}</p>}
    </li>
  );
}
