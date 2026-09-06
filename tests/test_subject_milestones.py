"""Checkpoints set against a subject, and the goal drafted from them.

Nothing here calls a model. What is worth testing is the store's bounds, and
the two rules that keep subject checkpoints from quietly becoming goal
checkpoints.
"""
import pytest

from backend.api import subjects as api
from backend.tracking import subject_goal
from backend.tracking.subject_brief import BriefUnavailable


def test_a_subjects_checkpoints_round_trip(client):
    client.post('/api/subject_milestones', json={
        'subject': 'mathematics',
        'milestones': [
            {'id': 'a', 'title': 'Comfortable with proofs', 'done': False},
            {'id': 'b', 'title': 'Silver DP unassisted', 'done': True},
        ],
    })
    got = client.get('/api/subject_milestones').json()['milestones']

    assert [row['title'] for row in got['mathematics']] == [
        'Comfortable with proofs', 'Silver DP unassisted']
    assert [row['done'] for row in got['mathematics']] == [False, True]


def test_an_empty_list_clears_the_subject_rather_than_being_refused(client):
    """It is how somebody removes their last checkpoint."""
    client.post('/api/subject_milestones', json={
        'subject': 'music', 'milestones': [{'id': 'a', 'title': 'Sight-read grade 5'}]})
    assert 'music' in client.get('/api/subject_milestones').json()['milestones']

    body = client.post('/api/subject_milestones',
                       json={'subject': 'music', 'milestones': []}).json()
    assert body['success'] is True
    assert 'music' not in body['milestones']


def test_one_subject_at_a_time_leaves_the_others_alone(client):
    client.post('/api/subject_milestones', json={
        'subject': 'mathematics', 'milestones': [{'id': 'a', 'title': 'Proofs'}]})
    client.post('/api/subject_milestones', json={
        'subject': 'music', 'milestones': [{'id': 'a', 'title': 'Scales'}]})

    got = client.get('/api/subject_milestones').json()['milestones']
    assert set(got) == {'mathematics', 'music'}


def test_the_list_is_bounded_and_junk_is_dropped(client):
    client.post('/api/subject_milestones', json={
        'subject': 'mathematics',
        'milestones': (
            [{'id': str(n), 'title': 'Stage {}'.format(n)} for n in range(30)]
            # A blank title is not a checkpoint, and neither is a bare string.
            + [{'id': 'x', 'title': '   '}, 'not a dict']
        ),
    })
    rows = client.get('/api/subject_milestones').json()['milestones']['mathematics']

    assert len(rows) == api.MILESTONES_PER_SUBJECT
    assert all(row['title'].strip() for row in rows)


def test_a_title_longer_than_the_column_is_cut_rather_than_refused(client):
    client.post('/api/subject_milestones', json={
        'subject': 'mathematics', 'milestones': [{'id': 'a', 'title': 'x' * 500}]})
    rows = client.get('/api/subject_milestones').json()['milestones']['mathematics']
    assert len(rows[0]['title']) == api.MILESTONE_TITLE_MAX


def test_a_save_needs_a_subject(client):
    body = client.post('/api/subject_milestones', json={'subject': '  '}).json()
    assert body['success'] is False


# ---------------------------------------------------------------------------
# The drafted goal
# ---------------------------------------------------------------------------
def test_the_brief_carries_the_checkpoints_in_the_readers_order():
    """They are the stages the goal is written over, so order is the content."""
    brief = subject_goal.brief_from({
        'subject': 'Mathematics',
        'finished': 90,
        'milestones': ['Comfortable with proofs', 'Silver DP unassisted'],
    })

    assert brief.index('Comfortable with proofs') < brief.index('Silver DP unassisted')
    assert '90' in brief


def test_the_brief_says_plainly_when_there_are_no_checkpoints():
    """An empty list has to read as an absence, not as a missing line.

    The model is asked to write the stages itself in that case, and it can only
    know to do that if the brief says so.
    """
    brief = subject_goal.brief_from({'subject': 'Mathematics'})
    assert 'has not written any checkpoints' in brief


def test_a_draft_is_bounded_to_what_add_goal_will_take():
    cleaned = subject_goal._clean({
        'title': 'Competition ready',
        'why': 'because',
        'unit': 'problems',
        'target': 10 ** 9,
        'weeks': 500,
        'milestones': ['a'] * 20,
    })

    assert cleaned['target'] == subject_goal.TARGET[1]
    assert cleaned['weeks'] == subject_goal.WEEKS[1]
    assert len(cleaned['milestones']) == subject_goal.MILESTONES


def test_a_draft_with_no_title_is_a_failure_rather_than_an_unnamed_goal():
    with pytest.raises(BriefUnavailable):
        subject_goal._clean({'title': '   ', 'target': 10, 'weeks': 4})


def test_a_non_numeric_target_falls_back_rather_than_crashing():
    cleaned = subject_goal._clean({
        'title': 'Something', 'target': 'lots', 'weeks': 'a while', 'milestones': []})
    assert isinstance(cleaned['target'], int)
    assert isinstance(cleaned['weeks'], int)


def test_without_a_key_the_draft_says_so(client, monkeypatch):
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    response = client.post('/api/suggest_subject_goal', json={'subject': 'Maths'})

    assert response.status_code == 200
    assert response.json()['success'] is False
    assert 'ANTHROPIC_API_KEY' in response.json()['message']
