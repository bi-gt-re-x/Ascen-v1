"""Guessing a password has to get expensive.

/api/login had no limit of any kind: a script could try passwords against an
account as fast as the network allowed, forever, and nothing in the app would
notice. The hashing is real and the session key is no longer guessable, so the
front door was the only way in and it was unlocked.

Three things are worth pinning here, and only the first is about counting:

    1. a budget exists, and running it out answers 429 rather than another
       "invalid credentials" the script can keep hammering;
    2. **only failures count.** A reader who mistypes and then gets it right
       must not be locked out, and a busy session must never be throttled —
       this is the property most likely to be broken by a later edit, because
       it is invisible until somebody hits it;
    3. the window slides, so a caller who waits gets back in.

`test_every_credential_endpoint_is_limited` walks the app's own routes rather
than listing paths, in the spirit of test_guard: an auth endpoint added next
year is covered the day it is written, and exempting one is a deliberate edit
somebody has to justify.
"""
import pytest
from fastapi.testclient import TestClient

from backend.middleware import limit
from tests.conftest import PASSWORD, make_account, sign_in


def wrong(client, username='tester', password='definitely-not-it'):
    return client.post('/api/login',
                       json={'username': username, 'password': password})


# --------------------------------------------------------------------------
# The budget
# --------------------------------------------------------------------------
def test_a_burst_of_wrong_passwords_is_cut_off(app, anon):
    make_account('tester')
    policy = limit.LIMITS['/api/login']

    for attempt in range(policy.limit):
        reply = wrong(anon)
        assert reply.status_code == 200, 'attempt %d' % attempt
        assert reply.json()['success'] is False

    refused = wrong(anon)
    assert refused.status_code == 429
    assert refused.json()['success'] is False
    assert 'Too many sign-in attempts' in refused.json()['message']


def test_the_refusal_says_when_to_come_back(app, anon):
    make_account('tester')
    for _ in range(limit.LIMITS['/api/login'].limit):
        wrong(anon)

    refused = wrong(anon)
    assert refused.status_code == 429
    # A client that wants to back off correctly needs this, and a bare 429
    # tells it nothing.
    assert int(refused.headers['retry-after']) > 0


def test_the_right_password_still_works_inside_the_budget(app, anon):
    make_account('tester')
    for _ in range(limit.LIMITS['/api/login'].limit - 1):
        wrong(anon)

    reply = anon.post('/api/login',
                      json={'username': 'tester', 'password': PASSWORD})
    assert reply.json()['success'] is True


# --------------------------------------------------------------------------
# Only failures count
# --------------------------------------------------------------------------
def test_signing_in_clears_what_came_before(app, anon):
    """Two typos then the real password must not leave a half-spent budget."""
    make_account('tester')
    policy = limit.LIMITS['/api/login']

    for _ in range(policy.limit - 1):
        wrong(anon)
    anon.post('/api/login', json={'username': 'tester', 'password': PASSWORD})

    # The budget is consecutive failures, so this is attempt one of ten again.
    for attempt in range(policy.limit):
        assert wrong(anon).status_code == 200, 'attempt %d' % attempt


def test_a_working_session_is_never_throttled(app):
    """The limiter must not touch ordinary use.

    Signing in successfully many times over is what a person with several
    devices does, and it is indistinguishable from a script only if attempts
    are counted rather than failures.
    """
    make_account('tester')
    for _ in range(limit.LIMITS['/api/login'].limit * 3):
        client = TestClient(app)
        reply = client.post('/api/login',
                            json={'username': 'tester', 'password': PASSWORD})
        assert reply.json()['success'] is True


# --------------------------------------------------------------------------
# The two keys
# --------------------------------------------------------------------------
def test_one_account_cannot_be_locked_out_cheaply(app, anon):
    """Failing against somebody else's username must not lock them out fast.

    The per-account budget is deliberately looser than the per-IP one: a tight
    one turns password guessing into denial of service, where anybody who knows
    your username can keep you out of your own account. See the note in
    backend/middleware/limit.py.
    """
    policy = limit.LIMITS['/api/login']
    assert limit.IDENTITY_MULTIPLIER > 1
    # The per-account budget is the looser number, so exhausting the per-IP one
    # from a single address cannot have exhausted the account's.
    account_budget = policy.limit * limit.IDENTITY_MULTIPLIER
    assert account_budget > policy.limit


def test_the_two_keys_are_separate(app):
    """Different addresses get their own budgets."""
    policy = limit.LIMITS['/api/login']
    one = limit.attempts
    for _ in range(policy.limit):
        one.record('/api/login|ip|10.0.0.1', policy.seconds)

    allowed, _ = one.check('/api/login|ip|10.0.0.1', policy.limit, policy.seconds)
    assert allowed is False
    allowed, _ = one.check('/api/login|ip|10.0.0.2', policy.limit, policy.seconds)
    assert allowed is True


# --------------------------------------------------------------------------
# The window
# --------------------------------------------------------------------------
def test_the_window_slides():
    """A caller who waits gets back in, without the app restarting.

    Time is passed in rather than slept, so this stays a unit test.
    """
    counter = limit.Attempts()
    for tick in range(5):
        counter.record('k', seconds=60, now=1000 + tick)

    assert counter.check('k', limit=5, seconds=60, now=1030)[0] is False
    # The first five all fall out of a 60s window by 1065.
    assert counter.check('k', limit=5, seconds=60, now=1065)[0] is True


def test_a_fixed_window_boundary_cannot_be_used_to_double_up():
    """The reason this is a sliding window and not a counter per minute.

    A fixed window lets a script send the whole budget at the end of one window
    and the whole budget again at the start of the next.
    """
    counter = limit.Attempts()
    for tick in range(5):
        counter.record('k', seconds=60, now=1059 + tick * 0.1)

    # One second later a fixed window would have rolled over and allowed five
    # more. The sliding window still remembers.
    assert counter.check('k', limit=5, seconds=60, now=1061)[0] is False


def test_the_table_stays_bounded(monkeypatch):
    """A stream of unique addresses must not grow the counters without limit."""
    monkeypatch.setattr(limit, 'MAX_TRACKED', 50)
    counter = limit.Attempts()
    for n in range(500):
        counter.record('ip|%d' % n, seconds=60)
    assert len(counter._hits) <= 50


# --------------------------------------------------------------------------
# Coverage: the policy table is the whole answer
# --------------------------------------------------------------------------
#: Endpoints that take a credential or spend something, and are deliberately
#: not limited. Empty on purpose — a new one has to be argued for here.
EXEMPT = set()


def test_every_credential_endpoint_is_limited(app):
    """Every path that accepts a password or sends mail has a policy.

    Walks the app's routes rather than a list, so an endpoint added later is
    covered the day it is written.
    """
    guessable = []
    for route in app.routes:
        path = getattr(route, 'path', '')
        methods = getattr(route, 'methods', set()) or set()
        if 'POST' not in methods:
            continue
        if any(word in path for word in ('login', 'signup', 'resend')):
            guessable.append(path)

    assert guessable, 'no auth endpoints found — has the router moved?'
    missing = [p for p in guessable if p not in limit.LIMITS and p not in EXEMPT]
    assert missing == [], (
        'these accept credentials and have no rate limit: %s' % missing)


def test_the_ai_endpoint_is_limited(app):
    """It spends money at Anthropic on every call. See LIMITS."""
    assert '/api/suggest_milestones' in limit.LIMITS


def test_the_other_ai_endpoint_is_limited(app):
    """Same money, and reached without anybody pressing a button.

    A checkpoint drafts its own checklist as it is created, so this one is
    spent by ordinary use rather than by a button somebody chose to press.
    """
    assert '/api/suggest_steps' in limit.LIMITS


def test_signup_is_limited(app, anon):
    """Account creation is a write a stranger can do. It gets a budget."""
    policy = limit.LIMITS['/api/auth/signup']
    for _ in range(policy.limit):
        anon.post('/api/auth/signup',
                  json={'name': 'x', 'email': 'x@example.test', 'password': 'y'})

    refused = anon.post('/api/auth/signup',
                        json={'name': 'x', 'email': 'x2@example.test', 'password': 'y'})
    assert refused.status_code == 429


# --------------------------------------------------------------------------
# The session cookie
# --------------------------------------------------------------------------
# These live here rather than in a file of their own because they are the same
# question as the rate limit: what does the front door give away?
#
# The suite runs with ASCEN_INSECURE_COOKIES set — TestClient speaks http, and
# a Secure cookie is never sent over it, so every signed-in test would break
# (see the note in conftest). That makes the *default* the thing worth pinning,
# because it is the one posture the rest of the suite cannot exercise: these
# two build an app with the flag cleared and read the header directly.
def _login_headers(monkeypatch, insecure):
    from backend.main import create_app

    if insecure is None:
        monkeypatch.delenv('ASCEN_INSECURE_COOKIES', raising=False)
    else:
        monkeypatch.setenv('ASCEN_INSECURE_COOKIES', insecure)

    make_account('tester')
    client = TestClient(create_app())
    reply = client.post('/api/login',
                        json={'username': 'tester', 'password': PASSWORD})
    assert reply.json()['success'] is True
    # Starlette writes the attributes lower-case (`secure`, `httponly`), so
    # everything below compares in one case rather than guessing which.
    return [v.lower() for k, v in reply.headers.multi_items()
            if k.lower() == 'set-cookie']


def test_the_session_cookie_is_secure_by_default(fresh_db, monkeypatch):
    """Unset the dev flag and the session cookie must come back Secure.

    Without it the browser sends the session over plain HTTP, where anything
    on the path can read it and be the account — and the cookie is the whole
    of the authorization now (backend/api/guard.py).
    """
    cookies = _login_headers(monkeypatch, None)
    session = [c for c in cookies if c.startswith('session=')]
    assert session, 'no session cookie was set: %s' % cookies
    assert 'secure' in session[0]
    # HttpOnly and SameSite are the other two halves and are worth failing on
    # together — a cookie readable from JavaScript is one an XSS can steal, and
    # one sent on cross-site requests is a CSRF away from being used.
    assert 'httponly' in session[0]
    assert 'samesite=lax' in session[0]


def test_the_dev_flag_is_the_only_way_to_turn_that_off(fresh_db, monkeypatch):
    """And it has to actually work, or local development is impossible."""
    cookies = _login_headers(monkeypatch, '1')
    session = [c for c in cookies if c.startswith('session=')]
    assert session
    assert 'secure' not in session[0]
