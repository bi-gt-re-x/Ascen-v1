import os

from flask import session, redirect, url_for, render_template

from app.init import create_app
from app.paths import USERS_JSON, read_json_file

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
    