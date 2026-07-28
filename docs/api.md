# API

Every endpoint returns JSON with a `success` boolean. A failure is usually
`{"success": false, "message": "..."}` with HTTP 200 — the client checks the
flag, not the status. Requests that need an account pass `username` (query
string for GET, body for POST/PUT/DELETE); the session is only used by the
account endpoints and the page gate.

The file each endpoint lives in is in the right-hand column.

## Pages

| Route | Notes | File |
| --- | --- | --- |
| `GET /` | Signed in → `/dashboard`, else the home page | `pages/homepage.py` |
| `GET /home` | The home page, and the host of the sign-in popup | `pages/homepage.py` |
| `GET /dashboard` | Account required | `pages/dashboard.py` |
| `GET /calendar` | Account required | `pages/calendar.py` |
| `GET /goals` | Account required | `pages/goals.py` |
| `GET /growth` | Account required | `pages/growth.py` |
| `GET /about-us`, `/careers`, `/contact-support` | | `pages/aboutus.py` |
| `GET /privacy-policy` | | `pages/privacypolicy.py` |
| `GET /terms-of-service` | | `pages/termsofservice.py` |
| `GET /engine` | Hidden; gated client-side by today's unlock | `pages/homepage.py` |

A signed-out visitor asking for a gated page is redirected to
`/home?auth=login&next=<path>` (`middleware/gate.py`).

## Account

| Endpoint | Does |
| --- | --- |
| `GET /api/auth/providers` | What the popup should offer (Google, mail) |
| `POST /api/auth/signup` | name + e-mail + password → verification e-mail |
| `POST /api/auth/resend` | Send the verification link again |
| `GET /api/auth/verify_status` | Polled by the "check your inbox" screen |
| `GET /verify/<token>` | The link in the e-mail: confirms, signs in |
| `POST /api/auth/complete_profile` | Username, theme, daily goal |
| `POST /api/login` | Username **or** e-mail + password |
| `POST /api/logout` | Clears the session and the theme cookie |
| `POST /api/signup` | The original username + password sign-up, kept for older clients |
| `GET /auth/google`, `GET /auth/google/callback` | Google sign-in, when configured |
| `POST /api/set_theme` | `{"theme": "light" \| "dark"}` |

All in `routes/auth.py`, except the theme (`routes/theme.py`).

## Dashboard — `pages/dashboard.py`

| Endpoint | Does |
| --- | --- |
| `GET /api/get_user_data?username=` | Stats (level, xp, tasks, streaks) + every task. Decays a stale streak on read |
| `POST /api/update_stats` | Write back level / xp / tasks_completed |
| `POST /api/track_daily_xp` | Fold a batch into today's ledger row |

## Tasks — `pages/tasks.py`

| Endpoint | Does |
| --- | --- |
| `GET /api/tasks?username=` | Every task for an account |
| `POST /api/tasks` | Create one (`name`, `priority`, `xp_reward`, `due_date`) |
| `PUT /api/tasks/<id>` | Edit; `completed: true` stamps it done |
| `DELETE /api/tasks/<id>?username=` | Delete |
| `POST /api/complete_task` | **The one that matters**: XP, level, streak, ledger row, goal progress |
| `POST /api/get_task_status` | Status of one task |
| `POST /api/timer_expired` | Timer ran out → status `expired` |
| `POST /api/update_task_due_date` | Push a deadline out |
| `GET /api/last_task_completion?username=` | Most recent completion, polled by the goals page |
| `POST /api/add_task`, `POST /api/delete_task` | Older names, kept |
| `POST /api/delete_task_no_tracking` | Delete with no XP/streak side effects |

## Goals — `pages/goals.py`

| Endpoint | Does |
| --- | --- |
| `POST /api/add_goal` | Type `xp` / `streak` / `tasks` / `focus`, with its target |
| `GET /api/get_goals?username=` | Every goal + `avg_xp_per_day`. Re-syncs streak and focus goals first |
| `POST /api/update_goal` | Edit fields |
| `POST /api/delete_goal` | Delete |
| `POST /api/update_goal_progress` | Add to one counter by hand, capped at target |
| `POST /api/auto_apply_task_xp` | Apply a completed task's XP to active XP goals |

## Calendar — `pages/calendar.py`

| Endpoint | Does |
| --- | --- |
| `GET/POST /api/calendar` | List / create entries (a task on a day) |
| `PUT/DELETE /api/calendar/<id>` | Edit / delete an entry |
| `POST /api/create_calendar_event` | A standalone block, optionally recurring |
| `DELETE /api/delete_calendar_event/<id>` | Delete one (built-ins are protected) |
| `GET /api/get_default_events`, `/api/get_custom_events` | Split by `is_default` |
| `POST /api/sync_task_to_calendar` | Put an existing task on the calendar |
| `POST /api/mark_task_completed_in_calendar` | Complete a task and tick its entries |
| `GET /api/get_calendar_progress?username=` | Totals and per-day grouping |
| `GET /api/get_event_colors`, `POST /api/add_event_color` | The palette already in use |
| `GET/POST /api/day_focus` | The one-line focus note on a day |
| `GET /api/xp_earned_on?username=&date=` | One day's XP, midnight to midnight |

## Focus — `pages/focus.py`

| Endpoint | Does |
| --- | --- |
| `POST /api/focus_sync` | Mirror a day's focus total (never lowers a recorded total) |
| `GET /api/focus_history?username=&start=&end=` | `{iso: {seconds, goal_hours}}` |

## Growth — `pages/growth.py`

| Endpoint | Does |
| --- | --- |
| `GET /api/get_growth_data?username=` | Day-by-day XP, tasks and focus; last 30 days |
| `GET /api/get_growth_ratings?username=` | The five-metric report card + weekly trends |
| `GET /api/get_xp_data?username=` | The ledger rolled up: level, totals, series |

## Known gap

`frontend/js/calendar/calendar-month.js` posts to
`/api/update_task_completion`, which has never existed server-side. It 404s.
