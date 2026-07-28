"""Ascen's backend.

See [app.py](app.py) for how the pieces fit together. `create_app` is the only
thing an entry point needs.
"""
from backend.app import create_app

__all__ = ['create_app']
