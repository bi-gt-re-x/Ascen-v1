-- user_subjects — what an account has changed about the subject catalogue.
--
-- The catalogue itself is a hundred fixed rows in backend/config/subjects.py
-- and is not stored in the database at all: it is the same list for everybody
-- and it ships with the code. This table holds only the two things an account
-- can say about it, and it holds them in one shape because they are the same
-- shape:
--
--   a subject of its own      — custom = 1, and `name` is what the reader typed
--   a colour on an existing   — custom = 0, and only `family` means anything
--                               subject
--
-- Two tables would have been a `custom_subjects` and a `subject_colors` that
-- both key on (account, subject id), both answer the picker, and both have to
-- be read to draw one row. A custom subject with no colour set and a catalogue
-- subject with one are the same record with different columns filled in.
--
-- `family` is one of the twelve names in frontend/src/utils/eventPalette.ts —
-- 'indigo', 'teal', 'rose'. Not a hex: the palette is six shades per family
-- and the calendar picks the rung it needs per surface, so storing a colour
-- would store one of the six and lose the other five. NULL means the account
-- has not chosen, and the subject keeps whatever the palette gives it.
--
-- No foreign key on subject_id, deliberately. For a custom subject there is
-- nothing to point at, and for a catalogue subject the target is a Python
-- tuple. A row naming a subject the catalogue has since dropped is ignored on
-- read rather than deleted — the catalogue is code, and code gets reverted.

CREATE TABLE IF NOT EXISTS user_subjects (
    user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    subject_id  TEXT NOT NULL,

    -- Only read when custom = 1. A catalogue subject is named by the
    -- catalogue, and letting an account rename one here would mean two names
    -- for the same id depending on who is asking.
    name        TEXT NOT NULL DEFAULT '',

    -- One of the twelve palette families, or NULL for "not chosen".
    family      TEXT,

    custom      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS user_subjects_user_idx ON user_subjects (user_id);
