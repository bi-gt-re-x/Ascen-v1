"""Breaking a goal into checkpoints, with a model.

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

## Two providers, one job

Hugging Face first, Anthropic second — see `PROVIDERS`. The reason for the
choice is cost: this is one short answer per goal a person creates by hand, so
a small open model behind a free-tier token is the right size of tool, and
nobody should need a paid account to use a button. Anthropic stays because it
is markedly better at the part that is actually hard — five checkpoints that
are sequential, non-overlapping and real advances on each other is a reasoning
problem — and an account that has a key should get that.

Which one runs is `MILESTONE_PROVIDER`, or whichever key is present when that
is unset. Everything below the provider split is shared: same system prompt,
same brief, same parse, same enforcement of five. Swapping providers changes
where the sentence comes from and nothing about what the page does with it.

## Small models do not return clean JSON

The Anthropic path constrains the answer with a schema and gets an object
back. The Hugging Face path asks for JSON and gets, variously: JSON, JSON in a
markdown fence, JSON with a sentence in front of it, a bare array, or a
numbered list in prose. `_titles` handles all of them, because the alternative
is a feature that works on Tuesdays. It is deliberately generous on the way in
and strict on the way out — anything it cannot read five titles from raises,
and the page says so.

## Nothing here writes

A suggestion is a draft. This module hands five strings back to the endpoint
and the endpoint hands them to the page, where they land in five editable
fields that only reach the database if the user saves them. The model proposes
the plan; the account owns it.
"""
import json
import os
import re
from typing import List

# What the page draws, so what the model is asked for and what is enforced on
# the way back.
COUNT = 5

# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------
# Sonnet 5. Thinking is on by default here as it was on Opus, which is the
# property this actually depends on: the five have to be sequential and
# non-overlapping, and that is a reasoning problem rather than a recall one.
# `thinking` is left unset because omitting it on this model runs adaptive.
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL') or 'claude-sonnet-5'

# Room for the thinking as well as the answer — `max_tokens` is a hard limit
# on the two together, and five titles that arrive truncated are five titles
# the JSON parse rejects. 16k is the recommended ceiling for a request that
# does not stream, which this one does not: it is one short answer and the
# page is holding a spinner for it.
ANTHROPIC_MAX_TOKENS = 16000

# Sent as `anthropic-workspace-id` when set.
#
# An identity-linked key belongs to a person rather than to a workspace, and
# the API refuses it with a 400 saying so until the request names the
# workspace it acts in. A key that is not identity-linked does not need this
# and is not sent it — an empty value here means the header is omitted
# entirely rather than sent blank, which is its own 400.
ANTHROPIC_WORKSPACE_ID = os.environ.get('ANTHROPIC_WORKSPACE_ID') or ''

# ---------------------------------------------------------------------------
# Hugging Face
# ---------------------------------------------------------------------------
# The router is OpenAI-shaped, so this is one POST and no SDK: it takes the
# same `messages` array and answers in `choices[0].message.content`. Going
# through the router rather than at a named provider means the token works
# against whichever provider is actually serving the model that day.
HF_URL = 'https://router.huggingface.co/v1/chat/completions'

# A 7B that follows a JSON instruction well enough to be worth its price, which
# is the whole reason this path exists. Set HF_MODEL to trade up — a bigger
# instruct model gives noticeably better checkpoints and still costs a
# fraction of a frontier call:
#
#   Qwen/Qwen2.5-7B-Instruct          the default: cheapest that works
#   meta-llama/Llama-3.1-8B-Instruct  same size, often better prose
#   Qwen/Qwen2.5-72B-Instruct         much better plans, still cheap
#   meta-llama/Llama-3.3-70B-Instruct the strongest of the open options
HF_MODEL = os.environ.get('HF_MODEL') or 'Qwen/Qwen2.5-7B-Instruct'

# No thinking to budget for on these, and five six-word titles is a short
# answer. Generous enough that a model which preambles still gets its JSON out.
HF_MAX_TOKENS = 700

# Low, not zero. The task wants the obvious decomposition of a goal rather than
# an inventive one, and small models get less coherent as this climbs.
HF_TEMPERATURE = 0.3

# Long enough for a cold provider to load the model, short enough that the
# button does not look hung. The page holds its own spinner meanwhile.
HF_TIMEOUT = 60.0

# Tried in this order when MILESTONE_PROVIDER is unset. Cheap first: an account
# with both keys is not asking to be billed for a button it could have free.
PROVIDERS = ('huggingface', 'anthropic')

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

# Said only to the open models. The Anthropic path constrains the shape with a
# schema instead, and repeating it there costs tokens to no effect.
JSON_RULE = """\

Answer with JSON and nothing else — no explanation, no markdown fence:

{"milestones": ["first", "second", "third", "fourth", "fifth"]}
"""

# ---------------------------------------------------------------------------
# The second job: one checkpoint's checklist
# ---------------------------------------------------------------------------
# What a checkpoint's checklist holds, and so what is asked for. Between
# MIN_STEPS and MAX_STEPS in backend/api/goals.py, because the column is
# padded up to the first and cut at the second — asking for a number outside
# that range means asking for rows that will be silently added or dropped.
STEP_COUNT = 5

# The distinction the milestone prompt spends its words keeping apart is the
# one this prompt spends its words inverting. A checkpoint is a state; a step
# is the work that gets there, and here the actions are exactly what is
# wanted. Said plainly, because a model that has been told "not an action"
# about milestones will otherwise hedge toward states here too.
SYSTEM_STEPS = """\
You break one checkpoint of a long-term goal into the actions that reach it, \
for a study-planning app.

A step is an ACTION SOMEBODY DOES — a piece of work that can be sat down to \
and finished. This is the opposite of the checkpoint above it, which is a \
state being reached:

  Checkpoint: "Solving Silver DP problems unassisted"
  Step (right): "Work through the knapsack chapter"
  Step (wrong): "Confident with knapsack problems"

The second is a state. States are what checkpoints are; you are writing the \
work underneath one.

Rules for the set you return:
- Exactly five, in the order they would be done.
- Each is a single sitting or a small run of them, not a term's project.
- Concrete to this checkpoint and its subject. "Practise more" says nothing.
- Ten words or fewer each, starting with a verb.
- Together they are enough that finishing all five reaches the checkpoint.
"""

STEPS_SCHEMA = {
    'type': 'object',
    'properties': {
        'steps': {
            'type': 'array',
            'items': {'type': 'string'},
            'description': 'The five steps, in the order they would be done.',
        },
    },
    'required': ['steps'],
    'additionalProperties': False,
}


class PlannerUnavailable(RuntimeError):
    """The model could not be reached, or was not configured.

    Carries a message written for the person looking at the goals page rather
    than for a log, because that is where it is shown.
    """


# ---------------------------------------------------------------------------
# Which provider
# ---------------------------------------------------------------------------
def _hf_token() -> str:
    """The Hugging Face token, under either of the names people have it under."""
    return (os.environ.get('HF_TOKEN')
            or os.environ.get('HUGGINGFACE_API_KEY')
            or '')


def _keyed(provider: str) -> bool:
    """Whether this provider has what it needs to be called."""
    if provider == 'huggingface':
        return bool(_hf_token())
    if provider == 'anthropic':
        return bool(os.environ.get('ANTHROPIC_API_KEY'))
    return False


def provider() -> str:
    """The provider this call will use, or '' if none can be.

    Read per call rather than at import, because `load_dotenv()` in the entry
    point runs after this module is imported — the same reason `configured()`
    has always checked the environment late.
    """
    named = (os.environ.get('MILESTONE_PROVIDER') or '').strip().lower()
    if named in ('huggingface', 'hf'):
        return 'huggingface' if _keyed('huggingface') else ''
    if named == 'anthropic':
        return 'anthropic' if _keyed('anthropic') else ''
    return next((name for name in PROVIDERS if _keyed(name)), '')


def configured() -> bool:
    """Whether a suggestion can be made at all. Checked per call."""
    return bool(provider())


NO_KEY = (
    'Milestone suggestions need a model key in the environment. Either put a '
    'free Hugging Face token in HF_TOKEN (huggingface.co → Settings → Access '
    'Tokens → New token, read access is enough), or an ANTHROPIC_API_KEY. '
    'Add one to .env and restart the server.')


# ---------------------------------------------------------------------------
# The brief
# ---------------------------------------------------------------------------
def _ask(goal: str, instruction: str = '') -> str:
    """The user turn. Everything the account has said about the thing.

    `instruction` is what to do with it, and it differs between the two jobs
    this module does — five checkpoints for a goal, or a checklist for one
    checkpoint. The brief underneath is built the same way for both.
    """
    lead = instruction or 'Break this goal into its five checkpoints.'
    return (lead + '\n\n' + goal)


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


# ---------------------------------------------------------------------------
# Reading the answer
# ---------------------------------------------------------------------------
# A leading "1. ", "- ", "* " or "1) " on a prose fallback line.
_BULLET = re.compile(r'^\s*(?:[-*•]|\d+[.)])\s*')
# Quotes and trailing commas left by a list that was nearly JSON.
_TRIM = re.compile(r'^["\'\s,]+|["\'\s,]+$')


def _strings(value) -> List[str]:
    """Pull a list of titles out of whatever shape the JSON came back in."""
    if isinstance(value, list):
        found = []
        for entry in value:
            if isinstance(entry, str):
                found.append(entry)
            elif isinstance(entry, dict):
                # Some models answer [{"milestone": "..."}] however plainly the
                # prompt asked for strings.
                found.extend(str(inner) for inner in entry.values()
                             if isinstance(inner, str))
        return found
    if isinstance(value, dict):
        for key in ('milestones', 'checkpoints', 'steps', 'result', 'items'):
            if key in value:
                return _strings(value[key])
        # A single-key object wrapping the list under a name we did not guess.
        if len(value) == 1:
            return _strings(next(iter(value.values())))
    return []


def _titles(text: str) -> List[str]:
    """Five titles from a model's answer, however it chose to format it.

    Generous on the way in — see the module docstring. Order of attempts is
    cheapest-and-most-likely first, and each one is a shape a small model has
    actually been seen to return.
    """
    if not text or not text.strip():
        return []
    body = text.strip()

    # A markdown fence, with or without a language tag.
    fence = re.search(r'```(?:json)?\s*(.+?)```', body, re.S)
    if fence:
        body = fence.group(1).strip()

    # Clean JSON, which is the case the prompt asks for.
    try:
        found = _strings(json.loads(body))
        if found:
            return found
    except (json.JSONDecodeError, ValueError):
        pass

    # JSON with a sentence in front of it or behind it. Widest span first, so
    # an object holding the array wins over the array alone.
    for pattern in (r'\{.*\}', r'\[.*\]'):
        match = re.search(pattern, body, re.S)
        if not match:
            continue
        try:
            found = _strings(json.loads(match.group(0)))
            if found:
                return found
        except (json.JSONDecodeError, ValueError):
            continue

    # Prose: a numbered or bulleted list. Only lines that were actually marked
    # as list items, so a preamble sentence does not become a checkpoint.
    lines = [_TRIM.sub('', _BULLET.sub('', line))
             for line in body.splitlines() if _BULLET.match(line)]
    return [line for line in lines if line]


# ---------------------------------------------------------------------------
# The providers
# ---------------------------------------------------------------------------
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


def _from_anthropic(brief: str, system: str = None, schema: dict = None,
                    instruction: str = '') -> str:
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - dependency is in requirements
        raise PlannerUnavailable(
            'The anthropic package is not installed. Run: '
            '.venv-fastapi/bin/python -m pip install -r requirements.txt'
        ) from exc

    # The header is omitted rather than sent empty when there is no workspace
    # to name: a blank one is refused the same way a missing one is.
    client = anthropic.Anthropic(
        default_headers=({'anthropic-workspace-id': ANTHROPIC_WORKSPACE_ID}
                         if ANTHROPIC_WORKSPACE_ID else None))
    try:
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=ANTHROPIC_MAX_TOKENS,
            system=system or SYSTEM,
            # `high` is this model's own default, and the level its guidance
            # calls the balance of cost against intelligence. It was 'medium'
            # under Opus, and carrying that down a tier would have been two
            # step-downs at once — medium here is described as comparable to
            # the *previous* Sonnet at high, and a weak plan is worse than no
            # plan. Raise to 'xhigh' if the checkpoints come back shallow;
            # that is the documented lever, rather than prompting around it.
            output_config={
                'effort': 'high',
                'format': {'type': 'json_schema', 'schema': schema or SCHEMA},
            },
            messages=[{'role': 'user', 'content': _ask(brief, instruction)}],
        )
    except Exception as exc:  # noqa: BLE001 - every failure reads the same here
        # One exception to "every failure reads the same": a key that belongs
        # to a person rather than to a workspace is refused until the request
        # names one, and the raw 400 for it is the API talking to a developer.
        # This module's errors are shown on the goals page, so it says what to
        # do instead of what happened.
        if 'anthropic-workspace-id' in str(exc):
            raise PlannerUnavailable(
                'This Anthropic key is identity-linked, so it has to name the '
                'workspace it acts in. Put the workspace id in '
                'ANTHROPIC_WORKSPACE_ID in .env and restart the server — it '
                'is in the Anthropic console URL when the workspace is open, '
                'and on Settings → Workspaces.') from exc
        raise PlannerUnavailable(
            'Could not reach the model: {}'.format(exc)) from exc

    # Checked before the content is read: on a refusal `content` is empty or a
    # partial, and indexing it is how this would become a 500 instead of a
    # sentence on the page.
    if response.stop_reason == 'refusal':
        raise PlannerUnavailable(
            'The model declined to plan this. Try rewording the title.')

    return next((block.text for block in response.content
                 if block.type == 'text'), '')


def _from_huggingface(brief: str, system: str = None,
                      instruction: str = '') -> str:
    try:
        import httpx
    except ImportError as exc:  # pragma: no cover - arrives with anthropic
        raise PlannerUnavailable(
            'The httpx package is not installed. Run: '
            '.venv-fastapi/bin/python -m pip install -r requirements.txt'
        ) from exc

    payload = {
        'model': HF_MODEL,
        'max_tokens': HF_MAX_TOKENS,
        'temperature': HF_TEMPERATURE,
        'messages': [
            {'role': 'system', 'content': (system or SYSTEM) + JSON_RULE},
            {'role': 'user', 'content': _ask(brief, instruction)},
        ],
        # Honoured by some providers behind the router and ignored by the
        # rest, which is why `_titles` does not depend on it. Asking costs
        # nothing and makes the clean-JSON path the common one.
        'response_format': {'type': 'json_object'},
    }

    try:
        response = httpx.post(
            HF_URL,
            headers={'Authorization': 'Bearer {}'.format(_hf_token())},
            json=payload,
            timeout=HF_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001 - one message for every transport failure
        raise PlannerUnavailable(
            'Could not reach Hugging Face: {}'.format(exc)) from exc

    if response.status_code == 401:
        raise PlannerUnavailable(
            'Hugging Face rejected the token in HF_TOKEN. Check it is current '
            'and has read access.')
    if response.status_code == 402:
        raise PlannerUnavailable(
            'This Hugging Face account is out of inference credits for the '
            'month. Wait for the reset, or set HF_MODEL to a smaller model.')
    if response.status_code == 404:
        raise PlannerUnavailable(
            '“{}” is not being served by any Hugging Face provider. Set '
            'HF_MODEL to one that is.'.format(HF_MODEL))
    if response.status_code == 429:
        raise PlannerUnavailable(
            'Hugging Face is rate-limiting this token. Try again in a minute.')
    if response.status_code >= 400:
        raise PlannerUnavailable(
            'Hugging Face returned {}: {}'.format(
                response.status_code, response.text[:200]))

    try:
        choice = response.json()['choices'][0]['message']['content']
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise PlannerUnavailable(
            'Hugging Face’s answer could not be read. Try again.') from exc
    return choice or ''


# ---------------------------------------------------------------------------
# The one thing this module does
# ---------------------------------------------------------------------------
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

    using = provider()
    if not using:
        raise PlannerUnavailable(NO_KEY)

    brief = _brief(title, why, description, category, unit, target)
    text = (_from_huggingface(brief) if using == 'huggingface'
            else _from_anthropic(brief))

    cleaned = [str(entry).strip() for entry in _titles(text) if str(entry).strip()]
    if len(cleaned) < COUNT:
        raise PlannerUnavailable(
            'The model returned {} checkpoints instead of {}. Try again.'.format(
                len(cleaned), COUNT))
    return cleaned[:COUNT]


def suggest_steps(milestone, goal='', why='', description='', category='',
                  unit='', target='') -> List[str]:
    """Five steps for one checkpoint, in the order they would be done.

    The goal is passed as well as the checkpoint because a checkpoint title is
    six words and frequently meaningless alone: "Silver DP unassisted" is a
    different checklist under "Reach USACO Gold" than it would be under a
    goal about teaching. The model gets both and is asked about the one.

    Raises `PlannerUnavailable` on everything the page should say out loud,
    exactly as `suggest_milestones` does — a checklist that cannot be drafted
    is a checkpoint with the blank rows it would have had anyway.
    """
    if not (milestone or '').strip():
        raise PlannerUnavailable('A checkpoint needs a title before it can be broken down.')

    using = provider()
    if not using:
        raise PlannerUnavailable(NO_KEY)

    brief = _brief(goal or milestone, why, description, category, unit, target)
    if goal.strip():
        brief += '\n\nCheckpoint to break down: {}'.format(milestone.strip())
    else:
        brief = 'Checkpoint to break down: {}'.format(milestone.strip())
    instruction = 'Break this checkpoint into the five steps that reach it.'

    text = (_from_huggingface(brief, SYSTEM_STEPS, instruction) if using == 'huggingface'
            else _from_anthropic(brief, SYSTEM_STEPS, STEPS_SCHEMA, instruction))

    cleaned = [str(entry).strip() for entry in _titles(text) if str(entry).strip()]
    if len(cleaned) < STEP_COUNT:
        raise PlannerUnavailable(
            'The model returned {} steps instead of {}. Try again.'.format(
                len(cleaned), STEP_COUNT))
    return cleaned[:STEP_COUNT]
