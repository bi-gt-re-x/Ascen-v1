"""Run the app.

    python backend/run.py          # or: python run.py, which imports this

Reads .env first so mail and Google credentials are in the environment before
anything looks for them, then builds the app. PORT overrides the port; macOS
gives 5000 to AirPlay, which is what run_mac.py is for.
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

from backend.app import create_app                        # noqa: E402

app = create_app()


def main():
    """Serve the app on PORT (default 5000)."""
    port = int(os.environ.get('PORT', settings.DEFAULT_PORT))
    app.config['SERVER_NAME'] = '127.0.0.1:{}'.format(port)
    app.run(debug=True, port=port)


if __name__ == '__main__':
    main()
