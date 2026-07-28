# Database

Ascen stores its data in `data/postgresql/` — one `.sql` file per part of the
app, each holding its tables' definitions followed by their rows as `INSERT`
statements. Schema and data sit in the same file, in the SQL the app is
migrating toward.

`data/backups/` holds the JSON stores this replaced. They are a backup of the
last JSON-era state; nothing reads or writes them any more.

Every read and write goes through `backend/database/connection.py`. Nothing
else in the codebase opens a file.

## What lives where

| File | Tables | Rows |
| --- | --- | --- |
| `users.sql` | `users` | accounts: identity, sign-in, progression (xp, level, streak) |
| `tasks.sql` | `tasks` | every task, plus the timing recorded on completion |
| `goals.sql` | `goals` | goals of all four types |
| `growth.sql` | `xp_events` (+ the `growth_daily` view) | the XP ledger — append-only, one row per earning moment |
| `focus.sql` | `focus_days`, `day_focus_notes` | each day's focus total, and the day's one-line note |
| `events.sql` | `calendar_entries`, `calendar_events`, `event_colors` | tasks placed on a day, standalone calendar blocks, the palette in use |
| `analytics.sql` | `metric_snapshots` | the graded report card, one row per user per day per metric |
| `achievements.sql`, `history.sql`, `library.sql`, `notes.sql`, `settings.sql` | — | schema only: those features are not built |

`user_id` on every row is the **username**, not the account id.

## How a file is laid out

Everything above the first `-- ---- rows: <table> ----` marker is the schema
and is preserved word for word on every write. Below each marker are that
table's rows:

```sql
CREATE TABLE IF NOT EXISTS focus_days (
    user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
    date        TEXT NOT NULL,
    seconds     NUMERIC DEFAULT 0 CHECK (seconds >= 0),
    goal_hours  NUMERIC DEFAULT 2 CHECK (goal_hours >= 0),
    PRIMARY KEY (user_id, date)
);

-- ---- rows: focus_days ----
INSERT INTO focus_days (user_id, date, seconds, goal_hours) VALUES ('dude', '2026-07-26', 4.0, 2.0);
```

A write regenerates one table's block and leaves every other byte of the file
alone, so comments and hand edits to a schema survive.

Values keep their types on the way back: the column's SQL type decides, so
`INTEGER` comes back an int, `NUMERIC` a float, `BOOLEAN` a bool, `JSONB` the
decoded object, and `NULL` is None. Quoting is what separates `'1'` the string
from `1` the number.

## Behaviour that isn't obvious

**Writes are atomic.** A temp file in the same directory is `os.replace()`d
over the target, so a concurrent reader sees the whole old file or the whole
new one — never a truncated one. The threaded dev server makes that real.

**Reads write.** `GET /api/get_user_data` decays a stale streak,
`GET /api/get_goals` re-syncs streak and focus goals, and
`GET /api/get_growth_ratings` files a snapshot into `analytics.sql`. All three
save as they go, so the `.sql` files change as the app is used.

**Ids are millisecond timestamps**, stepped forward past collisions
(`connection.new_id`). They are primary keys now, so two rows created in the
same millisecond can no longer share one.

**Levels are derived but stored.** Level N costs N × 100 XP; `level` is kept on
the account so a page renders without recomputing, and is recalculated from the
total on every completion.

**Older passwords are plaintext.** Accounts predating hashing hold a plaintext
`password_hash`; sign-in accepts them and rewrites the field as a pbkdf2 hash
the first time each is used.

## Moving to a real PostgreSQL server

The files are already the schema and the data, in order:

1. `psql -f users.sql` first, then `tasks.sql` and `goals.sql`, then the rest —
   foreign keys point at `users.username`.
2. Repoint `backend/database/connection.py` — the load/save pair per table — at
   the connection instead of the file. Nothing above that layer knows where the
   data lives, so `tracking/` and `pages/` should not need to change.
