"""One module per page's API.

Each file here owns the endpoints a page calls, and carries the request bodies
those endpoints accept at the top of the module — so a route and the shape it
expects are read together, and adding a page is still writing one file.

The rules live in backend/tracking/. A module here reads the request, asks a
tracker, and shapes the JSON that goes back; it holds no rules of its own.

This is what backend/pages/ was under Flask. The page *routes* moved out — the
Jinja pages are served by backend/routes/pages.py, and once the React frontend
replaces them the only thing left here is the API, which is the point.

Modules for pages that don't exist yet (achievements, notes, library, history,
settings, analytics, growthtree) are stubs, so the place each one goes is
already decided. `ROUTERS` in backend/routes/__init__.py is the list that
matters.
"""
