---
name: ascen-v1-file-tree
description: "At-a-glance file tree of the Ascen project after the 2026-07-26 backend rewrite and the 2026-07-27 utils/docs/data move"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 480e8eec-ae85-4382-8e8b-5cf825fb6ff5
  modified: 2026-07-27T14:14:15.034Z
---

**Backend rewritten 2026-07-26, folders moved 2026-07-27** (branch `calendar-focus-and-recurrence`): `paths.py` (2200 lines), `auth.py`, `services/`, `models/`, root `task_backend.py`, `utilities/` and `images/` are all gone. Verify paths before relying on them. See [[ascen-v1-overview]], [[ascen-v1-data-schema]], [[ascen-v1-run-setup]].

```
run.py                     # shim: from backend.run import app, main (run_mac.py imports app)
run_mac.py                 # macOS runner, port 5050
database.db                # SQLite — DEAD; no code opens it any more
data/
  backups/                 # THE live datastore (JSON): users tasks calendar goals xpevents eventcolors
  postgresql/              # 12 .sql table definitions, the migration target; nothing executes them
backend/
  app.py                   # create_app(): Flask + jinja ChoiceLoader(frontend/secret)
  run.py                   # loads .env, builds app, main()
  config/settings.py       # ALL paths/keys/tunables + load_dotenv() + apply(app)
  database/connection.py   # the JSON store: read_json/write_json (atomic) + users()/save_users() etc.
  database/{schema,seed}.sql migrations/   # placeholders, nothing executes them
  tracking/                # pure logic, no Flask routes
    auth.py    accounts, passwords, verification e-mail, Google, session
    xp.py      ledger + levels + streak (refresh_streak/extend_streak/award_task_completion)
    focus.py   focus_history + the per-day focus note (day_focus)
    event.py   calendar entries/events/colours
    growth.py  30-day series + the 5-metric report card
    tree.py analytics.py productivity.py consistency.py   # stubs, features not built
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
utils/images/              # logo.svg (was images/)
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
