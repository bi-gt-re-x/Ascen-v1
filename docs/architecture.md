# Architecture

Ascen is a Flask app with server-rendered pages and a JSON datastore. There is
no build step and no framework on the frontend: templates render, scripts fetch
JSON, the backend owns every rule.

## The shape of the repo

```
run.py                 entry point — a shim over backend/run.py
run_mac.py             same, on port 5050 (macOS gives 5000 to AirPlay)

backend/               the Flask app  (see "Layers" below)
frontend/
  templates/           all Jinja templates
  js/                  all client scripts (served at /static/js/...)
  secret/              the easter-egg chain and the hidden /engine page
styles/                all CSS (served at /static/css/...)
utils/
  icons/               80 calendar SVGs      -> /static/icons/...
  images/              logo, and avatars/    -> /static/images/...
                       (50 profile pictures)
  fonts/               (empty)               -> /static/fonts/...
  assets/              (empty)               -> /static/assets/...
data/
  ascen.db             the live database (SQLite, git-ignored)
  sql/                 its schema and seed, one .sql per part of the app
  backups/             the JSON stores it replaced, kept as a backup
docs/                  this folder
```

## Layers

The backend is a stack of layers, each depending only on the ones above it.

```
config/       every path, key and tunable. Nothing else hard-codes a path.
database/     connection.py — the .sql store. The only code that opens a file.
tracking/     the rules. XP and streaks, focus, calendar events, growth
              grading, accounts. No Flask routing anywhere in here.
pages/        one blueprint per page: the route that renders it and the API
              endpoints that page calls. Reads the request, asks a tracker,
              shapes the JSON.
routes/       the routes that belong to no single page — accounts, theme,
              static assets — plus the list of every blueprint to register.
middleware/   what happens around every request: the account gate, and the
              theme + current_user that every template gets.
```

`app.py` assembles them and knows no page by name; `routes/__init__.py` holds
the page list. Adding a page means writing `backend/pages/<name>.py` with a
`bp` and adding its name to `PAGE_MODULES`.

## Rules worth knowing

**The backend is the source of truth.** The client renders and animates; it
never decides what an account's XP, level or streak is. Scripts fetch with
`cache: 'no-store'` so a second tab can't show a stale number.

**Writes are atomic.** `database/connection.py` replaces a table's rows inside
one transaction, because the threaded dev server can read a table on one
request while another request is rewriting it. A reader sees all of the old
rows or all of the new ones.

**Reads can write.** A stale streak is decayed and self-tracking goals are
re-synced when they are read, and asking for the report card files a snapshot
into `metric_snapshots`. So the database changes as the app is used, with no
user action — `data/sql/` does not.

**The theme is server-rendered.** `<html data-theme="...">` is decided from the
`theme` cookie before a byte is sent, so navigation never flashes the wrong
theme. See `middleware/context.py` and `routes/theme.py`.

**Static URLs are stable.** Assets live in top-level folders, not one `static/`
tree; `routes/assets.py` maps `/static/<kind>/...` onto them, so every
`url_for('static', filename='css/...')` keeps working wherever a folder moves.

## What isn't built

`pages/` and `tracking/` carry stubs for features that don't exist yet —
growthtree, achievements, notes, library, history, settings. Each stub says
what belongs in it, and `data/sql/` has their tables, schema only.

See [database.md](database.md) for the stores, [api.md](api.md) for the
endpoints, and [roadmap.md](roadmap.md) for what's next.
