-- history — a searchable record of everything already done.
--
-- Not built yet. The pieces exist scattered across the other tables
-- (completed tasks, finished goals, XP rows, focus days); the History page
-- wants one timeline it can page through and filter, which is this.

CREATE TABLE IF NOT EXISTS activity_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    -- What happened: task_completed, goal_completed, level_up, streak_broken,
    -- focus_session, achievement_earned…
    kind         TEXT NOT NULL,
    summary      TEXT NOT NULL DEFAULT '',

    -- What it happened to, when it points at a row elsewhere.
    subject_id   TEXT,
    subject_type TEXT CHECK (subject_type IN ('task', 'goal', 'event', 'achievement')),

    -- Anything else worth keeping about the moment (xp earned, new level…).
    detail       TEXT NOT NULL DEFAULT '{}',

    occurred_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS activity_log_user_time_idx
    ON activity_log (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_kind_idx ON activity_log (user_id, kind);
