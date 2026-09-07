"""Entry point.

    .venv-fastapi/bin/python run.py        # http://127.0.0.1:5050

The app is assembled in [backend/main.py](backend/main.py) and started by
[backend/run.py](backend/run.py); this file just makes `python run.py` work
from the repo root.
"""
# This file *is* the development server, so it fills in the flags that say so —
# before importing backend.run, which builds the app at import and reads them
# while it does. See `dev_defaults` in backend/config/settings.py for why a
# deployment must not get them.
from backend.config import settings                      # noqa: E402

settings.dev_defaults()

from backend.run import app, main   # noqa: E402,F401 - `app` is the ASGI entry point

if __name__ == '__main__':
    main()
