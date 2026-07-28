"""What happens around every request, whatever page it is for."""
from backend.middleware import context, gate


def register(app):
    gate.register(app)
    context.register(app)
