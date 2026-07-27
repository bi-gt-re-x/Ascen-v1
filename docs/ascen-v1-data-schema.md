---
name: ascen-v1-data-schema
description: JSON datastore schemas + record counts for Ascen v1 (data/backups/*.json)
metadata: 
  node_type: memory
  type: project
  originSessionId: cb79112d-50f4-4eea-ad2c-9ae5817161d9
  modified: 2026-07-22T16:07:14.399Z
---

Ascen's live datastore is 6 JSON files, each a **flat list of record objects**, in **`data/backups/`** (moved there 2026-07-27; the name is where it's headed, not what it is — `data/postgresql/*.sql` holds the target schema and nothing executes it yet). SQLite `database.db` is dead and no longer opened at all. See [[ascen-v1-file-tree]], [[ascen-v1-overview]]. Schemas (captured 2026-07-16, updated 2026-07-27):

- **users.json** — `id, username, password_hash` (plaintext!), `xp, level, current_streak, best_streak, charge, tasks_completed, last_task_date, day_state, theme, created_at`, and (added 2026-07-22) optional `focus_history`: `{iso_date: {seconds, goal_hours}}` synced from the dashboard Focus panel via POST /api/focus_sync. Also optional `day_focus`: `{iso_date: text}` (the calendar's per-day note), and the account fields added by the 2026-07-26 accounts flow: `name, email, provider, email_verified, verify_token, profile_complete, daily_goal`. 6 users: `gayguy`, `fettywhopper`, `men`, `fatty`, `dude`, `SMYLES`.
- **tasks.json** (was task.json) — `id, user_id, title, description, priority, status, xp_value, due_date, show_on_calendar, created_at, completed_at`, plus `completion_seconds` + `met_deadline` recorded on completion (the report card's efficiency metric). ~700 records.
- **calendar.json** — `id, name, recurrence-month, recurrence-week, end_date, date, time_block, description, completed(bool), created_at, is_default(bool)`. ~7 records. (Note hyphenated keys `recurrence-month/-week`.)
- **goals.json** — `id, user_id, title, description, progress(float), target_value, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, deadline, status, created_at`. ~7 records. `goal_type` drives which target/current pair is used (xp / streak / tasks / focus).
- **xpevents.json** (was xpevent.json) — `id, user_id, amount(int), reason, timestamp, date, tasks_completed`. ~220 records (append-only XP ledger). `reason` is `task_completion` (1 task) or `daily_xp` (a rolled-up day).

Records are keyed to users by `user_id` (except calendar events, which are global/not user-scoped). A 6th store, **eventcolors.json**, is a dict `{"colors": [hex,...]}`. Backend routes now live one-module-per-page in `backend/pages/` (see [[ascen-v1-file-tree]]) and are all under `/api/*` — e.g. get_user_data, tasks, complete_task, add_goal, get_growth_data, get_growth_ratings, create_calendar_event, login/signup/logout, set_theme; page routes: `/`, `/dashboard`, `/calendar`, `/growth`, `/goals`, `/home`.
