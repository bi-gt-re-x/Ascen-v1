-- growth — the XP ledger the growth page is built on.
--
-- The live shape of data/backups/xpevents.json: one append-only row per
-- XP-earning moment. It is the source of truth for "how much did I earn, and
-- when" — the growth chart, the calendar's daily XP and the report card all
-- read it rather than recomputing from tasks.
--
-- Two reasons are written today:
--   task_completion  one completed task, tasks_completed = 1
--   daily_xp         a rolled-up day total, tasks_completed = the day's count

CREATE TABLE IF NOT EXISTS xp_events (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    amount           INTEGER NOT NULL DEFAULT 0,
    reason           TEXT NOT NULL DEFAULT 'task_completion',

    -- The day the XP belongs to, kept alongside the timestamp so a day's
    -- total is a plain equality test rather than a range scan.
    event_date       DATE NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    tasks_completed  INTEGER NOT NULL DEFAULT 1,
    avg_task_xp      NUMERIC(10, 2)
);

CREATE INDEX IF NOT EXISTS xp_events_user_date_idx ON xp_events (user_id, event_date);

-- The growth chart's series: one row per day from account creation to today,
-- including days with nothing recorded, so the x-axis is real time rather
-- than a list of active days. Derived — the app builds it on read today.
CREATE OR REPLACE VIEW growth_daily AS
SELECT
    user_id,
    event_date,
    SUM(amount)                                     AS xp_earned,
    SUM(tasks_completed)                            AS tasks_completed,
    SUM(SUM(amount)) OVER (PARTITION BY user_id
                           ORDER BY event_date)     AS cumulative_xp
FROM xp_events
GROUP BY user_id, event_date;
