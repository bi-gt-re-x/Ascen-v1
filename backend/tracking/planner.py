"""Breaking a goal into checkpoints, with the model.

## Why this is a model and not a rule

Every other file in this package computes something: XP from a task, a streak
from a run of days, focus time from a stopwatch. Those are arithmetic, and
arithmetic is what a tracker is for. "What are the five checkpoints between
here and USACO Gold?" is not arithmetic — it is domain knowledge about a
subject the app has never heard of, and there is no table it could be read
from. That is the one job here.

## What a checkpoint is, and why the prompt spends its words on it

The distinction the whole goals page is built on is that a milestone is *a
state the goal reaches*, not an action taken toward it — "Master Silver DP" is
a checkpoint, "Solve ten DP problems" is a task. A model asked for "five steps"
returns the tasks every time, so the prompt says which of the two it wants and
shows the difference rather than naming it.

Five, and exactly five, because that is what the page draws. The count is
asked for in the prompt and enforced here on the way back: `suggest` returns
five titles or raises, and never a short list the caller has to pad.

## Nothing here writes

A suggestion is a draft. This module hands five strings back to the endpoint
and the endpoint hands them to the page, where they land in five editable
fields that only reach the database if the user saves them. The model proposes
the plan; the account owns it.
"""
import json
import os
from typing import List

# Opus 5 — the checkpoints are the whole value of the feature and a weaker
# plan is worse than none. Thinking is on by default on this model, which is
# what we want here: the five have to be sequential and non-overlapping, and
# that is a reasoning problem rather than a recall one.
MODEL = 'claude-opus-5'

# What the page draws, so what the model is asked for and what is enforced on
# the way back.
COUNT = 5

# Room for the thinking as well as the answer — on Opus 5 `max_tokens` caps
# both together, and five titles that arrive truncated are five titles the
# JSON parse rejects.
MAX_TOKENS = 16000

SYSTEM = """\
You break a long-term goal into its checkpoints for a study-planning app.

A checkpoint is a STATE THE GOAL REACHES, not an action taken toward it. This \
distinction is the whole point and getting it wrong makes the output useless:

  Goal: Reach USACO Gold
  Checkpoint (right): "Solving Silver DP problems unassisted"
  Checkpoint (wrong): "Do ten DP practice problems"

The second is a task. Tasks are the evidence a checkpoint is being reached and \
the app tracks them separately; you are writing the checkpoints.

Rules for the set you return:
- Exactly five, in the order they will be reached.
- Each one is a real advance on the one before it, and they do not overlap.
- The fifth is the goal itself being reached.
- Specific to this goal and its subject. "Make good progress" says nothing.
- Six words or fewer each, written as a state: no leading verb like \
"Complete", "Finish" or "Start".
"""


class PlannerUnavailable(RuntimeError):
    """The model could not be reached, or was not configured.

    Carries a message written for the person looking at the goals page rather
    than for a log, because that is where it is shown.
    """


def configured() -> bool:
    """Whether a key is present. Checked per call — `.env` loads at startup."""
    return bool(os.environ.get('ANTHROPIC_API_KEY'))


def _client():
    if not configured():
        raise PlannerUnavailable(
            'Milestone suggestions need an ANTHROPIC_API_KEY in the '
            'environment. Add one and restart the server.')
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - dependency is in requirements
        raise PlannerUnavailable(
            'The anthropic package is not installed. Run: '
            '.venv-fastapi/bin/python -m pip install -r requirements.txt'
        ) from exc
    return anthropic.Anthropic()


def _ask(goal: str) -> str:
    """The user turn. Everything the account has said about the goal."""
    return ('Break this goal into its five checkpoints.\n\n' + goal)


def _brief(title: str, why: str = '', description: str = '',
           category: str = '', unit: str = '', target: str = '') -> str:
    """What the account has told us about the goal, as lines the model reads.

    Only the fields that were filled in. An empty "Why: " line is a line the
    model has to decide means nothing, and it sometimes decides wrong.
    """
    lines = ['Goal: {}'.format(title.strip())]
    if category and category != 'other':
        lines.append('Field: {}'.format(category))
    if why.strip():
        lines.append('Why it matters: {}'.format(why.strip()))
    if description.strip():
        lines.append('Notes: {}'.format(description.strip()))
    if target:
        lines.append('Target: {}{}'.format(target, ' {}'.format(unit) if unit else ''))
    return '\n'.join(lines)


# The response is parsed, so it is constrained rather than asked for politely.
# `minItems`/`maxItems` are not supported constraints, which is why the count
# is stated in the prompt and checked below instead.
SCHEMA = {
    'type': 'object',
    'properties': {
        'milestones': {
            'type': 'array',
            'items': {'type': 'string'},
            'description': 'The five checkpoints, in the order they are reached.',
        },
    },
    'required': ['milestones'],
    'additionalProperties': False,
}


def suggest_milestones(title, why='', description='', category='',
                       unit='', target='') -> List[str]:
    """Five checkpoint titles for this goal, in order.

    Raises `PlannerUnavailable` for anything the page should say out loud: no
    key, no package, a refused request, a call that failed. The caller turns
    that into a message on the goal rather than into a 500 — a suggestion
    failing is a suggestion not appearing, not the page breaking.
    """
    if not (title or '').strip():
        raise PlannerUnavailable('A goal needs a title before it can be broken down.')

    client = _client()
    brief = _brief(title, why, description, category, unit, target)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM,
            output_config={
                'effort': 'medium',
                'format': {'type': 'json_schema', 'schema': SCHEMA},
            },
            messages=[{'role': 'user', 'content': _ask(brief)}],
        )
    except Exception as exc:  # noqa: BLE001 - every failure reads the same here
        raise PlannerUnavailable(
            'Could not reach the model: {}'.format(exc)) from exc

    # Checked before the content is read: on a refusal `content` is empty or a
    # partial, and indexing it is how this would become a 500 instead of a
    # sentence on the page.
    if response.stop_reason == 'refusal':
        raise PlannerUnavailable(
            'The model declined to plan this goal. Try rewording the title.')

    text = next((block.text for block in response.content
                 if block.type == 'text'), '')
    try:
        titles = json.loads(text).get('milestones') or []
    except (json.JSONDecodeError, AttributeError) as exc:
        raise PlannerUnavailable(
            'The model’s answer could not be read. Try again.') from exc

    cleaned = [str(entry).strip() for entry in titles if str(entry).strip()]
    if len(cleaned) < COUNT:
        raise PlannerUnavailable(
            'The model returned {} checkpoints instead of {}. Try again.'.format(
                len(cleaned), COUNT))
    return cleaned[:COUNT]
