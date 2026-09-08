"""The subject page's interpretation layer, and the loop that checks it.

Nothing here calls a model. What is worth testing is everything around the
call: the sections that go in, the bounds that come out, and the two states
that are not "it worked" — no key, and an answer that cannot be read.

The rule the feature exists to keep is that the model may reason over the
page's figures and may not produce any others. That rule lives in the prompt
and cannot be asserted from here, so what these hold instead is the structure
that makes it enforceable — every counted figure reaches the brief, the two
figures the model *is* asked for are clamped, and the vocabulary it is handed
is labelled as a curriculum rather than as a measurement.
"""
import pytest

from backend.tracking import subject_ai


STATE = {
    'subject': 'Algebra',
    'span': '30D',
    'aim': 'Get 24 on the AMC 8',
    'overall': 59,
    'finished': 33,
    'finished_before': 21,
    'rated': 31,
    'active_days': 11,
    'dimensions': [
        {'label': 'Mastery', 'value': 47, 'meaning': 'How hard the work is.',
         'evidence': ['31 rated tasks', 'mean difficulty 2.9 of 5']},
        {'label': 'Execution', 'value': 67, 'meaning': 'How it goes.',
         'evidence': ['mean 3.7 of 5']},
    ],
    'curve': {
        'rungs': [
            {'level': 3, 'label': 'Fair', 'done': 10, 'execution': 75,
             'quality': 60, 'cleared': 100, 'minutes': 25.0},
            {'level': 4, 'label': 'Hard', 'done': 9, 'execution': 25,
             'quality': 32, 'cleared': 0, 'minutes': 43.3},
        ],
        'best': {'label': 'Fair', 'execution': 75},
        'threshold': {'label': 'Hard', 'execution': 25},
        'drop': 50,
    },
    'time': {'known': True, 'typical': 25.0, 'hours': 14.3, 'drift': -1.2,
             'efficiency': 62, 'quicker': 55, 'rushed': 0, 'thorough': 9},
    'momentum': {'known': True, 'earlier': 51, 'later': 67, 'change': 16,
                 'direction': 'climbing'},
    'mistakes': [{'label': 'Kept getting interrupted', 'count': 4, 'share': 40}],
    'goals': [{'title': 'Get 24 on the AMC 8', 'progress': 50,
               'deadline': '2026-11-01', 'standing': 'projected 16 days late',
               'levers': ['Aim more of this subject at it — 2 of 11 tasks named it.']}],
    'vocabulary': ['Algebra', 'Equations', 'Functions', 'Inequalities'],
    'previous': [{'title': 'Timed Fair set', 'type': 'timed_set',
                  'difficulty': 3, 'minutes': 20, 'on': '2026-08-20'}],
    'outcomes': [{'type': 'timed_set', 'given': 3, 'taken': 2, 'change': 7}],
}


# ---------------------------------------------------------------------------
# The brief
# ---------------------------------------------------------------------------
def test_every_counted_figure_reaches_the_model():
    """A figure dropped on the way in is one the model is then forbidden to use.

    The prompt's whole instruction is "quote these and add nothing", which is
    only workable if the numbers on the reader's screen all arrive.
    """
    brief = subject_ai.brief_from(STATE)

    for expected in ('Algebra', '59', '33', '31', '11',
                     'Mastery: 47', 'Execution: 67', 'mean difficulty 2.9 of 5',
                     'Fair', 'Hard', '75', '25', '50',
                     '14.3', '62', 'climbing', '16',
                     'Kept getting interrupted', '40%',
                     'Get 24 on the AMC 8', 'timed_set'):
        assert expected in brief, expected


def test_the_brief_is_sectioned_so_the_instruction_can_name_a_section():
    """XML sections are not decoration. "Use the figures in
    <difficulty_analysis>" is followable in a way "use the figures above" is
    not, and a later change to one section leaves the others alone."""
    brief = subject_ai.brief_from(STATE)

    for section in ('subject_profile', 'dimensions', 'difficulty_analysis',
                    'time_analysis', 'recent_trends', 'mistake_patterns',
                    'skill_vocabulary', 'goals', 'recommendation_outcomes'):
        assert '<{}>'.format(section) in brief, section
        assert '</{}>'.format(section) in brief, section


def test_the_skill_vocabulary_is_labelled_as_a_curriculum():
    """The single worst thing this feature could produce is "your circle
    geometry is at 68%" — a number about a person that nobody counted. Ascen
    records a subject and a difficulty and nothing finer, so the area names
    have to arrive labelled as what they are."""
    brief = subject_ai.brief_from(STATE)

    assert 'NO measurement' in brief
    assert 'Equations' in brief
    # And the prompt has to say the same thing, since the label alone is a
    # hint rather than an instruction.
    assert 'It does **not** record' in subject_ai.SYSTEM
    assert 'a sub-skill' in subject_ai.SYSTEM
    assert 'MAY NOT state or imply the reader' in subject_ai.SYSTEM


def test_an_empty_section_is_left_out_rather_than_sent_blank():
    """An empty section is one the model has to decide means nothing, and it
    sometimes decides wrong."""
    brief = subject_ai.brief_from({'subject': 'Violin', 'dimensions': []})

    assert 'Violin' in brief
    assert '<mistake_patterns>' not in brief
    assert '<recommendation_outcomes>' not in brief


def test_a_kind_never_acted_on_reports_no_change_rather_than_none():
    """"It did not work" and "it was never tried" are different findings, and
    a zero would collapse them into the first."""
    brief = subject_ai.brief_from({
        **STATE,
        'outcomes': [{'type': 'review', 'given': 4, 'taken': 0, 'change': None}],
    })
    assert 'review: 4 recommended, 0 acted on' in brief


# ---------------------------------------------------------------------------
# The answer
# ---------------------------------------------------------------------------
def test_the_two_figures_the_model_supplies_are_clamped():
    """Difficulty and duration are the only numbers it is allowed to invent,
    and a 400-minute session at difficulty 9 is not a suggestion this page
    should print however confidently it arrives."""
    cleaned = subject_ai._clean({
        'diagnosis': [],
        'priorities': [],
        'next_steps': [
            {'title': 'Marathon', 'focus': 'Algebra', 'type': 'timed_set',
             'difficulty': 9, 'duration_minutes': 400, 'reason': 'x', 'drills': []},
            {'title': 'Atom', 'focus': 'Algebra', 'type': 'review',
             'difficulty': 0, 'duration_minutes': 1, 'reason': 'x', 'drills': []},
        ],
        'insights': [],
    })

    assert [step['difficulty'] for step in cleaned['next_steps']] == [5, 1]
    assert [step['minutes'] for step in cleaned['next_steps']] == [120, 10]


def test_an_unknown_session_kind_lands_in_a_known_bucket():
    """The feedback loop counts by kind. A free-text type would produce twelve
    spellings of "practice" and therefore no counts at all."""
    cleaned = subject_ai._clean({
        'diagnosis': [], 'priorities': [], 'insights': [],
        'next_steps': [{'title': 'Something', 'focus': 'x', 'type': 'vibes',
                        'difficulty': 3, 'duration_minutes': 30,
                        'reason': 'x', 'drills': []}],
    })
    assert cleaned['next_steps'][0]['type'] in subject_ai.STEP_TYPES


def test_confidence_out_of_range_is_not_confidence():
    cleaned = subject_ai._clean({
        'diagnosis': [
            {'finding': 'A', 'confidence': 4.2, 'evidence': ['x']},
            {'finding': 'B', 'confidence': -1, 'evidence': ['x']},
            {'finding': 'C', 'confidence': 'very', 'evidence': ['x']},
        ],
        'priorities': [], 'next_steps': [], 'insights': [],
    })
    assert [row['confidence'] for row in cleaned['diagnosis']] == [1.0, 0.0, 0.5]


def test_each_list_is_cut_to_what_the_page_draws():
    """The product rule: the database can be exhaustive and the UI selective.
    A page of forty-seven findings answers no question."""
    cleaned = subject_ai._clean({
        'diagnosis': [{'finding': 'd{}'.format(n), 'confidence': 0.5,
                       'evidence': ['a', 'b', 'c', 'd', 'e']} for n in range(9)],
        'priorities': [{'focus': 'p{}'.format(n), 'weight': 0.5, 'reason': 'x'}
                       for n in range(9)],
        'next_steps': [{'title': 's{}'.format(n), 'focus': 'x', 'type': 'review',
                        'difficulty': 3, 'duration_minutes': 30, 'reason': 'x',
                        'drills': ['a', 'b', 'c', 'd', 'e', 'f']} for n in range(9)],
        'insights': [{'observation': 'i{}'.format(n), 'evidence': 'x',
                      'implication': 'y'} for n in range(9)],
    })

    assert len(cleaned['diagnosis']) == subject_ai.DIAGNOSES
    assert len(cleaned['priorities']) == subject_ai.PRIORITIES
    assert len(cleaned['next_steps']) == subject_ai.NEXT_STEPS
    assert len(cleaned['insights']) == subject_ai.INSIGHTS
    assert len(cleaned['diagnosis'][0]['evidence']) == 4
    assert len(cleaned['next_steps'][0]['drills']) == 4


def test_an_empty_answer_is_a_failure_rather_than_an_empty_page():
    with pytest.raises(subject_ai.BriefUnavailable):
        subject_ai._clean({'diagnosis': [], 'priorities': [],
                           'next_steps': [], 'insights': []})


# ---------------------------------------------------------------------------
# Without a key
# ---------------------------------------------------------------------------
def test_without_a_key_it_says_so_instead_of_calling_anything(monkeypatch):
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    monkeypatch.setenv('HF_TOKEN', 'a-token-that-does-not-help-here')

    assert subject_ai.configured() is False
    with pytest.raises(subject_ai.BriefUnavailable) as caught:
        subject_ai.read(STATE)
    assert 'ANTHROPIC_API_KEY' in str(caught.value)


# ---------------------------------------------------------------------------
# The endpoints, and the loop
# ---------------------------------------------------------------------------
def test_the_endpoint_reports_availability_rather_than_failing(client, monkeypatch):
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    body = client.get('/api/subject_reading').json()
    assert body['success'] is True
    assert body['available'] is False


def test_the_endpoint_answers_readably_rather_than_erroring(client, monkeypatch):
    """A reading that cannot be made is not a broken request. The analytics
    under it were already complete."""
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    response = client.post('/api/subject_reading', json={'subject': 'Algebra'})

    assert response.status_code == 200
    assert response.json()['success'] is False
    assert 'ANTHROPIC_API_KEY' in response.json()['message']


def test_the_endpoint_needs_a_subject(client):
    response = client.post('/api/subject_reading', json={'subject': '  '})
    assert response.status_code == 200
    assert response.json()['success'] is False


def test_recommendations_start_empty_and_do_not_error(client):
    body = client.get('/api/subject_recommendations?subject=Algebra').json()
    assert body['success'] is True
    assert body['recommendations'] == []
    assert body['outcomes'] == []


def test_taking_a_recommendation_that_is_not_on_record_says_so(client):
    body = client.post('/api/subject_recommendation',
                       json={'id': 'nope', 'task_id': ''}).json()
    assert body['success'] is False


def test_outcomes_separate_never_tried_from_did_not_work():
    """The distinction the whole loop exists for. A kind recommended six times
    and never acted on has no change to report, and reporting nought would
    read as a verdict on it."""
    from backend.api.subject_ai import _outcomes

    rows = [
        {'kind': 'timed_set', 'taken_at': '2026-09-01', 'execution_at': 60},
        {'kind': 'timed_set', 'taken_at': '2026-09-02', 'execution_at': 64},
        {'kind': 'review', 'taken_at': None, 'execution_at': 60},
    ]
    by_kind = {entry['type']: entry for entry in _outcomes(rows, 70)}

    assert by_kind['timed_set'] == {'type': 'timed_set', 'given': 2, 'taken': 2,
                                    'change': 8}
    assert by_kind['review']['change'] is None
    assert by_kind['review']['taken'] == 0
