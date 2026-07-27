"""The terms of service."""
from flask import Blueprint, render_template

bp = Blueprint('termsofservice', __name__)


@bp.route('/terms-of-service')
def page():
    return render_template('Misc HTML/terms_of_service.html')
