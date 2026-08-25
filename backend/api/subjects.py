"""Subjects — the catalogue, plus whatever this account has made of it.

The catalogue itself is a fixed hundred entries in backend/config/subjects.py.
This module is what makes it useful to a picker, and it does three things to
it before handing it over.

**It orders it by use.** The subjects this account files the most tasks under
move to the front, so someone who tags everything "Mathematics" and "Gym" is
offered those two first instead of scrolling to them every time. The count
comes from the user's own tasks, which is the only record of the choice —
there is no separate "favourites" table to keep in step, and there is nothing
to migrate if the catalogue is edited later. A subject retired from the
catalogue simply stops being counted, because the ordering walks the catalogue
rather than the tasks. Ties keep catalogue order, and catalogue order is
deliberate: the groups run from study through work to home, which is a
sensible first offer to an account that has never picked a subject at all.

**It puts the account's own subjects at the front of that.** Ahead of the
hundred, not sorted into them, and ahead of them however little they have been
used. Somebody who went and made a subject did so because the hundred did not
have the one they wanted; burying it at position forty because it is new would
undo the making of it.

**It applies the account's colours.** A `family` on a row here overrides the
palette's own answer for that subject — see frontend/src/utils/eventPalette.ts
for the twelve families and what they mean by default.

Storage for the last two is data/sql/subjects.sql. The catalogue is code and
is not in the database.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.api.guard import current_username
from backend.api.reply import fail, ok
from backend.config import subjects as catalogue
from backend.database import connection as db

router = APIRouter(tags=['subjects'])

# The twelve in frontend/src/utils/eventPalette.ts. Repeated rather than
# imported because there is nothing to import from — the palette is the
# frontend's. A name not in this list is refused, so a typo cannot reach a
# calendar block as an unknown family and paint it as nothing at all.
FAMILIES = (
    'blue', 'indigo', 'purple', 'teal', 'green', 'cyan',
    'yellow', 'orange', 'red', 'rose', 'brown', 'gray',
)

# What a custom subject's id looks like. The prefix is what keeps the two id
# spaces apart: no catalogue id can begin with it, so `_own` below can tell a
# made-up subject from one of the hundred without consulting either list.
CUSTOM_PREFIX = 'own_'

MAX_NAME = 40

# Enough for a picker to stay a picker. The catalogue is a hundred and the row
# is meant to be scanned; an account with two hundred of its own has built a
# different feature and should be told so rather than silently allowed.
MAX_CUSTOM = 40


class NewSubject(BaseModel):
    username: str = Depends(current_username)
    name: str = ''
    family: Optional[str] = None


class Recolour(BaseModel):
    username: str = Depends(current_username)
    # None clears the choice and hands the subject back to the palette.
    family: Optional[str] = None


def _slug(name):
    """"Data Science Team" as "own_data_science_team"."""
    body = re.sub(r'[^a-z0-9]+', '_', str(name).strip().lower()).strip('_')
    return CUSTOM_PREFIX + body if body else ''


def _rows(username):
    """This account's rows, keyed by subject id."""
    if not username:
        return {}
    return {
        row['subject_id']: row
        for row in db.user_subjects()
        if row.get('user_id') == username
    }


def usage(username: Optional[str]):
    """{subject_id: how many of this user's tasks carry it}."""
    if not username:
        return {}
    counts = {}
    for task in db.tasks_for(username):
        subject_id = task.get('subject')
        if not subject_id:
            continue
        counts[subject_id] = counts.get(subject_id, 0) + 1
    return counts


def _custom_entry(row, used):
    """One of the account's own subjects, in the shape the catalogue uses.

    Every field the hundred have, so nothing downstream has to ask which kind
    of subject it is holding. `icon` is the one that cannot be guessed well —
    the catalogue's hundred each have a drawing chosen for them, and a name
    nobody has seen before has none — so custom subjects share one mark and
    the colour is what tells them apart. That is also why the library asks for
    a colour when it asks for the name.
    """
    return {
        'id': row['subject_id'],
        'name': row.get('name') or row['subject_id'],
        'abbr': None,
        'label': row.get('name') or row['subject_id'],
        'icon': 'star',
        'group': 'Yours',
        'used': used,
        'family': row.get('family'),
        'custom': True,
    }


def own_ids(username):
    """The custom subject ids this account may file a task under.

    backend/api/tasks.py calls this: a subject id is stored only if something
    recognises it, and until there were custom subjects the catalogue was the
    only thing that could.
    """
    return {
        subject_id for subject_id, row in _rows(username).items()
        if row.get('custom')
    }


@router.get('/api/subjects')
def subjects(username: str = Depends(current_username)):
    """The account's own subjects, then the hundred, most-used first."""
    counts = usage(username)
    rows = _rows(username)

    mine = [
        _custom_entry(row, counts.get(subject_id, 0))
        for subject_id, row in rows.items()
        if row.get('custom')
    ]
    # Newest last, so the list does not reshuffle every time one is added.
    mine.sort(key=lambda entry: rows[entry['id']].get('created_at') or '')

    # `-used` sorts descending; the index keeps ties in catalogue order, which
    # `sorted` would preserve anyway but only because it is stable — saying it
    # here means the ordering does not depend on that.
    ordered = sorted(
        enumerate(catalogue.SUBJECTS),
        key=lambda pair: (-counts.get(pair[1]['id'], 0), pair[0]),
    )

    return ok(subjects=mine + [
        {
            **subject,
            'used': counts.get(subject['id'], 0),
            'family': (rows.get(subject['id']) or {}).get('family'),
            'custom': False,
        }
        for _, subject in ordered
    ])


@router.post('/api/subjects')
def create(body: NewSubject, username: str = Depends(current_username)):
    """Add a subject of this account's own."""

    name = ' '.join(str(body.name or '').split())[:MAX_NAME]
    if not name:
        return fail('A subject needs a name')

    subject_id = _slug(name)
    if not subject_id:
        return fail('That name has no letters or numbers in it')

    if catalogue.get(subject_id):
        return fail('The catalogue already has that one')

    family = body.family
    if family is not None and family not in FAMILIES:
        return fail('Unknown colour')

    rows = db.user_subjects()
    mine = [r for r in rows if r.get('user_id') == username]
    if any(r['subject_id'] == subject_id for r in mine):
        return fail('You already have a subject called that')
    if len([r for r in mine if r.get('custom')]) >= MAX_CUSTOM:
        return fail('That is as many subjects as one account can add')

    rows.append({
        'user_id': username,
        'subject_id': subject_id,
        'name': name,
        'family': family,
        'custom': True,
    })
    db.save_user_subjects(rows)
    return ok(subject=_custom_entry(rows[-1], 0))


@router.patch('/api/subjects/{subject_id}/color')
def recolour(subject_id: str, body: Recolour,
             username: str = Depends(current_username)):
    """Choose a colour for a subject — one of the account's own, or one of the
    hundred. `family: null` gives the subject back to the palette."""

    family = body.family
    if family is not None and family not in FAMILIES:
        return fail('Unknown colour')

    known = bool(catalogue.get(subject_id)) or subject_id in own_ids(username)
    if not known:
        return fail('No such subject')

    rows = db.user_subjects()
    for row in rows:
        if row.get('user_id') == username and row['subject_id'] == subject_id:
            # Clearing the colour on a catalogue subject leaves a row that says
            # nothing; drop it rather than store "this account has no opinion".
            if family is None and not row.get('custom'):
                rows.remove(row)
            else:
                row['family'] = family
            break
    else:
        rows.append({
            'user_id': username,
            'subject_id': subject_id,
            'name': '',
            'family': family,
            'custom': False,
        })

    db.save_user_subjects(rows)
    return ok(subject_id=subject_id, family=family)


@router.delete('/api/subjects/{subject_id}')
def remove(subject_id: str, username: str = Depends(current_username)):
    """Delete one of the account's own subjects.

    Tasks already filed under it keep the id. They draw as unfiled — the same
    as a task whose subject was retired from the catalogue — rather than being
    rewritten, because a delete here is about the picker and should not reach
    into the record of work already done.
    """
    if subject_id not in own_ids(username):
        return fail('That is not one of yours to delete')

    db.save_user_subjects([
        row for row in db.user_subjects()
        if not (row.get('user_id') == username and row['subject_id'] == subject_id)
    ])
    return ok(subject_id=subject_id)
