"""Entry point.

The app is assembled in [backend/app.py](backend/app.py) and started by
[backend/run.py](backend/run.py); this file just makes `python run.py` work
from the repo root and gives run_mac.py an `app` to import.
"""
from backend.run import app, main   # noqa: F401 - `app` is imported by run_mac.py

if __name__ == '__main__':
    main()
