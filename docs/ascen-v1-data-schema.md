---
name: ascen-v1-data-schema
description: datastore tables + record counts for Ascen v1 (SQLite data/ascen.db, seeded from data/sql/*.sql)
metadata: 
  node_type: memory
  type: project
  originSessionId: cb79112d-50f4-4eea-ad2c-9ae5817161d9
  modified: 2026-07-28T15:13:21.109Z
---

**Since 2026-07-28 the live datastore is a real SQLite database, `data/ascen.db`** (git-ignored), built on first use from `data/sql/*.sql` — each of those holds its tables' CREATE TABLE plus the seed rows as INSERTs, under `-- ---- rows: <table> ----` markers. They are read only when the db is absent; after that the db is the only copy. `data/backups/*.json` is the old JSON store, kept as a backup. The root `database.db` is a different, dead file that nothing opens. See [[ascen-v1-file-tree]], [[ascen-v1-overview]]. Row counts as migrated 2026-07-28: users 6, tasks 714, goals 10, xp_events 234, focus_days 9, day_focus_notes 1, calendar_events 7, event_colors 21, metric_snapshots 36. Schemas (captured 2026-07-16, updated 2026-07-28):

- **users** (users.sql) — `id, username, password_hash` (plaintext!), `xp, level, current_streak, best_streak, charge, tasks_completed, last_task_date, day_state, theme, created_at`, and (added 2026-07-22) optional `focus_history`: `{iso_date: {seconds, goal_hours}}` synced from the dashboard Focus panel via POST /api/focus_sync. The old `focus_history`/`day_focus` blobs now live as their own tables in focus.sql (`focus_days`: user_id/date/seconds/goal_hours, `day_focus_notes`: user_id/date/text). Account fields include those added by the 2026-07-26 accounts flow: `name, email, provider, email_verified, verify_token, profile_complete, daily_goal`. 6 users: `gayguy`, `fettywhopper`, `men`, `fatty`, `dude`, `SMYLES`.
- **tasks** (tasks.sql) — `id, user_id, title, description, priority, status, xp_value, due_date, show_on_calendar, created_at, completed_at`, plus `completion_seconds` + `met_deadline` recorded on completion (the report card's efficiency metric). ~700 records.
- **calendar_entries + calendar_events** (events.sql; a row with `name` is an event, one with `task_id`/`user_id` is an entry) — `id, name, recurrence-month, recurrence-week, end_date, date, time_block, description, completed(bool), created_at, is_default(bool)`. ~7 records. (Note hyphenated keys `recurrence-month/-week`.)
- **goals** (goals.sql) — `id, user_id, title, description, progress(float), target_value, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, deadline, status, created_at`. ~7 records. `goal_type` drives which target/current pair is used (xp / streak / tasks / focus).
- **xp_events** (growth.sql) — `id, user_id, amount(int), reason, timestamp, date, tasks_completed`. ~220 records (append-only XP ledger). `reason` is `task_completion` (1 task) or `daily_xp` (a rolled-up day).

Records are keyed to users by `user_id` (except calendar events, which are global/not user-scoped). **event_colors** (events.sql) is one row per hex colour. **metric_snapshots** (analytics.sql) stores the graded report card: one row per user per day per metric, written every time the ratings are computed. Backend routes now live one-module-per-page in `backend/pages/` (see [[ascen-v1-file-tree]]) and are all under `/api/*` — e.g. get_user_data, tasks, complete_task, add_goal, get_growth_data, get_growth_ratings, create_calendar_event, login/signup/logout, set_theme; page routes: `/`, `/dashboard`, `/calendar`, `/growth`, `/goals`, `/home`.
