"""Is the model actually reachable, and what is stopping it if not.

Two features in this app call a model: the goals page's checkpoint and step
suggestions (backend/tracking/planner.py) and the "Read this back to me" panel
on a subject's analytics page (backend/tracking/subject_brief.py). Both fail
the same way when the environment is not right, and both fail *politely* — a
sentence in the page rather than an error — which is correct for a reader and
unhelpful for whoever is setting the thing up.

So this says the same thing out loud, in one command, with the check that
actually matters at the end: a real call.

    .venv-fastapi/bin/python scripts/check_model.py          # config only
    .venv-fastapi/bin/python scripts/check_model.py --call   # config + one call

## The live call is opt-in, because it costs money

Everything before `--call` reads the environment and spends nothing. The call
is one short request and is the only part that can prove the setup works —
a key can be present, correctly formatted and still refused, which is exactly
the state this script was written for.

## What it does not do

It does not write to .env, create anything, or read a key aloud. It reports
which names are set and how the API answered, and prints the fix for the
answer it got.
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / '.env')

from backend.tracking import planner, subject_brief  # noqa: E402


def _mark(ok: bool) -> str:
    return 'yes' if ok else 'no '


def report() -> None:
    """What is set, and what each feature can do with it."""
    key = os.environ.get('ANTHROPIC_API_KEY') or ''
    workspace = planner.workspace_id()
    hf = bool(os.environ.get('HF_TOKEN') or os.environ.get('HUGGINGFACE_API_KEY'))
    groq = os.environ.get('GROQ_API_KEY') or ''

    print('Environment')
    # Length and prefix only. The prefix is the one part worth seeing — it says
    # which kind of key this is, and an admin key here is a common mix-up.
    print('  ANTHROPIC_API_KEY       {}  {}'.format(
        _mark(bool(key)),
        '{}… ({} chars)'.format(key[:12], len(key)) if key else 'unset'))
    print('  ANTHROPIC_WORKSPACE_ID  {}  {}'.format(
        _mark(bool(workspace)), workspace or 'unset'))
    print('  GROQ_API_KEY            {}  {}'.format(
        _mark(bool(groq)),
        '{}… ({} chars)'.format(groq[:8], len(groq)) if groq else 'unset'))
    print('  GROQ_MODEL              {}'.format(planner.GROQ_MODEL))
    print('  HF_TOKEN                {}'.format(_mark(hf)))
    print('  MILESTONE_PROVIDER      {}'.format(
        os.environ.get('MILESTONE_PROVIDER') or 'unset (cheapest key wins)'))
    print()

    print('Features')
    print('  Goals: suggest checkpoints   {}  (provider: {})'.format(
        _mark(planner.configured()), planner.provider() or 'none'))
    # Not "Anthropic only" any more. It needs a provider that will hold a JSON
    # schema, which Groq does and the Hugging Face router's default does not —
    # so the line names the one being used rather than the one it used to be.
    print('  Subject: read this back      {}  (provider: {})'.format(
        _mark(subject_brief.configured()),
        planner.provider() if planner.able() else 'none that holds a schema'))
    print()

    # "yes" above means a key is set, which is all this half can honestly
    # check: an identity-linked key and a workspace key have the same
    # `sk-ant-api03-` prefix and the same length, so there is no way to tell
    # them apart without calling. That leaves the one state this script was
    # written for reading as fine — a key present, both features "yes", and
    # every request refused. Naming it here costs a line and saves the reader
    # concluding the config is right and the bug is elsewhere.
    if key and not workspace:
        print('Note: no workspace id is set. That is correct for an ordinary')
        print('workspace key. If calls come back saying the key is')
        print('identity-linked, it is this line — see ANTHROPIC_WORKSPACE_ID in')
        print('.env.example. Nothing here can tell the two kinds of key apart;')
        print('only --call can.')
        print()


def call() -> int:
    """One real request, and the fix for whatever comes back."""
    if not subject_brief.configured():
        print('No Anthropic key, so there is nothing to call.')
        print(subject_brief.NO_KEY)
        return 1

    print('Calling {}…'.format(subject_brief.MODEL_DEFAULT))
    # The smallest brief that still exercises the whole path: the prompt, the
    # schema, the parse and the clamp.
    findings = {
        'subject': 'Mathematics',
        'span': '30D',
        'score': 61,
        'grade': 'C',
        'finished': 18,
        'finished_before': 12,
        'streak': 4,
        'rates': [{'label': 'Quality', 'now': 47}, {'label': 'Consistency', 'now': 48}],
        'bands': [{'label': 'Trivial', 'done': 9, 'holding': 90},
                  {'label': 'Brutal', 'done': 15, 'holding': 61}],
        'struggles': [{'label': 'Kept getting interrupted', 'share': 40, 'count': 4}],
        'goals': [],
    }

    try:
        written = subject_brief.write(findings)
    except subject_brief.BriefUnavailable as exc:
        print()
        print('It did not work. The app would show this in the panel:')
        print()
        print('  ' + str(exc).replace('\n', '\n  '))
        return 1

    print()
    print('Reading:')
    print('  ' + written['reading'])
    for item in written['practice']:
        print()
        print('  {} — {} min'.format(item['title'], item['minutes']))
        for point in item['focus']:
            print('    - {}'.format(point))
        print('    Why: {}'.format(item['why']))
    print()
    print('Working.')
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--call', action='store_true',
                        help='make one real request (costs money)')
    args = parser.parse_args()

    report()
    return call() if args.call else 0


if __name__ == '__main__':
    raise SystemExit(main())
