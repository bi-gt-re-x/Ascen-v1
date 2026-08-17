"""Notes — free-form writing, optionally attached to a day, a task or a goal.

The one place in Ascen where the user types something the app will not score.
Everything else on the account is a number or becomes one: a task has an XP
value, a goal has a percentage, a rating has two stars. A note has none of
that, on purpose — the app can already tell somebody they worked eleven days
running and cannot tell them *why* the eleventh was the one that clicked, and
that sentence is worth keeping somewhere that is not a task title.

So there is no XP for writing one, no streak of days written, and no count of
notes anywhere near the report card. Attaching a note to a task does not change
the task. A feature that pays out is a feature people game, and the moment a
note is worth points it stops being the honest one.

## The shape

The table has been in data/sql/notes.sql since long before this file did
anything, and it is unchanged: a title, a body, three optional anchors
(`note_date`, `task_id`, `goal_id`), a pin flag and two timestamps. A note with
no anchor set is a loose note, which is the common case and the default.

`updated_at` moves on every write and `created_at` never does, so the list can
be ordered by "last touched" without losing when a note was started. Pinned
notes sort above everything regardless, because a pin is the reader saying
where the ordering is wrong.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.database import connection as db
from backend.tracking.auth import load_user

router = APIRouter(tags=['notes'])

#: The longest a title and a body may be. Generous, and still a limit: the
#: column is TEXT with no ceiling, and a request body is the one thing here a
#: caller controls entirely.
TITLE_MAX = 200
BODY_MAX = 20000


class SaveNote(BaseModel):
    username: Optional[str] = None
    #: Absent on a create, present on an edit. The row's own id, never reused.
    id: Optional[str] = None
    title: str = ''
    body: str = ''
    #: The day this is about, "2026-08-16". Empty for a note about no day.
    note_date: str = ''
    task_id: str = ''
    goal_id: str = ''
    pinned: bool = False


class DeleteNote(BaseModel):
    username: Optional[str] = None
    id: Optional[str] = None


def _known(username):
    """Whether this is a real account.

    `load_user` hands back `(all users, the one named)` so a caller can mutate
    and save the store, which makes the tuple itself always truthy — the reason
    this is a named helper rather than an inline `if not load_user(...)`. It is
    not paranoia: the notes table has a foreign key onto `users.username`, so a
    write for an account that does not exist fails at the database with an
    integrity error rather than at the door with a sentence.
    """
    _, user = load_user((username or '').strip())
    return bool(user)


def _now():
    return datetime.now().isoformat(timespec='seconds')


def _mine(username):
    """This account's notes, pinned first and most recently touched first.

    The ordering is applied here rather than in the client because it is the
    only ordering the page ever wants, and two callers sorting the same list
    two ways is how a list stops agreeing with itself after a write.
    """
    rows = [row for row in db.notes() if row.get('user_id') == username]
    rows.sort(
        key=lambda row: (
            0 if row.get('pinned') else 1,
            # Descending by string, which is safe: both timestamps are ISO and
            # ISO sorts lexicographically in date order.
            [-ord(c) for c in (row.get('updated_at') or row.get('created_at') or '')],
        )
    )
    return rows


def _clean(note: SaveNote):
    """The writable fields, trimmed and capped. Nothing else is stored."""
    return {
        'title': note.title.strip()[:TITLE_MAX],
        'body': note.body[:BODY_MAX],
        # An empty anchor is stored as absent rather than as '', so the column
        # is NULL and `row.get('task_id')` is falsy either way — see the note
        # at the top of database/connection.py about missing keys.
        **({'note_date': note.note_date.strip()} if note.note_date.strip() else {}),
        **({'task_id': note.task_id.strip()} if note.task_id.strip() else {}),
        **({'goal_id': note.goal_id.strip()} if note.goal_id.strip() else {}),
        'pinned': bool(note.pinned),
    }


@router.get('/api/notes')
def list_notes(username: str = ''):
    """Every note this account has, in the order the page draws them."""
    if not _known(username):
        return fail('Sign in to see your notes.')
    return ok(notes=_mine(username))


@router.post('/api/notes/save')
def save_note(note: SaveNote):
    """Create a note, or replace the writable fields of one that exists.

    One endpoint for both because the difference is a single branch and the
    client has one form. An `id` that does not belong to this account is a
    failure rather than a create: silently making a new note out of a failed
    edit would lose whatever the reader thought they were editing.
    """
    username = (note.username or '').strip()
    if not _known(username):
        return fail('Sign in to save a note.')

    fields = _clean(note)
    if not fields['title'] and not fields['body'].strip():
        return fail('A note needs a title or something written in it.')

    rows = db.notes()

    if note.id:
        for row in rows:
            if str(row.get('id')) == str(note.id) and row.get('user_id') == username:
                row.update(fields)
                row['updated_at'] = _now()
                db.save_notes(rows)
                return ok(note=row)
        return fail('That note does not exist.')

    stamp = _now()
    row = {
        'id': db.new_id('notes'),
        'user_id': username,
        **fields,
        'created_at': stamp,
        'updated_at': stamp,
    }
    rows.append(row)
    db.save_notes(rows)
    return ok(note=row)


@router.post('/api/notes/delete')
def delete_note(request: DeleteNote):
    """Remove one note. There is no trash — a note is the reader's to discard."""
    username = (request.username or '').strip()
    if not _known(username):
        return fail('Sign in to delete a note.')

    rows = db.notes()
    kept = [row for row in rows
            if not (str(row.get('id')) == str(request.id)
                    and row.get('user_id') == username)]
    if len(kept) == len(rows):
        return fail('That note does not exist.')

    db.save_notes(kept)
    return ok(id=request.id)
