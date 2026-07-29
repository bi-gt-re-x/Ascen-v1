"""Profile pictures.

Fifty round drawings live in utils/images/avatars/ — astronauts and planets,
animals, plants, and everyday things — and every account gets one of them.

Which one is not stored anywhere. It is worked out from the account's id, so
the same account always draws the same picture on every device and every
request, and there is nothing to write, migrate or keep in step. Ids are
millisecond creation timestamps, which spreads accounts evenly across the set;
two accounts sharing a picture is expected and fine.

The day an account can *choose* its picture, this becomes a stored column and
`avatar_for` becomes the fallback for accounts that have not picked one.
"""
import hashlib

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


def avatar_name(key):
    """One of AVATARS for any key, the same one every time.

    md5 rather than hash(): Python salts str hashing per process, so hash()
    would give an account a different picture each time the server restarted.
    """
    if not key:
        return FALLBACK
    digest = hashlib.md5(str(key).encode('utf-8')).hexdigest()
    return AVATARS[int(digest, 16) % len(AVATARS)]


def avatar_for(user):
    """The picture for an account row.

    Keyed on the id, which never changes; the username can be edited and a
    rename should not repaint the account.
    """
    if not user:
        return FALLBACK
    return avatar_name(user.get('id') or user.get('username'))


def avatar_path(name):
    """The static path a template or client uses to load one."""
    return 'images/avatars/{}.svg'.format(name)
