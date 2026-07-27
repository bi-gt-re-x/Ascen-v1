-- users — one row per account.
--
-- The live shape of data/backups/users.json. Everything an account carries
-- lives here: who they are, how they sign in, and their progression (xp,
-- level, streak), which the app reads on every page load.
--
-- Nothing runs this file yet; the app still reads the JSON store. It is the
-- target schema for the PostgreSQL move.

CREATE TABLE IF NOT EXISTS users (
    -- Millisecond creation timestamp as text, which is what the JSON store
    -- uses; a real migration can swap this for a generated identity.
    id                TEXT PRIMARY KEY,
    username          TEXT NOT NULL UNIQUE,
    name              TEXT,
    email             TEXT UNIQUE,

    -- pbkdf2 hash. Accounts made before hashing hold a plaintext value here
    -- and are upgraded on their next successful sign-in.
    password_hash     TEXT NOT NULL DEFAULT '',
    provider          TEXT NOT NULL DEFAULT 'local'
                      CHECK (provider IN ('local', 'google')),

    -- Verification. A NULL email_verified means an account that predates the
    -- e-mail flow; the app treats those as verified.
    email_verified    BOOLEAN,
    verify_token      TEXT,
    verify_sent_at    TIMESTAMPTZ,
    verified_at       TIMESTAMPTZ,
    profile_complete  BOOLEAN,

    -- Preferences chosen in the Complete Profile step.
    theme             TEXT NOT NULL DEFAULT 'light'
                      CHECK (theme IN ('light', 'dark')),
    daily_goal        INTEGER CHECK (daily_goal BETWEEN 10 AND 2000),

    -- Progression. level is derived from xp (level N costs N * 100) but is
    -- stored so a page can render without recomputing.
    xp                INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level             INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    tasks_completed   INTEGER NOT NULL DEFAULT 0,
    charge            INTEGER NOT NULL DEFAULT 0,

    -- Streak. current_streak is lost after a full day with no completed task;
    -- best_streak is the all-time record and is never lowered. day_state flips
    -- to 'newday' at the start of a day and 'oldday' once a task lands.
    current_streak    INTEGER NOT NULL DEFAULT 0,
    best_streak       INTEGER NOT NULL DEFAULT 0,
    last_task_date    DATE,
    day_state         TEXT CHECK (day_state IN ('newday', 'oldday')),

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_verify_token_idx ON users (verify_token)
    WHERE verify_token IS NOT NULL;
