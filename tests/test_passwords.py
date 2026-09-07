"""A password column that is not a hash opens nothing.

`check_password` used to end `return stored == password`, so any account whose
`password_hash` was not recognisably a hash was compared literally. That kept
pre-hashing accounts working and upgraded them on their next sign-in, which was
a fair trade while the app ran on one laptop.

It stops being one the moment the app is reachable from anywhere else, because
it makes the column trusted to say what it holds. A literal that arrives there
by any route — a seed file, an import, a restore — becomes a working password
that is also readable by whoever can see the row. `data/sql/users.sql` shipped
exactly that: two accounts whose stored value *was* the password, committed.

These hold the branch shut from both ends: the function, and the seed it made
dangerous.
"""
import glob
import re

from backend.tracking import auth


PLAINTEXT = ('t', 'dick', '1', '2', 'password', 'hunter2', 'Password1!')


def test_a_plaintext_password_hash_opens_nothing():
    """The branch itself. Each value is offered as its own password."""
    for stored in PLAINTEXT:
        assert auth.check_password({'password_hash': stored}, stored) is False, stored


def test_an_empty_password_hash_opens_nothing():
    """How the seeded demo accounts are locked: '' is not a password."""
    for attempt in ('', 't', 'anything'):
        assert auth.check_password({'password_hash': ''}, attempt) is False, attempt


def test_a_real_hash_still_opens_the_account():
    """The other half — refusing plaintext must not refuse everybody."""
    stored = auth.hash_password('RealPassword1!')
    assert auth.check_password({'password_hash': stored}, 'RealPassword1!') is True
    assert auth.check_password({'password_hash': stored}, 'wrong') is False


def test_a_corrupt_hash_is_refused_rather_than_raised():
    """A value that looks like a hash and is not. werkzeug raises on some of
    these, and a sign-in endpoint must answer False rather than 500."""
    for stored in ('pbkdf2:sha256:not-a-real-hash', 'scrypt:$$$', 'argon2$broken'):
        assert auth.check_password({'password_hash': stored}, 'anything') is False, stored


def test_no_seeded_account_ships_a_usable_password():
    """The seed file, read as text.

    Every `password_hash` in data/sql/users.sql must be either empty or a real
    hash — never a literal somebody could read out of the repository and sign
    in with. Reading the file rather than the built database is deliberate: the
    file is what is committed, and it is the committed copy that leaks.
    """
    seeded = []
    for path in glob.glob('data/sql/users.sql'):
        with open(path, encoding='utf-8') as handle:
            for row in re.finditer(r'INSERT INTO users .*?VALUES \((.*?)\);',
                                   handle.read()):
                values = [v.strip() for v in row.group(1).split(',')]
                seeded.append((values[1].strip("'"), values[4].strip().strip("'")))

    assert seeded, 'no seeded users found — has the file moved?'
    for username, stored in seeded:
        assert stored == '' or auth._is_hashed(stored), (username, stored)
        # An empty hash is the intended state for a demo account; a real hash
        # would mean a credential shipped in the repository even if nobody
        # knows the password behind it.
        assert stored == '', (
            '%s ships a password hash; seeded accounts must not be signable'
            % username)
