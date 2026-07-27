# Database

Ascen runs on JSON files. `data/backups/` **is** the live datastore — the name
is about where it's headed, not what it is: `data/postgresql/` holds the table
definitions we are migrating toward, and until that migration happens the JSON
files are the real thing and everything reads and writes them.

Every read and write goes through `backend/database/connection.py`. Nothing
else in the codebase opens a file.

## The stores

| File | Holds |
| --- | --- |
| `users.json` | Accounts: identity, sign-in, progression (xp, level, streak), theme, plus two embedded blobs — `focus_history` and `day_focus` |
| `tasks.json` | Tasks, including the timing recorded on completion |
| `goals.json` | Goals of all four types |
| `xpevents.json` | The XP ledger — append-only, one row per earning moment |
| `calendar.json` | Calendar entries (a task on a day) and events (standalone blocks) |
| `eventcolors.json` | `{"colors": [...]}` — every hex colour handed out |

`user_id` on every row is the **username**, not the account id.

## Shapes

Field-by-field definitions live in `data/postgresql/*.sql`, one file per table,
each written against the JSON shape it describes:

| File | Tables |
| --- | --- |
| `users.sql` | `users` |
| `tasks.sql` | `tasks` |
| `goals.sql` | `goals` |
| `growth.sql` | `xp_events`, and the `growth_daily` view the chart wants |
| `focus.sql` | `focus_days`, `day_focus_notes` — today embedded in the user row |
| `events.sql` | `calendar_entries`, `calendar_events`, `event_colors` |
| `notes.sql`, `achievements.sql`, `analytics.sql`, `history.sql`, `settings.sql`, `library.sql` | Not built yet — the shape each page would need |

Nothing executes those files. `backend/database/schema.sql` and `seed.sql` are
placeholders for the same reason.

## Behaviour that isn't obvious

**Writes are atomic.** `write_json` writes a temp file in the same directory
and `os.replace()`s it over the target, so a concurrent reader sees either the
whole old file or the whole new one — never a truncated one. The threaded dev
server makes this a real case, not a theoretical one.

**Reads write.** `GET /api/get_user_data` decays a stale streak and
`GET /api/get_goals` re-syncs streak and focus goals, both saving as they go.
So the JSON files show as modified whenever the app runs, with no user action.
Don't commit that churn.

**Levels are derived but stored.** Level N costs N × 100 XP; `level` is kept on
the account so a page can render without recomputing, and is recalculated from
the total on every completion.

**Older passwords are plaintext.** Accounts predating hashing hold a plaintext
`password_hash`; sign-in accepts them and rewrites the field as a pbkdf2 hash
the first time each one is used.

**`database.db`** at the repo root is a dead SQLite file from an early attempt.
No code opens it.

## Migrating to PostgreSQL

1. Create the schema from `data/postgresql/*.sql` (order: `users`, then
   `tasks` and `goals`, then the rest — foreign keys point at `users.username`).
2. Load the JSON stores into it. The embedded blobs (`focus_history`,
   `day_focus`) fan out into `focus_days` and `day_focus_notes`.
3. Rewrite `backend/database/connection.py` — the load/save pair per store —
   to run queries. Nothing above that layer knows where the data lives, so
   `tracking/` and `pages/` should not need to change.
