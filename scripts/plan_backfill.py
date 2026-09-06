"""Fill in the plans an account's goals and checkpoints never got.

The goals page can break a goal into five checkpoints and a checkpoint into
five steps, both with a model — see backend/tracking/planner.py. Everything
created since that landed gets its plan as it is made. Everything created
before it did not, and no amount of using the app backfills them: the drafting
runs on creation, and these rows were already there.

This walks one account and fills only the gaps:

    a goal with no checkpoints at all   -> five checkpoints
    a checkpoint with no written steps  -> five steps

## It never overwrites

A goal that already has one checkpoint is a goal somebody planned by hand, and
a half-written checklist is somebody's half-written checklist. Both are left
exactly as they are. That is also what makes this resumable: a run that dies
on its twentieth call has written the first nineteen, and running it again
picks up at the twentieth rather than starting over or duplicating.

## It costs money, so it does nothing by default

Every gap is one model call. A dry run — the default — makes no calls at all
and prints what a real run would spend them on. `--write` is the flag that
lets it actually call and actually write, and `--limit` caps how many calls a
single run may make, so a first pass over a large account can be a small one.

## Completed goals are skipped

A five-step plan for something already finished is noise on the page and a
call nobody needed. `--include-completed` overrides that for an account whose
history is worth filling in.

## One failure is one gap

A call that fails — the model unreachable, an answer that could not be read,
a rate limit — is reported and skipped, and the run carries on to the next
gap. The alternative is a batch of forty that stops on the third and leaves
the account looking half-planned with no way to tell which half is missing.

Usage:

    .venv-fastapi/bin/python scripts/plan_backfill.py --user Alpha
    .venv-fastapi/bin/python scripts/plan_backfill.py --user Alpha --write --limit 5
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import settings  # noqa: E402
from backend.config.settings import DB_PATH  # noqa: E402
# Imported rather than restated, for the reason seed_showcase.py gives about
# `_recompute`: these are the shapes the app itself writes, and a script that
# invented its own would put rows in the database the app would never have
# produced. `_clean_steps`/`_steps_column` are the checklist's floor, ceiling
# and storage format; `_recompute` is what a goal's progress and status come
# to once its checkpoint list changes.
from backend.api.goals import (  # noqa: E402
    _clean_steps, _recompute, _steps_column,
)
from backend.tracking import planner  # noqa: E402


def _written(steps_column) -> int:
    """How many steps on a stored checkpoint actually have text.

    A checkpoint is seeded with `MIN_STEPS` placeholders, so "has steps" is
    never "the column is non-empty" — it is whether anybody, or anything, has
    written into one of them.
    """
    try:
        raw = json.loads(steps_column) if steps_column else []
    except (ValueError, TypeError):
        return 0
    if not isinstance(raw, list):
        return 0
    return sum(1 for row in raw
               if isinstance(row, dict) and str(row.get('title') or '').strip())


def find_gaps(con, user: str, include_completed: bool = False):
    """The goals with no checkpoints and the checkpoints with no steps.

    Read in one pass and returned as plain dicts, so the planning loop below
    is not holding a cursor open across calls that each take seconds.
    """
    con.row_factory = sqlite3.Row
    goals = [dict(r) for r in con.execute(
        'SELECT id, title, category, why, description, measure, unit,'
        ' current_value, target_number, status'
        ' FROM goals WHERE user_id = ?', (user,))]
    stones = [dict(r) for r in con.execute(
        'SELECT id, goal_id, title, steps, position'
        ' FROM goal_milestones WHERE user_id = ?', (user,))]

    if not include_completed:
        goals = [g for g in goals if (g.get('status') or '') != 'completed']
    live = {g['id'] for g in goals}

    has_stones = {s['goal_id'] for s in stones}
    goals_without = [g for g in goals if g['id'] not in has_stones]

    # Only checkpoints under a goal this run is considering: a checkpoint
    # under a completed goal is skipped for the same reason the goal is.
    stones_without = [s for s in stones
                      if s['goal_id'] in live and not _written(s['steps'])]
    stones_without.sort(key=lambda s: (str(s['goal_id']), s.get('position') or 0))

    return goals, goals_without, stones_without


def _brief_of(goal: dict) -> dict:
    """The goal's own words, as `planner` takes them."""
    target = ''
    if (goal.get('measure') or '') == 'number' and goal.get('target_number'):
        target = str(goal['target_number'])
    return {
        'why': goal.get('why') or '',
        'description': goal.get('description') or '',
        'category': goal.get('category') or '',
        'unit': goal.get('unit') or '',
        'target': target,
    }


def _next_milestone_id(con, taken: set) -> str:
    """An id no checkpoint has, across every account.

    `goal_milestones.id` is the primary key, so uniqueness is global rather
    than per-user — the app's own `_fresh_milestone_id` reads the whole table
    for the same reason.
    """
    n = 1
    while True:
        candidate = f'pb{n:07d}'
        if candidate not in taken:
            taken.add(candidate)
            return candidate
        n += 1


def plan_goal(con, user: str, goal: dict, taken: set) -> int:
    """Five checkpoints for a goal that has none. Returns how many were written."""
    titles = planner.suggest_milestones(goal['title'], **_brief_of(goal))
    now = datetime.now().isoformat()
    rows = []
    for position, title in enumerate(titles):
        rows.append((_next_milestone_id(con, taken), goal['id'], user, title,
                     '', position, 'pending', '', None, now,
                     _steps_column(_clean_steps([]))))
    con.executemany(
        'INSERT INTO goal_milestones (id, goal_id, user_id, title, note,'
        ' position, status, target_date, completed_at, created_at, steps)'
        ' VALUES (?,?,?,?,?,?,?,?,?,?,?)', rows)

    # The goal's progress and status are derived from its checkpoints, so a
    # goal that just grew five of them is a goal whose two computed columns
    # are now stale. Same call the API makes on every checkpoint write.
    shape = dict(goal)
    _recompute(shape, [{'status': 'pending'} for _ in rows])
    con.execute('UPDATE goals SET progress = ?, target_value = ?, status = ?'
                ' WHERE id = ? AND user_id = ?',
                (shape.get('progress'), shape.get('target_value'),
                 shape.get('status'), goal['id'], user))
    return len(rows)


def plan_steps(con, user: str, stone: dict, goal: dict | None) -> int:
    """Five steps for a checkpoint that has none. Returns how many were written."""
    brief = _brief_of(goal) if goal else {}
    titles = planner.suggest_steps(
        stone['title'], goal=(goal or {}).get('title', ''), **brief)

    steps = _clean_steps([
        {'id': f's{i + 1}', 'title': title, 'done': False,
         'task_id': None, 'due': None}
        for i, title in enumerate(titles)
    ])
    con.execute('UPDATE goal_milestones SET steps = ? WHERE id = ? AND user_id = ?',
                (_steps_column(steps), stone['id'], user))
    return sum(1 for s in steps if not s['placeholder'])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--user', default='Alpha')
    ap.add_argument('--write', action='store_true',
                    help='make the model calls and save. Without it, nothing '
                         'is called and nothing is written.')
    ap.add_argument('--limit', type=int, default=0,
                    help='stop after this many model calls (0 = no cap)')
    ap.add_argument('--include-completed', action='store_true',
                    help='plan finished goals too')
    args = ap.parse_args()

    # The same call backend/run.py makes before anything reads a key. Without
    # it a standalone script sees whatever is already exported and nothing
    # from .env, which reads as "no key configured" however carefully the key
    # was put there.
    settings.load_dotenv()

    con = sqlite3.connect(DB_PATH)
    try:
        con.execute('PRAGMA foreign_keys = ON')
        goals, goals_without, stones_without = find_gaps(
            con, args.user, args.include_completed)
        by_id = {g['id']: g for g in goals}
        calls = len(goals_without) + len(stones_without)

        print(f'{args.user}: {len(goals)} goals in scope')
        print(f'  {len(goals_without)} with no checkpoints')
        print(f'  {len(stones_without)} checkpoints with no steps')
        print(f'  {calls} model call(s) to fill every gap')

        if not args.write:
            print()
            print('Dry run — nothing called, nothing written. Re-run with '
                  '--write to fill these in.')
            for goal in goals_without:
                print(f'  goal  {goal["id"]:>14}  {goal["title"]}')
            for stone in stones_without:
                print(f'  step  {stone["id"]:>14}  {stone["title"]}')
            return 0

        if not planner.configured():
            print()
            print(planner.NO_KEY)
            return 1

        budget = args.limit if args.limit > 0 else calls
        used = failed = wrote_stones = wrote_steps = 0
        taken = {r[0] for r in con.execute('SELECT id FROM goal_milestones')}

        for goal in goals_without:
            if used >= budget:
                break
            used += 1
            try:
                wrote_stones += plan_goal(con, args.user, goal, taken)
                con.commit()
                print(f'  planned  {goal["title"]}')
            except planner.PlannerUnavailable as exc:
                con.rollback()
                failed += 1
                print(f'  FAILED   {goal["title"]}: {exc}')

        for stone in stones_without:
            if used >= budget:
                break
            used += 1
            try:
                wrote_steps += plan_steps(
                    con, args.user, stone, by_id.get(stone['goal_id']))
                con.commit()
                print(f'  stepped  {stone["title"]}')
            except planner.PlannerUnavailable as exc:
                con.rollback()
                failed += 1
                print(f'  FAILED   {stone["title"]}: {exc}')

        print()
        print(f'{used} call(s) made, {failed} failed')
        print(f'  {wrote_stones} checkpoints and {wrote_steps} steps written')
        if used < calls:
            print(f'  {calls - used} gap(s) left — run again to continue')
        return 1 if failed and not (wrote_stones or wrote_steps) else 0
    finally:
        con.close()


if __name__ == '__main__':
    raise SystemExit(main())
