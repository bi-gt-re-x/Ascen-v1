"""The headers a browser needs in order to defend the page it was given.

None of these change what the app does. They change what a *browser* will let
somebody else do to it, which is why they belong here rather than on any one
route: a header that is set on most responses is not set at all, because an
attack picks the response that missed.

## What each one is for

**Content-Security-Policy** says where scripts, styles, images and fonts may
come from, and the browser refuses everything else.

Be clear about what this one does and does not buy, because `script-src`
carries `'unsafe-inline'` and that is the directive XSS actually cares about.
It is there because the app has inline scripts that cannot simply be deleted:
the theme boot in `frontend/index.html`, which sets `data-theme` from the
cookie before the first paint precisely so it can run *before* anything else,
and the account sync in the Jinja head, which is templated
(`{{ current_user|tojson }}`) and so has no fixed hash to allow. Allowing them
by hash needs the templated one rewritten; allowing them by nonce needs a
per-request value threaded through both the static file and the templates.
Either is worth doing and neither is this change.

So what is left is still worth having, and it is the half that needs no
refactor: nothing may be framed, no plugins, no `<base>` rewrite, no form
posted off-origin, and — the one that limits what a successful injection can
*do* — `connect-src 'self'`, so a stolen session cannot be sent anywhere.
Tightening `script-src` to a nonce is the next step, and until it happens this
policy should be read as defence in depth rather than as XSS protection.

The Google Fonts hosts are named because the pages use them: the stylesheet
comes from `fonts.googleapis.com` and the files it points at from
`fonts.gstatic.com`. A policy that omitted them would render the whole app in
a fallback face, which is how a CSP gets turned off rather than fixed.

**frame-ancestors 'none'** stops the app being framed, which is clickjacking:
an invisible copy of the page over somebody else's buttons, so a click meant
for "Play" lands on "Delete my account" — a real control on the settings page.
`X-Frame-Options` says the same thing for browsers that predate CSP.

**X-Content-Type-Options: nosniff** stops a browser second-guessing a
Content-Type. Without it a `.json` export or an uploaded-looking path served as
text can be sniffed as HTML and run as a page on this origin.

**Referrer-Policy** keeps the path out of the `Referer` on cross-origin
requests. The paths here carry no ids, but `/verify/<token>` does, and a
verification link opened in a browser that then loads any third-party resource
would otherwise hand that token to whoever it loaded.

**Permissions-Policy** turns off the device APIs this app has no use for. It
costs nothing and it means an injected script cannot ask for the camera.

**Strict-Transport-Security** tells the browser to refuse plain HTTP to this
host for a year, which is what makes the Secure cookie flag hard to strip. It
is sent **only over HTTPS**, and that condition is not cosmetic: sent over
plain HTTP it would be ignored by a correct browser, and pinning it from a
development server on localhost would make http://localhost unreachable in
that browser for a year — for every project on it, not just this one.
"""
from backend.config import settings

#: Sent on every response.
#:
#: `img-src data:` is there for the inline SVG and canvas work in the analytics
#: pages, which encode images rather than fetching them. The two Google hosts
#: and both `'unsafe-inline'`s are explained in the note above — the styles one
#: is permanent (React writes inline `style=`), the scripts one is a debt.
CSP = "; ".join((
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
))

STATIC = {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

#: A year, and the value browsers want before they will preload a host.
HSTS = 'max-age=31536000; includeSubDomains'


def register(app):
    app.middleware('http')(security_headers)


def _is_https(request):
    """Whether the browser reached this over TLS.

    `request.url.scheme` is what this process was spoken to in, which behind a
    proxy is http even when the browser used https — so the forwarded scheme is
    read too, and only when the deployment says there is a proxy in front. That
    is the same claim `client_ip` needs in backend/middleware/limit.py, and the
    same flag answers it: believing `X-Forwarded-Proto` from anywhere would let
    a caller turn HSTS on for a host that cannot serve it.
    """
    if request.url.scheme == 'https':
        return True
    if settings.trust_proxy():
        return request.headers.get('x-forwarded-proto', '').split(',')[0].strip() == 'https'
    return False


async def security_headers(request, call_next):
    response = await call_next(request)
    for name, value in STATIC.items():
        # setdefault rather than assignment: a route that has deliberately said
        # something stricter about itself keeps what it said.
        response.headers.setdefault(name, value)
    if _is_https(request):
        response.headers.setdefault('Strict-Transport-Security', HSTS)
    return response
