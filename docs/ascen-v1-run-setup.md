---
name: ascen-v1-run-setup
description: How to run the Ascen Flask app locally on this macOS machine
metadata: 
  node_type: memory
  type: project
  originSessionId: b914a0dc-6f30-4713-b9c4-697e858ed39b
  modified: 2026-07-22T15:40:41.859Z
---

**As of 2026-07-22 the project lives at the repo root `/Users/myles/Ascen-v1`** — the old `Ascen v1/` subdir was flattened away (see [[ascen-v1-file-tree]]). Run everything from the repo root.

**As of the FastAPI rewrite there is no `run_mac.py`.** It existed only because Flask baked `SERVER_NAME` in at `127.0.0.1:5000`, and **port 5000 is occupied by macOS ControlCenter (AirPlay Receiver)**. FastAPI has no such setting, so `backend/config/settings.py` simply defaults to **port 5050** and `python run.py` is the whole story. `PORT` still overrides it.

**`.venv-fastapi/`, `node_modules/` and `.claude/launch.json` are gitignored/local-only — recreate on a fresh checkout:**
```
python3 -m venv .venv-fastapi
.venv-fastapi/bin/python -m pip install -r requirements.txt
npm install
```
Two servers, both from the repo root:
```
.venv-fastapi/bin/python run.py     # API + the original pages, :5050
npm run dev                         # the React app, :5173 (proxies to :5050)
```
`.claude/launch.json` has `ascen-api` and `ascen-web` for preview_start. The old Flask venv `.venv-mac/` is dead weight now.

Direct background run (no reloader):
```
PORT=5050 .venv-fastapi/bin/python -c "import sys; sys.path.insert(0,'.'); from backend.config import settings; settings.load_dotenv(); from backend.main import create_app; import uvicorn; uvicorn.run(create_app(), host='127.0.0.1', port=5050)"
```

Point it at a throwaway database with `ASCEN_DB=/path/to/copy.db` — worth doing for anything that writes, since reads write too (streak decay, goal sync, report-card snapshots).

Gotcha: a stale instance from an old session may already hold port 5050 (`lsof -ti :5050 | xargs kill`).

See [[ascen-v1-overview]] for architecture.
