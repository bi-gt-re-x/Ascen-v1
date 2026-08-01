"""What happens around every request, whatever page it is for.

Two things, and they are no longer the same kind of thing:

  * `gate` is real middleware — it runs before a request reaches a route and
    can answer it with a redirect instead;
  * `context` is what a template renders with. Flask injected it globally
    through a context processor; here it is a function the page routes call,
    so it registers nothing.

Ordering note: `gate` reads `request.session`, so SessionMiddleware has to be
installed before it runs. Starlette runs middleware in reverse registration
order, so backend/main.py adds SessionMiddleware *after* this — see the note
there.
"""
from backend.middleware import gate


def register(app):
    gate.register(app)
