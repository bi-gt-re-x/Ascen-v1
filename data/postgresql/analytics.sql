-- analytics — the graded report card.
--
-- Five metrics, each scored 0-100 with a letter grade, plus a weighted
-- overall. They are computed from the XP ledger, the completed tasks and the
-- focus history (see backend/tracking/analytics.py), and every computation is
-- written here — so the report card has a history rather than only a current
-- number, and today's grade survives a change to how it is calculated.
--
-- One row per user per day per metric: recomputing on the same day replaces
-- that day's row.
--
--   productivity   XP earned per day since the account was made
--   quality        average XP per completed task
--   consistency    share of days the user showed up at all
--   efficiency     half deadlines met, half how fast tasks were finished
--   focus          tracked focus time against the daily focus goal
--   overall        the average of the five

CREATE TABLE IF NOT EXISTS metric_snapshots (
    user_id  TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    date     TEXT NOT NULL,

    metric   TEXT NOT NULL CHECK (metric IN ('productivity', 'quality', 'consistency',
                                             'efficiency', 'focus', 'overall')),
    score    INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    grade    TEXT NOT NULL CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'F')),

    -- The raw numbers behind the score (avg_daily_xp, active_days, the
    -- week-over-week trend, …), kept loose because each metric reports
    -- different ones.
    detail   JSONB DEFAULT '{}',

    PRIMARY KEY (user_id, date, metric)
);

CREATE INDEX IF NOT EXISTS metric_snapshots_user_metric_idx
    ON metric_snapshots (user_id, metric, date DESC);

-- ---- rows: metric_snapshots ----
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('gayguy', '2026-07-27', 'productivity', 40, 'D', '{"avg_daily_xp": 119, "trend": {"direction": "down", "pct": -73}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('gayguy', '2026-07-27', 'quality', 80, 'B', '{"avg_task_xp": 46, "trend": {"direction": "down", "pct": -18}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('gayguy', '2026-07-27', 'consistency', 40, 'D', '{"active_days": 18, "rate": 40, "total_days": 45, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('gayguy', '2026-07-27', 'efficiency', 33, 'F', '{"avg_minutes": 235, "has_timing": true, "on_time_pct": 36, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('gayguy', '2026-07-27', 'focus', 14, 'F', '{"focused_minutes": 53, "goal_minutes": 390, "pct_of_goal": 14, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('gayguy', '2026-07-27', 'overall', 41, 'D', '{"message": "Tackling hard tasks \u2014 hit your daily focus goal.", "trend": {"direction": "down", "pct": -73}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fettywhopper', '2026-07-27', 'productivity', 0, 'F', '{"avg_daily_xp": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fettywhopper', '2026-07-27', 'quality', 0, 'F', '{"avg_task_xp": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fettywhopper', '2026-07-27', 'consistency', 0, 'F', '{"active_days": 0, "rate": 0, "total_days": 41, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fettywhopper', '2026-07-27', 'efficiency', 0, 'F', '{"avg_minutes": null, "has_timing": false, "on_time_pct": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fettywhopper', '2026-07-27', 'focus', 0, 'F', '{"focused_minutes": 0, "goal_minutes": 0, "pct_of_goal": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fettywhopper', '2026-07-27', 'overall', 0, 'F', '{"message": "Strong daily output.", "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('men', '2026-07-27', 'productivity', 57, 'D', '{"avg_daily_xp": 171, "trend": {"direction": "up", "pct": 1768}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('men', '2026-07-27', 'quality', 100, 'S', '{"avg_task_xp": 68, "trend": {"direction": "up", "pct": 17}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('men', '2026-07-27', 'consistency', 26, 'F', '{"active_days": 7, "rate": 26, "total_days": 27, "trend": {"direction": "up", "pct": 50}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('men', '2026-07-27', 'efficiency', 59, 'D', '{"avg_minutes": 233, "has_timing": true, "on_time_pct": 89, "trend": {"direction": "up", "pct": 311}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('men', '2026-07-27', 'focus', 48, 'D', '{"focused_minutes": 507, "goal_minutes": 1050, "pct_of_goal": 48, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('men', '2026-07-27', 'overall', 58, 'D', '{"message": "Tackling hard tasks \u2014 show up more often.", "trend": {"direction": "up", "pct": 1768}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fatty', '2026-07-27', 'productivity', 0, 'F', '{"avg_daily_xp": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fatty', '2026-07-27', 'quality', 0, 'F', '{"avg_task_xp": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fatty', '2026-07-27', 'consistency', 0, 'F', '{"active_days": 0, "rate": 0, "total_days": 6, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fatty', '2026-07-27', 'efficiency', 0, 'F', '{"avg_minutes": null, "has_timing": false, "on_time_pct": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fatty', '2026-07-27', 'focus', 0, 'F', '{"focused_minutes": 0, "goal_minutes": 0, "pct_of_goal": 0, "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('fatty', '2026-07-27', 'overall', 0, 'F', '{"message": "Strong daily output.", "trend": {"direction": "flat", "pct": 0}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('dude', '2026-07-27', 'productivity', 2, 'F', '{"avg_daily_xp": 5, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('dude', '2026-07-27', 'quality', 18, 'F', '{"avg_task_xp": 10, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('dude', '2026-07-27', 'consistency', 25, 'F', '{"active_days": 1, "rate": 25, "total_days": 4, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('dude', '2026-07-27', 'efficiency', 15, 'F', '{"avg_minutes": 710, "has_timing": true, "on_time_pct": 0, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('dude', '2026-07-27', 'focus', 1, 'F', '{"focused_minutes": 7, "goal_minutes": 840, "pct_of_goal": 1, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('dude', '2026-07-27', 'overall', 12, 'F', '{"message": "Showing up daily \u2014 hit your daily focus goal.", "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('SMYLES', '2026-07-27', 'productivity', 30, 'F', '{"avg_daily_xp": 90, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('SMYLES', '2026-07-27', 'quality', 100, 'S', '{"avg_task_xp": 60, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('SMYLES', '2026-07-27', 'consistency', 50, 'D', '{"active_days": 1, "rate": 50, "total_days": 2, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('SMYLES', '2026-07-27', 'efficiency', 50, 'D', '{"avg_minutes": 1, "has_timing": true, "on_time_pct": 0, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('SMYLES', '2026-07-27', 'focus', 2, 'F', '{"focused_minutes": 2, "goal_minutes": 120, "pct_of_goal": 2, "trend": {"direction": "up", "pct": 100}}');
INSERT INTO metric_snapshots (user_id, date, metric, score, grade, detail) VALUES ('SMYLES', '2026-07-27', 'overall', 46, 'D', '{"message": "Tackling hard tasks \u2014 hit your daily focus goal.", "trend": {"direction": "up", "pct": 100}}');
