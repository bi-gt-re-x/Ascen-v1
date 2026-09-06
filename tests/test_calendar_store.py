"""The calendar document — the thing that had never been on the server.

Until `/api/calendar_store` existed, every event any user of this app had ever
made lived in their own browser's localStorage and nowhere else: the month,
week and day views never called the backend, so the database held seven default
rows and no user event at all. These tests are about the properties that make
moving it safe rather than about the endpoint's surface.

The shape is deliberately not validated by the endpoint. It is the client's own
store — start and end times, subtasks, XP, a colour family, two legacy colour
spellings, unpadded `YYYY-M-D` day keys — and every field in it is there
because some version of the calendar wrote it. An endpoint that dropped what it
had not been told about is precisely the failure this one exists to prevent, so
`test_keeps_a_shape_the_server_knows_nothing_about` is the important one here.
"""
from backend.database import connection as db


# A day key in the store's own unpadded spelling, holding an event with every
# field the client has ever written onto one.
CALENDAR = {
    '2026-7-4': {
        'focus': 'ship the migration',
        'timestamps': [
            {
                'startTime': '09:00',
                'endTime': '10:30',
                'task': 'Write the store',
                'recurrence': 'weekly',
                'recurrenceDays': [1, 3, 5],
                'xp': 25,
                'family': 'sky',
                'color': '#3e6b98',
                'colorIndex': 4,
                'hasSubtasks': True,
                'subtasks': [{'text': 'schema', 'xp': 5, 'completed': True}, 'endpoints'],
                'completed': False,
            },
        ],
    },
}


def test_starts_empty_which_means_never_uploaded(client):
    """An account that predates the endpoint gets `{}`.

    The client reads that as "the browser's copy is the only copy" and migrates
    it up. Reading it as "this calendar is empty" would delete one.
    """
    reply = client.get('/api/calendar_store').json()
    assert reply['success']
    assert reply['data'] == {}


def test_round_trips_through_the_database(client):
    assert client.put('/api/calendar_store', json={'data': CALENDAR}).json()['success']

    # Asserted on the database, not the reply: a handler that answers
    # {"success": true} without writing anything must not pass.
    assert db.calendar_document('tester') == CALENDAR
    assert client.get('/api/calendar_store').json()['data'] == CALENDAR


def test_keeps_a_shape_the_server_knows_nothing_about(client):
    """Every field survives, including ones no Python here has heard of.

    The store carries two years of accumulated spellings and will carry more.
    An endpoint that modelled the shape would drop whatever it had not been
    updated for, silently, which is the whole bug being fixed.
    """
    invented = {'2027-1-9': {'timestamps': [{'somethingNew': [1, {'deep': True}]}]}}
    client.put('/api/calendar_store', json={'data': invented})
    assert client.get('/api/calendar_store').json()['data'] == invented


def test_replaces_rather_than_merges(client):
    """Whole-document writes. The client holds one object and re-saves it."""
    client.put('/api/calendar_store', json={'data': CALENDAR})
    client.put('/api/calendar_store', json={'data': {'2026-8-1': {'timestamps': []}}})

    stored = client.get('/api/calendar_store').json()['data']
    assert '2026-7-4' not in stored
    assert list(stored) == ['2026-8-1']


def test_one_account_cannot_read_or_write_another(client, stranger):
    """The document is keyed by the session, like everything else under /api."""
    client.put('/api/calendar_store', json={'data': CALENDAR})
    assert stranger.get('/api/calendar_store').json()['data'] == {}

    stranger.put('/api/calendar_store', json={'data': {'2026-9-9': {'timestamps': []}}})
    assert client.get('/api/calendar_store').json()['data'] == CALENDAR


def test_signed_out_callers_are_refused(anon):
    assert anon.get('/api/calendar_store').status_code == 401
    assert anon.put('/api/calendar_store', json={'data': CALENDAR}).status_code == 401
    # And nothing was written by the attempt.
    assert db.calendar_document('tester') == {}
