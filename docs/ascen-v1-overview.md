---
name: ascen-v1-overview
description: What the Ascen v1 project is and how its code is structured (Flask productivity app)
metadata: 
  node_type: memory
  type: project
  originSessionId: b914a0dc-6f30-4713-b9c4-697e858ed39b
  modified: 2026-07-28T15:13:43.649Z
---

**Ascen v1** ("Study Dashboard" / "grind-os") is a Flask productivity web app the user has built over ~3 months (2nd attempt after scrapping a first agent-built version). Gamified study/task tracker: tasks, XP/levels, streaks, a calendar, goals, and a growth analytics/report-card page.

**Layout:** repo root `/Users/myles/Ascen-v1` IS the project. Entry point is [run.py](run.py), a shim over [backend/run.py](backend/run.py).

**Structure** (see [[ascen-v1-file-tree]] for the full tree) — **backend rewritten 2026-07-26** into layers: `config/` (paths + keys), `database/connection.py` (the JSON store, the only code that touches a file), `tracking/` (the rules — xp/streak, focus, calendar events, growth grading, accounts), `pages/` (one blueprint per page: its route + its API), `routes/` (cross-page: accounts, theme, static assets), `middleware/` (the account gate + template context), assembled by [backend/app.py](backend/app.py). Before that it was one 2200-line `backend/paths.py` plus `auth.py`/`services/`; a root `task_backend.py` held calendar+XP helpers and is gone (ported into `tracking/event.py`).
- `frontend/html/` — what is left of the original server-rendered pages. Only `careers.html`, `contact-support.html` and the `engine.html` in `frontend/secret/` are still rendered ([backend/routes/pages.py](../backend/routes/pages.py)); `homepage.html` and `aboutus.html` are kept as reference for two ports that are still settling. The dashboard, calendar, growth, analytics, goals and footer-page templates were deleted once React took their routes — see git history.
- `frontend/index.html` — the one shell the app is served from. Every React route ([backend/routes/spa.py](../backend/routes/spa.py) has the list) is this file plus client-side routing, so moving between the dashboard, calendar, growth, analytics and goals never reloads the page.
- `styles/` (top level) — all CSS (`styles/calendar/` = active calendar styles). `styles/layout.css` = shared responsive foundation (`.page-shell`, breakpoints 1024/768/480).
- `frontend/js/` — what the React port has *not* replaced. `page-fade.js` is the only one still loaded (by careers.html and contact-support.html); the rest are the last copy of a behaviour with no React counterpart yet — `timer.js` (the focus timer page), `celebrate.js` (day-clear confetti), `focus-theme.js` (Focus Mode's look, which sets `html.focus-mode`), `goal-auto.js`/`goal-notify.js` (goal automation and its toasts), `slider-keyboard.js`. Everything ported — the dashboard, tasks, goals, growth, focus, theme, topnav, auth-flow, api, the ten `home-*.js` and all of `js/calendar/` — was deleted; git history has it.
- `utils/` — `images/` (logo.svg + `avatars/`: 50 round profile-picture SVGs, one per account, picked from the account id by `backend/tracking/avatar.py`, or from an `avatar` row in `user_settings` once the account chooses one in the top bar's account menu), `icons/` (80 calendar svg icons), plus empty `fonts/` and `assets/`.
- `data/ascen.db` — **the actual datastore** since 2026-07-28: a SQLite database, git-ignored. `data/sql/*.sql` = its schema + seed rows, one file per area (users, tasks, goals, growth=xp ledger, focus, events, analytics=report card), read only when the db is missing. `data/backups/*.json` = the old JSON store, kept as a backup only.
- `docs/` — architecture / api / database / roadmap / changelog, plus copies of these memory files.
- `fit-scale.js` (deleted) — proportional "zoom to fit" for `data-fit-width="N"` elements. The goals page dropped it in the 2026-07-22 redesign and the growth/analytics ports never took it up: the React pages are responsive through `styles/layout.css` instead of being zoomed as a fixed-width composition.

**Non-obvious facts:**
- Live data is **`data/ascen.db`** (SQLite), read/written by `backend/database/connection.py`. Its interface survived two datastore rewrites unchanged — `read_table`/`write_table`/`new_id` + a load/save pair per store — which is why `tracking/` and `pages/` needed zero edits when JSON→.sql→SQLite. The root `database.db` — a dead Flask-era file nothing opened — has been deleted; `git show 2ce0fca:database.db` recovers it.
- **`read_table` omits NULL columns from the row dict** rather than returning None, because the app relies on `'met_deadline' in task`, `.get('tasks_completed', 1)` and `.get('email_verified', True)` — returning None there would corrupt the report card, undercount the growth chart, and lock 5 of 6 accounts out.
- **`write_table` must disable foreign keys while it swaps rows.** Every account-owned table is ON DELETE CASCADE and `refresh_streak` rewrites `users` on every page load, so its DELETE-then-INSERT would cascade away all tasks/goals/XP. It re-checks with `PRAGMA foreign_key_check` before commit. Do not "simplify" this away.
- The whole backend is **tracked in git** — the old `.gitignore` patterns referenced pre-reorg paths and no longer match. (`paths.py` was historically the "hidden master backend file" referenced in 00-Welcome.txt.) `database.db`/`.env` may still be ignored.
- **`write_table` is atomic** (one transaction, WAL on) to avoid torn reads under the threaded dev server. Streak model: `tracking/xp.py:refresh_streak(user)` decays a stale current_streak (lost after a full missed day; best_streak kept) on every `get_user_data`/`get_goals` read, and `complete_task` extends it on consecutive days. Backend is the single source of truth; JS API reads use `cache: 'no-store'`. Reads still write (streak decay, goal sync, report-card snapshots) — but into the db now, so **the old git churn from the datastore is gone**; `data/sql/` no longer changes when the app runs.
- Older accounts still hold a **plaintext** `password_hash` in users.json; sign-in accepts them and upgrades each one to a pbkdf2 hash the first time it's used (`tracking/auth.py`).

See [[ascen-v1-run-setup]] for how to run it on this Mac.
