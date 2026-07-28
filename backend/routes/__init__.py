"""The routing table: every blueprint the app serves, in one list.

Page blueprints come from backend/pages/ (one per page). The two here are the
routes that don't belong to a single page — the account endpoints and the theme
switch — plus the static-asset route, which is registered on the app directly
because it owns the reserved `static` endpoint name.

Adding a page: write backend/pages/<name>.py with a `bp`, then add it to
PAGE_MODULES. Nothing else needs to know.
"""
from importlib import import_module

from backend.routes import assets

# Imported by name so this list reads as the map of the app.
PAGE_MODULES = (
    'homepage',
    'dashboard',
    'tasks',
    'calendar',
    'goals',
    'growth',
    'focus',
    'aboutus',
    'privacypolicy',
    'termsofservice',
)

SHARED_MODULES = (
    'backend.routes.auth',
    'backend.routes.theme',
)


def register(app):
    """Attach every blueprint and the static route to `app`."""
    for name in PAGE_MODULES:
        module = import_module('backend.pages.{}'.format(name))
        app.register_blueprint(module.bp)

    for path in SHARED_MODULES:
        app.register_blueprint(import_module(path).bp)

    assets.register(app)
