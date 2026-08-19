-- records — the account's hall of fame, in its own words.
--
-- Built: backend/api/records.py serves it and frontend/src/pages/Records.tsx
-- draws it.
--
-- ## Why this table exists at all
--
-- The Records page was entirely derived: best XP day, heaviest task, longest
-- streak, all read back out of the growth history. That is honest and it is
-- also only ever about the things Ascen itself counts. It cannot know that you
-- got 25/25 on AMC 8, or reached RCM 9, or wrote a ten-thousand-line project,
-- because none of those happened inside the app. This is where the account
-- says so. The derived records stay exactly as they were and are drawn beside
-- these; neither is a replacement for the other.
--
-- ## One row is one entry, not one record
--
-- The important shape here. A "record" in the reader's sense — "AMC 8, best
-- 25" — is not a row: it is every row sharing a `name`, and the best of them
-- is the maximum. That falls out of storing entries rather than bests:
--
--     the personal best   the largest `value` among rows with that name
--     the evolution       those rows in date order: 18 → 20 → 21 → 23 → 25
--     "+7 from first"     the newest minus the oldest
--     "NEW RECORD"        the newest row is also the largest
--
-- Storing a single best per name would give the first of those and destroy the
-- other three, and the other three are most of what the page is for.
--
-- ## Milestones share the table
--
-- `kind` separates them. A milestone is a thing that either happened or has
-- not — "first AIME problem solved" — so it carries no figure and its date is
-- empty until it does. They live here rather than in their own table because
-- they are the same record with the number left out: same owner, same
-- category, same date, same page, same three endpoints.
--
-- Note the other milestones in this app are `goal_milestones`, which are
-- checkpoints *on the way to* a goal and are ordered, dated and ticked off in
-- sequence. These are not those: they are things already achieved, in no
-- order, belonging to no goal.

CREATE TABLE IF NOT EXISTS records (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    -- 'record' for a figure that can be beaten, 'milestone' for a thing that
    -- either happened or has not.
    kind         TEXT NOT NULL DEFAULT 'record'
                 CHECK (kind IN ('record', 'milestone')),

    -- What it measures: "AMC 8", "Longest coding session". Rows sharing this
    -- and an owner are the same record over time — see above.
    name         TEXT NOT NULL DEFAULT '',

    -- Free text, and deliberately not a subject id. The page groups by this
    -- and the reader's categories are theirs: "Competitive Math" is not a
    -- subject in the catalogue and should not have to be one to be a heading.
    category     TEXT NOT NULL DEFAULT '',

    -- The comparable number. Everything printed is built from this and `unit`
    -- rather than stored as text, because a record that cannot be compared to
    -- the one before it cannot be a record.
    value        NUMERIC NOT NULL DEFAULT 0,
    -- The "out of", for a score with a ceiling: 25 / 25. Zero means none.
    target       NUMERIC NOT NULL DEFAULT 0,
    -- What `value` counts: 'points', 'minutes', 'days', 'lines', ''. The
    -- client formats from it — 258 minutes prints as "4h 18m".
    unit         TEXT NOT NULL DEFAULT '',

    note         TEXT NOT NULL DEFAULT '',

    -- ISO date. Empty on a milestone not reached yet, which is what draws it
    -- as an open circle rather than a tick.
    achieved_on  TEXT NOT NULL DEFAULT '',

    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The page reads one account's rows and groups them in memory; this is the
-- index that read wants. The second covers the per-name history lookup.
CREATE INDEX IF NOT EXISTS records_user_idx ON records (user_id, kind);
CREATE INDEX IF NOT EXISTS records_name_idx ON records (user_id, name, achieved_on);
