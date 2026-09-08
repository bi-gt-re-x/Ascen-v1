"""The interpretation layer: diagnosis, priorities, and what to do next.

## The division this file exists to hold

    THE BACKEND COUNTS.  THE MODEL INTERPRETS.

Every figure that reaches this module was computed deterministically from the
account's own tasks — `subjectState` in frontend/src/components/Subject/state.ts
and `subjectModel` beside it. The model is never asked to average anything,
work out a rate, or decide how many tasks were finished. It is asked for the
four things arithmetic cannot supply:

  1. **Which finding explains which.** A difficulty curve that falls twelve
     points at Hard and a mistake pattern of "kept getting interrupted" are two
     rows in a table; that the first is probably caused by the second is a
     reading, and readings are what a model is for.
  2. **What the subject actually is.** "Drill the level below your ceiling" is
     the app's instruction. "Thirty minutes of angle-chasing before you go back
     to olympiad geometry" needs to know what geometry is made of, and there is
     no table in Ascen that knows.
  3. **What to do next, in order.** Ranked against the reader's stated goal
     rather than against whichever internal measure happens to be lowest.
  4. **Whether the last advice worked.** Given the outcomes of previous
     recommendations, which kinds of intervention are actually moving this
     particular account — which is how the system gets more personal as it
     collects more data rather than merely louder.

## The rule the prompt exists to enforce

**The model is given the numbers and may not produce any others.** It may
quote them, compare them, order them, and say what they imply; it may not
compute, estimate, re-round, or invent one. The schema helps by leaving
nowhere to put a figure except inside a field that also has to carry its
evidence.

This is not a style preference. A reader cannot tell a counted figure from an
invented one by looking at it, and the whole value of the page is that they do
not have to.

## What the record cannot support, and is therefore forbidden

Ascen records a subject and a difficulty on a task. It does **not** record a
sub-skill. So the model is handed the subject's authored skill tree as a
*vocabulary* — the names of the areas this subject is made of — and is told
plainly that these carry no measurement, and that it may recommend one but may
not claim the reader's standing in it. Without that instruction the obvious
failure is a fluent "your circle geometry is at 68%", which is a number about
a person that nobody counted.

## Sections, not a wall

The brief is XML-sectioned. That is not decoration: the instruction "use the
figures in <difficulty_analysis> and do not invent others" is followable in a
way that "use the figures above" is not, and the sections are what let a later
change to one part of the brief leave the rest alone.

## Nothing here writes to the account

A reading. The endpoint hands it to the page, the page draws it in panels that
say a model wrote them, and the reader decides what to keep. The one thing
that *is* stored is the recommendation itself — see backend/api/subject_ai.py
— because a recommendation nobody can look back at is a recommendation whose
effectiveness can never be checked, and that check is the last item on the
list above.
"""
from typing import Any, Dict, List

from backend.tracking import planner
from backend.tracking.subject_brief import BriefUnavailable, _object

#: Opus, for the reason subject_brief gives at length: this holds a
#: "quote these and only these" instruction across four nested structured
#: outputs while reasoning about which finding explains which, and the
#: characteristic failure of a smaller model on exactly that is a fluent
#: invented statistic about the reader.
MODEL_DEFAULT = 'claude-opus-5'

MAX_TOKENS = 16000

#: What the page draws. Bounds rather than validation for its own sake — the
#: product rule is that the UI is selective even though the database is not
#: (a page of forty-seven findings answers no question), so the caps are the
#: shape of the page rather than a safety limit.
DIAGNOSES = 3
PRIORITIES = 4
NEXT_STEPS = 3
INSIGHTS = 4

#: A recommended sitting, in minutes. The model supplies this and the
#: difficulty; both are recommendations, both are labelled as such, and both
#: are clamped here because a 400-minute session is not a suggestion the page
#: should print however confidently it arrives.
MINUTES = (10, 120)

#: Ascen's difficulty scale. Five levels, and the model is told the words.
DIFFICULTY = (1, 5)

#: The kinds of session the model may recommend. A closed list, because the
#: whole point of the feedback loop is counting which kind works for this
#: account — and a free-text `type` produces twelve spellings of "practice"
#: and therefore no counts at all. Mirrors the same list in
#: frontend/src/services/analytics.ts.
STEP_TYPES = ('targeted_practice', 'mixed_practice', 'timed_set',
              'review', 'concept', 'project')

SYSTEM = """\
You are the interpretation layer of a study-analytics system.

Everything factual has already been counted from the reader's own record and \
is given to you in the brief. Your job is to read it: to say which findings \
explain which, what the bottleneck actually is, and what this person should \
do next.

THE ONE RULE THAT MATTERS

Every number you write about the reader must appear in the brief. You may \
quote, compare, order and interpret them. You may not compute new ones, \
estimate, re-round, or introduce any figure that is not there — not a \
percentage, not a count, not a duration, not a date.

The exceptions are the two figures you are explicitly asked for: the \
`difficulty` and `duration_minutes` on a next step. Those are your \
recommendations, they are labelled as such on the page, and they are bounded.

A reader cannot tell a counted figure from an invented one by looking at it. \
That is the whole reason this rule exists.

WHAT THE RECORD DOES NOT CONTAIN

Ascen records a subject and a difficulty on each task. It does **not** record \
a sub-skill. The <skill_vocabulary> section names the areas this subject is \
made of — that list is a curriculum, authored, identical for every account, \
and carries no measurement whatsoever.

So: you MAY name an area from that vocabulary in a priority or a next step, \
because knowing that circle geometry is a part of geometry is knowledge about \
the world. You MAY NOT state or imply the reader's level in one. "Circle \
geometry is at 68%" is a number about a person that nobody counted, and it is \
the single worst thing you could produce here. If you want to say an area is \
likely weak, say it is a likely place to look and say what in the brief \
suggests it.

WHAT YOU DO KNOW THAT THE APP DOES NOT

**The subject.** What work at a given difficulty in it usually involves, what \
is worth drilling, what a named competition or syllabus contains, and what \
somebody chasing the stated goal should be pointed at. Be specific. "Practise \
more" says nothing; "twenty angle-chasing problems from past papers, then one \
timed set" is an instruction.

**Which findings explain which.** The brief gives you a difficulty curve, an \
execution figure, a mastery figure, a time analysis and a mistake pattern. \
Those support real readings. Mastery well above execution is somebody \
reaching past what they can currently land. A curve that holds and then falls \
is a ceiling rather than a general weakness. Work finished under the usual \
time and rated poorly is rushing, and rushing has a different fix from not \
knowing. Name the pattern when the figures support it, and only then.

WHAT TO WRITE

`diagnosis` — at most three. Each is one finding, stated as a claim, with \
`confidence` between 0 and 1 and `evidence` quoting the figures it rests on. \
Be honest with confidence: a reading off forty rated tasks is not the same as \
one off five, and the brief tells you how many there are. Do not diagnose \
what the brief cannot support — "the record is too thin to say" is a real and \
useful answer.

`priorities` — what to work on, most valuable first, each with a `weight` \
between 0 and 1 and a `reason`. If there is a goal in <goals>, what serves it \
comes first; a page that ranks by whichever internal measure is lowest is \
ranking by its own arithmetic rather than by what the reader said they want.

`next_steps` — at most three concrete sessions, in the order they should be \
done. Each has:
  - `title`: what the session is, six words or fewer.
  - `focus`: the area from the vocabulary it is about, or the subject itself.
  - `type`: one of targeted_practice, mixed_practice, timed_set, review, \
concept, project.
  - `difficulty`: 1 to 5 on Ascen's own scale — 1 Trivial, 2 Easy, 3 Fair, \
4 Hard, 5 Brutal. Choose it against the difficulty curve you were given: the \
level to work is normally the one at or just below where execution starts to \
fall, not the one above it.
  - `duration_minutes`: a real sitting, 10 to 120.
  - `reason`: one sentence, citing a figure from the brief. This is what makes \
the recommendation checkable rather than a horoscope.
  - `drills`: two to four specific things to do in the session, a few words \
each, concrete to the subject.

`insights` — at most four. Each is an `observation`, the `evidence` behind it, \
and the `implication` — what it means the reader should do differently. An \
observation with no implication is a statistic they can already see. Do not \
repeat a diagnosis here.

IF PREVIOUS RECOMMENDATIONS ARE PRESENT

<recommendation_outcomes> tells you what was recommended before and what \
happened to the figures afterwards. Use it. If one kind of session has been \
followed by improvement for this person and another has not, weight the next \
steps accordingly and say so in the reason. If a recommendation was made and \
never acted on, that is information too — a plan nobody follows is the wrong \
plan, and the fix is usually a smaller one.

TONE

Direct and specific. No encouragement, no praise, no "keep up the great work". \
State observations as observations and predictions as predictions. Never claim \
certainty you do not have.

Write the way somebody who knows the subject would say it out loud. Short \
sentences. Ordinary words. No em-dash asides, no "X, not Y" flourishes, and \
no sentence that exists to land a point rather than say a thing. Never open \
with "Your record shows" or close by summarising what you just said.
"""

SCHEMA = {
    'type': 'object',
    'properties': {
        'diagnosis': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'finding': {'type': 'string'},
                    'confidence': {'type': 'number'},
                    'evidence': {'type': 'array', 'items': {'type': 'string'}},
                },
                'required': ['finding', 'confidence', 'evidence'],
                'additionalProperties': False,
            },
        },
        'priorities': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'focus': {'type': 'string'},
                    'weight': {'type': 'number'},
                    'reason': {'type': 'string'},
                },
                'required': ['focus', 'weight', 'reason'],
                'additionalProperties': False,
            },
        },
        'next_steps': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string'},
                    'focus': {'type': 'string'},
                    'type': {'type': 'string', 'enum': list(STEP_TYPES)},
                    'difficulty': {'type': 'integer'},
                    'duration_minutes': {'type': 'integer'},
                    'reason': {'type': 'string'},
                    'drills': {'type': 'array', 'items': {'type': 'string'}},
                },
                'required': ['title', 'focus', 'type', 'difficulty',
                             'duration_minutes', 'reason', 'drills'],
                'additionalProperties': False,
            },
        },
        'insights': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'observation': {'type': 'string'},
                    'evidence': {'type': 'string'},
                    'implication': {'type': 'string'},
                },
                'required': ['observation', 'evidence', 'implication'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['diagnosis', 'priorities', 'next_steps', 'insights'],
    'additionalProperties': False,
}


NO_KEY = (
    'Reading your subject back needs an Anthropic key. Put one in '
    'ANTHROPIC_API_KEY in .env and restart the server. A Hugging Face token '
    'does not cover this one: it asks a model to reason over a table of your '
    'figures without adding any, and a small model inventing a number about '
    'you here would be worse than no panel at all.')


def configured() -> bool:
    """Whether the button can do anything. Checked per call, as planner does."""
    return bool(planner._keyed('anthropic'))


# ---------------------------------------------------------------------------
# The brief
# ---------------------------------------------------------------------------
def _section(name: str, lines: List[str]) -> str:
    """One XML section, or nothing at all when it has no content.

    An empty section is a section the model has to decide means nothing, and
    it sometimes decides wrong — the same reasoning `subject_brief.brief_from`
    gives for leaving absent lines out.
    """
    body = [line for line in lines if str(line).strip()]
    if not body:
        return ''
    return '<{0}>\n{1}\n</{0}>'.format(name, '\n'.join(body))


def _kv(label: str, value: Any) -> str:
    return '' if value in (None, '', []) else '{}: {}'.format(label, value)


def brief_from(state: Dict[str, Any]) -> str:
    """The subject state, as the sections the model reads.

    Text rather than raw JSON, for the reason the other briefs give: the
    instruction that matters is "quote these and add nothing", and labelled
    statements are what that is easiest to follow against. The sections are
    the spec's, so a change to one leaves the others alone.
    """
    parts: List[str] = []

    # ---- Who and what --------------------------------------------------
    parts.append(_section('subject_profile', [
        _kv('Subject', state.get('subject')),
        _kv('Window these figures cover', state.get('span')),
        _kv('Overall rating out of 100', state.get('overall')),
        _kv('Tasks finished in the window', state.get('finished')),
        _kv('Tasks finished the window before', state.get('finished_before')),
        _kv('Of the finished ones, rated on both rows', state.get('rated')),
        _kv('Days in the window with work here', state.get('active_days')),
        _kv('What they say they are chasing here', state.get('aim')),
        _kv('Where they say they are now', state.get('level')),
    ]))

    # ---- The dimensions, each with what it was counted from -------------
    dimensions = state.get('dimensions') or []
    if dimensions:
        lines = []
        for entry in dimensions:
            value = entry.get('value')
            if value is None:
                continue
            lines.append('{}: {} — {}'.format(
                entry.get('label'), value, entry.get('meaning') or ''))
            for item in (entry.get('evidence') or []):
                lines.append('    evidence: {}'.format(item))
        parts.append(_section('dimensions', lines))

    # ---- The curve, which is the most useful thing here ------------------
    curve = state.get('curve') or {}
    rungs = curve.get('rungs') or []
    if rungs:
        lines = ['Ascen rates difficulty 1-5: 1 Trivial, 2 Easy, 3 Fair, '
                 '4 Hard, 5 Brutal. Execution and quality are 0-100.']
        for rung in rungs:
            if not rung.get('done'):
                continue
            lines.append(
                '  Level {} ({}): {} rated, execution {}, quality {}, '
                'landed {}%, median {} min'.format(
                    rung.get('level'), rung.get('label'), rung.get('done'),
                    rung.get('execution'), rung.get('quality'),
                    rung.get('cleared'), rung.get('minutes')))
        if curve.get('threshold'):
            lines.append('')
            lines.append(
                'The app worked out where this falls off: execution is best at '
                '{} and drops {} points by {}.'.format(
                    (curve.get('best') or {}).get('label'), curve.get('drop'),
                    (curve.get('threshold') or {}).get('label')))
        elif curve.get('best'):
            lines.append('')
            lines.append(
                'The app found no level where execution falls away sharply. '
                'The best-executed level is {}.'.format(
                    (curve.get('best') or {}).get('label')))
        parts.append(_section('difficulty_analysis', lines))

    # ---- Time, and what it bought ---------------------------------------
    time = state.get('time') or {}
    if time.get('known'):
        parts.append(_section('time_analysis', [
            'Ascen does not ask how long a task should take. "Usual" below '
            'means this account\'s own median time at that difficulty in this '
            'subject, so the comparison is against themselves.',
            _kv('Median minutes a task', time.get('typical')),
            _kv('Hours logged in the window', time.get('hours')),
            _kv('Mean minutes against their own median', time.get('drift')),
            _kv('Share of tasks finished quicker than usual, percent',
                time.get('quicker')),
            _kv('Efficiency out of 100 (speed weighted by how it was rated)',
                time.get('efficiency')),
            _kv('Finished quicker than usual AND rated poorly', time.get('rushed')),
            _kv('Took longer than usual AND rated well', time.get('thorough')),
        ]))

    # ---- Direction -------------------------------------------------------
    momentum = state.get('momentum') or {}
    if momentum.get('known'):
        parts.append(_section('recent_trends', [
            'Measured as the later half of the window against the earlier '
            'half, in points of execution.',
            _kv('Earlier half', momentum.get('earlier')),
            _kv('Later half', momentum.get('later')),
            _kv('Change in points', momentum.get('change')),
            _kv('Direction', momentum.get('direction')),
        ]))

    # ---- What goes wrong -------------------------------------------------
    reasons = state.get('mistakes') or []
    if reasons:
        lines = ['Chosen by the reader from a fixed list of six, on tasks they '
                 'rated at or below Solid.']
        for entry in reasons:
            lines.append('  {}: {} tasks, {}% of the badly-rated ones'.format(
                entry.get('label'), entry.get('count'), entry.get('share')))
        parts.append(_section('mistake_patterns', lines))

    # ---- The curriculum's own words, and nothing more --------------------
    vocabulary = [str(entry).strip() for entry in (state.get('vocabulary') or [])
                  if str(entry).strip()]
    if vocabulary:
        parts.append(_section('skill_vocabulary', [
            'The named areas of this subject, from Ascen\'s authored skill '
            'tree. This is a curriculum: it is identical for every account and '
            'carries NO measurement of this reader. Name one if it helps; do '
            'not state their level in it.',
            '  ' + ', '.join(vocabulary),
        ]))

    # ---- What it is all for ----------------------------------------------
    goals = state.get('goals') or []
    if goals:
        lines = []
        for entry in goals:
            lines.append('  "{}": {}% done, due {}, {}'.format(
                entry.get('title'), entry.get('progress'),
                entry.get('deadline') or 'no date set',
                entry.get('standing') or 'no projection'))
            for lever in (entry.get('levers') or []):
                lines.append('      the app says: {}'.format(lever))
        parts.append(_section('goals', lines))

    # ---- What was said last time, and whether it worked -------------------
    previous = state.get('previous') or []
    if previous:
        lines = []
        for entry in previous:
            lines.append('  {} — {} at difficulty {}, {} min, given {}'.format(
                entry.get('title'), entry.get('type'), entry.get('difficulty'),
                entry.get('minutes'), entry.get('on')))
        parts.append(_section('previous_recommendations', lines))

    outcomes = state.get('outcomes') or []
    if outcomes:
        lines = ['What happened to the figures after each kind of session was '
                 'recommended. Counted by the app, not by you.']
        for entry in outcomes:
            lines.append('  {}: {} recommended, {} acted on, execution moved '
                         '{} points after'.format(
                             entry.get('type'), entry.get('given'),
                             entry.get('taken'), entry.get('change')))
        parts.append(_section('recommendation_outcomes', lines))

    return '\n\n'.join(part for part in parts if part)


# ---------------------------------------------------------------------------
# Reading the answer
# ---------------------------------------------------------------------------
def _clamp(value: Any, low: int, high: int, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(low, min(high, number))


def _unit(value: Any) -> float:
    """A 0-1 weight, defensively. Out-of-range confidence is not confidence."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.5
    return round(max(0.0, min(1.0, number)), 2)


def _clean(found: Dict[str, Any]) -> Dict[str, Any]:
    """The answer, narrowed to the shape the page draws.

    Everything is bounded on the way out, and every list is cut to what the
    page has room for — the product rule that the UI is selective even though
    the analytics are not.
    """
    diagnosis = []
    for entry in (found.get('diagnosis') or [])[:DIAGNOSES]:
        if not isinstance(entry, dict):
            continue
        finding = str(entry.get('finding') or '').strip()
        if not finding:
            continue
        diagnosis.append({
            'finding': finding,
            'confidence': _unit(entry.get('confidence')),
            'evidence': [str(item).strip() for item in (entry.get('evidence') or [])
                         if str(item).strip()][:4],
        })

    priorities = []
    for entry in (found.get('priorities') or [])[:PRIORITIES]:
        if not isinstance(entry, dict):
            continue
        focus = str(entry.get('focus') or '').strip()
        if not focus:
            continue
        priorities.append({
            'focus': focus,
            'weight': _unit(entry.get('weight')),
            'reason': str(entry.get('reason') or '').strip(),
        })

    steps = []
    for entry in (found.get('next_steps') or [])[:NEXT_STEPS]:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get('title') or '').strip()
        if not title:
            continue
        kind = str(entry.get('type') or '').strip()
        steps.append({
            'title': title,
            'focus': str(entry.get('focus') or '').strip(),
            # An unknown type would break the counting the feedback loop is
            # for, so it lands in the general bucket rather than in a new one.
            'type': kind if kind in STEP_TYPES else 'targeted_practice',
            'difficulty': _clamp(entry.get('difficulty'), *DIFFICULTY, fallback=3),
            'minutes': _clamp(entry.get('duration_minutes'), *MINUTES, fallback=30),
            'reason': str(entry.get('reason') or '').strip(),
            'drills': [str(item).strip() for item in (entry.get('drills') or [])
                       if str(item).strip()][:4],
        })

    insights = []
    for entry in (found.get('insights') or [])[:INSIGHTS]:
        if not isinstance(entry, dict):
            continue
        observation = str(entry.get('observation') or '').strip()
        if not observation:
            continue
        insights.append({
            'observation': observation,
            'evidence': str(entry.get('evidence') or '').strip(),
            'implication': str(entry.get('implication') or '').strip(),
        })

    if not (diagnosis or priorities or steps or insights):
        raise BriefUnavailable('The model returned nothing usable. Try again.')

    return {
        'diagnosis': diagnosis,
        'priorities': priorities,
        'next_steps': steps,
        'insights': insights,
    }


# ---------------------------------------------------------------------------
# The one thing this module does
# ---------------------------------------------------------------------------
def read(state: Dict[str, Any], model_id: str = '') -> Dict[str, Any]:
    """A reading of this subject state, and what to do next.

    Raises `BriefUnavailable` for everything the page should say out loud —
    no key, a refused request, an unreadable answer. The caller turns that
    into a sentence in the panel rather than into a 500: a reading that
    cannot be made is a page that says so, over analytics that were already
    complete without it.
    """
    if not configured():
        raise BriefUnavailable(NO_KEY)
    if not str(state.get('subject') or '').strip():
        raise BriefUnavailable('There is no subject to read.')

    try:
        text = planner.from_anthropic(
            brief_from(state),
            system=SYSTEM,
            schema=SCHEMA,
            instruction=(
                'Read this subject state. Diagnose, prioritise, and say what '
                'to do next — using only the figures in the sections below.'),
            model_id=model_id or MODEL_DEFAULT,
            max_tokens=MAX_TOKENS,
        )
    except planner.PlannerUnavailable as exc:
        # The client, the workspace header and the refusal check are shared
        # with the goals page — see `planner.from_anthropic`. Its errors are
        # already written for a reader rather than for a log.
        raise BriefUnavailable(str(exc)) from exc

    return _clean(_object(text))
