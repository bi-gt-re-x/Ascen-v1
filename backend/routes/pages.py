"""The pages themselves — the Jinja templates in frontend/html/.

These are the routes that were one-per-file in backend/pages/ under Flask. They
are collected here because there is nothing left in them: a page route renders
a template and nothing else, and the API each page calls now lives in
backend/api/. That is also why they are worth keeping in one place — this file
is the whole list of what still renders server-side, and it shrinks to nothing
as the React frontend takes each page over.

Two shims let the existing templates render unchanged:

  * `url_for` — the templates ask for pages by Flask endpoint name
    (`url_for('goals.page')`) and for assets by filename
    (`url_for('static', filename='css/navbar.css')`). ENDPOINTS below is that
    mapping, and it doubles as the routing table for this file.
  * `request.path` — provided by backend/middleware/context.py.

Nothing here decides who may see a page. That is the account gate, in
backend/middleware/gate.py.
"""
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from starlette.responses import RedirectResponse

from backend.config.settings import SECRET_FOLDER, TEMPLATE_FOLDER
from backend.middleware import context
from backend.routes.assets import static_url
from backend.tracking.auth import signed_in_user

router = APIRouter(include_in_schema=False)

# Templates resolve out of frontend/html/ first and frontend/secret/
# second — the hidden /engine page lives outside the normal tree.
templates = Jinja2Templates(directory=[TEMPLATE_FOLDER, SECRET_FOLDER])

# Flask endpoint name -> the path it lived at. The templates link by these
# names, so this is what keeps every href in them correct.
ENDPOINTS = {
    'home.page': '/home',
    'dashboard.page': '/dashboard',
    'calendar.page': '/calendar',
    'goals.page': '/goals',
    'growth.page': '/growth',
    'analytics.page': '/analytics',
    'aboutus.page': '/about-us',
    'aboutus.careers': '/careers',
    'aboutus.contact_support': '/contact-support',
    'privacypolicy.page': '/privacy-policy',
    'termsofservice.page': '/terms-of-service',
}


def url_for(endpoint, **values):
    """What `url_for` means inside a template.

    `url_for('static', filename='css/x.css')` resolves against the asset
    mounts; anything else is a page, looked up in ENDPOINTS. An unknown name
    returns '#' rather than raising, so a typo in a template is a dead link
    and not a 500 on every page that includes the top bar.
    """
    if endpoint == 'static':
        return static_url(values.get('filename', ''))
    return ENDPOINTS.get(endpoint, '#')


templates.env.globals['url_for'] = url_for


def page(path):
    """Register a page: GET, and the HEAD some clients send ahead of it.

    FastAPI registers exactly the method asked for, where Flask answered HEAD
    on any GET route for free. Link checkers and health probes send HEAD, and a
    405 there reads like the page is broken.
    """
    return router.api_route(path, methods=['GET', 'HEAD'])


def render(request, template):
    """Render a template with the context every page gets."""
    return templates.TemplateResponse(template, context.for_request(request))


# --------------------------------------------------------------------------
# The pages
# --------------------------------------------------------------------------
@page('/')
def index(request: Request):
    """The front door: signed in goes to the dashboard, everyone else lands."""
    if signed_in_user(request):
        return RedirectResponse('/dashboard', status_code=303)
    return render(request, 'homepage.html')


@page('/home')
def home(request: Request):
    """The home page, and the host of the sign-in popup (?auth=login|profile)."""
    return render(request, 'homepage.html')


@page('/dashboard')
def dashboard(request: Request):
    return render(request, 'dashboard.html')


@page('/calendar')
def calendar(request: Request):
    return render(request, 'calendar.html')


@page('/goals')
def goals(request: Request):
    return render(request, 'goals.html')


@page('/growth')
def growth(request: Request):
    return render(request, 'growth.html')


@page('/analytics')
def analytics(request: Request):
    """The graded report card.

    Was the second half of the growth page, toggled into view by a script.
    It is a page of its own now, which is why growth.html no longer carries a
    hidden copy of it."""
    return render(request, 'analytics.html')


# /about-us, /privacy-policy and /terms-of-service used to be here. React has
# them now — see backend/routes/spa.py, which is the list of what has moved.
# The templates they rendered are still in frontend/html/ as the reference the
# port was made against; nothing serves them.


@page('/careers')
def careers(request: Request):
    return render(request, 'careers.html')


@page('/contact-support')
def contact_support(request: Request):
    return render(request, 'contact-support.html')


@page('/engine')
def engine(request: Request):
    """The hidden ENGINE room. engine.js gates it client-side: without today's
    unlock it bounces back to the home page."""
    return render(request, 'engine.html')
