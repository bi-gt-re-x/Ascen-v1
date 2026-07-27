"""The account gate.

Pages that show personal data need an account. Rather than decorating each
view, this runs before every request and checks one list — so GATED_ENDPOINTS
is the whole answer to "what needs an account?", and the page modules stay free
of auth plumbing.

A signed-out visitor is bounced to the home page with the sign-in popup already
open, and `next` carries where they were headed so finishing the flow lands
them there instead of on the home page.
"""
from flask import redirect, request, url_for

from backend.tracking.auth import profile_complete, signed_in_user

GATED_ENDPOINTS = ('dashboard.page', 'calendar.page', 'goals.page', 'growth.page')


def register(app):
    app.before_request(gate_pages)


def gate_pages():
    if request.endpoint not in GATED_ENDPOINTS:
        return None
    user = signed_in_user()
    if not user:
        return redirect(url_for('home.page', auth='login', next=request.path))
    if not profile_complete(user):
        return redirect(url_for('home.page', auth='profile', next=request.path))
    return None
