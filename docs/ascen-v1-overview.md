---
name: ascen-v1-overview
description: What the Ascen v1 project is and how its code is structured (Flask productivity app)
metadata: 
  node_type: memory
  type: project
  originSessionId: b914a0dc-6f30-4713-b9c4-697e858ed39b
  modified: 2026-07-27T13:45:52.509Z
---

**Ascen v1** ("Study Dashboard" / "grind-os") is a Flask productivity web app the user has built over ~3 months (2nd attempt after scrapping a first agent-built version). Gamified study/task tracker: tasks, XP/levels, streaks, a calendar, goals, and a growth analytics/report-card page.

**Layout:** repo root `/Users/myles/Ascen-v1` IS the project. Entry point is [run.py](run.py), a shim over [backend/run.py](backend/run.py).

**Structure** (see [[ascen-v1-file-tree]] for the full tree) — **backend rewritten 2026-07-26** into layers: `config/` (paths + keys), `database/connection.py` (the JSON store, the only code that touches a file), `tracking/` (the rules — xp/streak, focus, calendar events, growth grading, accounts), `pages/` (one blueprint per page: its route + its API), `routes/` (cross-page: accounts, theme, static assets), `middleware/` (the account gate + template context), assembled by [backend/app.py](backend/app.py). Before that it was one 2200-line `backend/paths.py` plus `auth.py`/`services/`; a root `task_backend.py` held calendar+XP helpers and is gone (ported into `tracking/event.py`).
- `frontend/templates/` — all Jinja templates (mainpage, dashboard, calendar, growth, goals, `Misc HTML/` footer pages).
- `styles/` (top level) — all CSS (`styles/calendar/` = active calendar styles). `styles/layout.css` = shared responsive foundation (`.page-shell`, breakpoints 1024/768/480).
- `frontend/js/` — all JS, moved there 2026-07-27 (api.js, dashboard.js, tasks.js, goal.js, focus.js, focus-theme.js, celebrate.js, theme.js, page-fade.js, fit-scale.js, `js/calendar/` for day/week views, etc.).
- `utils/` — `images/` (logo.svg), `icons/` (80 calendar svg icons), plus empty `fonts/` and `assets/`.
- `data/postgresql/*.sql` — **the actual datastore** since 2026-07-27: schema + rows in one file per area (users, tasks, goals, growth=xp ledger, focus, events, analytics=report card). `data/backups/*.json` = the old JSON store, kept as a backup only.
- `docs/` — architecture / api / database / roadmap / changelog, plus copies of these memory files.
- `frontend/js/fit-scale.js` — proportional "zoom to fit" for `data-fit-width="N"` elements (growth pages); goals page no longer uses it after the 2026-07-22 redesign.

**Non-obvious facts:**
- Live data is **`data/postgresql/*.sql`**, read/written by `backend/database/connection.py` (parses INSERTs, types values from the column type, rewrites one table's block at a time). Nothing opens `database.db` at all.
- The whole backend is **tracked in git** — the old `.gitignore` patterns referenced pre-reorg paths and no longer match. (`paths.py` was historically the "hidden master backend file" referenced in 00-Welcome.txt.) `database.db`/`.env` may still be ignored.
- **`database/connection.py:write_table` is atomic** (temp file + `os.replace`) to avoid torn reads under the threaded dev server. Streak model: `tracking/xp.py:refresh_streak(user)` decays a stale current_streak (lost after a full missed day; best_streak kept) on every `get_user_data`/`get_goals` read, and `complete_task` extends it on consecutive days. Backend is the single source of truth; JS API reads use `cache: 'no-store'`. The `.sql` files get rewritten on normal reads (streak decay, goal sync, and the report card filing a snapshot into analytics.sql), so they show as git-modified whenever the app runs — don't commit that churn.
- Older accounts still hold a **plaintext** `password_hash` in users.json; sign-in accepts them and upgrades each one to a pbkdf2 hash the first time it's used (`tracking/auth.py`).

See [[ascen-v1-run-setup]] for how to run it on this Mac.
