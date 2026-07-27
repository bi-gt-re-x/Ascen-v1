"""About Us, and the two company pages that sit beside it in the footer."""
from flask import Blueprint, render_template

bp = Blueprint('aboutus', __name__)


@bp.route('/about-us')
def page():
    return render_template('Misc HTML/about_us.html')


@bp.route('/careers')
def careers():
    return render_template('Misc HTML/careers.html')


@bp.route('/contact-support')
def contact_support():
    return render_template('Misc HTML/contact_support.html')
