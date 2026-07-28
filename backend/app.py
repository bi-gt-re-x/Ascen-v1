"""The application factory — where the backend is assembled.

    config/      what things are called and where they live
    database/    the JSON datastore, and the only code that touches a file
    tracking/    the rules: XP, streaks, focus, calendar events, accounts
    pages/       one blueprint per page: its route and its API
    routes/      the cross-page routes (accounts, theme) and the asset route
    middleware/  what happens around every request

Nothing here knows anything about a specific page. `routes.register` walks the
page list and attaches each blueprint; adding a page never means editing this
file.
"""
from flask import Flask
from jinja2 import ChoiceLoader, FileSystemLoader

from backend import middleware, routes
from backend.config import settings


def create_app():
    app = Flask(__name__,
                template_folder=settings.TEMPLATE_FOLDER,
                # No default static folder: assets live in top-level folders
                # and are served by backend/routes/assets.py.
                static_folder=None)

    # Templates also resolve out of frontend/secret (the hidden /engine page).
    app.jinja_loader = ChoiceLoader([
        app.jinja_loader,
        FileSystemLoader(settings.SECRET_FOLDER),
    ])

    settings.apply(app)
    middleware.register(app)
    routes.register(app)

    return app
