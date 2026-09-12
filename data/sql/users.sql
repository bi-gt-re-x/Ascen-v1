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

    -- pbkdf2 hash, and only ever that: `check_password` in
    -- backend/tracking/auth.py has no plaintext branch, so a value here that
    -- is not a hash opens nothing. An empty string is the deliberate way to
    -- say "no password signs this account in" — see the note above the rows.
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

    -- Streak. current_streak survives a single missed day once the run has
    -- reached GRACE_EARNED_AT, and is lost to two; best_streak is the all-time
    -- record and is never lowered. day_state flips to 'newday' at the start of
    -- a day and 'oldday' once a task lands. streak_grace_day is the date of
    -- the one missed day this run was forgiven, which is what the refresh rate
    -- is counted from -- see `_grace_available` in backend/tracking/xp.py.
    current_streak    INTEGER DEFAULT 0,
    best_streak       INTEGER DEFAULT 0,
    last_task_date    TEXT,
    day_state         TEXT CHECK (day_state IN ('newday', 'oldday')),
    streak_grace_day  TEXT,

    created_at        TEXT
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_verify_token_idx ON users (verify_token)
    WHERE verify_token IS NOT NULL;

-- ---- rows: users ----
--
-- Six demo accounts, and every one of them is furniture: the tasks, goals,
-- focus days and analytics in the other seed files hang off these usernames,
-- so the app comes up with something to draw rather than six empty pages.
--
-- None of them is a person and none of them can be signed into. That is the
-- point of the two columns that look empty:
--
--   * The names and addresses are example.test placeholders. This file used to
--     carry a real name, a real e-mail address and the pbkdf2 hash of a real
--     password, because it was written by exporting a live database — and it
--     is committed, so that was a person's account details in the repository,
--     and in every clone of it.
--
--   * `password_hash` is '' on all six, which `check_password` answers False
--     to before it looks at anything. Two of these rows used to hold the
--     password itself in the clear ('dick', 't'), which the old plaintext
--     branch accepted: publishing this file published two working logins.
--
-- A seeded account that can be signed into is a backdoor with a changelog, so
-- the rule for anything added here is that it stays furniture: give it data to
-- make the demo worth looking at, never a credential.
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1781399054117', 'demo', 'Demo Account', 'demo@example.test', '', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 5343, 10, 160, 0, 0, 1, '2026-07-21', 'newday', '2026-06-13T20:04:14.120090');
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1781715970833', 'riley', 'Riley Quinn', 'riley@example.test', '', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1782923188347', 'avery', 'Avery Stone', 'avery@example.test', '', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 4621, 10, 70, 0, 0, 3, '2026-07-23', 'newday', NULL);
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1784731823389', 'casey', 'Casey Brooks', 'casey@example.test', '', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-22T09:50:23.389568');
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1784926246867', 'jordan', 'Jordan Reyes', 'jordan@example.test', '', NULL, NULL, NULL, NULL, NULL, NULL, 'light', NULL, 20, 1, 2, NULL, 1, 1, '2026-07-26', 'newday', '2026-07-24T15:50:46.867453');
INSERT INTO users (id, username, name, email, password_hash, provider, email_verified, verify_token, verify_sent_at, verified_at, profile_complete, theme, daily_goal, xp, level, tasks_completed, charge, current_streak, best_streak, last_task_date, day_state, created_at) VALUES ('1785084084815', 'morgan', 'Morgan Lee', 'morgan@example.test', '', 'local', TRUE, NULL, '2026-07-26T11:41:24.815441', '2026-07-26T11:41:31.343809', TRUE, 'light', 200, 180, 2, 3, NULL, 1, 1, '2026-07-26', 'newday', '2026-07-26T11:41:24.815441');
