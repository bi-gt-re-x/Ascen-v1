# Changelog

Notable changes, newest first. Dates are the day the work landed on the branch.

## 2026-07-29 — The landing page becomes a demonstration

Five passes over `/home`, so the page shows the app working instead of
describing it. Everything is hand-written CSS and vanilla JS — no library, no
build step — and every piece of it degrades to a static page.

- **The opening.** A black curtain lifts, the logo draws itself stroke-first,
  then the greeting, date, headline (a word at a time), subtitle and buttons
  each take their turn. Behind every section: a grid, a slow gradient, drifting
  particles on one canvas, and a glow trailing the cursor.
- **A simulated dashboard** that fills itself in — sidebar, nav icons, cards,
  XP bar in three pulls, counters, a level flip and a rating stepping C to A —
  then floats on a seven-second cycle.
- **Two workflow demos.** A task is checked off, confettis, slides out, and its
  XP flies to the bar; an event is dragged Monday to Tuesday, snaps in with an
  overshoot, and the streak catches.
- **Charts that draw themselves**, measured rather than hard-coded:
  `getTotalLength()` for the dash, `getPointAtLength()` for the points. Bars
  grow on an overshoot curve, the gauge winds, the XP timeline writes itself.
- **The finish.** Feature-card hover, philosophy icons stroking themselves on,
  connector wires across the tech stack, a 500ms theme fade, and a closing CTA
  that glows, breathes, shines and ripples.

Three things worth carrying forward:

- **Animated elements are written in CSS in their *finished* state.** A script
  adds one class to put them back to the start and removes it a frame later.
  With no JS, a parse error, or `prefers-reduced-motion`, the page is just the
  page — it never sits blank waiting for a script that did not run. The usual
  arrangement (hide in CSS, reveal in JS) fails the opposite way.
- **`window.HomePlay`** is the shared kit: `onView` (play on enter, reset on
  leave, everything cancellable), `countThrough` (waypoint counters) and a
  cancellable `timeline`.
- **SVG bars are scaled, not resized.** Animating `y`/`height` through the CSS
  box looked right and was not: Chrome takes a unitless `y` and drops a
  unitless `height`, which left every bar flat with its markup value destroyed.

The Technology Stack section also stopped claiming React, TypeScript, FastAPI
and PostgreSQL, none of which this project uses. It reads HTML · CSS · Vanilla
JS, Python · Flask · Jinja, SQLite, SVG · Canvas.

## 2026-07-29 — An account menu under the avatar

Clicking the avatar opens a square panel: the username with a red Log Out
button beside it, and under that a row of all fifty pictures that scrolls
sideways inside the panel rather than widening it. Picking one is instant —
the tick and the bar's own picture move first and the request only confirms
them, putting both back if it fails.

- A pick is stored as an `avatar` row in `user_settings`, the key/value table
  that exists so a preference like this is not a migration. `avatar_for` reads
  it, and falls back to the derived picture for accounts that never picked.
- `POST /api/avatar`, in `routes/auth.py`: 401 without a session, 400 for any
  name that is not one of the fifty, so nothing reaches the row but a real one.
- The menu opens scrolled to the picture you are wearing, wherever it sits in
  the fifty.

## 2026-07-29 — Every account gets a profile picture

Fifty round drawings in `utils/images/avatars/` — astronauts and planets,
animals, plants and everyday things — replace the letter-in-a-circle the top
bar used to show. They are original flat SVGs drawn for the app, a couple of KB
each, so there is nothing licensed or downloaded in the tree.

- Which picture an account gets is **derived**: `md5(user id) % 50` in
  `backend/tracking/avatar.py`. No column, no migration, and every account that
  already existed has one too. `md5` rather than `hash()`, which Python salts
  per process and would repaint every account on restart. (Picking one from the
  account menu stores it and overrides this — see the entry above.)
- Keyed on the id rather than the username, so a rename keeps the picture.
- `middleware/context.py` now looks the account row up once and derives both
  `current_theme` and `current_avatar` from it; `auth.theme_for` went with it.
  `public_user()` gained an `avatar` URL for the client.

## 2026-07-28 — The .sql files become an actual database

The data lives in SQLite at `data/ascen.db` now. `data/sql/` keeps the schema
and the rows to start from, and is read once — when the database does not exist
yet — so a fresh clone still comes up working with nothing to install or start.
`data/postgresql/` is gone; its contents moved to `data/sql/` with the DDL
rewritten for SQLite.

- `backend/database/connection.py` rewritten on `sqlite3`. The public interface
  is unchanged — `read_table`, `write_table`, `new_id` and the load/save pair
  per store — so `tracking/` and `pages/` did not change at all.
- Schemas converted: `TIMESTAMPTZ`/`JSONB`/`DATE` → `TEXT`, `BIGSERIAL` →
  `INTEGER PRIMARY KEY AUTOINCREMENT`, `TEXT[]` → JSON in a `TEXT` column,
  `SMALLINT` → `INTEGER`, `now()` → `datetime('now')`, `left()` → `substr()`,
  the `growth_daily` view to `CREATE VIEW IF NOT EXISTS`. The `GIN` index on
  `library_items.tags` has no SQLite equivalent and is dropped. Every `CHECK`,
  every foreign key and both partial/expression indexes survive as written.
- **A NULL column is left out of the row dict** rather than returned as `None`.
  Three call sites depend on it: `'met_deadline' in task` (640 of 714 tasks
  lack it), `xp_event.get('tasks_completed', 1)` (124 of 234), and
  `user.get('email_verified', True)` (5 of 6 accounts) — which would otherwise
  have locked those accounts out.
- **`write_table` disables foreign keys while it swaps a table's rows.** Every
  account-owned table is `ON DELETE CASCADE`, and `refresh_streak` rewrites
  `users` on every page load, so the delete half of the rewrite would have
  cascaded away every task, goal and XP row. `PRAGMA foreign_key_check` still
  runs on the written table before commit.
- Three goals belonging to `user_id = 'Default'`, an account that never
  existed, were dropped. They had been unreachable since the account gate
  landed.
- `data/ascen.db` is git-ignored. The seed files no longer change as the app
  runs, so the datastore stops showing up as modified in every diff.

Verified by running the old and new code side by side: 371 KB of API responses
across four accounts, and the only differences are absent `null` keys and
`100.0` rendering as `100`.

## 2026-07-27 — The datastore moves into the .sql files

`data/postgresql/*.sql` is now where the data lives, not just where the schema
was going to. Each file holds its tables' definitions followed by their rows as
INSERT statements; `data/backups/*.json` is kept as a backup of the last
JSON-era state and is no longer read or written.

- `backend/database/connection.py` rewritten around the .sql files: reading
  parses the INSERTs and types each value from its column, writing regenerates
  one table's rows and leaves the rest of the file — schema, comments, other
  tables — byte for byte.
- The two blobs that hung off the user row fan out into tables of their own:
  `focus_days` and `day_focus_notes` in focus.sql. The single calendar list
  splits into `calendar_entries` and `calendar_events` in events.sql.
- The growth ratings moved out of `tracking/growth.py` into
  `tracking/analytics.py`, and every computation now files a dated row per
  metric into analytics.sql — so the report card accumulates a history instead
  of only ever showing today's number. growth.py keeps the chart series.
- The schemas were rewritten to match the data exactly, including the two
  hyphenated recurrence columns the calendar writes, which exist as quoted
  identifiers.
- achievements, history, library, notes and settings stay schema-only: those
  features are not built.
- Ids are primary keys now, so `connection.new_id` steps past collisions —
  creating four goals in one loop used to hand two of them the same id, and
  whichever the app found first won.

Verified against the JSON-backed app: all 75 read responses across every
account came back identical, and 55 of 57 write steps matched. The two that
differ are the id collision, which the old store had and this one does not.

## 2026-07-27 — Repo layout: utils, docs, and a Postgres-shaped data folder

Assets, docs and data moved to their final homes. No behaviour changed; the
URLs the frontend asks for are the same.

- `utilities/js/` → `frontend/js/`. All client scripts now sit with the
  templates they belong to; `styles/` stays a top-level folder.
- `images/` and `images/icons/` → `utils/images/` and `utils/icons/`, joined by
  empty `utils/fonts/` and `utils/assets/`.
- `data/*.json` → `data/backups/`, which is still the live datastore.
- `data/postgresql/` added: one `.sql` per table, twelve in all, written
  against the JSON shapes they describe. Nothing executes them yet.
- `utilities/docs/` → `docs/`, filled in — architecture, api, database,
  roadmap, this file — plus the project notes carried alongside them.
- `/static/<kind>/...` gained `fonts` and `assets`; the four existing kinds
  point at their new folders.

## 2026-07-26 — Backend rewrite

The backend was one 2200-line `paths.py` plus `auth.py`, `services/` and a
993-line `task_backend.py` at the repo root. It is now layered: `config/`,
`database/`, `tracking/`, `pages/`, `routes/`, `middleware/`, assembled by
`app.py`. Verified against the old backend response-for-response — 83 read
endpoints, 63 write steps and every page's HTML came back byte-identical.

- One module per page under `pages/`, one per tracked thing under `tracking/`.
  Stubs mark where the features that don't exist yet will go.
- Blueprint endpoints renamed (`main.dashboard` → `dashboard.page`, and so on);
  every template updated. Every URL is unchanged.
- Nothing opens `database.db` any more — no `init_db`, no sqlite import.
- `/api/get_xp_data` now answers from the JSON ledger. It used to read SQLite
  tables that were never populated and always replied "User not found".
- The legacy `/api/signup` now hashes the password instead of storing it in the
  clear.
- Dropped `/daily_xp` and `/test-dashboard`, whose templates never existed.

## Earlier

See `git log`. Highlights: the accounts and e-mail verification flow
(`a5e1512`), the hidden Engine easter-egg chain (`b964d1c` … `98d8a4e`), and
the calendar's daily counts, ledger XP and weekly focus time (`f5debe6`).
