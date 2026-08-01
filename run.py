"""Entry point.

    .venv-fastapi/bin/python run.py        # http://127.0.0.1:5050

The app is assembled in [backend/main.py](backend/main.py) and started by
[backend/run.py](backend/run.py); this file just makes `python run.py` work
from the repo root.
"""
from backend.run import app, main   # noqa: F401 - `app` is the ASGI entry point

if __name__ == '__main__':
    main()
