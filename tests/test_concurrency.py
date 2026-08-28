"""Two things happening at once, and nothing disappearing.

Both bugs these cover were live and both were silent. They are here because
they are invisible to any test that does one thing at a time, and because the
fix for each is the sort of thing a later refactor undoes by accident.

`TestClient` is threadsafe against one app, and the app runs its sync handlers
in a threadpool, so a ThreadPoolExecutor really does put several requests
inside the database at the same moment. That is enough to reproduce both.
"""
from concurrent.futures import ThreadPoolExecutor

from backend.database import connection as db

N = 24


def spread(work, count=N):
    with ThreadPoolExecutor(max_workers=count) as pool:
        return list(pool.map(work, range(count)))


def test_concurrent_creates_all_land(client):
    """`new_id` handed the same millisecond to two callers at once.

    Under the old whole-table write that was a lost update and nothing said so.
    Under INSERT it is a duplicate primary key, which is why it was found — and
    why the fix is a lock plus a retry rather than a bigger number somewhere.
    """
    made = spread(lambda i: client.post(
        '/api/tasks', json={'name': 'race %d' % i, 'xp_reward': 1}).json())

    ids = [reply['task_id'] for reply in made if reply.get('success')]
    assert len(ids) == N, 'some creates failed outright'
    assert len(set(ids)) == N, 'two tasks were handed the same id'
    assert len(db.rows_for('tasks', 'tester')) == N


def test_concurrent_completions_do_not_cancel_each_other(client):
    """The one that cost 29 completions out of 30.

    Each request read `tasks_completed`, added one in Python and wrote the row
    back, so they all wrote the same value. `add_to_row` adds in SQL, which is
    the only way this comes out right.
    """
    ids = [client.post('/api/tasks',
                       json={'name': 'race %d' % i, 'xp_reward': 3}).json()['task_id']
           for i in range(N)]

    before = db.find_row('users', 'tester', key='username')
    spread(lambda i: client.post('/api/complete_task', json={'task_id': ids[i]}))
    after = db.find_row('users', 'tester', key='username')

    assert after['tasks_completed'] - (before['tasks_completed'] or 0) == N
    assert after['xp'] - (before['xp'] or 0) == N * 3
    # And the ledger agrees with the counter it is supposed to explain.
    assert sum(r.get('amount', 0) for r in db.rows_for('xp_events', 'tester')) == N * 3


def test_concurrent_deletes_leave_nothing_behind(client):
    ids = [client.post('/api/tasks',
                       json={'name': 'race %d' % i, 'xp_reward': 1}).json()['task_id']
           for i in range(N)]
    spread(lambda i: client.delete('/api/tasks/%s' % ids[i]))
    assert db.rows_for('tasks', 'tester') == []


def test_two_accounts_writing_at_once_do_not_touch_each_other(client, stranger):
    """The old whole-table write made every save a write of everybody's rows."""
    def work(i):
        who = client if i % 2 == 0 else stranger
        who.post('/api/tasks', json={'name': 'row %d' % i, 'xp_reward': 1})

    spread(work)
    assert len(db.rows_for('tasks', 'tester')) == N // 2
    assert len(db.rows_for('tasks', 'stranger')) == N // 2
