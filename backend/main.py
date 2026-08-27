"""The application factory — where the backend is assembled.

    config/      what things are called and where they live
    database/    the SQLite datastore, and the only code that touches a file
    tracking/    the rules: XP, streaks, focus, calendar events, accounts
    api/         one router per page: the endpoints that page calls
    routes/      the cross-page routes (accounts, theme, the Jinja pages) and
                 the asset mounts
    middleware/  what happens around every request

Nothing here knows anything about a specific page. `routes.register` walks the
router list and attaches each one; adding a page never means editing this file.

Two things below are not obvious:

**The validation handler.** Every endpoint answers `{"success": ...}` with HTTP
200, and every script in frontend/ checks that flag rather than the status code
(see backend/api/reply.py). FastAPI's default answer to a body it cannot parse
is a 422 carrying `detail`, which those scripts would read straight past. The
handler below puts a malformed request back into the shape the client expects.

**Middleware order.** Starlette runs middleware in reverse registration order,
so the one added *last* runs *first*. The account gate reads `request.session`,
so SessionMiddleware has to run before it — which means being added after it.
"""
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from backend import middleware, routes
from backend.api.guard import NotSignedIn
from backend.config import settings


def create_app():
    app = FastAPI(
        title='Ascen',
        description='A gamified productivity tracker: tasks, XP, streaks, '
                    'a calendar, goals and growth analytics.',
        version='1.0.1',
    )

    @app.exception_handler(RequestValidationError)
    async def malformed_request(request, exc):
        """A body FastAPI could not parse, in the shape the client reads."""
        return JSONResponse(
            {"success": False, "message": "Invalid request.",
             "detail": exc.errors()},
            status_code=200)

    @app.exception_handler(NotSignedIn)
    async def not_signed_in(request, exc):
        """A request to an account endpoint with no session behind it.

        Raised by the dependencies in backend/api/guard.py, which every
        endpoint that touches an account's data now depends on. 401 rather than
        the usual 200, because this is the one failure the client acts on
        rather than displays — see the note in guard.py.
        """
        return JSONResponse(
            {"success": False, "message": "Sign in to continue."},
            status_code=401)

    middleware.register(app)

    # Added after the gate so it runs before it — see the note above.
    #
    # `https_only` is what marks the cookie Secure, and it is on unless the
    # environment says otherwise. Without it the browser will send the session
    # over plain HTTP, where anything between the reader and the server can
    # read it and *be* them — the cookie is the whole of the authorization now
    # (backend/api/guard.py), so it is the one thing worth protecting.
    #
    # Development is the exception the flag exists for: a Secure cookie is
    # simply never sent over the http:// dev server, so signing in locally
    # would stop working. run.py sets ASCEN_INSECURE_COOKIES for a local run.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.secret_key(),
        session_cookie=settings.SESSION_COOKIE,
        max_age=settings.SESSION_MAX_AGE,
        same_site='lax',
        https_only=settings.secure_cookies(),
    )

    # The Vite dev server is a separate origin during development and the
    # session cookie has to survive the hop. Nothing is cross-origin once the
    # built frontend is served by this app.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.DEV_ORIGINS,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    routes.register(app)

    return app
