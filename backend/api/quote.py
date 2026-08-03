"""The dashboard's daily quote.

This endpoint exists so the key does not have to be in the browser. The old
frontend called api-ninjas.com directly from api.js with

    headers: {'X-Api-Key': 'rwDm3Irql9...'}

written into the file, which put a live credential into every page's source,
into the repository, and into git history. Anything the browser can send, a
reader can copy. Proxying the call through here means the key is read from the
environment on the server and never leaves it.

Three sources, tried in order, so the page always has a line to print:

  1. **API Ninjas**, when ``QUOTES_API_KEY`` is set — the source the original
     used, with the same success/wisdom categories.
  2. **ZenQuotes**, which needs no key at all. This is what makes the feature
     work on a clean checkout with an empty .env, which is the rule the rest of
     the app follows (see the note on optional credentials in README.md).
  3. A **built-in** line, when both are unreachable. Chosen by the date rather
     than at random, so an offline day still shows one steady quote instead of
     a different one on every reload.

The result is cached for the day it belongs to. It is a *daily* quote — the
same all day is the intended behaviour, not a shortcut — and it also keeps the
app inside ZenQuotes' free rate limit no matter how many times the dashboard is
opened.

Nothing about the account reaches either upstream: the request carries no
username, no token and no headers beyond the API key, so who asked for the
quote is not something a third party learns.
"""
import json
import os
import urllib.error
import urllib.request
from datetime import date

from fastapi import APIRouter

from backend.api.reply import ok

router = APIRouter(tags=['quote'])

# Long enough for a slow-but-working upstream, short enough that a dead one
# does not hold the connection open. The dashboard renders its fallback line
# immediately and swaps this in when it lands, so nothing waits on it.
TIMEOUT_SECONDS = 4

NINJAS_URL = 'https://api.api-ninjas.com/v2/randomquotes?categories=success,wisdom'
ZEN_URL = 'https://zenquotes.io/api/today'

# urllib introduces itself as "Python-urllib/3.x", which a fair number of
# public APIs refuse or tarpit. Saying who is actually calling is both politer
# and more reliable.
USER_AGENT = 'Ascen/1.0 (+https://github.com/ascen; daily quote)'

# Used when every upstream is unreachable. Kept short deliberately: this is a
# fallback, not a quote library.
BUILT_IN = (
    ('The secret of getting ahead is getting started.', 'Mark Twain'),
    ('It does not matter how slowly you go as long as you do not stop.', 'Confucius'),
    ('Well begun is half done.', 'Aristotle'),
    ('Discipline is the bridge between goals and accomplishment.', 'Jim Rohn'),
    ('We are what we repeatedly do. Excellence, then, is a habit.', 'Will Durant'),
    ('The way to get started is to quit talking and begin doing.', 'Walt Disney'),
    ('Little by little, one travels far.', 'J. R. R. Tolkien'),
)

# {'day': '2026-08-02', 'payload': {...}} — one day's answer, in memory.
# Process-local on purpose: it is a cache, not a record, and losing it on a
# restart costs one request to an upstream that is free.
_cache = {}


def _fetch_json(url, headers=None):
    """GET `url` and parse the JSON, or return None if anything at all fails.

    Every failure is the same failure to a caller — no key, no network, a 500
    upstream, a body that is not JSON — because the answer in each case is to
    try the next source.
    """
    request = urllib.request.Request(
        url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json', **(headers or {})}
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError):
        return None


def _from_ninjas():
    """API Ninjas: `[{"quote": "...", "author": "..."}]`. Needs a key."""
    key = os.environ.get('QUOTES_API_KEY')
    if not key:
        return None

    data = _fetch_json(NINJAS_URL, {'X-Api-Key': key})
    if not isinstance(data, list) or not data:
        return None

    first = data[0] or {}
    text = (first.get('quote') or '').strip()
    author = (first.get('author') or '').strip()
    return {'quote': text, 'author': author or 'Unknown', 'source': 'api-ninjas'} if text else None


def _from_zenquotes():
    """ZenQuotes: `[{"q": "...", "a": "..."}]` from its quote-of-the-day route."""
    data = _fetch_json(ZEN_URL)
    if not isinstance(data, list) or not data:
        return None

    first = data[0] or {}
    text = (first.get('q') or '').strip()
    author = (first.get('a') or '').strip()
    # The free tier answers a rate-limited caller with a 200 and this sentence
    # in the quote field, so it has to be read as a failure rather than printed.
    if not text or 'Too many requests' in text:
        return None
    return {'quote': text, 'author': author or 'Unknown', 'source': 'zenquotes'}


def _built_in(today):
    """One of the local lines, picked by the date so it holds for the day."""
    text, author = BUILT_IN[today.toordinal() % len(BUILT_IN)]
    return {'quote': text, 'author': author, 'source': 'built-in'}


@router.get('/api/daily_quote')
def daily_quote():
    """Today's quote. Always succeeds — the fallback guarantees a line."""
    today = date.today()
    day = today.isoformat()

    if _cache.get('day') == day:
        return ok(**_cache['payload'])

    payload = _from_ninjas() or _from_zenquotes() or _built_in(today)

    # Only a real answer is worth keeping for the day. Caching the fallback
    # would mean one bad minute at midnight costs the quote until tomorrow.
    if payload['source'] != 'built-in':
        _cache['day'] = day
        _cache['payload'] = payload

    return ok(**payload)
