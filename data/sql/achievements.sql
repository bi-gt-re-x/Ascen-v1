-- achievements — badges earned for milestones.
--
-- Two tables, because the catalogue of what can be earned is shared and only
-- the earning is per-user. The catalogue itself lives in
-- backend/api/achievements.py — a badge is a rule, and a rule in a table has to
-- be migrated to change — and that module inserts anything missing here on
-- first read, so somebody querying this database sees the same hundred badges
-- the page does.

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

    -- Ordering / rarity for the badge wall. 1 is a first afternoon, 5 is a
    -- year of the app taken seriously.
    tier         INTEGER NOT NULL DEFAULT 1,

    -- Which of the wall's five headings it is filed under.
    category     TEXT,

    -- What earning it is worth toward the achievement score. Never added to
    -- the account's own XP — see the module note in backend/api/achievements.py.
    xp_reward    INTEGER,

    -- One of the five nobody is told about: name, description and progress are
    -- all withheld until it is earned.
    hidden       INTEGER DEFAULT 0,

    -- The title earning it confers. Exactly one badge has one.
    title        TEXT
);

-- Who has earned what.
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id         TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    achievement_id  TEXT NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
    earned_at       TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (user_id, achievement_id)
);
