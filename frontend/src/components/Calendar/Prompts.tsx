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
 * picks a side and the grid is honest again. It is red and it reappears on
 * every render until it is resolved, both deliberately; what it is not any
 * more is a wall over the very thing it is asking about. See its own note.
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

/** One side of a clash, as the dialog has to describe it. */
export interface ConflictSide {
  name: string;
  /** "9 – 10:30 AM" — the span it occupies. */
  when: string;
  kind: 'task' | 'event';
}

export interface ConflictDialogProps {
  /** "Wednesday, Aug 12" — the day the two are booked on. */
  where: string;
  /** The two, in the order they were found. */
  sides: [ConflictSide, ConflictSide];
  /**
   * Put the two on screen: scroll the grid to them and light them up. The
   * dialog steps aside while this is on, because a modal over the thing it is
   * asking about is a question the reader cannot answer.
   */
  onReveal: () => void;
  onDelete: (which: 0 | 1) => void;
}

/**
 * Two blocks booked over each other.
 *
 * There is no "keep both": the grid refuses to hold that state, so the reader
 * picks a side. What the dialog owes them in exchange is enough to pick with —
 * it used to offer two bare names, which on a seven-column week is a question
 * about two rectangles the reader cannot see and may never have looked at. It
 * now says which day, what each one is, and when each one runs, and **Show me
 * on the grid** scrolls the pair into view, rings them, and gets out of the
 * way so they can be read before either is deleted.
 */
export function ConflictDialog({
  where,
  sides,
  onReveal,
  onDelete,
}: ConflictDialogProps) {
  const [peeking, setPeeking] = useState(false);

  return (
    <div className={`wk-overlap-backdrop${peeking ? ' is-peeking' : ''}`}>
      <div className="wk-overlap-popup" role="alertdialog" aria-modal={!peeking}>
        <span className="wk-overlap-msg">
          Two things are booked over each other on <strong>{where}</strong>. Delete
          one to continue:
        </span>

        <ul className="wk-overlap-list">
          {sides.map((side, index) => (
            <li className="wk-overlap-item" key={`${side.name}-${side.when}-${index}`}>
              <span className="wk-overlap-where">
                <span className={`wk-overlap-kind is-${side.kind}`}>
                  {side.kind === 'task' ? 'Task' : 'Event'}
                </span>
                <span className="wk-overlap-when">{side.when}</span>
              </span>
              <span className="wk-overlap-name">{side.name}</span>
              <button
                type="button"
                className="wk-overlap-close"
                onClick={() => onDelete(index as 0 | 1)}
              >
                Delete this one
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="wk-overlap-reveal"
          onClick={() => {
            setPeeking(true);
            onReveal();
          }}
        >
          {peeking ? 'Show me again' : 'Show me on the grid'}
        </button>
      </div>
    </div>
  );
}
