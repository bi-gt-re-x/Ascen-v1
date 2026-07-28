"""One module per page.

Each file here owns a page: the route that renders it and the API endpoints
that page calls. The rules live in backend/tracking/ — a page module reads the
request, asks a tracker, and shapes the JSON that goes back.

Modules for pages that don't exist yet (achievements, notes, library, history,
settings, analytics, growthtree) are stubs, so the place each one goes is
already decided.
"""
