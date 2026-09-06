-- notifications — the bell's list, and the only part of the app that speaks
-- first.
--
-- Built: backend/tracking/notify.py writes the rows, backend/api/notifications.py
-- serves them, and frontend/src/components/Notifications draws them.
--
-- ## Nothing here is generated on a schedule
--
-- There is no job runner in this app, and a notification table filled by a cron
-- would be the first thing in it that lied — rows written at 3am about a state
-- that has since changed. Every row is instead derived from the record at the
-- moment somebody asks for the list, by the sweep in backend/tracking/notify.py.
-- An account in good order therefore has an empty bell, which is the whole
-- reason a badge on it is worth looking at.
--
-- ## `fingerprint` is the design
--
-- It names the *situation* rather than the moment: 'overdue:2026-09-01',
-- 'goal-due:1755:2026-09-01', 'streak-milestone:30'. The sweep runs on every
-- read and inserts on this key, so finding the same situation a hundred times
-- writes one row. A situation that is genuinely new — tomorrow's overdue list,
-- the next milestone — is a different fingerprint and is a new notification.
--
-- ## The delete is soft, and that is not squeamishness
--
-- `deleted_at` is what makes "delete" stick. The situation a deleted row
-- described is usually still true — the tasks are still late — so a hard delete
-- would let the very next sweep put the same notification straight back, which
-- is precisely the thing the reader just said they did not want. The tombstone
-- is the memory that this one was answered. backend/tracking/notify.py prunes
-- them once they are old enough that their fingerprint can never recur.
--
-- ## Read, shown, deleted are three different things
--
-- `shown_at` is set when the toast has appeared on screen, so it appears once
-- and not on every page load. `read_at` is set when the bell was opened, which
-- is what clears the badge. `deleted_at` is the reader throwing it away. A row
-- can be read without being deleted and deleted without ever being read.

CREATE TABLE IF NOT EXISTS notifications (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    fingerprint  TEXT NOT NULL,
    -- Which switch in Settings governs it: tasks, calendar, analytics, goals,
    -- streak, progress. Stored rather than derived from the fingerprint so the
    -- read filter is a WHERE clause and not a parse.
    channel      TEXT NOT NULL DEFAULT 'tasks',
    -- How it is painted: urgent, warn, info, good.
    tone         TEXT NOT NULL DEFAULT 'info',
    title        TEXT NOT NULL DEFAULT '',
    body         TEXT NOT NULL DEFAULT '',
    -- Where clicking it goes, as an in-app path.
    link         TEXT NOT NULL DEFAULT '',
    -- The day this is about, or '' for one that is about no particular day.
    -- Yesterday's "3 tasks are late" is neither news nor today's count, so a
    -- row with a day on it retires when that day passes — `retire_notifications`
    -- in backend/database/connection.py.
    for_day      TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    shown_at     TEXT,
    read_at      TEXT,
    deleted_at   TEXT
);

-- The dedupe. A sweep inserts on this key and ignores the collision, so the
-- same situation cannot be written twice — including against a tombstone,
-- which is what makes a deleted notification stay deleted.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_print_idx
    ON notifications (user_id, fingerprint);

-- The read: one account's live rows. `rows_for` is not used for
-- this table — the reads are all scoped by deleted_at as well as user_id.
CREATE INDEX IF NOT EXISTS notifications_live_idx
    ON notifications (user_id, deleted_at);
