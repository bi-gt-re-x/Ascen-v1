"""The account gate.

Pages that show personal data need an account. Rather than decorating each
view, this runs before every request and checks one list — so GATED_PATHS is
the whole answer to "what needs an account?", and the page routes stay free of
auth plumbing.

A signed-out visitor is bounced to the home page with the sign-in popup already
open, and `next` carries where they were headed so finishing the flow lands
them there instead of on the home page.

The Flask version matched on endpoint name; this one matches on path, which
says the same thing about the same four pages and keeps working when those
pages are served by the React router instead of by Jinja.
"""
from urllib.parse import urlencode

from starlette.responses import RedirectResponse

from backend.tracking.auth import profile_complete, signed_in_user

GATED_PATHS = ('/dashboard', '/calendar', '/goals', '/growth', '/analytics')


def register(app):
    app.middleware('http')(gate_pages)


def _to_home(reason, path):
    return RedirectResponse(
        '/home?{}'.format(urlencode({'auth': reason, 'next': path})),
        status_code=303)


async def gate_pages(request, call_next):
    path = request.url.path
    if path in GATED_PATHS:
        user = signed_in_user(request)
        if not user:
            return _to_home('login', path)
        if not profile_complete(user):
            return _to_home('profile', path)
    return await call_next(request)
