-- users — one row per account.
--
-- Everything an account carries: who they are, how they sign in, and their
-- progression (xp, level, streak), which the app reads on every page load.
-- Focus history and the per-day focus note used to hang off this row; they
-- live in focus.sql now.

CREATE TABLE IF NOT EXISTS users (
    -- Millisecond creation timestamp as text, which is what the app generates;
    -- a real migration can swap this for a generated identity.
    id                TEXT PRIMARY KEY,
    username          TEXT NOT NULL UNIQUE,
    name              TEXT,
    email             TEXT UNIQUE,

    -- pbkdf2 hash. Accounts made before hashing hold a plaintext value here
    -- and are upgraded on their next successful sign-in.
    password_hash     TEXT NOT NULL DEFAULT '',
    provider          TEXT CHECK (provider IN ('local', 'google')),

    -- Verification. NULL email_verified means an account that predates the
    -- e-mail flow; the app treats those as verified.
    email_verified    BOOLEAN,
    verify_token      TEXT,
    verify_sent_at    TEXT,
    verified_at       TEXT,
    profile_complete  BOOLEAN,

    -- Preferences chosen in the Complete Profile step.
    theme             TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    daily_goal        INTEGER CHECK (daily_goal BETWEEN 10 AND 2000),

    -- Progression. level is derived from xp (level N costs N * 100) but is
    -- stored so a page can render without recomputing.
    xp                INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level             INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    tasks_completed   INTEGER DEFAULT 0,
    charge            INTEGER DEFAULT 0,

    -- Streak. current_streak is lost after a full day with no completed task;
    -- best_streak is the all-time record and is never lowered. day_state flips
    -- to 'newday' at the start of a day and 'oldday' once a task lands.
    current_streak    INTEGER DEFAULT 0,
    best_streak       INTEGER DEFAULT 0,
    last_task_date    TEXT,
    day_state         TEXT CHECK (day_state IN ('newday', 'oldday')),

    created_at        TEXT
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_verify_token_idx ON users (verify_token)
    WHERE verify_token IS NOT NULL;

-- ---- rows: users ----
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1781399054117', 'gayguy', NULL, NULL, 'pbkdf2:sha256:1000000$Mvvru7nu5tlPpx5R$1bb3211089b5bd19bed9ebd7a65922214b3256438012df96c37a9eb9851ab477', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 5343, 10, 160, 0, 0, 1, '2026-07-21', 'newday', '2026-06-13T20:04:14.120090');
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1781715970833', 'fettywhopper', NULL, NULL, 'dick', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1782923188347', 'men', NULL, NULL, '1', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 4621, 10, 70, 0, 0, 3, '2026-07-23', 'newday', NULL);
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1784731823389', 'fatty', NULL, NULL, 't', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-22T09:50:23.389568');
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1784926246867', 'dude', NULL, NULL, '2', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 20, 1, 2, NULL, 1, 1, '2026-07-26', 'newday', '2026-07-24T15:50:46.867453');
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1785084084815', 'SMYLES', 'Myles Zhang', 'hanwenks@gmail.com', 'pbkdf2:sha256:1000000$eRfYTkavaouvqBY3$a3d9a2f056dbbed56cef0e8a018d5cac4141bb1611f03b62fadf80f5cddf8c2e', 'local', TRUE, NULL, '2026-07-26T11:41:24.815441', '2026-07-26T11:41:31.343809', TRUE, 'light', 200, 180, 2, 3, NULL, 1, 1, '2026-07-26', 'newday', '2026-07-26T11:41:24.815441');
