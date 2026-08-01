"""The routing table: everything the app serves, in one list.

API routers come from backend/api/ (one per page). The three here are the
routes that don't belong to a single page — the account endpoints, the theme
switch and the Jinja pages — plus the static-asset mounts.

Adding a page's API: write backend/api/<name>.py with a `router`, then add it
to API_MODULES. Nothing else needs to know.

Order matters in one place: the asset mounts go on last, so a route defined
above always wins over a file that happens to sit at the same path.
"""
from importlib import import_module

from backend.routes import assets

# Imported by name so this list reads as the map of the app. The stubs in
# backend/api/ (achievements, notes, library, history, settings, analytics,
# growthtree) are deliberately absent — they carry no router yet.
API_MODULES = (
    'dashboard',
    'tasks',
    'calendar',
    'goals',
    'growth',
    'focus',
)

SHARED_MODULES = (
    'backend.routes.auth',
    'backend.routes.theme',
    'backend.routes.pages',
)


def register(app):
    """Attach every router and the asset mounts to `app`."""
    for name in API_MODULES:
        app.include_router(import_module('backend.api.{}'.format(name)).router)

    for path in SHARED_MODULES:
        app.include_router(import_module(path).router)

    assets.register(app)
