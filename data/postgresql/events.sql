-- events — what is on the calendar, and when.
--
-- The live shape of data/backups/calendar.json, which holds two kinds of row
-- in one list: a task placed on a day (task_id + time_block), and a
-- standalone block created on the calendar itself (name + optional
-- recurrence). They are split into two tables here, since that is what the
-- JSON store is really carrying.
--
-- event_colors is data/backups/eventcolors.json: every hex colour already
-- handed out, so a new event can be given one that is visibly different.

-- A task placed on a day.
CREATE TABLE IF NOT EXISTS calendar_entries (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    task_id       TEXT REFERENCES tasks (id) ON DELETE CASCADE,

    entry_date    DATE NOT NULL,
    time_block    TEXT,

    completed     BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A standalone calendar block, optionally recurring.
CREATE TABLE IF NOT EXISTS calendar_events (
    id                TEXT PRIMARY KEY,
    user_id           TEXT REFERENCES users (username) ON DELETE CASCADE,

    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    event_date        DATE NOT NULL,
    time_block        TEXT,

    -- Recurrence, as the calendar writes it: a weekday code or a day-of-month,
    -- repeating until end_date.
    recurrence_week   TEXT,
    recurrence_month  TEXT,
    end_date          DATE,

    -- Built-in events, which the app refuses to delete.
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,

    completed         BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every colour already in use.
CREATE TABLE IF NOT EXISTS event_colors (
    color       TEXT PRIMARY KEY CHECK (color ~ '^#[0-9a-f]{6}$'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_entries_user_date_idx ON calendar_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS calendar_events_user_date_idx ON calendar_events (user_id, event_date);
