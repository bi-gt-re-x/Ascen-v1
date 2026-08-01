"""Static assets.

The CSS, JS, icons and images live in top-level folders rather than one
static/ tree, so each one is mounted under the classic /static/<kind>/... URL —
which is why every `url_for('static', filename='css/...')` already in the
templates still resolves. The map itself is STATIC_ROOTS in config/settings.py.

One mount per kind rather than a single handler that joins a path: Starlette's
StaticFiles refuses to serve anything outside the directory it was given, so a
request for `/static/css/../../../.env` is answered with a 404 instead of the
file. The Flask version leaned on send_from_directory for the same guarantee.
"""
import os

from starlette.responses import Response
from starlette.staticfiles import StaticFiles

from backend.config.settings import STATIC_ROOTS

# Assets that are edited in place and served under a stable URL. There is no
# content hash in `/static/css/calendar/week.css`, so the URL cannot tell a
# browser that the file behind it changed.
REVALIDATE = ('css', 'js', 'secret')


class Assets(StaticFiles):
    """StaticFiles that tells the browser to check before reusing a file.

    Starlette sends `etag` and `last-modified` and **no `Cache-Control`**, and
    that combination is a trap for a file served under a stable URL. With no
    explicit freshness a browser is free to invent one — the common heuristic
    is a tenth of the file's age — so a stylesheet that had not been touched in
    a week could be reused for hours without ever asking the server. Editing
    the CSS then changed nothing on screen, and no amount of reloading helped,
    because the browser never made a request to reload.

    `no-cache` does not mean "do not store"; it means "store it, but
    revalidate before each use". The ETag above makes that revalidation a 304
    with an empty body, so the cost is one conditional request and the file
    still comes off disk. Correctness where it matters, and nearly all of the
    saving.

    Images, icons and fonts keep the default: they are replaced by adding a new
    file, not by editing one in place, so a stale copy is not a hazard.
    """

    def file_response(self, *args, **kwargs) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers.setdefault('Cache-Control', 'no-cache')
        return response


def register(app):
    for kind, root in STATIC_ROOTS.items():
        # check_dir=False so a folder that is empty today (fonts, assets)
        # doesn't stop the app from starting.
        cls = Assets if kind in REVALIDATE else StaticFiles
        app.mount('/static/{}'.format(kind),
                  cls(directory=root, check_dir=False),
                  name='static-{}'.format(kind))


def static_url(filename):
    """The URL for an asset, the way the templates ask for it.

    Templates call `url_for('static', filename='css/navbar.css')`; under FastAPI
    there is no such endpoint, so backend/routes/pages.py passes this in as
    `url_for` and the templates go on working unchanged.
    """
    return '/static/{}'.format(str(filename).lstrip('/'))


def has_static(kind, rest):
    """Whether an asset actually exists — used only by the 404 page."""
    root = STATIC_ROOTS.get(kind)
    if not root:
        return False
    return os.path.isfile(os.path.join(root, rest))
