-- focus — how long the user actually sat down and worked.
--
-- Both tables used to be JSON blobs on the user row. The focus session itself
-- runs client-side; what is stored is each day's total, which the calendar's
-- Weekly Focus Time panel, the growth chart and focus-type goals all read.

CREATE TABLE IF NOT EXISTS focus_days (
    user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    date        TEXT NOT NULL,

    -- Never lowered by a later sync: a stale client cannot shrink a day's
    -- already-recorded total.
    seconds     NUMERIC DEFAULT 0 CHECK (seconds >= 0),

    -- The daily focus goal that was set on the day, in hours.
    goal_hours  NUMERIC DEFAULT 2 CHECK (goal_hours >= 0),

    PRIMARY KEY (user_id, date)
);

-- The one-line "Focus" note attached to a calendar day. The Week, Day and
-- Month views all show it, so an edit in one view lands everywhere.
CREATE TABLE IF NOT EXISTS day_focus_notes (
    user_id  TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    date     TEXT NOT NULL,
    text     TEXT NOT NULL CHECK (length(text) <= 200),

    PRIMARY KEY (user_id, date)
);

-- ---- rows: focus_days ----
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('gayguy', '2026-07-22', 240.0, 2.5);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('gayguy', '2026-07-23', 77.0, 2.0);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('gayguy', '2026-07-24', 2849.0, 2.0);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('men', '2026-07-22', 30245.0, 12.0);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('men', '2026-07-23', 178.0, 2.0);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('men', '2026-07-24', 9.0, 3.5);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('dude', '2026-07-25', 438.0, 12.0);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('dude', '2026-07-26', 4.0, 2.0);
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('SMYLES', '2026-07-26', 118.0, 2.0);

-- ---- rows: day_focus_notes ----
INSERT INTO day_focus_notes (user_id, date, text) VALUES ('dude', '2026-07-25', 'gh');
