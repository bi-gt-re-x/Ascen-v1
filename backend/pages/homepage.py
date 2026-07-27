"""The home page — the landing route and the sign-in popup's host.

`/` is the front door: a signed-in visitor is sent to their dashboard, everyone
else gets the marketing page (which is also where the auth popup opens, driven
by ?auth=login / ?auth=profile).

`/engine` is the hidden ENGINE room. engine.js gates it client-side: without
today's unlock it bounces back here.
"""
from flask import Blueprint, redirect, render_template, url_for

from backend.tracking.auth import signed_in_user

bp = Blueprint('home', __name__)


@bp.route('/')
def index():
    if signed_in_user():
        return redirect(url_for('dashboard.page'))
    return render_template('mainpage.html')


@bp.route('/home')
def page():
    return render_template('mainpage.html')


@bp.route('/engine')
def engine():
    return render_template('engine.html')
