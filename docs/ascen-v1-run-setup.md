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

`run_mac.py` (committed) wraps run.py: overrides `SERVER_NAME` to the run port. Needed because `backend/config/settings.py` defaults `SERVER_NAME` to `127.0.0.1:5000`, but **port 5000 is occupied by macOS ControlCenter (AirPlay Receiver)** — so the app runs on **port 5050**. Honors `PORT` env var.

**`.venv-mac/` and `.claude/launch.json` are gitignored/local-only — recreate on a fresh checkout:**
```
cd /Users/myles/Ascen-v1
python3 -m venv .venv-mac && .venv-mac/bin/python -m pip install flask requests
```
`.claude/launch.json` has the `grindos-mac` config (`.venv-mac/bin/python run_mac.py`, port 5050) for preview_start `{name: "grindos-mac"}`. Opens at http://localhost:5050 → landing route `/` ("Study Dashboard").

Direct background run (reliable — debug reloader can misbehave detached):
```
PORT=5050 .venv-mac/bin/python -c "from run import app; app.config['SERVER_NAME']='127.0.0.1:5050'; app.run(host='127.0.0.1', port=5050, use_reloader=False)"
```

Gotcha: a stale instance from an old session may already hold port 5050 (`lsof -ti :5050 | xargs kill`). The old committed `.venv/` was a **Windows** venv — gone/ignored now.

See [[ascen-v1-overview]] for architecture.
