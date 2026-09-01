# Roadmap

What's built, what's scaffolded, and what's still an idea. The README carries
the wider product vision; this is the engineering view.

## Built

Dashboard and task management · calendar (Month / Week / Day) · XP, levels and
streaks · goals of four types · the growth chart and the five-metric report
card · focus tracking · light/dark theme · accounts with e-mail verification
and optional Google sign-in.

## Scaffolded, not built

Each of these has a page module, a tracking module where it needs one, and a
table definition — all empty except for a note saying what belongs in it. The
place each one goes is already decided.

| Feature | Page | Tracking | Table |
| --- | --- | --- | --- |
| Growth tree | `pages/growthtree.py` | `tracking/tree.py` | — |
| Achievements | `pages/achievements.py` | — | `achievements.sql` |
| Notes | `pages/notes.py` | — | `notes.sql` |
| Library | `pages/library.py` | — | `library.sql` |
| History | `pages/history.py` | — | `history.sql` |
| Settings | `pages/settings.py` | — | `settings.sql` |

Productivity and consistency also have tracking stubs. Both are currently
scores computed inside `tracking/analytics.py`; they move out only if either
grows into a feature of its own. `pages/analytics.py` is still a stub — the
analytics *page* doesn't exist, though the grading behind it does.

## Next

**A PostgreSQL server.** The data is in a real database now — SQLite, at
`data/ascen.db`, behind one module (`backend/database/connection.py`) whose
only two SQL-running functions are `read_table` and `write_table`. What is left
is putting the server-only types back in `data/sql/` and pointing those two
functions at a connection pool; the steps are in [database.md](database.md).

**Hash the remaining plaintext passwords.** Legacy accounts upgrade themselves
on their next sign-in; the ones that never sign in stay plaintext.

**Rotate `SECRET_KEY` out of the default.** It falls back to a hard-coded dev
value when the environment doesn't set one, which is fine locally and not
anywhere else.

## Later

Cloud sync and cross-device support · habit tracking · data export ·
AI-assisted productivity suggestions · team workspaces.

Notifications landed — see backend/tracking/notify.py. *Reminders* did not, and
are a different thing: they need something running when nobody is looking at
the app, and there is no job runner here. The bell is read from the record on
each visit, which is why an account in good order gets nothing.
