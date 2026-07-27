-- focus — how long the user actually sat down and worked.
--
-- Today both of these live inside the user row as JSON blobs
-- (`focus_history` and `day_focus` in data/backups/users.json); they are their
-- own tables here because that is what they are.
--
-- The focus session itself runs client-side; what is stored is each day's
-- total, which the calendar's Weekly Focus Time panel, the growth chart and
-- focus-type goals all read.

CREATE TABLE IF NOT EXISTS focus_days (
    user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    focus_date  DATE NOT NULL,

    -- Never lowered by a later sync: a stale client cannot shrink a day's
    -- already-recorded total.
    seconds     NUMERIC(10, 1) NOT NULL DEFAULT 0 CHECK (seconds >= 0),

    -- The daily focus goal that was set on the day, in hours.
    goal_hours  NUMERIC(4, 2) NOT NULL DEFAULT 2 CHECK (goal_hours >= 0),

    PRIMARY KEY (user_id, focus_date)
);

-- The one-line "Focus" note attached to a calendar day. The Week, Day and
-- Month views all show it, so an edit in one view lands everywhere.
CREATE TABLE IF NOT EXISTS day_focus_notes (
    user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    note_date   DATE NOT NULL,
    text        TEXT NOT NULL CHECK (length(text) <= 200),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, note_date)
);
