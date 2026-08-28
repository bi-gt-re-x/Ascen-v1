"""The row operations, and the rules they inherited from `write_table`.

connection.py has two ways to write now: the whole-table pair it was built on,
and the targeted six that replaced it on every hot path. They share `_encode`
and the missing-key convention, and the point of most of these tests is that
they really do — a row written by one has to read back the same as a row
written by the other, or the app has two datastores wearing one interface.
"""
import pytest

from backend.database import connection as db


@pytest.fixture
def two_accounts(fresh_db):
    for name in ('alice', 'bob'):
        db.insert_row('users', {'id': db.new_id('users'), 'username': name,
                                'xp': 0, 'level': 1, 'theme': 'light'})
    return 'alice', 'bob'


def a_task(owner, title='t', **extra):
    row = {'id': db.new_id('tasks'), 'user_id': owner, 'title': title,
           'status': 'todo', 'xp_value': 5}
    row.update(extra)
    return db.insert_row('tasks', row)


# --------------------------------------------------------------------------
# Scoping
# --------------------------------------------------------------------------
def test_rows_for_returns_only_that_account(two_accounts):
    alice, bob = two_accounts
    a_task(alice, 'hers'); a_task(alice, 'hers too'); a_task(bob, 'his')
    assert [r['title'] for r in db.rows_for('tasks', alice)] == ['hers', 'hers too']
    assert [r['title'] for r in db.rows_for('tasks', bob)] == ['his']


def test_update_row_will_not_cross_accounts(two_accounts):
    alice, bob = two_accounts
    row = a_task(alice, 'hers')
    assert db.update_row('tasks', row['id'], {'title': 'stolen'}, user_id=bob) is False
    assert db.find_row('tasks', row['id'])['title'] == 'hers'


def test_delete_row_will_not_cross_accounts(two_accounts):
    alice, bob = two_accounts
    row = a_task(alice, 'hers')
    assert db.delete_row('tasks', row['id'], user_id=bob) is False
    assert db.find_row('tasks', row['id']) is not None
    assert db.delete_row('tasks', row['id'], user_id=alice) is True
    assert db.find_row('tasks', row['id']) is None


def test_find_row_hides_another_accounts_row(two_accounts):
    """"Not yours" and "not there" are the same answer, on purpose."""
    alice, bob = two_accounts
    row = a_task(alice)
    assert db.find_row('tasks', row['id'], user_id=bob) is None


# --------------------------------------------------------------------------
# The NULL convention, shared with write_table
# --------------------------------------------------------------------------
def test_a_column_that_was_never_written_stays_missing(two_accounts):
    """The rule the whole backend reads by: NULL is an absent key, not None."""
    alice, _ = two_accounts
    row = a_task(alice)
    read = db.find_row('tasks', row['id'])
    assert 'due_date' not in read
    assert read.get('due_date', 'fallback') == 'fallback'


def test_setting_a_field_to_none_clears_it(two_accounts):
    """`update_row` says what to change, so None means NULL rather than skip."""
    alice, _ = two_accounts
    row = a_task(alice, due_date='2026-05-05')
    assert db.find_row('tasks', row['id'])['due_date'] == '2026-05-05'
    db.update_row('tasks', row['id'], {'due_date': None}, user_id=alice)
    assert 'due_date' not in db.find_row('tasks', row['id'])


def test_a_row_reads_back_the_same_whichever_wrote_it(two_accounts):
    """`insert_row` and `write_table` are one datastore, not two."""
    alice, _ = two_accounts
    a_task(alice, 'via insert_row', due_date='2026-06-06')
    rows = db.read_table('tasks')
    rows.append({'id': db.new_id('tasks'), 'user_id': alice, 'title': 'via write_table',
                 'status': 'todo', 'xp_value': 5, 'due_date': '2026-06-06'})
    db.write_table('tasks', rows)

    both = {r['title']: r for r in db.rows_for('tasks', alice)}
    one = dict(both['via insert_row']); two = dict(both['via write_table'])
    for differ in ('id', 'title'):
        one.pop(differ); two.pop(differ)
    # Same keys, same values — including which columns are absent because the
    # write left them NULL rather than letting a DEFAULT stand in.
    assert one == two


def test_booleans_survive_the_round_trip(two_accounts):
    """SQLite stores 0/1; the app and its JSON want real booleans."""
    alice, _ = two_accounts
    row = a_task(alice)
    db.update_row('tasks', row['id'], {'timer_expired': True}, user_id=alice)
    assert db.find_row('tasks', row['id'])['timer_expired'] is True


# --------------------------------------------------------------------------
# Arithmetic and ids
# --------------------------------------------------------------------------
def test_add_to_row_adds_rather_than_sets(two_accounts):
    alice, _ = two_accounts
    user = db.find_row('users', alice, key='username')
    db.add_to_row('users', user['id'], {'xp': 30})
    after = db.add_to_row('users', user['id'], {'xp': 12})
    assert after['xp'] == 42


def test_add_to_row_applies_its_plain_changes_in_the_same_write(two_accounts):
    alice, _ = two_accounts
    user = db.find_row('users', alice, key='username')
    after = db.add_to_row('users', user['id'], {'xp': 5},
                          changes={'current_streak': 3, 'day_state': 'oldday'})
    assert (after['xp'], after['current_streak'], after['day_state']) == (5, 3, 'oldday')


def test_add_to_row_treats_a_null_column_as_zero(two_accounts):
    """COALESCE, so a column nobody has written to is not NULL + 1 = NULL."""
    alice, _ = two_accounts
    user = db.find_row('users', alice, key='username')
    assert 'tasks_completed' not in user or user['tasks_completed'] == 0
    assert db.add_to_row('users', user['id'], {'tasks_completed': 1})['tasks_completed'] == 1


def test_ids_are_unique_and_ordered(fresh_db):
    ids = [db.new_id('tasks') for _ in range(50)]
    assert len(set(ids)) == 50
    assert ids == sorted(ids, key=int)


def test_insert_row_steps_past_an_id_already_taken(two_accounts):
    """The cross-process half of the id fix: the table is the only memory."""
    alice, _ = two_accounts
    first = a_task(alice, 'first')
    second = db.insert_row('tasks', {'id': first['id'], 'user_id': alice,
                                     'title': 'same id', 'status': 'todo'})
    assert second['id'] != first['id']
    assert len(db.rows_for('tasks', alice)) == 2


def test_a_real_constraint_still_raises(two_accounts):
    """The retry is for colliding ids only, not for every IntegrityError."""
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        db.insert_row('tasks', {'id': db.new_id('tasks'),
                                'user_id': 'nobody-by-that-name',
                                'title': 'orphan', 'status': 'todo'})
