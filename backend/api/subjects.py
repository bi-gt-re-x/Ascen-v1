"""Subjects — the catalogue, ordered by what this account actually uses.

The catalogue itself is a fixed hundred entries in backend/config/subjects.py.
This endpoint is what makes it useful to a picker: it hands the list back with
the subjects this user has filed the most tasks under moved to the front, so
someone who tags everything "Mathematics" and "Gym" is offered those two first
instead of scrolling to them every time.

The count comes from the user's own tasks, which is the only record of the
choice — there is no separate "favourites" table to keep in step, and there is
nothing to migrate if the catalogue is edited later. A subject that has been
retired from the catalogue simply stops being counted, because the ordering
walks the catalogue rather than the tasks.

Ties keep catalogue order, and catalogue order is deliberate: the groups run
from study through work to home, which is a sensible first offer to an account
that has never picked a subject at all.
"""
from typing import Optional

from fastapi import APIRouter

from backend.api.reply import ok
from backend.config import subjects as catalogue
from backend.database import connection as db

router = APIRouter(tags=['subjects'])


def usage(username: Optional[str]):
    """{subject_id: how many of this user's tasks carry it}."""
    if not username:
        return {}
    counts = {}
    for task in db.tasks():
        if task.get('user_id') != username:
            continue
        subject_id = task.get('subject')
        if not subject_id:
            continue
        counts[subject_id] = counts.get(subject_id, 0) + 1
    return counts


@router.get('/api/subjects')
def subjects(username: str = ''):
    """The hundred subjects, most-used first, each with its label and icon."""
    counts = usage(username)

    # `-used` sorts descending; the index keeps ties in catalogue order, which
    # `sorted` would preserve anyway but only because it is stable — saying it
    # here means the ordering does not depend on that.
    ordered = sorted(
        enumerate(catalogue.SUBJECTS),
        key=lambda pair: (-counts.get(pair[1]['id'], 0), pair[0]),
    )

    return ok(subjects=[
        {**subject, 'used': counts.get(subject['id'], 0)}
        for _, subject in ordered
    ])
