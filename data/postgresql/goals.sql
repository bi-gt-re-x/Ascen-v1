-- goals — "earn N XP", "reach an N-day streak", "complete N tasks",
-- "focus N minutes".
--
-- The live shape of data/backups/goals.json. Each type counts with its own
-- pair of columns rather than a shared current/target, because a goal keeps
-- its other targets when its type is edited.
--
-- XP and task goals are fed by the app when a task is completed. Streak and
-- focus goals track themselves: a streak goal follows the account's live
-- streak, and a focus goal measures the focus time accumulated since it was
-- set, which is what focus_baseline_seconds remembers.

CREATE TABLE IF NOT EXISTS goals (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    title                   TEXT NOT NULL,
    description             TEXT NOT NULL DEFAULT '',
    goal_type               TEXT NOT NULL DEFAULT 'xp'
                            CHECK (goal_type IN ('xp', 'streak', 'tasks', 'focus')),

    target_xp               INTEGER NOT NULL DEFAULT 0,
    current_xp              INTEGER NOT NULL DEFAULT 0,
    target_streak           INTEGER NOT NULL DEFAULT 0,
    current_streak          INTEGER NOT NULL DEFAULT 0,
    target_tasks            INTEGER NOT NULL DEFAULT 0,
    current_tasks           INTEGER NOT NULL DEFAULT 0,
    target_focus            INTEGER NOT NULL DEFAULT 0,   -- minutes
    current_focus           NUMERIC(10, 1) NOT NULL DEFAULT 0,

    -- The account's lifetime focus seconds when a focus goal was created;
    -- progress is (lifetime total now - this).
    focus_baseline_seconds  NUMERIC(12, 1) NOT NULL DEFAULT 0,

    -- Denormalised copies of the active type's target and percentage, which
    -- the goals page renders directly.
    target_value            INTEGER NOT NULL DEFAULT 0,
    progress                NUMERIC(5, 1) NOT NULL DEFAULT 0,

    priority                SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    deadline                TIMESTAMPTZ,
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_status_idx ON goals (user_id, status);
CREATE INDEX IF NOT EXISTS goals_user_type_idx ON goals (user_id, goal_type);
