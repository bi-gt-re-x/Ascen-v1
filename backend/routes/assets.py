"""Static assets.

The CSS, JS, icons and images live in top-level folders rather than one
static/ tree, so this route maps the classic /static/<kind>/... URL onto the
right folder — which is why every url_for('static', filename='css/...') in the
templates still resolves. The map itself is STATIC_ROOTS in config/settings.py.
"""
from flask import abort, send_from_directory

from backend.config.settings import STATIC_ROOTS


def register(app):
    @app.route('/static/<path:filename>', endpoint='static')
    def static_files(filename):
        kind, _, rest = filename.partition('/')
        root = STATIC_ROOTS.get(kind)
        if not root or not rest:
            abort(404)
        return send_from_directory(root, rest)
