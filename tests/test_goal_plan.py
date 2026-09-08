"""The route from here to one goal, written by a model.

Nothing here calls a model. What is worth testing is everything around the
call — the brief that goes in, the bounds that come out, and the states that
are not "it worked": no key, and an answer that cannot be read.

The rule the feature exists to keep is the one `test_subject_brief` states:
the model may lay a plan over the page's figures and may not produce any
others. That rule lives in the prompt and cannot be asserted from here, so
what these hold instead is the structure that makes it enforceable — the
brief carries every figure the page drew, and the one number the model does
supply is bounded on the way out.
"""
import pytest

from backend.tracking import goal_plan


FINDINGS = {
    'goal': 'Get 24 on the AMC 8',
    'subject': 'Algebra',
    'standing': '12 of 24 points',
    'deadline': '2026-11-01',
    'days_left': 54,
    'need_weekly': '1.6 points',
    'have_weekly': '1.2 points',
    'lands': '2026-11-16',
    'expected': 56,
    'stages': ['Finish the counting unit'],
    'levers': ['Aim more of this subject at it — 2 of the 11 tasks you '
               'finished here named this goal.'],
    'span': '30D',
    'score': 71,
    'grade': 'B',
    'finished': 11,
    'aimed': 2,
    'recent_days': 1,
    'bands': [{'label': 'Brutal', 'done': 3, 'holding': 52}],
    'struggles': [{'label': 'Kept getting interrupted', 'share': 40, 'count': 2}],
}


# ---------------------------------------------------------------------------
# The brief that goes to the model
# ---------------------------------------------------------------------------
def test_the_brief_carries_every_figure_the_page_drew():
    """A figure dropped on the way in is one the model is then forbidden to use.

    The prompt's whole instruction is "quote these and add nothing", which is
    only workable if the numbers on the reader's screen all reach it.
    """
    brief = goal_plan.brief_from(FINDINGS)

    for expected in ('Get 24 on the AMC 8', 'Algebra', '12 of 24 points',
                     '54', '2026-11-01', '1.6 points', '1.2 points',
                     '2026-11-16', '71', 'B', '11', 'Brutal',
                     'Kept getting interrupted', '40%',
                     'Finish the counting unit'):
        assert expected in brief, expected


def test_the_apps_own_conclusions_go_over_as_sentences():
    """The levers reach the model as the app wrote them, not as raw counts.

    They already are conclusions — `leversFor` in
    frontend/src/components/Subject/model.ts ranked them and wrote the
    sentence. Handing over the counts instead would invite the model to
    re-derive the ranking and disagree with the panel directly above it.
    """
    brief = goal_plan.brief_from(FINDINGS)
    assert 'Aim more of this subject at it' in brief
    assert 'hardest first' in brief


def test_the_brief_leaves_out_what_is_not_there():
    """An empty line is a line the model has to interpret, and it sometimes
    interprets wrong. A goal with no date has no days left, and says nothing
    about them rather than saying nothing is known."""
    brief = goal_plan.brief_from({'goal': 'Learn to sight-read', 'subject': 'Violin'})

    assert 'Learn to sight-read' in brief
    assert 'Days remaining' not in brief
    assert 'Rate it needs' not in brief


# ---------------------------------------------------------------------------
# The answer, on the way out
# ---------------------------------------------------------------------------
def test_a_phase_length_is_clamped_to_something_a_plan_could_use():
    """`weeks` is the one number the model supplies rather than quotes, and a
    phase of three hundred weeks drafted against a goal due in April is not a
    plan the page should print however confidently it arrives."""
    cleaned = goal_plan._clean({
        'route': 'Two sentences.',
        'phases': [
            {'title': 'Counting', 'weeks': 900, 'outcome': 'Solid', 'focus': ['a']},
            {'title': 'Geometry', 'weeks': 0, 'outcome': 'Solid', 'focus': ['b']},
            {'title': 'Junk', 'weeks': 'soon', 'outcome': '', 'focus': []},
        ],
        'week': ['One thing'],
    })

    assert [phase['weeks'] for phase in cleaned['phases']] == [
        goal_plan.PHASE_WEEKS[1], goal_plan.PHASE_WEEKS[0], goal_plan.PHASE_WEEKS[0]]


def test_the_plan_is_cut_to_what_the_page_draws():
    """A route in eleven stages is not a route anybody follows, and seven
    things to do this week is a list nobody starts."""
    cleaned = goal_plan._clean({
        'route': 'A read.',
        'phases': [{'title': 'P{}'.format(n), 'weeks': 2, 'outcome': 'x',
                    'focus': ['a', 'b', 'c', 'd', 'e', 'f']} for n in range(11)],
        'week': ['do {}'.format(n) for n in range(9)],
    })

    assert len(cleaned['phases']) == goal_plan.PHASES
    assert len(cleaned['week']) == goal_plan.THIS_WEEK
    assert len(cleaned['phases'][0]['focus']) == 4


def test_a_phase_with_no_title_is_dropped_rather_than_drawn_blank():
    cleaned = goal_plan._clean({
        'route': 'A read.',
        'phases': [{'title': '   ', 'weeks': 2, 'outcome': 'x', 'focus': []},
                   {'title': 'Real', 'weeks': 2, 'outcome': 'x', 'focus': []}],
        'week': [],
    })
    assert [phase['title'] for phase in cleaned['phases']] == ['Real']


def test_an_empty_answer_is_a_failure_rather_than_an_empty_panel():
    """A panel that draws nothing looks like a panel that failed to load, and
    the reader has no way to tell that from one that was never pressed."""
    with pytest.raises(goal_plan.BriefUnavailable):
        goal_plan._clean({'route': '  ', 'phases': [], 'week': []})


# ---------------------------------------------------------------------------
# Without a key
# ---------------------------------------------------------------------------
def test_without_a_key_it_says_so_instead_of_calling_anything(monkeypatch):
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    monkeypatch.setenv('HF_TOKEN', 'a-token-that-does-not-help-here')

    assert goal_plan.configured() is False
    with pytest.raises(goal_plan.BriefUnavailable) as caught:
        goal_plan.plan(FINDINGS)
    assert 'ANTHROPIC_API_KEY' in str(caught.value)


def test_a_goal_with_no_title_is_refused_before_anything_is_spent(monkeypatch):
    """Checked before the key is, because it costs nothing to check and the
    call it would make costs the account's owner money."""
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'sk-ant-not-a-real-key')
    with pytest.raises(goal_plan.BriefUnavailable) as caught:
        goal_plan.plan({'goal': '   ', 'subject': 'Algebra'})
    assert 'no goal' in str(caught.value).lower()


# ---------------------------------------------------------------------------
# The endpoint
# ---------------------------------------------------------------------------
def test_the_endpoint_answers_readably_rather_than_erroring(client, monkeypatch):
    """A plan that cannot be written is not a broken request — the page prints
    the message beside the button, over a panel that was already complete."""
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    response = client.post('/api/goal_plan', json={
        'goal': 'Get 24 on the AMC 8', 'subject': 'Algebra'})

    assert response.status_code == 200
    assert response.json()['success'] is False
    assert 'ANTHROPIC_API_KEY' in response.json()['message']


def test_the_endpoint_needs_a_goal_to_plan_a_route_to(client):
    response = client.post('/api/goal_plan', json={'goal': '   ', 'subject': 'Algebra'})
    assert response.status_code == 200
    assert response.json()['success'] is False
