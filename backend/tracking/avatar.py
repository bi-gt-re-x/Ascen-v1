"""Profile pictures.

Fifty round drawings live in utils/images/avatars/ — astronauts and planets,
animals, plants, and everyday things — and every account has one of them.

An account gets one two ways. If it picked one from the menu under its avatar,
that choice is stored, as an `avatar` row in user_settings — the key/value table
that exists so a preference like this is not a migration. If it never picked,
the picture is worked out from the account's id: the same one on every device
and every request, with nothing to write or keep in step. Ids are millisecond
creation timestamps, which spreads accounts evenly across the set; two accounts
sharing a picture is expected and fine.

So a brand-new account already has a picture before it has an opinion, and
changing it is one row.
"""
import hashlib

from backend.database import connection as db

# The files in utils/images/avatars/, without the .svg. Sorted, and the order
# matters: it is what an account's id indexes into, so re-ordering this list
# would hand every account a different picture. Add new ones at the end.
AVATARS = [
    'alien', 'astronaut', 'backpack', 'balloon', 'bear',
    'bee', 'book', 'bunny', 'cactus', 'camera',
    'cat', 'cloud', 'comet', 'cupcake', 'dog',
    'earth', 'elephant', 'fox', 'frog', 'guitar',
    'kite', 'koala', 'leaf', 'lion', 'moon',
    'mountain', 'mushroom', 'owl', 'palette', 'palm',
    'panda', 'pencil', 'penguin', 'rainbow', 'robot',
    'rocket', 'satellite', 'saturn', 'snowflake', 'sprout',
    'star', 'sun', 'sunflower', 'telescope', 'tree',
    'turtle', 'ufo', 'volcano', 'wave', 'whale',
]

# What a page asks for when there is no account at all (the signed-out header).
FALLBACK = 'star'

# The user_settings key an account's choice is stored under.
SETTING_KEY = 'avatar'


def avatar_name(key):
    """One of AVATARS for any key, the same one every time.

    md5 rather than hash(): Python salts str hashing per process, so hash()
    would give an account a different picture each time the server restarted.
    """
    if not key:
        return FALLBACK
    digest = hashlib.md5(str(key).encode('utf-8')).hexdigest()
    return AVATARS[int(digest, 16) % len(AVATARS)]


def chosen_avatar(username):
    """The picture an account picked, or None if it never has.

    A stored name that is not one of ours — a file renamed or dropped since —
    is treated as no choice at all, so the account falls back to its derived
    picture rather than to a broken image.
    """
    if not username:
        return None
    for row in db.read_table('user_settings'):
        if row.get('user_id') == username and row.get('key') == SETTING_KEY:
            value = row.get('value')
            return value if value in AVATARS else None
    return None


def choose_avatar(username, name):
    """Store an account's pick. False if the name is not one of the fifty."""
    if not username or name not in AVATARS:
        return False
    rows = db.read_table('user_settings')
    for row in rows:
        if row.get('user_id') == username and row.get('key') == SETTING_KEY:
            row['value'] = name
            row.pop('updated_at', None)   # let the column's default restamp it
            break
    else:
        rows.append({'user_id': username, 'key': SETTING_KEY, 'value': name})
    db.write_table('user_settings', rows)
    return True


def avatar_for(user):
    """The picture for an account row: its own pick, else one from its id.

    The derived half is keyed on the id, which never changes; the username can
    be edited and a rename should not repaint the account.
    """
    if not user:
        return FALLBACK
    return (chosen_avatar(user.get('username'))
            or avatar_name(user.get('id') or user.get('username')))


def avatar_path(name):
    """The static path a template or client uses to load one."""
    return 'images/avatars/{}.svg'.format(name)
