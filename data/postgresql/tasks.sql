-- tasks — the unit of work the whole app is built on.
--
-- The live shape of data/backups/tasks.json. Completing a task is the single
-- moment that moves an account forward: it awards xp_value, extends the
-- streak, writes a row to the XP ledger (growth.sql) and counts toward the
-- user's goals.
--
-- `user_id` holds the username, which is what the JSON store keys on; the
-- migration can repoint it at users.id.

CREATE TABLE IF NOT EXISTS tasks (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    title               TEXT NOT NULL DEFAULT '',
    description         TEXT NOT NULL DEFAULT '',
    priority            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high')),
    status              TEXT NOT NULL DEFAULT 'todo'
                        CHECK (status IN ('todo', 'done', 'expired')),

    -- What completing it is worth.
    xp_value            INTEGER NOT NULL DEFAULT 0 CHECK (xp_value >= 0),

    due_date            TIMESTAMPTZ,
    show_on_calendar    BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timer, when one was set for this task.
    timer_duration      INTEGER,
    timer_expired       BOOLEAN NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,

    -- Recorded on completion, and read by the growth report card's efficiency
    -- metric: how long it took, and whether it beat its deadline. Tasks
    -- completed before this was tracked are simply left out of those scores.
    completion_seconds  INTEGER,
    met_deadline        BOOLEAN
);

CREATE INDEX IF NOT EXISTS tasks_user_status_idx ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS tasks_user_completed_idx ON tasks (user_id, completed_at DESC);
