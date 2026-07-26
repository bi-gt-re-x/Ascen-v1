import os

from flask import session, redirect, url_for, render_template


def load_dotenv(path='.env'):
    """Read KEY=value lines from a .env file into the environment.

    Mail and Google sign-in credentials live there rather than in the code, so
    the repo never carries a secret. Anything already set in the real
    environment wins, and a missing file is fine — the app runs without either
    (verification links print to the console; the Google button stays hidden).
    """
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


load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

from backend import create_app                                    # noqa: E402
from backend.paths import USERS_JSON, read_json_file              # noqa: E402

app = create_app()


@app.route('/')
def index():
    """Landing route.

    If an account is signed in (tracked via the server-side session) and that
    account still exists in the backend data, send them straight to the
    dashboard. Otherwise, show the home page.
    """
    username = session.get('username')
    if username:
        # Pull the account data from the backend to confirm it's still valid.
        users = read_json_file(USERS_JSON)
        if any(u.get('username') == username for u in users):
            return redirect(url_for('main.dashboard'))
        # Stale/removed account: drop the session and fall through to home.
        session.pop('username', None)
    return render_template('mainpage.html')


if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
    