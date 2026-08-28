"""Create it, change it, read it back, delete it — for each thing the app owns.

Not exhaustive coverage of every endpoint; a round trip through each resource,
asserting on the database rather than on the reply, so a handler that answers
`{"success": true}` without writing anything cannot pass. These are the tests
the goals and milestone refactor leans on.
"""
from backend.database import connection as db


# --------------------------------------------------------------------------
# Tasks
# --------------------------------------------------------------------------
def test_task_round_trip(client):
    made = client.post('/api/tasks', json={
        'name': 'write the tests', 'priority': 'high', 'xp_reward': 20,
        'due_date': '2026-12-31T23:59:00',
    }).json()
    assert made['success']
    task_id = made['task_id']

    row = db.find_row('tasks', task_id, user_id='tester')
    assert (row['title'], row['priority'], row['xp_value']) == ('write the tests', 'high', 20)

    client.put('/api/tasks/%s' % task_id, json={'name': 'renamed', 'priority': 'low'})
    row = db.find_row('tasks', task_id, user_id='tester')
    assert (row['title'], row['priority']) == ('renamed', 'low')

    assert client.delete('/api/tasks/%s' % task_id).json()['success']
    assert db.find_row('tasks', task_id) is None


def test_completing_a_task_records_the_timing(client):
    """`completion_seconds` and `met_deadline` are what efficiency reads."""
    made = client.post('/api/tasks', json={
        'name': 'on time', 'xp_reward': 5, 'due_date': '2099-01-01T00:00:00',
    }).json()
    client.post('/api/complete_task', json={'task_id': made['task_id']})

    row = db.find_row('tasks', made['task_id'], user_id='tester')
    assert row['status'] == 'done'
    assert row['completed_at']
    assert row['met_deadline'] is True
    assert row['completion_seconds'] >= 0


def test_rating_a_task_stores_both_answers(client, task):
    client.post('/api/complete_task', json={'task_id': task})
    client.post('/api/rate_task', json={'task_id': task, 'difficulty': 4, 'execution': 2})
    row = db.find_row('tasks', task, user_id='tester')
    assert (row['difficulty'], row['execution']) == (4, 2)


def test_an_unrated_task_is_absent_rather_than_zero(client, task):
    """A zero would be a rating. The scores must not see one."""
    row = db.find_row('tasks', task, user_id='tester')
    assert 'difficulty' not in row and 'execution' not in row


# --------------------------------------------------------------------------
# Notes
# --------------------------------------------------------------------------
def test_note_round_trip(client):
    made = client.post('/api/notes/save',
                       json={'title': 'first', 'body': 'hello'}).json()
    assert made['success']
    note_id = made['note']['id']
    assert db.find_row('notes', note_id, user_id='tester')['title'] == 'first'

    client.post('/api/notes/save',
                json={'id': note_id, 'title': 'second', 'body': 'changed'})
    row = db.find_row('notes', note_id, user_id='tester')
    assert (row['title'], row['body']) == ('second', 'changed')

    assert client.post('/api/notes/delete', json={'id': note_id}).json()['success']
    assert db.find_row('notes', note_id) is None


def test_editing_a_note_that_is_gone_does_not_create_one(client):
    """A failed edit must not silently become a new note."""
    reply = client.post('/api/notes/save',
                        json={'id': 'no-such-note', 'title': 'x', 'body': 'y'}).json()
    assert reply['success'] is False
    assert db.rows_for('notes', 'tester') == []


# --------------------------------------------------------------------------
# Records
# --------------------------------------------------------------------------
def test_record_round_trip(client):
    made = client.post('/api/records/save', json={
        'name': 'AMC 8', 'kind': 'record', 'value': 18, 'unit': 'pts',
    }).json()
    assert made['success']
    record_id = made['record']['id']
    assert db.find_row('records', record_id, user_id='tester')['value'] == 18

    client.post('/api/records/save', json={
        'id': record_id, 'name': 'AMC 8', 'kind': 'record', 'value': 25, 'unit': 'pts',
    })
    assert db.find_row('records', record_id, user_id='tester')['value'] == 25

    assert client.post('/api/records/delete', json={'id': record_id}).json()['success']
    assert db.find_row('records', record_id) is None


# --------------------------------------------------------------------------
# Goals and their checkpoints
# --------------------------------------------------------------------------
def make_goal(client, title='ship it', target=100):
    reply = client.post('/api/add_goal', json={
        'title': title, 'goal_type': 'xp', 'target_xp': target,
    }).json()
    assert reply['success'], reply
    return db.rows_for('goals', 'tester')[-1]['id']


def test_goal_round_trip(client):
    goal_id = make_goal(client)
    assert db.find_row('goals', goal_id, user_id='tester')['title'] == 'ship it'

    client.post('/api/update_goal', json={'id': goal_id, 'title': 'ship it properly'})
    assert db.find_row('goals', goal_id, user_id='tester')['title'] == 'ship it properly'

    assert client.post('/api/delete_goal', json={'goal_id': goal_id}).json()['success']
    assert db.find_row('goals', goal_id) is None


def test_goal_progress_is_capped_at_its_target(client):
    goal_id = make_goal(client, target=100)
    reply = client.post('/api/update_goal_progress',
                        json={'goal_id': goal_id, 'xp_to_add': 250}).json()
    assert reply['success']
    assert reply['current'] == 100
    assert reply['status'] == 'completed'


def test_milestones_round_trip_and_keep_their_order(client):
    goal_id = make_goal(client)
    for title in ('first', 'second', 'third'):
        assert client.post('/api/add_milestone',
                           json={'goal_id': goal_id, 'title': title}).json()['success']

    stones = sorted(db.rows_for('goal_milestones', 'tester'),
                    key=lambda r: r.get('position', 0))
    assert [s['title'] for s in stones] == ['first', 'second', 'third']
    assert [s.get('position', 0) for s in stones] == [0, 1, 2]

    middle = stones[1]['id']
    assert client.post('/api/delete_milestone', json={'id': middle}).json()['success']

    left = sorted(db.rows_for('goal_milestones', 'tester'),
                  key=lambda r: r.get('position', 0))
    assert [s['title'] for s in left] == ['first', 'third']
    # The gap is closed rather than left as 0, 2.
    assert [s.get('position', 0) for s in left] == [0, 1]


def test_deleting_a_goal_unlinks_its_tasks_without_deleting_them(client):
    """A task done for a goal was still done. It loses the link, not itself."""
    goal_id = make_goal(client)
    made = client.post('/api/tasks', json={
        'name': 'toward the goal', 'xp_reward': 5, 'goal_id': goal_id,
    }).json()
    assert db.find_row('tasks', made['task_id'], user_id='tester')['goal_id'] == goal_id

    client.post('/api/delete_goal', json={'goal_id': goal_id})
    row = db.find_row('tasks', made['task_id'], user_id='tester')
    assert row is not None
    assert 'goal_id' not in row or row['goal_id'] is None


def test_deleting_a_milestone_unlinks_its_tasks(client):
    goal_id = make_goal(client)
    client.post('/api/add_milestone', json={'goal_id': goal_id, 'title': 'step one'})
    stone_id = db.rows_for('goal_milestones', 'tester')[0]['id']
    made = client.post('/api/tasks', json={
        'name': 'toward the step', 'xp_reward': 5,
        'goal_id': goal_id, 'milestone_id': stone_id,
    }).json()

    client.post('/api/delete_milestone', json={'id': stone_id})
    row = db.find_row('tasks', made['task_id'], user_id='tester')
    assert row is not None
    assert 'milestone_id' not in row or row['milestone_id'] is None


# --------------------------------------------------------------------------
# Calendar
# --------------------------------------------------------------------------
def test_calendar_event_belongs_to_the_account_that_made_it(client, stranger):
    """The leak: `create_event` never wrote user_id and nothing filtered on it."""
    made = client.post('/api/create_calendar_event', json={
        'name': 'study block', 'date': '2026-09-01', 'time_block': 'Morning',
    }).json()
    assert made['success']
    assert db.find_row('calendar_events', made['entry_id'])['user_id'] == 'tester'

    assert client.get('/api/get_custom_events').json()['events']
    assert stranger.get('/api/get_custom_events').json()['events'] == []

    # And the stranger cannot delete it.
    assert stranger.delete('/api/delete_calendar_event/%s'
                           % made['entry_id']).json()['success'] is False
    assert db.find_row('calendar_events', made['entry_id']) is not None


def test_calendar_entry_round_trip(client, task):
    made = client.post('/api/calendar', json={
        'date': '2026-09-01', 'time_block': 'Morning', 'task_id': task,
    }).json()
    assert made['success']
    entries = db.rows_for('calendar_entries', 'tester')
    assert len(entries) == 1

    entry_id = entries[0]['id']
    client.put('/api/calendar/%s' % entry_id, json={'time_block': 'Evening'})
    assert db.find_row('calendar_entries', entry_id)['time_block'] == 'Evening'

    client.delete('/api/calendar/%s' % entry_id)
    assert db.rows_for('calendar_entries', 'tester') == []


# --------------------------------------------------------------------------
# Focus
# --------------------------------------------------------------------------
def test_a_focus_day_is_never_lowered_by_a_stale_client(client):
    """An old tab must not shrink a day already recorded."""
    client.post('/api/focus_sync', json={'date': '2026-08-01', 'focused_seconds': 3600,
                                         'goal_hours': 2})
    client.post('/api/focus_sync', json={'date': '2026-08-01', 'focused_seconds': 60,
                                         'goal_hours': 2})
    row = db.find_row('focus_days', '2026-08-01', user_id='tester', key='date')
    assert row['seconds'] == 3600


def test_day_focus_note_upserts_and_an_empty_one_deletes(client):
    client.post('/api/day_focus', json={'date': '2026-08-01', 'text': 'deep work'})
    assert db.find_row('day_focus_notes', '2026-08-01',
                       user_id='tester', key='date')['text'] == 'deep work'

    client.post('/api/day_focus', json={'date': '2026-08-01', 'text': 'changed'})
    assert db.find_row('day_focus_notes', '2026-08-01',
                       user_id='tester', key='date')['text'] == 'changed'

    client.post('/api/day_focus', json={'date': '2026-08-01', 'text': ''})
    assert db.find_row('day_focus_notes', '2026-08-01',
                       user_id='tester', key='date') is None


# --------------------------------------------------------------------------
# Subjects and the avatar — the two tables keyed on something other than `id`
# --------------------------------------------------------------------------
def test_a_custom_subject_round_trips(client):
    made = client.post('/api/subjects', json={'name': 'Olympiad Geometry'}).json()
    assert made['success'], made
    subject_id = made['subject']['id']
    assert db.find_row('user_subjects', subject_id,
                       user_id='tester', key='subject_id')['custom'] is True

    client.patch('/api/subjects/%s/color' % subject_id, json={'family': 'blue'})
    assert db.find_row('user_subjects', subject_id,
                       user_id='tester', key='subject_id')['family'] == 'blue'

    assert client.delete('/api/subjects/%s' % subject_id).json()['success']
    assert db.find_row('user_subjects', subject_id,
                       user_id='tester', key='subject_id') is None


def test_clearing_a_catalogue_subjects_colour_drops_the_row(client):
    """A row saying "this account has no opinion" is a row worth not keeping."""
    catalogue_id = client.get('/api/subjects').json()['subjects'][-1]['id']
    client.patch('/api/subjects/%s/color' % catalogue_id, json={'family': 'rose'})
    assert db.find_row('user_subjects', catalogue_id,
                       user_id='tester', key='subject_id') is not None

    client.patch('/api/subjects/%s/color' % catalogue_id, json={'family': None})
    assert db.find_row('user_subjects', catalogue_id,
                       user_id='tester', key='subject_id') is None


def test_choosing_an_avatar_replaces_the_previous_pick(client):
    """An upsert on (user_id, key) — it must not leave two rows behind."""
    first = client.post('/api/avatar', json={'avatar': 'rocket'}).json()
    assert first['success'], first
    client.post('/api/avatar', json={'avatar': 'penguin'})

    rows = [r for r in db.rows_for('user_settings', 'tester') if r['key'] == 'avatar']
    assert len(rows) == 1
    assert client.get('/api/auth/verify_status').json()['avatar'].endswith('/penguin.svg')
