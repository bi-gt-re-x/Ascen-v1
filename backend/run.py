"""Run the app.

    python backend/run.py          # or: python run.py, which imports this

Reads .env first so mail and Google credentials are in the environment before
anything looks for them, then builds the app. PORT overrides the port; macOS
gives 5000 to AirPlay, which is why the default here is 5050.
"""
import os
import sys

# Running this file directly puts backend/ on sys.path, not the repo root —
# add the root so `import backend...` resolves either way.
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.config import settings                       # noqa: E402

settings.load_dotenv()

from backend.main import create_app                       # noqa: E402

app = create_app()


def main():
    """Serve the app on PORT, for development.

    Passed as an import string rather than the app object so uvicorn's reloader
    can rebuild it in the worker process — handing it a live object disables
    reload with a warning.

    ## Why the cookie flag is set here and not at import

    The session cookie is marked Secure by default (see `secure_cookies` in
    config/settings.py), and a Secure cookie is never sent over http:// — so
    signing in against this server, which serves plain HTTP on localhost,
    would silently stop working.

    Turning that off belongs to *this function* rather than to the module,
    because this function is the development server and nothing else calls it:
    it binds 127.0.0.1 and enables the reloader. Anything deployed points a
    real server at `backend.run:app`, which imports the module and never gets
    here, so it keeps the secure default. Putting the flag at module scope
    would have handed the insecure default to every deployment that imported
    the app — the opposite of what it is for.

    An explicit ASCEN_INSECURE_COOKIES in the environment still wins, so this
    only fills in a default.
    """
    import uvicorn

    os.environ.setdefault('ASCEN_INSECURE_COOKIES', '1')

    uvicorn.run('backend.run:app',
                host='127.0.0.1',
                port=int(os.environ.get('PORT', settings.DEFAULT_PORT)),
                reload=True,
                reload_dirs=[os.path.join(ROOT_DIR, 'backend')])


if __name__ == '__main__':
    main()
