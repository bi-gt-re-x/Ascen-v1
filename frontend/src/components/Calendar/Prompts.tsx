/**
 * The two things the grid stops you for: a deletion, and a clash.
 *
 * `DeleteConfirm` is the ordinary one — a blocking card, because deleting a
 * recurring event from a keystroke away from the mouse is not a thing to do by
 * accident. When the thing repeats it asks which: this day, or every day it
 * lands on.
 *
 * `ConflictDialog` is the unusual one. Two blocks booked over each other is a
 * state the calendar refuses to hold, so there is no "keep both" — the reader
 * picks a side and the grid is honest again. It is red, it is modal, and it
 * reappears on every render until it is resolved, all deliberately.
 */
import { useState } from 'react';
import type { Scope } from '@/hooks/useCalendarStore';

export interface DeleteConfirmProps {
  kind: 'task' | 'event';
  name: string;
  /** When set, the dialog asks about the series instead of just confirming. */
  occurrences?: number;
  onConfirm: (scope: Scope) => void;
  onCancel: () => void;
}

export function DeleteConfirm({
  kind,
  name,
  occurrences = 1,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  const [scope, setScope] = useState<Scope>('one');
  const repeats = occurrences > 1;

  return (
    <div
      className="wk-confirm-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="wk-confirm-popup" role="dialog" aria-modal="true">
        <h3 className="wk-confirm-title">Delete {kind}?</h3>
        <p className="wk-confirm-msg">
          {repeats
            ? `“${name}” lands on ${occurrences} days. This can’t be undone.`
            : `Delete “${name}”? This can’t be undone.`}
        </p>

        {repeats && (
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="deleteScope"
                checked={scope === 'one'}
                onChange={() => setScope('one')}
              />{' '}
              This occurrence
            </label>
            <label>
              <input
                type="radio"
                name="deleteScope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />{' '}
              All {occurrences} occurrences
            </label>
          </div>
        )}

        <div className="wk-confirm-actions">
          <button type="button" className="wk-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="wk-confirm-delete"
            onClick={() => onConfirm(scope)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export interface CreateChooserProps {
  /** "9:15 AM – 10:30 AM", the slot that was dragged out. */
  when: string;
  onChoose: (kind: 'event' | 'task') => void;
  onCancel: () => void;
}

/**
 * What a drag on empty grid asks: is this an event or a task?
 *
 * The drag has already said *when*, and that is the hard part — the two dialogs
 * behind this open with the slot filled in. Asking here rather than picking a
 * default is what makes one gesture serve both, which is the whole point of
 * dragging out a slot instead of pressing a button labelled with one of them.
 */
export function CreateChooser({ when, onChoose, onCancel }: CreateChooserProps) {
  return (
    <div
      className="wk-choose-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="wk-choose-popup" role="dialog" aria-modal="true">
        <div>
          <div className="wk-choose-title">New on this slot</div>
          <p className="wk-empty">{when}</p>
        </div>
        <div className="wk-choose-row">
          <button type="button" className="wk-choose-btn" onClick={() => onChoose('event')}>
            Event
          </button>
          <button
            type="button"
            className="wk-choose-btn is-task"
            onClick={() => onChoose('task')}
          >
            Task
          </button>
        </div>
        <button type="button" className="wk-choose-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export interface ConflictDialogProps {
  /** The two labels, in the order they were found. */
  names: [string, string];
  onDelete: (which: 0 | 1) => void;
}

export function ConflictDialog({ names, onDelete }: ConflictDialogProps) {
  return (
    <div className="wk-overlap-backdrop">
      <div className="wk-overlap-popup" role="alertdialog" aria-modal="true">
        <span className="wk-overlap-msg">
          “{names[0]}” and “{names[1]}” overlap. Delete one to continue:
        </span>
        {names.map((name, index) => (
          <button
            key={name}
            type="button"
            className="wk-overlap-close"
            onClick={() => onDelete(index as 0 | 1)}
          >
            Delete “{name}”
          </button>
        ))}
      </div>
    </div>
  );
}
