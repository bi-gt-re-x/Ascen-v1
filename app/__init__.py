from flask import Flask

import sqlite3

import os

from .paths import DATABASE_PATH, TEMPLATE_FOLDER, STATIC_FOLDER, bp
from .services.automation import automation_bp
from .routes.calendar import dayfocus_bp



def create_app():

    app = Flask(__name__, template_folder=TEMPLATE_FOLDER, static_folder=STATIC_FOLDER)



    # Secret key for signing the session cookie (used to track who is signed in)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'grind-os-dev-secret-change-me')



    # Configure Flask for proper URL generation

    app.config['SERVER_NAME'] = '127.0.0.1:5000'

    

    # Initialize Database

    init_db(app)

    

    # Register Blueprint

    app.register_blueprint(bp)

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