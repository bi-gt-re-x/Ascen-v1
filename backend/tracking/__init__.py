"""What the app keeps track of.

One module per tracked thing. These hold the rules — how XP becomes a level,
when a streak breaks, what a calendar event looks like — and never touch HTTP.
The page blueprints in backend/pages/ call into here.
"""
