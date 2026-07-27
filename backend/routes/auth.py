"""The account endpoints — everything the sign-in popup and the e-mail link hit.

These are deliberately thin: the rules (hashing, verification, Google, the
session) are in backend/tracking/auth.py. Not a page of its own — the popup
lives on the home page — so it sits here with the other cross-page routes.
"""
import secrets
from datetime import datetime

from flask import (Blueprint, jsonify, redirect, request, session, url_for)

from backend.config.settings import THEME_COOKIE_MAX_AGE
from backend.database import connection as db
from backend.tracking import auth

bp = Blueprint('auth', __name__)


# --------------------------------------------------------------------------
# Sign in / sign out
# --------------------------------------------------------------------------
@bp.route('/api/login', methods=['POST'])
def login():
    """Sign in with a username or an e-mail address.

    Accounts made before the e-mail flow stored their password in the clear;
    those still open, and a successful sign-in quietly replaces the stored
    value with a real hash, so each account upgrades itself the first time it
    is used.
    """
    data = request.json or {}
    identifier = str(data.get('username') or data.get('email') or '').strip()
    password = str(data.get('password') or '')

    users = db.users()
    user = auth.find_user(users, username=identifier, email=identifier)

    if not user or not auth.check_password(user, password):
        return jsonify({"success": False,
                        "message": "Account doesn't exist or invalid credentials."})

    if not auth.is_verified(user):
        return jsonify({"success": False, "unverified": True, "email": user.get('email'),
                        "message": "Confirm your e-mail first — check your inbox."})

    # Upgrade a legacy plaintext password now that we have seen it.
    if user.get('password_hash') == password:
        user['password_hash'] = auth.hash_password(password)
        db.save_users(users)

    payload = auth.sign_in(user)
    resp = jsonify({"success": True, "message": "Login successful!",
                    "user": {"username": user['username'], "id": user.get('id'),
                             "theme": payload['theme']},
                    "profile_complete": auth.profile_complete(user)})
    # Seed the theme cookie from the account so every page this device loads
    # renders in the right theme immediately, even before any JS runs.
    resp.set_cookie('theme', payload['theme'], max_age=THEME_COOKIE_MAX_AGE, samesite='Lax')
    return resp


@bp.route('/api/logout', methods=['POST'])
def logout():
    """Drop the session, and the theme cookie with it."""
    auth.sign_out()
    resp = jsonify({"success": True, "message": "Logged out."})
    resp.delete_cookie('theme')
    return resp


@bp.route('/api/signup', methods=['POST'])
def legacy_signup():
    """The original username + password sign-up, kept for older clients.

    New accounts go through /api/auth/signup, which adds the e-mail
    verification and profile steps.
    """
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required."})

    users = db.users()
    if auth.find_user(users, username=username):
        return jsonify({"success": False, "message": "Account already exists."})

    users.append({
        "id": str(int(datetime.now().timestamp() * 1000)),
        "username": username,
        "password_hash": auth.hash_password(password),
        "xp": 0,
        "level": 1,
        "theme": "light",
        # Recorded so the growth chart's day counter accumulates from the real
        # creation date.
        "created_at": datetime.now().isoformat(),
    })
    db.save_users(users)
    return jsonify({"success": True, "message": "Account created successfully! Please log in."})


# --------------------------------------------------------------------------
# Sign up, verify, complete profile
# --------------------------------------------------------------------------
@bp.route('/api/auth/providers', methods=['GET'])
def providers():
    """What the popup should offer: Google only when it can actually work."""
    return jsonify({'success': True,
                    'google': auth.google_configured(),
                    'mail': auth.mail_configured()})


@bp.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name') or '').strip()
    email = str(data.get('email') or '').strip()
    password = str(data.get('password') or '')

    if not name:
        return jsonify({'success': False, 'field': 'name', 'message': 'Enter your name.'})
    if not auth.EMAIL_RE.match(email):
        return jsonify({'success': False, 'field': 'email',
                        'message': 'Enter a valid e-mail address.'})
    problem = auth.password_problem(password)
    if problem:
        return jsonify({'success': False, 'field': 'password', 'message': problem})

    if auth.find_user(db.users(), email=email):
        return jsonify({'success': False, 'field': 'email',
                        'message': 'An account already uses that e-mail. Log in instead.'})

    user = auth.create_account(name, email, password)
    # Remember who is mid-signup so the verify + profile steps know the account
    # without trusting anything the client sends.
    session['pending_user'] = user['username']

    sent, link = auth.send_verification(user)
    return jsonify({'success': True, 'email': email, 'sent': sent,
                    'dev_link': None if sent else link,
                    'message': 'Check your inbox to confirm {}.'.format(email)})


@bp.route('/api/auth/resend', methods=['POST'])
def resend():
    users = db.users()
    user = auth.find_user(users, username=session.get('pending_user'))
    if not user:
        data = request.get_json(silent=True) or {}
        user = auth.find_user(users, email=str(data.get('email') or '').strip())
    if not user:
        return jsonify({'success': False,
                        'message': 'Start again — we lost track of that sign-up.'})
    if auth.is_verified(user):
        return jsonify({'success': True, 'already': True,
                        'message': 'That e-mail is already confirmed.'})

    auth.new_verify_token(user)
    db.save_users(users)
    sent, link = auth.send_verification(user)
    return jsonify({'success': True, 'sent': sent, 'dev_link': None if sent else link,
                    'message': 'Sent again to {}.'.format(user.get('email'))})


@bp.route('/verify/<token>', methods=['GET'])
def verify_link(token):
    """The link from the e-mail. Confirms, signs in, opens Complete Profile."""
    user = auth.consume_verify_token(token)
    if not user:
        return redirect(url_for('home.page', auth='login', verify='invalid'))
    auth.sign_in(user)
    if auth.profile_complete(user):
        return redirect(url_for('dashboard.page'))
    return redirect(url_for('home.page', auth='profile', verify='ok'))


@bp.route('/api/auth/verify_status', methods=['GET'])
def verify_status():
    """Has the pending account been confirmed yet?

    The inbox screen polls this, so clicking the link in another tab moves this
    one along on its own. Opening the link in THIS browser signs the account
    in, which clears `pending_user` — so fall back to the signed-in account, or
    the poll would keep waiting for something that already happened.
    """
    user = auth.find_user(db.users(),
                          username=session.get('pending_user') or session.get('username'))
    if not user:
        return jsonify({'success': False, 'verified': False})
    verified = auth.is_verified(user)
    if verified:
        auth.sign_in(user)
    return jsonify({'success': True, 'verified': verified,
                    'profile_complete': auth.profile_complete(user)})


@bp.route('/api/auth/complete_profile', methods=['POST'])
def complete_profile():
    """The last step: pick a username, a theme and a daily goal."""
    data = request.get_json(silent=True) or {}
    users = db.users()
    user = auth.find_user(users,
                          username=session.get('username') or session.get('pending_user'))
    if not user:
        return jsonify({'success': False, 'message': 'Sign in again to finish setting up.'})
    if not auth.is_verified(user):
        return jsonify({'success': False, 'message': 'Confirm your e-mail first.'})

    wanted = str(data.get('username') or '').strip()
    if wanted and wanted.lower() != str(user.get('username', '')).lower():
        if not auth.USERNAME_RE.match(wanted):
            return jsonify({'success': False, 'field': 'username',
                            'message': '3-24 characters: letters, numbers, dot, '
                                       'dash or underscore.'})
        if auth.find_user(users, username=wanted):
            return jsonify({'success': False, 'field': 'username',
                            'message': 'That username is taken.'})
        old = user['username']
        user['username'] = wanted
        db.save_users(users)
        auth.rename_user(old, wanted)

    theme = data.get('theme')
    user['theme'] = theme if theme in ('light', 'dark') else 'light'

    try:
        goal = int(data.get('daily_goal', 100))
    except (TypeError, ValueError):
        goal = 100
    user['daily_goal'] = max(10, min(2000, goal))

    user['profile_complete'] = True
    db.save_users(users)

    payload = auth.sign_in(user)
    resp = jsonify({'success': True, 'user': payload, 'message': 'You are all set.'})
    resp.set_cookie('theme', user['theme'], max_age=THEME_COOKIE_MAX_AGE, samesite='Lax')
    return resp


# --------------------------------------------------------------------------
# Google sign-in
# --------------------------------------------------------------------------
@bp.route('/auth/google', methods=['GET'])
def google_start():
    if not auth.google_configured():
        return redirect(url_for('home.page', auth='login', oauth='unconfigured'))
    state = secrets.token_urlsafe(24)
    session['oauth_state'] = state
    session['oauth_next'] = request.args.get('next') or ''
    return redirect(auth.google_consent_url(state))


@bp.route('/auth/google/callback', methods=['GET'])
def google_callback():
    if not auth.google_configured():
        return redirect(url_for('home.page', auth='login', oauth='unconfigured'))
    if request.args.get('state') != session.pop('oauth_state', None):
        return redirect(url_for('home.page', auth='login', oauth='state'))
    code = request.args.get('code')
    if not code:
        return redirect(url_for('home.page', auth='login', oauth='denied'))

    try:
        info = auth.google_profile(code)
    except Exception as exc:                  # noqa: BLE001 - surface as a popup message
        print('[auth] google sign-in failed: {}'.format(exc))
        return redirect(url_for('home.page', auth='login', oauth='failed'))

    email = str(info.get('email') or '').strip()
    if not email or not info.get('email_verified', True):
        return redirect(url_for('home.page', auth='login', oauth='noemail'))

    user = auth.upsert_google_user(info, email)
    auth.sign_in(user)

    nxt = session.pop('oauth_next', '') or ''
    if not auth.profile_complete(user):
        return redirect(url_for('home.page', auth='profile', next=nxt))
    if nxt.startswith('/'):
        return redirect(nxt)
    return redirect(url_for('dashboard.page'))
