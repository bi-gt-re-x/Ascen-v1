from flask import Flask, abort, send_from_directory
from jinja2 import ChoiceLoader, FileSystemLoader

import sqlite3

import os

from .auth import auth_bp, gate_pages
from .paths import DATABASE_PATH, TEMPLATE_FOLDER, ROOT_DIR, bp
from .services.automation import automation_bp
from .routes.calendar import dayfocus_bp


# Static assets moved out of the old app/static tree into top-level folders,
# but keep their classic /static/<kind>/... URLs so every
# url_for('static', filename='css/...') in the templates still works.
STATIC_ROOTS = {
    'css': os.path.join(ROOT_DIR, 'styles'),
    'js': os.path.join(ROOT_DIR, 'utilities', 'js'),
    'images': os.path.join(ROOT_DIR, 'images'),
    'icons': os.path.join(ROOT_DIR, 'images', 'icons'),
    # The hidden easter-egg chain (scripts, styles and the /engine page) all
    # lives under frontend/secret and is served at /static/secret/...
    'secret': os.path.join(ROOT_DIR, 'frontend', 'secret'),
}


def create_app():

    app = Flask(__name__, template_folder=TEMPLATE_FOLDER, static_folder=None)

    # Let templates also resolve out of frontend/secret (the hidden /engine page).
    app.jinja_loader = ChoiceLoader([
        app.jinja_loader,
        FileSystemLoader(os.path.join(ROOT_DIR, 'frontend', 'secret')),
    ])

    @app.route('/static/<path:filename>', endpoint='static')
    def static_files(filename):
        kind, _, rest = filename.partition('/')
        root = STATIC_ROOTS.get(kind)
        if not root or not rest:
            abort(404)
        return send_from_directory(root, rest)



    # Secret key for signing the session cookie (used to track who is signed in)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'grind-os-dev-secret-change-me')



    # Configure Flask for proper URL generation

    app.config['SERVER_NAME'] = '127.0.0.1:5000'

    

    # Initialize Database

    init_db(app)

    

    # Register Blueprint

    app.register_blueprint(bp)

    app.register_blueprint(auth_bp)

    # Pages that show personal data need an account: this bounces a signed-out
    # visitor to the home page with the sign-in popup already open.
    app.before_request(gate_pages)

    app.register_blueprint(automation_bp)

    app.register_blueprint(dayfocus_bp)

    

    return app



def init_db(app):

    with app.app_context():

        conn = sqlite3.connect(DATABASE_PATH)

        c = conn.cursor()

        

        # Enable foreign keys

        c.execute("PRAGMA foreign_keys = ON")

        

        # Create Users table

        c.execute('''CREATE TABLE IF NOT EXISTS users

                     (username TEXT PRIMARY KEY, password TEXT)''')

                     

        # Create User Stats table

        c.execute('''CREATE TABLE IF NOT EXISTS user_stats

                     (username TEXT PRIMARY KEY, level INTEGER, xp INTEGER, tasks_completed INTEGER, current_streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0, charge INTEGER DEFAULT 0,

                      FOREIGN KEY(username) REFERENCES users(username))''')

                      

        # Create Tasks table

        c.execute('''CREATE TABLE IF NOT EXISTS tasks

                     (id TEXT PRIMARY KEY, username TEXT, name TEXT, description TEXT, 

                      priority TEXT, xp_reward INTEGER, timer_duration INTEGER,

                      FOREIGN KEY(username) REFERENCES users(username))''')

                      

        # Migrate tasks table to add due_date column if it doesn't exist

        try:

            c.execute("ALTER TABLE tasks ADD COLUMN due_date TEXT")

        except sqlite3.OperationalError:

            pass  # Column already exists

                      

        conn.commit()

        conn.close()