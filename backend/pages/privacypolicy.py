"""The privacy policy."""
from flask import Blueprint, render_template

bp = Blueprint('privacypolicy', __name__)


@bp.route('/privacy-policy')
def page():
    return render_template('Misc HTML/privacy_policy.html')
