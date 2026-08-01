"""Ascen's backend.

See [main.py](main.py) for how the pieces fit together. `create_app` is the
only thing an entry point needs.
"""
from backend.main import create_app

__all__ = ['create_app']
