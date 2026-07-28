"""Where everything lives and what it's called.

Nothing in the backend hard-codes a path or a key: modules import them from
here, so moving a folder or changing a cookie lifetime is a one-line edit.

Values that may come from the environment (secret key, mail, port) are read
when `apply()` runs rather than at import time, so `load_dotenv()` in the entry
point still gets the first word.
"""
import os

# backend/config/settings.py -> backend/ -> repo root
CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CONFIG_DIR)
ROOT_DIR = os.path.dirname(BACKEND_DIR)

# --- Frontend ------------------------------------------------------------
TEMPLATE_FOLDER = os.path.join(ROOT_DIR, 'frontend', 'templates')
# The hidden easter-egg chain (scripts, styles and the /engine page) lives
# outside the normal template tree and is served at /static/secret/...
SECRET_FOLDER = os.path.join(ROOT_DIR, 'frontend', 'secret')

# Static assets sit in top-level folders rather than one static/ tree, but keep
# their classic /static/<kind>/... URLs so every url_for('static', ...) in the
# templates still resolves. See backend/routes/assets.py.
STATIC_ROOTS = {
    'css': os.path.join(ROOT_DIR, 'styles'),
    'js': os.path.join(ROOT_DIR, 'frontend', 'js'),
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
    'achievements', 'history', 'library', 'notes', 'settings',
]

# --- Behaviour -----------------------------------------------------------
# A year: the theme cookie only has to outlive the session.
THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

# XP needed for level N is N * 100.
LEVEL_XP_STEP = 100

DEFAULT_PORT = 5000
DEFAULT_SERVER_NAME = '127.0.0.1:5000'


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


def apply(app):
    """Push the Flask-level settings onto an app instance."""
    # Signs the session cookie, which is how we know who is signed in.
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'grind-os-dev-secret-change-me')
    # Needed for url_for outside a request context. run_mac.py overrides it
    # because macOS gives port 5000 to AirPlay.
    app.config['SERVER_NAME'] = os.environ.get('SERVER_NAME', DEFAULT_SERVER_NAME)
