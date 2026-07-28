-- achievements — badges earned for milestones.
--
-- Not built yet: no page, no API, no JSON store. Two tables, because the
-- catalogue of what can be earned is shared and only the earning is per-user.

-- The catalogue: every badge that exists.
CREATE TABLE IF NOT EXISTS achievements (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    icon         TEXT,                       -- a file in utils/icons/

    -- What earns it: a metric and the value that has to be reached, e.g.
    -- ('streak', 7) or ('tasks_completed', 100).
    metric       TEXT NOT NULL,
    threshold    INTEGER NOT NULL,

    -- Ordering / rarity for the badge wall.
    tier         SMALLINT NOT NULL DEFAULT 1
);

-- Who has earned what.
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id         TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    achievement_id  TEXT NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, achievement_id)
);
