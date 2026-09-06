-- events — what is on the calendar, and when.
--
-- Two kinds of row, which used to share one JSON list:
--   calendar_entries  a task placed on a day (task_id + time_block)
--   calendar_events   a standalone block created on the calendar itself
--                     (name + optional recurrence), is_default marking the
--                     built-ins the app refuses to delete
--
-- event_colors is every hex colour already handed out, so a new event can be
-- given one that is visibly different from the rest.
--
-- The recurrence columns are quoted because the app writes them hyphenated.

CREATE TABLE IF NOT EXISTS calendar_entries (
    id            TEXT PRIMARY KEY,
    user_id       TEXT REFERENCES users (username) ON DELETE CASCADE,
    task_id       TEXT,

    date          TEXT,
    time_block    TEXT,

    completed     BOOLEAN,
    completed_at  TEXT,
    created_at    TEXT
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT REFERENCES users (username) ON DELETE CASCADE,

    name                 TEXT NOT NULL,
    description          TEXT DEFAULT '',
    date                 TEXT,
    time_block           TEXT,

    -- Recurrence as the calendar writes it: a weekday code or a day of the
    -- month, repeating until end_date.
    "recurrence-week"    TEXT,
    "recurrence-month"   TEXT,
    end_date             TEXT,

    is_default           BOOLEAN DEFAULT FALSE,
    completed            BOOLEAN DEFAULT FALSE,
    completed_at         TEXT,
    created_at           TEXT
);

CREATE TABLE IF NOT EXISTS event_colors (
    color         TEXT PRIMARY KEY,

    -- The ISO week the colour was handed out in, "2026-W33". A colour is
    -- reserved for its own week and released after it, so a calendar does not
    -- run out of room as blocks are created and deleted over a year. Things
    -- still on the calendar keep their colour reserved by being there — the
    -- client tracks that half. See backend/tracking/event.py.
    claimed_week  TEXT
);

CREATE TABLE IF NOT EXISTS calendar_documents (
    user_id     TEXT PRIMARY KEY REFERENCES users (username) ON DELETE CASCADE,

    -- The whole calendar for one account, as the JSON the views already hold:
    -- { "2026-7-4": { "timestamps": [ ... ], "focus": "..." }, ... }
    --
    -- A document rather than a row per event, and that is the point. Every
    -- event any user of this app has ever made lived in their browser's
    -- localStorage and nowhere else, because the month, week and day views
    -- never called the endpoints above. The shape those endpoints model is the
    -- old coarse one — a `time_block` of 'morning', a recurrence spelled
    -- "mon, tue, wed" — and it cannot hold what the store actually keeps:
    -- start and end times, subtasks, XP, and the colour family. Writing the
    -- data through them would have lost four fields per event, so the fix was
    -- somewhere to put the shape that exists, unchanged.
    --
    -- Not queryable, deliberately. Nothing queries it: the calendar is read
    -- whole, for one account, by the client that renders it. When something
    -- does need to ask questions of individual events, that is the moment for
    -- a real table and a migration out of here — not before.
    data        TEXT NOT NULL DEFAULT '{}',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS calendar_entries_user_date_idx ON calendar_entries (user_id, date);
CREATE INDEX IF NOT EXISTS calendar_events_date_idx ON calendar_events (date);

-- ---- rows: calendar_entries ----


-- ---- rows: calendar_events ----
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_morning', NULL, 'Morning', 'Morning session', '2026-06-14', 'morning', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_afternoon', NULL, 'Afternoon', 'Afternoon session', '2026-06-14', 'afternoon', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_late_afternoon', NULL, 'Late Afternoon', 'Late afternoon session', '2026-06-14', 'late_afternoon', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_evening', NULL, 'Evening', 'Evening session', '2026-06-14', 'evening', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_night', NULL, 'Night', 'Night session', '2026-06-14', 'night', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_sessions', NULL, 'Sessions', 'Work sessions', '2026-06-14', 'sessions', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');
INSERT INTO calendar_events (id, user_id, name, description, date, time_block, "recurrence-week", "recurrence-month", end_date, is_default, completed, completed_at, created_at) VALUES ('default_sleep', NULL, 'Sleep Time', 'Sleep time', '2026-06-14', 'sleep', 'mon, tue, wed, thu, fri, sat, sun', NULL, 'dec 31, 2091', TRUE, FALSE, NULL, '2026-06-14T11:10:00.000000');

-- ---- rows: event_colors ----
INSERT INTO event_colors (color) VALUES ('#3e983e');
INSERT INTO event_colors (color) VALUES ('#9fa3a8');
INSERT INTO event_colors (color) VALUES ('#864a27');
INSERT INTO event_colors (color) VALUES ('#3e6b98');
INSERT INTO event_colors (color) VALUES ('#8bb83d');
INSERT INTO event_colors (color) VALUES ('#78736d');
INSERT INTO event_colors (color) VALUES ('#ee8c2b');
INSERT INTO event_colors (color) VALUES ('#4d9d75');
INSERT INTO event_colors (color) VALUES ('#a74454');
INSERT INTO event_colors (color) VALUES ('#ae8f32');
INSERT INTO event_colors (color) VALUES ('#696fb5');
INSERT INTO event_colors (color) VALUES ('#5cc639');
INSERT INTO event_colors (color) VALUES ('#3d8fb8');
INSERT INTO event_colors (color) VALUES ('#389457');
INSERT INTO event_colors (color) VALUES ('#e79f23');
INSERT INTO event_colors (color) VALUES ('#c85c41');
INSERT INTO event_colors (color) VALUES ('#854ebc');
INSERT INTO event_colors (color) VALUES ('#e3681c');
INSERT INTO event_colors (color) VALUES ('#9e754c');
INSERT INTO event_colors (color) VALUES ('#6aa63f');
INSERT INTO event_colors (color) VALUES ('#948f89');
