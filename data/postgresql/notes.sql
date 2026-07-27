-- notes — free-form notes attached to a day, a task or a goal.
--
-- Not built yet: no page, no API, no JSON store. This is the shape the
-- Notes page would need, so backend/pages/notes.py has something to fill in.

CREATE TABLE IF NOT EXISTS notes (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    title        TEXT NOT NULL DEFAULT '',
    body         TEXT NOT NULL DEFAULT '',

    -- What the note is about, when it is about anything. A note with none of
    -- these set is a loose note.
    note_date    DATE,
    task_id      TEXT REFERENCES tasks (id) ON DELETE SET NULL,
    goal_id      TEXT REFERENCES goals (id) ON DELETE SET NULL,

    pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_user_date_idx ON notes (user_id, note_date);
