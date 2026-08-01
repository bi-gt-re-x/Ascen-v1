"""The light/dark theme switch.

Every page renders <html data-theme="..."> server-side, so the theme is in the
very first bytes of the response and navigation never flashes or reverts. That
needs the answer before any JS runs, which is what the cookie set here is for —
the account's stored theme is the durable copy, the cookie is the one read on
every request. See backend/middleware/context.py for the read side.
"""
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.config.settings import THEME_COOKIE_MAX_AGE
from backend.database import connection as db
from backend.tracking.auth import load_user

router = APIRouter(tags=['theme'])


class SetTheme(BaseModel):
    theme: Optional[str] = None


@router.post('/api/set_theme')
def set_theme(request: Request, body: SetTheme):
    if body.theme not in ('light', 'dark'):
        return fail("Theme must be 'light' or 'dark'.", status=400)

    persisted = False
    users, user = load_user(request.session.get('username'))
    if user:
        user['theme'] = body.theme
        db.save_users(users)
        persisted = True

    response = JSONResponse(ok(persisted=persisted))
    response.set_cookie('theme', body.theme,
                        max_age=THEME_COOKIE_MAX_AGE, samesite='lax')
    return response
