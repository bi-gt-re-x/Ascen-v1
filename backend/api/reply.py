"""The shape every endpoint answers in.

Every response carries a `success` boolean, and a failure is
`{"success": false, "message": "..."}` sent with HTTP **200**. That is not an
accident and it is not FastAPI's default: every script in frontend/ checks the
flag rather than the status code, so an endpoint that started returning 4xx on
a bad request would break the client silently — the fetch would resolve, the
`.success` check would pass over an error body, and the page would render
nothing with no error in the console.

`ok()` and `fail()` are the only two ways to build a response, so the contract
holds by construction. Where the old Flask code returned a status alongside the
body (the two avatar failures), `status` carries it.

backend/main.py installs a matching handler for FastAPI's own validation
errors, so even a malformed body comes back in this shape rather than as a 422
with FastAPI's `detail` envelope.
"""
from fastapi.responses import JSONResponse


def ok(**fields):
    """A successful response, plus whatever the endpoint wants to say."""
    return {"success": True, **fields}


def fail(message, status=200, **fields):
    """A failed response. HTTP 200 unless the caller insists otherwise."""
    body = {"success": False, "message": message, **fields}
    if status == 200:
        return body
    return JSONResponse(body, status_code=status)
