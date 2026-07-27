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
# data/ is laid out for the PostgreSQL move that hasn't happened yet:
#
#   data/postgresql/   the table definitions, one .sql per table. Nothing runs
#                      them — they are the target schema, kept beside the data
#                      they describe so the two can't drift.
#   data/backups/      the JSON stores. Still the live datastore: every read and
#                      write in the app goes here, until Postgres is wired up.
DATA_DIR = os.path.join(ROOT_DIR, 'data')
POSTGRES_DIR = os.path.join(DATA_DIR, 'postgresql')
STORE_DIR = os.path.join(DATA_DIR, 'backups')

USERS_JSON = os.path.join(STORE_DIR, 'users.json')
TASKS_JSON = os.path.join(STORE_DIR, 'tasks.json')
CALENDAR_JSON = os.path.join(STORE_DIR, 'calendar.json')
GOALS_JSON = os.path.join(STORE_DIR, 'goals.json')
XPEVENT_JSON = os.path.join(STORE_DIR, 'xpevents.json')
# Every hex colour already handed to a calendar event, so a new event can be
# given one that is visibly different from the rest.
EVENTCOLORS_JSON = os.path.join(STORE_DIR, 'eventcolors.json')

DATABASE_DIR = os.path.join(BACKEND_DIR, 'database')
SCHEMA_SQL = os.path.join(DATABASE_DIR, 'schema.sql')
SEED_SQL = os.path.join(DATABASE_DIR, 'seed.sql')
MIGRATIONS_DIR = os.path.join(DATABASE_DIR, 'migrations')

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
