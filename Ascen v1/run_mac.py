"""macOS local-run wrapper.

Port 5000 is occupied by macOS ControlCenter (AirPlay Receiver), and the app
hardcodes SERVER_NAME = 127.0.0.1:5000 in app/init.py. This wrapper reuses the
same app object but points SERVER_NAME at an open port so it runs locally on a
Mac without editing the originals. The real entry point is still run.py.
"""
import os

from run import app

PORT = int(os.environ.get("PORT", 5050))
app.config["SERVER_NAME"] = f"127.0.0.1:{PORT}"

if __name__ == "__main__":
    app.run(debug=True, port=PORT)
