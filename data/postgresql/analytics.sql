-- analytics — the deeper cuts of a user's own data.
--
-- Not built yet. The five headline scores (productivity, quality,
-- consistency, efficiency, focus) are computed on read today, from the XP
-- ledger and completed tasks. This table is for keeping them: a dated
-- snapshot per metric, so the report card can show history rather than only
-- the current number.

CREATE TABLE IF NOT EXISTS metric_snapshots (
    user_id       TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,

    metric        TEXT NOT NULL
                  CHECK (metric IN ('productivity', 'quality', 'consistency',
                                    'efficiency', 'focus', 'overall')),
    score         SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    grade         TEXT NOT NULL CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'F')),

    -- The raw numbers behind the score (avg_daily_xp, active_days, …), kept
    -- loose because each metric reports different ones.
    detail        JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (user_id, snapshot_date, metric)
);

CREATE INDEX IF NOT EXISTS metric_snapshots_user_metric_idx
    ON metric_snapshots (user_id, metric, snapshot_date DESC);
