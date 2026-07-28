-- settings — account preferences beyond the theme toggle.
--
-- Not built yet. Theme and daily_goal live on the user row today because they
-- are the only two; a Settings page means more of them, and a key/value table
-- means adding one is not a migration.

CREATE TABLE IF NOT EXISTS user_settings (
    user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (user_id, key)
);

-- The defaults a new account starts with, so the app never has to hard-code
-- them in two places.
CREATE TABLE IF NOT EXISTS setting_defaults (
    key          TEXT PRIMARY KEY,
    value        TEXT NOT NULL,
    label        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT ''
);
