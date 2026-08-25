"""Where everything lives and what it's called.

Nothing in the backend hard-codes a path or a key: modules import them from
here, so moving a folder or changing a cookie lifetime is a one-line edit.

Values that may come from the environment (secret key, mail, port) are read
through a function rather than at import time, so `load_dotenv()` in the entry
point still gets the first word.
"""
import os
import secrets

# backend/config/settings.py -> backend/ -> repo root
CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CONFIG_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)

# --- Frontend ------------------------------------------------------------
FRONTEND_DIR = os.path.join(ROOT_DIR, 'frontend')
SRC_DIR = os.path.join(FRONTEND_DIR, 'src')

# The built React app — `npm run build` writes it. This app serves it for the
# pages React has taken over (backend/routes/spa.py), so one origin answers
# for the whole site and there is no second port to know about. It is a build
# output and git-ignored, so the folder may not exist; spa.py says so plainly
# rather than 404ing when it doesn't.
DIST_DIR = os.path.join(FRONTEND_DIR, 'dist')

# The original server-rendered pages. They still render and still work while
# the React app in frontend/src/ takes them over one at a time — see
# backend/routes/pages.py.
TEMPLATE_FOLDER = os.path.join(FRONTEND_DIR, 'html')

# The hidden easter-egg chain (scripts, styles and the /engine page) lives
# outside the normal template tree and is served at /static/secret/...
SECRET_FOLDER = os.path.join(FRONTEND_DIR, 'secret')

# Static assets sit in folders of their own rather than one static/ tree, but
# keep their classic /static/<kind>/... URLs so every url_for('static', ...) in
# the old pages still resolves. See backend/routes/assets.py.
#
# `css` points into the React app's styles/ because the stylesheets moved there
# whole — the old pages and the new components render from the same CSS, which
# is what stops the two frontends drifting apart while both are live.
STATIC_ROOTS = {
    'css': os.path.join(SRC_DIR, 'styles'),
    'js': os.path.join(FRONTEND_DIR, 'js'),
    'images': os.path.join(ROOT_DIR, 'utils', 'images'),
    'icons': os.path.join(ROOT_DIR, 'utils', 'icons'),
    'fonts': os.path.join(ROOT_DIR, 'utils', 'fonts'),
    'assets': os.path.join(ROOT_DIR, 'utils', 'assets'),
    'secret': SECRET_FOLDER,
}

# --- Datastore -----------------------------------------------------------
#   data/ascen.db      the live database. Everything the app reads and writes
#                      is in here; it is git-ignored, because it changes every
#                      time the app runs.
#   data/sql/          the schema and the seed: one .sql per part of the app,
#                      each holding its tables' definitions followed by the
#                      rows to start from. Executed once, when the database
#                      does not exist yet.
#   data/backups/      the JSON stores this replaced, kept as a backup of the
#                      last JSON-era state. Nothing reads or writes them.
DATA_DIR = os.path.join(ROOT_DIR, 'data')
SQL_DIR = os.path.join(DATA_DIR, 'sql')
BACKUP_DIR = os.path.join(DATA_DIR, 'backups')
DB_PATH = os.environ.get('ASCEN_DB') or os.path.join(DATA_DIR, 'ascen.db')

# The order data/sql/*.sql is executed in when building the database. It is
# spelled out rather than sorted because a table has to exist before another
# one can reference it: users first, then everything that hangs off a user.
SCHEMA_FILES = [
    'users', 'tasks', 'goals', 'growth', 'focus', 'events', 'analytics',
    'achievements', 'history', 'library', 'notes', 'settings', 'subjects',
    'records',
]

# --- Behaviour -----------------------------------------------------------
# A year: the theme cookie only has to outlive the session.
THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

# XP needed for level N is N * 100.
LEVEL_XP_STEP = 100

# macOS gives port 5000 to ControlCenter (AirPlay Receiver), so the app has
# always actually run on 5050. Under Flask that took a wrapper (run_mac.py)
# because SERVER_NAME was baked in at 5000; FastAPI needs no such setting, so
# the real port is simply the default now and the wrapper is gone.
DEFAULT_PORT = 5050

# The signed cookie the session lives in. Named the same as Flask's default so
# a browser holding the old one is signed out cleanly rather than confused by
# two cookies claiming the same thing.
SESSION_COOKIE = 'session'
SESSION_MAX_AGE = 60 * 60 * 24 * 14

# Where the React dev server runs. The API and the Vite dev server are separate
# origins during development, and the session cookie has to survive the hop —
# so these are allowed with credentials. In production the built frontend is
# served by this app and nothing is cross-origin.
DEV_ORIGINS = [
    'http://localhost:5090',
    'http://127.0.0.1:5090',
]


#: Where a generated development key is kept. Git-ignored with the database
#: beside it, and never the same on two machines.
SESSION_KEY_PATH = os.path.join(DATA_DIR, '.session_key')


def secret_key():
    """What the session cookie is signed with.

    Read on each call rather than at import, so `load_dotenv()` in the entry
    point still gets the first word. Changing it signs everyone out.

    ## There is no default, and there cannot be one

    This used to fall back to a literal — `'grind-os-dev-secret-change-me'` —
    which meant that an install where SECRET_KEY was never set signed its
    session cookies with a value printed in the repository. Anyone who had read
    the source could mint a session for any account. That was survivable while
    the API took `username` as a parameter and checked nothing, because the
    cookie was not protecting anything; now that the session *is* the whole of
    the authorization (backend/api/guard.py), a guessable key is the account.

    So: the environment wins if it says anything, and otherwise a random key is
    generated once and kept in a git-ignored file beside the database. The
    fallback is still a fallback — it keeps `python run.py` working in a fresh
    clone with no setup, which is the reason the literal existed — but it is
    not a value anybody else can know.

    **Set SECRET_KEY explicitly for anything deployed.** A file-backed key is
    per-machine, so two instances behind a load balancer would each sign with
    their own and reject each other's cookies, and a container rebuild signs
    everybody out.
    """
    from_env = os.environ.get('SECRET_KEY', '').strip()
    if from_env:
        return from_env
    return _generated_key()


def _generated_key():
    """The development key: read it, or make one and keep it.

    Written 0600 and read back on every call rather than cached, for the same
    reason `secret_key` is not read at import: the environment may still be
    about to answer, and a cached value would outlive a `.env` that appeared.
    """
    try:
        with open(SESSION_KEY_PATH) as handle:
            existing = handle.read().strip()
        if existing:
            return existing
    except OSError:
        pass

    key = secrets.token_urlsafe(48)
    try:
        if not os.path.isdir(DATA_DIR):
            os.makedirs(DATA_DIR)
        # Opened with O_EXCL so two workers starting together cannot both write
        # a key and disagree about which one is signing.
        handle = os.open(SESSION_KEY_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(handle, 'w') as out:
            out.write(key)
        return key
    except FileExistsError:
        with open(SESSION_KEY_PATH) as handle:
            return handle.read().strip() or key
    except OSError:
        # A read-only filesystem. Better an in-memory key that signs everyone
        # out on restart than a shared literal that never signs anyone out.
        return key


def load_dotenv(path=None):
    """Read KEY=value lines from a .env file into the environment.

    Mail and Google sign-in credentials live there rather than in the code, so
    the repo never carries a secret. Anything already set in the real
    environment wins, and a missing file is fine — the app runs without either
    (verification links print to the console; the Google button stays hidden).
    """
    path = path or os.path.join(ROOT_DIR, '.env')
    if not os.path.exists(path):
        return
    with open(path, 'r') as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
