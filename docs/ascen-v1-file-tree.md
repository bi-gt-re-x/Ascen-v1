---
name: ascen-v1-file-tree
description: "At-a-glance file tree of the Ascen project after the 2026-07-26 backend rewrite and the 2026-07-27 utils/docs/data move"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 480e8eec-ae85-4382-8e8b-5cf825fb6ff5
  modified: 2026-07-28T15:14:03.134Z
---

**Backend rewritten 2026-07-26; folders moved 2026-07-27; datastore became a real SQLite db 2026-07-28** (branch `calendar-focus-and-recurrence`): `paths.py` (2200 lines), `auth.py`, `services/`, `models/`, root `task_backend.py`, `utilities/`, `images/` and `data/postgresql/` are all gone. Verify paths before relying on them. See [[ascen-v1-overview]], [[ascen-v1-data-schema]], [[ascen-v1-run-setup]].

```
run.py                     # shim: from backend.run import app, main (run_mac.py imports app)
run_mac.py                 # macOS runner, port 5050
# (the root database.db is gone — a dead Flask-era SQLite file nothing opened. `git show 2ce0fca:database.db` has it if it is ever wanted.)
data/
  ascen.db                 # THE live datastore (SQLite, git-ignored). Built on first use.
  sql/                     # its schema + seed rows, one file per area. users tasks goals
                           #   growth(xp_events) focus(focus_days,day_focus_notes)
                           #   events(calendar_entries,calendar_events,event_colors)
                           #   analytics(metric_snapshots). 5 more are schema-only stubs.
                           #   Read ONLY when ascen.db is absent; delete the db to reset.
  backups/                 # the old JSON store, kept as a backup; not read or written
backend/
  app.py                   # create_app(): Flask + jinja ChoiceLoader(frontend/secret)
  run.py                   # loads .env, builds app, main()
  config/settings.py       # ALL paths/keys/tunables + load_dotenv() + apply(app)
  database/connection.py   # the SQLite store: connect/read_table/write_table (one txn, WAL)
                           #   + users()/save_users() etc. + new_id(table). Builds the db
                           #   from data/sql/ on first use. NULLs are omitted from row dicts;
                           #   write_table turns FKs off mid-swap (ON DELETE CASCADE trap).
  database/{schema,seed}.sql migrations/   # placeholders, nothing executes them
  tracking/                # pure logic, no Flask routes
    auth.py    accounts, passwords, verification e-mail, Google, session
    xp.py      ledger + levels + streak (refresh_streak/extend_streak/award_task_completion)
    focus.py   focus_history + the per-day focus note (day_focus)
    event.py   calendar entries/events/colours
    growth.py  the 30-day chart series
    analytics.py  the 5-metric report card + snapshots into analytics.sql
    tree.py productivity.py consistency.py   # stubs, features not built
  pages/                   # one blueprint per page: route + that page's API
    homepage dashboard tasks calendar goals growth focus aboutus privacypolicy termsofservice
    analytics growthtree achievements notes library history settings   # stubs
  routes/                  # cross-page routes
    __init__.py  register(app) + PAGE_MODULES list (add a page here)
    auth.py      /api/login|signup|logout, /api/auth/*, /verify/<t>, /auth/google*
    theme.py     /api/set_theme
    assets.py    /static/<kind>/... -> css js images icons fonts assets secret
  middleware/gate.py       # before_request account gate; GATED_ENDPOINTS
  middleware/context.py    # current_theme + current_user into every template
frontend/
  templates/               # ALL Jinja templates (mainpage, dashboard, calendar, growth, goals, "Misc HTML"/)
  js/                      # ALL client scripts (was utilities/js) — js/calendar/ = active calendar scripts
  secret/                  # easter-egg chain + engine.html
styles/                    # all CSS (top level; styles/calendar/ = active)
utils/icons/               # 80 calendar svg icons (was images/icons)
utils/images/              # logo.svg + avatars/ (50 profile-picture svgs)
utils/fonts/  utils/assets/    # empty scaffolds
docs/                      # architecture.md api.md database.md roadmap.md changelog.md
                           #   + copies of these memory files
```

**Gotchas:**
- Static roots are remapped in `backend/config/settings.py:STATIC_ROOTS` — `/static/js/...` → `frontend/js/`, `/static/icons/...` → `utils/icons/`, `/static/images/...` → `utils/images/`. Every `url_for('static', filename=...)` URL is unchanged.
- Blueprint endpoints changed in the rewrite: `main.dashboard` → `dashboard.page`, `main.home` → `home.page`, `main.about_us` → `aboutus.page`, `main.careers` → `aboutus.careers`, `main.contact_support` → `aboutus.contact_support`, `main.privacy_policy` → `privacypolicy.page`, `main.terms_of_service` → `termsofservice.page`. All templates were updated.
- Every URL the frontend calls is unchanged — old vs new responses were diffed byte-for-byte (83 read endpoints, 63 write steps, all page HTML).
- Dropped in the rewrite: `/daily_xp` and `/test-dashboard` (their templates never existed → 500s).
- Legacy calendar css duplicates: `styles/calendar.css`, `styles/calendar-week.css` (page loads only `styles/calendar/`).
- `docs/` holds a **copy** of these memory files; update the originals here, then re-copy.
