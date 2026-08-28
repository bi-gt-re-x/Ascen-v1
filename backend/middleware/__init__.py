"""What happens around every request, whatever page it is for.

Three things, and they are not all the same kind of thing:

  * `gate` is real middleware — it runs before a request reaches a route and
    can answer it with a redirect instead;
  * `limit` is too: it counts failed attempts on the handful of endpoints
    where guessing or spending is the attack, and answers 429 once a caller
    has run out. See LIMITS there for the whole policy;
  * `context` is what a template renders with. Flask injected it globally
    through a context processor; here it is a function the page routes call,
    so it registers nothing.

Ordering note: `gate` reads `request.session`, so SessionMiddleware has to be
installed before it runs. Starlette runs middleware in reverse registration
order, so backend/main.py adds SessionMiddleware *after* this — see the note
there.
"""
from backend.middleware import gate, limit


def register(app):
    gate.register(app)
    # Added after the gate so it runs before it: a signed-out caller hammering
    # /api/login should meet the limiter, and the gate has nothing to say about
    # /api paths anyway. See the ordering note in backend/main.py.
    limit.register(app)
