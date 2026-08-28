"""The account endpoints — everything the sign-in popup and the e-mail link hit.

These are deliberately thin: the rules (hashing, verification, Google, the
session) are in backend/tracking/auth.py. Not a page of its own — the popup
lives on the home page — so it sits here with the other cross-page routes.

The session is a signed cookie managed by Starlette's SessionMiddleware, so
every endpoint that reads or writes it takes the `Request` and hands it to the
tracker. The theme cookie is set on the response the same way Flask did it, so
a page still renders in the right theme before any JS runs.
"""
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.config.settings import THEME_COOKIE_MAX_AGE
from backend.database import connection as db
from backend.tracking import auth, avatar

router = APIRouter(tags=['auth'])


class Login(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class LegacySignup(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


class Signup(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class Resend(BaseModel):
    email: Optional[str] = None


class CompleteProfile(BaseModel):
    username: Optional[str] = None
    theme: Optional[str] = None
    daily_goal: Optional[object] = 100


class Avatar(BaseModel):
    avatar: Optional[str] = None


def _with_theme(body, theme):
    """A JSON response that also seeds the theme cookie.

    Set on login and on finishing the profile so every page this device loads
    renders in the right theme immediately, even before any JS runs.
    """
    response = JSONResponse(body)
    response.set_cookie('theme', theme, max_age=THEME_COOKIE_MAX_AGE, samesite='lax')
    return response


def _home(**params):
    """Redirect to the home page, carrying the popup's state in the query."""
    query = '&'.join('{}={}'.format(k, v) for k, v in params.items() if v != '')
    return RedirectResponse('/home?{}'.format(query) if query else '/home',
                            status_code=303)


# --------------------------------------------------------------------------
# Sign in / sign out
# --------------------------------------------------------------------------
@router.post('/api/login')
def login(request: Request, body: Login):
    """Sign in with a username or an e-mail address.

    Accounts made before the e-mail flow stored their password in the clear;
    those still open, and a successful sign-in quietly replaces the stored
    value with a real hash, so each account upgrades itself the first time it
    is used.
    """
    identifier = str(body.username or body.email or '').strip()
    password = str(body.password or '')

    users = db.users()
    user = auth.find_user(users, username=identifier, email=identifier)

    if not user or not auth.check_password(user, password):
        return fail("Account doesn't exist or invalid credentials.")

    if not auth.is_verified(user):
        return fail('Confirm your e-mail first — check your inbox.',
                    unverified=True, email=user.get('email'))

    # Upgrade a legacy plaintext password now that we have seen it.
    if user.get('password_hash') == password:
        user['password_hash'] = auth.hash_password(password)
        db.save_user(user)

    payload = auth.sign_in(request, user)
    return _with_theme(ok(
        message='Login successful!',
        user={"username": user['username'], "id": user.get('id'),
              "theme": payload['theme']},
        profile_complete=auth.profile_complete(user),
    ), payload['theme'])


@router.post('/api/logout')
def logout(request: Request):
    """Drop the session, and the theme cookie with it."""
    auth.sign_out(request)
    response = JSONResponse(ok(message='Logged out.'))
    response.delete_cookie('theme')
    return response


@router.post('/api/avatar')
def set_avatar(request: Request, body: Avatar):
    """Pick the account's profile picture, from the menu under the avatar."""
    user = auth.signed_in_user(request)
    if not user:
        return fail('Sign in first.', status=401)

    name = str(body.avatar or '')
    if not avatar.choose_avatar(user['username'], name):
        return fail('Unknown picture.', status=400)

    return ok(avatar='/static/' + avatar.avatar_path(name))


@router.post('/api/signup')
def legacy_signup(body: LegacySignup):
    """The original username + password sign-up, kept for older clients.

    New accounts go through /api/auth/signup, which adds the e-mail
    verification and profile steps.
    """
    if not body.username or not body.password:
        return fail('Username and password are required.')

    users = db.users()
    if auth.find_user(users, username=body.username):
        return fail('Account already exists.')

    db.insert_row('users', {
        "id": db.new_id('users'),
        "username": body.username,
        "password_hash": auth.hash_password(body.password),
        "xp": 0,
        "level": 1,
        "theme": "light",
        # Recorded so the growth chart's day counter accumulates from the real
        # creation date.
        "created_at": datetime.now().isoformat(),
    })
    return ok(message='Account created successfully! Please log in.')


# --------------------------------------------------------------------------
# Sign up, verify, complete profile
# --------------------------------------------------------------------------
@router.get('/api/auth/providers')
def providers():
    """What the popup should offer: Google only when it can actually work."""
    return ok(google=auth.google_configured(), mail=auth.mail_configured())


@router.post('/api/auth/signup')
def signup(request: Request, body: Signup):
    name = str(body.name or '').strip()
    email = str(body.email or '').strip()
    password = str(body.password or '')

    if not name:
        return fail('Enter your name.', field='name')
    if not auth.EMAIL_RE.match(email):
        return fail('Enter a valid e-mail address.', field='email')
    problem = auth.password_problem(password)
    if problem:
        return fail(problem, field='password')

    if auth.find_user(db.users(), email=email):
        return fail('An account already uses that e-mail. Log in instead.',
                    field='email')

    user = auth.create_account(name, email, password)
    # Remember who is mid-signup so the verify + profile steps know the account
    # without trusting anything the client sends.
    request.session['pending_user'] = user['username']

    sent, link = auth.send_verification(user, request)
    return ok(email=email, sent=sent,
              dev_link=None if sent else link,
              message='Check your inbox to confirm {}.'.format(email))


@router.post('/api/auth/resend')
def resend(request: Request, body: Resend):
    users = db.users()
    user = auth.find_user(users, username=request.session.get('pending_user'))
    if not user:
        user = auth.find_user(users, email=str(body.email or '').strip())
    if not user:
        return fail('Start again — we lost track of that sign-up.')
    if auth.is_verified(user):
        return ok(already=True, message='That e-mail is already confirmed.')

    auth.new_verify_token(user)
    db.save_user(user)
    sent, link = auth.send_verification(user, request)
    return ok(sent=sent, dev_link=None if sent else link,
              message='Sent again to {}.'.format(user.get('email')))


@router.get('/verify/{token}')
def verify_link(request: Request, token: str):
    """The link from the e-mail. Confirms, signs in, opens Complete Profile."""
    user = auth.consume_verify_token(token)
    if not user:
        return _home(auth='login', verify='invalid')
    auth.sign_in(request, user)
    if auth.profile_complete(user):
        # The front door rather than the dashboard: '/' is the route that reads
        # the account's chosen start page. See FrontDoor in frontend/src/App.tsx.
        return RedirectResponse('/', status_code=303)
    return _home(auth='profile', verify='ok')


@router.get('/api/auth/verify_status')
def verify_status(request: Request):
    """Has the pending account been confirmed yet?

    The inbox screen polls this, so clicking the link in another tab moves this
    one along on its own. Opening the link in THIS browser signs the account
    in, which clears `pending_user` — so fall back to the signed-in account, or
    the poll would keep waiting for something that already happened.

    It also answers "who is signed in", which is what the React app asks it on
    every load. A server-rendered page got `current_user` in its template; a
    single-page app has no such moment, and the session cookie is deliberately
    opaque to the client — so without the username here, an account whose
    localStorage was cleared would be signed in and unable to say as whom.
    `username` is additive: the older popup reads only the two flags.
    """
    user = auth.find_user(db.users(),
                          username=request.session.get('pending_user')
                          or request.session.get('username'))
    if not user:
        return {"success": False, "verified": False}
    verified = auth.is_verified(user)
    if verified:
        auth.sign_in(request, user)
    return ok(verified=verified,
              profile_complete=auth.profile_complete(user),
              username=user.get('username'),
              avatar='/static/' + avatar.avatar_path(avatar.avatar_for(user)))


@router.post('/api/auth/complete_profile')
def complete_profile(request: Request, body: CompleteProfile):
    """The last step: pick a username, a theme and a daily goal."""
    users = db.users()
    user = auth.find_user(users,
                          username=request.session.get('username')
                          or request.session.get('pending_user'))
    if not user:
        return fail('Sign in again to finish setting up.')
    if not auth.is_verified(user):
        return fail('Confirm your e-mail first.')

    wanted = str(body.username or '').strip()
    if wanted and wanted.lower() != str(user.get('username', '')).lower():
        if not auth.USERNAME_RE.match(wanted):
            return fail('3-24 characters: letters, numbers, dot, '
                        'dash or underscore.', field='username')
        if auth.find_user(users, username=wanted):
            return fail('That username is taken.', field='username')
        old = user['username']
        user['username'] = wanted
        # The one save that still rewrites the table, and it has to. Every
        # owned table has a foreign key onto users.username, and SQLite will
        # not let an UPDATE move a parent key out from under its children —
        # `write_table` switches foreign keys off for exactly this. The rename
        # then carries the children across. Once per account, at sign-up.
        db.save_users(users)
        auth.rename_user(old, wanted)

    user['theme'] = body.theme if body.theme in ('light', 'dark') else 'light'

    try:
        goal = int(body.daily_goal)
    except (TypeError, ValueError):
        goal = 100
    user['daily_goal'] = max(10, min(2000, goal))

    user['profile_complete'] = True
    db.save_user(user)

    payload = auth.sign_in(request, user)
    return _with_theme(ok(user=payload, message='You are all set.'), user['theme'])


# --------------------------------------------------------------------------
# Google sign-in
# --------------------------------------------------------------------------
@router.get('/auth/google')
def google_start(request: Request, next: str = ''):
    if not auth.google_configured():
        return _home(auth='login', oauth='unconfigured')
    state = secrets.token_urlsafe(24)
    request.session['oauth_state'] = state
    request.session['oauth_next'] = next or ''
    return RedirectResponse(auth.google_consent_url(state, request), status_code=303)


@router.get('/auth/google/callback')
def google_callback(request: Request, state: str = '', code: str = ''):
    if not auth.google_configured():
        return _home(auth='login', oauth='unconfigured')
    if state != request.session.pop('oauth_state', None):
        return _home(auth='login', oauth='state')
    if not code:
        return _home(auth='login', oauth='denied')

    try:
        info = auth.google_profile(code, request)
    except Exception as exc:              # noqa: BLE001 - surface as a popup message
        print('[auth] google sign-in failed: {}'.format(exc))
        return _home(auth='login', oauth='failed')

    email = str(info.get('email') or '').strip()
    if not email or not info.get('email_verified', True):
        return _home(auth='login', oauth='noemail')

    user = auth.upsert_google_user(info, email)
    auth.sign_in(request, user)

    nxt = request.session.pop('oauth_next', '') or ''
    if not auth.profile_complete(user):
        return _home(auth='profile', next=nxt)
    if nxt.startswith('/'):
        return RedirectResponse(nxt, status_code=303)
    # As above: the front door decides where an account opens.
    return RedirectResponse('/', status_code=303)
