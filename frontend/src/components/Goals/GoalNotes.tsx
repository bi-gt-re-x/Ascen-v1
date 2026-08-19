/**
 * One line of your own writing against each goal.
 *
 * ## Why this belongs on a goals page
 *
 * Everything else here is derived: progress is counted, health is inferred,
 * the rail is sorted. Not one figure on the page came from the person whose
 * goals they are. That is what makes a goals page feel like somebody else's
 * software — it can tell you that a goal is at risk and it has nowhere to put
 * the reason, which you know and it does not. "Knowledge is mostly there, the
 * problem is execution on 21-25" is worth more than every percentage above it,
 * and it is one sentence.
 *
 * So this is deliberately small. A textarea per goal, a line of it, saved
 * against the goal. Not a document, not a journal, not the notes page in
 * miniature — a margin note. The moment it grows a toolbar it stops being the
 * thing you scribble before closing the tab.
 *
 * ## It is the notes table, not a new one
 *
 * `notes` has carried `goal_id` since it was created (data/sql/notes.sql) and
 * the API has always accepted it; nothing in the app ever wrote one. So these
 * are ordinary notes that happen to name a goal, which means they are readable
 * from the notes page like any other and nothing here is a private format.
 * One note per goal is a rule this component keeps, not one the table
 * enforces: it edits the most recently touched note carrying the id.
 *
 * Saving is on blur rather than on a button. A margin note with a Save button
 * beside it does not get written, and unlike the notes page there is no delete
 * control here for an accidental save to sit next to.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { categoryOf } from './Outcome';
import type { Note } from '@/services/notes';
import type { Goal } from '@/types';

/** The note this goal is carrying, when it has one. Newest wins — see above. */
export function noteFor(goal: Goal, notes: Note[]): Note | undefined {
  return notes
    .filter((note) => note.goal_id === goal.id)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
}

export interface GoalNotesProps {
  goals: Goal[];
  notes: Note[];
  busy: boolean;
  /** Writes the note for one goal. The page owns the call and the re-read. */
  onSave: (goal: Goal, body: string, existing?: Note) => void;
  onOpen: (goal: Goal) => void;
  limit?: number;
}

export function GoalNotes({ goals, notes, busy, onSave, onOpen, limit = 5 }: GoalNotesProps) {
  const shown = useMemo(
    () => goals.filter((goal) => goal.status !== 'completed').slice(0, limit),
    [goals, limit],
  );

  /* What is in the boxes. Seeded from the server and then owned here, so
     typing is not fighting a re-read — the page re-reads after every write. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const goal of shown) {
        // Only fills a box that is not being typed in.
        if (next[goal.id] === undefined) next[goal.id] = noteFor(goal, notes)?.body ?? '';
      }
      return next;
    });
  }, [notes, shown]);

  const commit = useCallback(
    (goal: Goal) => {
      const existing = noteFor(goal, notes);
      const body = (drafts[goal.id] ?? '').trim();
      if (body === (existing?.body ?? '').trim()) return;
      onSave(goal, body, existing);
    },
    [drafts, notes, onSave],
  );

  if (shown.length === 0) {
    return <p className="gx-empty">No active goals to annotate.</p>;
  }

  return (
    <ul className="gx-notes">
      {shown.map((goal) => {
        const category = categoryOf(goal);
        const existing = noteFor(goal, notes);
        return (
          <li className={`gx-note tone-${category.tone}`} key={goal.id}>
            <button type="button" className="gx-note-goal" onClick={() => onOpen(goal)}>
              {goal.title}
            </button>
            <textarea
              className="gx-note-body"
              placeholder="What do you actually know about this one? The thing the percentage cannot say."
              maxLength={400}
              rows={2}
              disabled={busy}
              value={drafts[goal.id] ?? ''}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [goal.id]: event.target.value }))
              }
              onBlur={() => commit(goal)}
            />
            {existing && <span className="gx-note-when">Saved</span>}
          </li>
        );
      })}
    </ul>
  );
}
