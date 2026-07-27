# Changelog

Notable changes, newest first. Dates are the day the work landed on the branch.

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
