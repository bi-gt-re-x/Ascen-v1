"""The analytics page's task read: the same rows, in fewer columns.

`/api/get_user_data` hands back every column of every task the account owns,
`description` included — free text with no ceiling, on a table that reaches
thousands of rows on a real account. The analytics page walks all of them and
reads sixteen fields. This endpoint is those sixteen.

The risk in a projection is not that it returns too little; a missing field is
a `undefined` that some panel renders as a dash, which is visible the first
time anybody looks. It is that it quietly returns *different rows* — a WHERE
clause that drifts, a decode that stops running because it was written for the
`SELECT *` path. So these check the two things a projection has to keep true:
every row that was there is still there, and each one still decodes the way the
rest of the app expects.
"""
from backend.api.analytics import ANALYTICS_TASK_FIELDS
from backend.database import connection as db


def make(client, **fields):
    """One task, with whatever the caller wants set on it."""
    made = client.post('/api/tasks', json={
        'name': fields.pop('name', 'a task'),
        'xp_reward': fields.pop('xp_reward', 10),
        'due_date': fields.pop('due_date', ''),
    }).json()
    task_id = made['task_id']
    if fields:
        db.update_row('tasks', task_id, fields, user_id='tester')
    return task_id


def test_returns_every_task_the_account_owns(client):
    for index in range(5):
        make(client, name='task %d' % index)

    body = client.get('/api/analytics/tasks').json()
    assert body['success'] is True
    assert len(body['tasks']) == len(db.tasks_for('tester'))


def test_returns_only_the_declared_columns(client):
    make(client, description='a long description nothing on that page reads')

    row = client.get('/api/analytics/tasks').json()['tasks'][0]
    assert set(row) <= set(ANALYTICS_TASK_FIELDS)
    # The field the projection exists for.
    assert 'description' not in row


def test_keeps_the_values_the_full_read_gives(client):
    make(client, name='rated', difficulty=4, execution=2, subject='maths')

    full = {t['id']: t for t in db.tasks_for('tester')}
    for thin in client.get('/api/analytics/tasks').json()['tasks']:
        for field, value in thin.items():
            assert full[thin['id']][field] == value, field


def test_decodes_booleans_as_booleans(client):
    """The `SELECT *` path runs every row through `_decode`; so must this one.

    SQLite has no boolean, so `met_deadline` comes back as 0 or 1 unless
    something converts it — and a projection that skipped the decode would hand
    the client a number where every other endpoint hands it a bool.
    """
    make(client, met_deadline=True)

    row = client.get('/api/analytics/tasks').json()['tasks'][0]
    assert row['met_deadline'] is True


def test_cannot_be_asked_for_a_column_that_is_not_there(client):
    """Unknown names are dropped rather than reaching the SQL.

    The column list goes into the query string, so an unchecked one is an
    injection. It is a constant today; this is what keeps that from being the
    only thing standing between the two.
    """
    make(client)

    rows = db.columns_for('tasks', 'tester', ('id', 'no_such_column'))
    assert rows and set(rows[0]) == {'id'}

    assert db.columns_for('tasks', 'tester', ('"; DROP TABLE tasks; --',)) == []
    # And the table it tried to drop is still there.
    assert db.tasks_for('tester')


def test_is_scoped_to_the_signed_in_account(client, stranger):
    make(client, name='mine')
    stranger.post('/api/tasks', json={'name': 'theirs', 'xp_reward': 5, 'due_date': ''})

    titles = [t['title'] for t in client.get('/api/analytics/tasks').json()['tasks']]
    assert 'theirs' not in titles


def test_needs_a_session(anon):
    assert anon.get('/api/analytics/tasks').status_code == 401
