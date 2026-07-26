"""Accounts: sign-up, e-mail verification, profile completion and sign-in.

The whole journey the home page's popup walks through lives here:

    Log In ──────────────────────────────┐
                                         │
    Create Account → name / e-mail /     │
    password → verification e-mail →     │
    "check your inbox" → verify ─────────┤
                                         │
                                  Complete Profile
                            (username, theme, daily goal)
                                         │
                                     Dashboard

Two things are deliberately environment-driven, so the app runs with nothing
configured and gains the real thing the moment credentials exist:

  * E-mail. With MAIL_USERNAME + MAIL_PASSWORD set, verification links are sent
    over SMTP (Gmail's server by default — any recipient works: Gmail, Outlook,
    anything). Without them the app is in dev mode: the link is printed to the
    server log and handed back to the popup, so the flow can be walked end to
    end on a laptop with no mail account at all.
  * Google sign-in. With GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set, the
    "Continue with Google" button appears and works. Without them the button
    stays hidden rather than showing a control that cannot work.

Accounts live in data/users.json alongside the ones that already existed. Those
legacy accounts have a plaintext `password_hash` and no e-mail; they keep
working — sign-in accepts a legacy plaintext match and upgrades it to a real
hash on the spot, and an account with no `email_verified` field is treated as
verified so nobody is locked out by this change.
"""

import json
import os
import re
import secrets
import smtplib
import ssl
import urllib.parse
import urllib.request
from datetime import datetime
from email.message import EmailMessage

from flask import (Blueprint, jsonify, redirect, request, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

from .paths import (CALENDAR_JSON, GOALS_JSON, TASKS_JSON, USERS_JSON,
                    XPEVENT_JSON, read_json_file, write_json_file)

auth_bp = Blueprint('auth', __name__)

# scrypt (werkzeug's default) needs a hashlib build that isn't guaranteed here,
# so pin the hash to pbkdf2-sha256, which is available everywhere.
HASH_METHOD = 'pbkdf2:sha256'

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
USERNAME_RE = re.compile(r'^[A-Za-z0-9._-]{3,24}$')

# Pages a signed-out visitor may not open. Each redirects into the popup.
GATED_ENDPOINTS = ('main.dashboard', 'main.calendar', 'main.goals', 'main.growth')


# --------------------------------------------------------------------------
# Users store helpers
# --------------------------------------------------------------------------
def _users():
    return read_json_file(USERS_JSON)


def find_user(users, username=None, email=None):
    """The account matching a username or an e-mail (both case-insensitive)."""
    for u in users:
        if username and str(u.get('username', '')).lower() == str(username).lower():
            return u
        if email and str(u.get('email', '')).lower() == str(email or '').lower() and u.get('email'):
            return u
    return None


def _is_hashed(value):
    return isinstance(value, str) and value.startswith(('pbkdf2:', 'scrypt:', 'argon2', 'sha256$'))


def check_password(user, password):
    """True when `password` opens this account.

    Accounts made before this module stored the password in the clear; those
    still match, and the caller upgrades them to a hash on a successful sign-in.
    """
    stored = user.get('password_hash') or ''
    if not stored:
        return False
    if _is_hashed(stored):
        try:
            return check_password_hash(stored, password)
        except (ValueError, TypeError):
            return False
    return stored == password


def is_verified(user):
    """Legacy accounts (no such field) count as verified — nobody gets locked out."""
    return bool(user.get('email_verified', True))


def profile_complete(user):
    """Same rule: an account that predates the profile step is already complete."""
    return bool(user.get('profile_complete', True))


def unique_username(users, wanted):
    """`wanted`, or the first free `wanted2`, `wanted3`… variant."""
    base = re.sub(r'[^A-Za-z0-9._-]', '', str(wanted or '')).strip('._-') or 'user'
    base = base[:24] or 'user'
    if not find_user(users, username=base):
        return base
    for n in range(2, 1000):
        candidate = '{}{}'.format(base[:22], n)
        if not find_user(users, username=candidate):
            return candidate
    return '{}{}'.format(base[:16], secrets.token_hex(3))


def rename_user(old, new):
    """Rename an account and carry its rows across the other JSON stores.

    Only used while finishing a brand-new account, so there is normally nothing
    to carry — but doing it properly means a username chosen at the last step
    can never orphan data.
    """
    if old == new:
        return
    for path, key in ((TASKS_JSON, 'user_id'), (XPEVENT_JSON, 'user_id'),
                      (GOALS_JSON, 'user_id'), (CALENDAR_JSON, 'user_id')):
        rows = read_json_file(path)
        if not isinstance(rows, list):
            continue
        touched = False
        for row in rows:
            if isinstance(row, dict) and row.get(key) == old:
                row[key] = new
                touched = True
        if touched:
            write_json_file(path, rows)


def public_user(user):
    """The fields the client is allowed to see."""
    return {
        'username': user.get('username'),
        'name': user.get('name') or user.get('username'),
        'email': user.get('email'),
        'theme': user.get('theme') if user.get('theme') in ('light', 'dark') else 'light',
        'daily_goal': user.get('daily_goal'),
        'profile_complete': profile_complete(user),
    }


def sign_in(user):
    """Put the account in the session and hand back its public shape."""
    session['username'] = user['username']
    session.pop('pending_user', None)
    return public_user(user)


# --------------------------------------------------------------------------
# Page gate
# --------------------------------------------------------------------------
def signed_in_user():
    """The signed-in account, or None. Drops a session pointing at a dead account."""
    username = session.get('username')
    if not username:
        return None
    user = find_user(_users(), username=username)
    if not user:
        session.pop('username', None)
        return None
    return user


def gate_pages():
    """Send a signed-out visitor to the home page with the popup open.

    Registered as a before_request hook (rather than a decorator on each view)
    so the page routes stay free of auth plumbing and one list — GATED_ENDPOINTS
    — is the whole answer to "what needs an account?".

    `next` carries where they were headed, so finishing the flow lands them
    there instead of dumping them on the home page.
    """
    if request.endpoint not in GATED_ENDPOINTS:
        return None
    user = signed_in_user()
    if not user:
        return redirect(url_for('main.home', auth='login', next=request.path))
    if not profile_complete(user):
        return redirect(url_for('main.home', auth='profile', next=request.path))
    return None


# --------------------------------------------------------------------------
# E-mail
# --------------------------------------------------------------------------
def mail_configured():
    return bool(os.environ.get('MAIL_USERNAME') and os.environ.get('MAIL_PASSWORD'))


def _base_url():
    configured = os.environ.get('APP_BASE_URL')
    if configured:
        return configured.rstrip('/')
    return request.url_root.rstrip('/')


def _send_mail(to_address, subject, body):
    """Send over SMTP. Returns True when it actually went out."""
    if not mail_configured():
        return False
    host = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    port = int(os.environ.get('MAIL_PORT', '587'))
    username = os.environ['MAIL_USERNAME']
    password = os.environ['MAIL_PASSWORD']
    sender = os.environ.get('MAIL_FROM', username)

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = to_address
    msg.set_content(body)

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
            server.login(username, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls(context=context)
            server.login(username, password)
            server.send_message(msg)
    return True


def send_verification(user):
    """Mail the account its verification link.

    Returns (sent, link). In dev mode `sent` is False and the link is handed
    back so the popup can show it — the flow stays walkable with no mail set up.
    """
    link = '{}/verify/{}'.format(_base_url(), user['verify_token'])
    body = (
        "Hi {},\n\n"
        "Confirm your e-mail to finish setting up your Ascen account:\n\n"
        "{}\n\n"
        "If you didn't create this account you can ignore this message.\n"
    ).format(user.get('name') or user.get('username'), link)
    try:
        sent = _send_mail(user['email'], 'Verify your Ascen account', body)
    except Exception as exc:                      # noqa: BLE001 - report, don't crash signup
        print('[auth] verification e-mail failed: {}'.format(exc))
        sent = False
    if not sent:
        print('[auth] DEV MODE - verification link for {}: {}'.format(user['email'], link))
    return sent, link


# --------------------------------------------------------------------------
# Sign-up / verification / profile
# --------------------------------------------------------------------------
def password_problem(password):
    """None when the password is acceptable, else why it isn't."""
    if not password or len(password) < 8:
        return 'Password must be at least 8 characters.'
    if password.isdigit() or password.isalpha():
        return 'Mix letters with numbers or symbols.'
    return None


@auth_bp.route('/api/auth/providers', methods=['GET'])
def providers():
    """What the popup should offer: Google only when it can actually work."""
    return jsonify({
        'success': True,
        'google': bool(os.environ.get('GOOGLE_CLIENT_ID') and os.environ.get('GOOGLE_CLIENT_SECRET')),
        'mail': mail_configured(),
    })


@auth_bp.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name') or '').strip()
    email = str(data.get('email') or '').strip()
    password = str(data.get('password') or '')

    if not name:
        return jsonify({'success': False, 'field': 'name', 'message': 'Enter your name.'})
    if not EMAIL_RE.match(email):
        return jsonify({'success': False, 'field': 'email', 'message': 'Enter a valid e-mail address.'})
    problem = password_problem(password)
    if problem:
        return jsonify({'success': False, 'field': 'password', 'message': problem})

    users = _users()
    if find_user(users, email=email):
        return jsonify({'success': False, 'field': 'email',
                        'message': 'An account already uses that e-mail. Log in instead.'})

    username = unique_username(users, email.split('@')[0])
    now = datetime.now().isoformat()
    user = {
        'id': str(int(datetime.now().timestamp() * 1000)),
        'username': username,
        'name': name,
        'email': email,
        'password_hash': generate_password_hash(password, method=HASH_METHOD),
        'provider': 'local',
        'email_verified': False,
        'verify_token': secrets.token_urlsafe(32),
        'verify_sent_at': now,
        'profile_complete': False,
        'xp': 0,
        'level': 1,
        'theme': 'light',
        'created_at': now,
    }
    users.append(user)
    write_json_file(USERS_JSON, users)

    # Remember who is mid-signup so the verify + profile steps know the account
    # without trusting anything the client sends.
    session['pending_user'] = username

    sent, link = send_verification(user)
    return jsonify({'success': True, 'email': email, 'sent': sent,
                    'dev_link': None if sent else link,
                    'message': 'Check your inbox to confirm {}.'.format(email)})


@auth_bp.route('/api/auth/resend', methods=['POST'])
def resend():
    users = _users()
    user = find_user(users, username=session.get('pending_user'))
    if not user:
        data = request.get_json(silent=True) or {}
        user = find_user(users, email=str(data.get('email') or '').strip())
    if not user:
        return jsonify({'success': False, 'message': 'Start again — we lost track of that sign-up.'})
    if is_verified(user):
        return jsonify({'success': True, 'already': True, 'message': 'That e-mail is already confirmed.'})

    user['verify_token'] = secrets.token_urlsafe(32)
    user['verify_sent_at'] = datetime.now().isoformat()
    write_json_file(USERS_JSON, users)
    sent, link = send_verification(user)
    return jsonify({'success': True, 'sent': sent, 'dev_link': None if sent else link,
                    'message': 'Sent again to {}.'.format(user.get('email'))})


def _verify_token(token):
    """Mark the account holding `token` verified. Returns the user or None."""
    users = _users()
    user = next((u for u in users if u.get('verify_token') and u.get('verify_token') == token), None)
    if not user:
        return None
    user['email_verified'] = True
    user['verify_token'] = None
    user['verified_at'] = datetime.now().isoformat()
    write_json_file(USERS_JSON, users)
    return user


@auth_bp.route('/verify/<token>', methods=['GET'])
def verify_link(token):
    """The link from the e-mail. Confirms, signs in, opens Complete Profile."""
    user = _verify_token(token)
    if not user:
        return redirect(url_for('main.home', auth='login', verify='invalid'))
    sign_in(user)
    if profile_complete(user):
        return redirect(url_for('main.dashboard'))
    return redirect(url_for('main.home', auth='profile', verify='ok'))


@auth_bp.route('/api/auth/verify_status', methods=['GET'])
def verify_status():
    """Has the pending account been confirmed yet? The inbox screen polls this,
    so clicking the link in another tab moves this one along on its own.

    Opening the link in THIS browser signs the account in, which clears
    `pending_user` — so fall back to the signed-in account, or the poll would
    keep waiting for something that already happened.
    """
    user = find_user(_users(), username=session.get('pending_user') or session.get('username'))
    if not user:
        return jsonify({'success': False, 'verified': False})
    verified = is_verified(user)
    if verified:
        sign_in(user)
    return jsonify({'success': True, 'verified': verified,
                    'profile_complete': profile_complete(user)})


@auth_bp.route('/api/auth/complete_profile', methods=['POST'])
def complete_profile():
    data = request.get_json(silent=True) or {}
    users = _users()
    user = find_user(users, username=session.get('username') or session.get('pending_user'))
    if not user:
        return jsonify({'success': False, 'message': 'Sign in again to finish setting up.'})
    if not is_verified(user):
        return jsonify({'success': False, 'message': 'Confirm your e-mail first.'})

    wanted = str(data.get('username') or '').strip()
    if wanted and wanted.lower() != str(user.get('username', '')).lower():
        if not USERNAME_RE.match(wanted):
            return jsonify({'success': False, 'field': 'username',
                            'message': '3-24 characters: letters, numbers, dot, dash or underscore.'})
        if find_user(users, username=wanted):
            return jsonify({'success': False, 'field': 'username', 'message': 'That username is taken.'})
        old = user['username']
        user['username'] = wanted
        write_json_file(USERS_JSON, users)
        rename_user(old, wanted)

    theme = data.get('theme')
    user['theme'] = theme if theme in ('light', 'dark') else 'light'

    try:
        goal = int(data.get('daily_goal', 100))
    except (TypeError, ValueError):
        goal = 100
    user['daily_goal'] = max(10, min(2000, goal))

    user['profile_complete'] = True
    write_json_file(USERS_JSON, users)

    payload = sign_in(user)
    resp = jsonify({'success': True, 'user': payload, 'message': 'You are all set.'})
    resp.set_cookie('theme', user['theme'], max_age=60 * 60 * 24 * 365, samesite='Lax')
    return resp


# --------------------------------------------------------------------------
# Google sign-in
# --------------------------------------------------------------------------
GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'


def _google_redirect_uri():
    return '{}/auth/google/callback'.format(_base_url())


@auth_bp.route('/auth/google', methods=['GET'])
def google_start():
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    if not client_id:
        return redirect(url_for('main.home', auth='login', oauth='unconfigured'))
    state = secrets.token_urlsafe(24)
    session['oauth_state'] = state
    session['oauth_next'] = request.args.get('next') or ''
    params = {
        'client_id': client_id,
        'redirect_uri': _google_redirect_uri(),
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'access_type': 'online',
        'prompt': 'select_account',
    }
    return redirect('{}?{}'.format(GOOGLE_AUTH_URL, urllib.parse.urlencode(params)))


def _post_form(url, fields):
    body = urllib.parse.urlencode(fields).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode('utf-8'))


def _get_json(url, token):
    req = urllib.request.Request(url)
    req.add_header('Authorization', 'Bearer {}'.format(token))
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode('utf-8'))


@auth_bp.route('/auth/google/callback', methods=['GET'])
def google_callback():
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    if not (client_id and client_secret):
        return redirect(url_for('main.home', auth='login', oauth='unconfigured'))
    if request.args.get('state') != session.pop('oauth_state', None):
        return redirect(url_for('main.home', auth='login', oauth='state'))
    code = request.args.get('code')
    if not code:
        return redirect(url_for('main.home', auth='login', oauth='denied'))

    try:
        token = _post_form(GOOGLE_TOKEN_URL, {
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': _google_redirect_uri(),
            'grant_type': 'authorization_code',
        })
        info = _get_json(GOOGLE_USERINFO_URL, token.get('access_token', ''))
    except Exception as exc:                      # noqa: BLE001 - surface as a popup message
        print('[auth] google sign-in failed: {}'.format(exc))
        return redirect(url_for('main.home', auth='login', oauth='failed'))

    email = str(info.get('email') or '').strip()
    if not email or not info.get('email_verified', True):
        return redirect(url_for('main.home', auth='login', oauth='noemail'))

    users = _users()
    user = find_user(users, email=email)
    if not user:
        now = datetime.now().isoformat()
        user = {
            'id': str(int(datetime.now().timestamp() * 1000)),
            'username': unique_username(users, email.split('@')[0]),
            'name': info.get('name') or email.split('@')[0],
            'email': email,
            'password_hash': '',
            'provider': 'google',
            # Google already proved the address — no second verification e-mail.
            'email_verified': True,
            'profile_complete': False,
            'xp': 0,
            'level': 1,
            'theme': 'light',
            'created_at': now,
        }
        users.append(user)
    else:
        user['email_verified'] = True
    write_json_file(USERS_JSON, users)

    sign_in(user)
    nxt = session.pop('oauth_next', '') or ''
    if not profile_complete(user):
        return redirect(url_for('main.home', auth='profile', next=nxt))
    if nxt.startswith('/'):
        return redirect(nxt)
    return redirect(url_for('main.dashboard'))
