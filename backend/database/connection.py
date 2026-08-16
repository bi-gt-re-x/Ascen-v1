"""The datastore: a SQLite database at data/ascen.db.

Every read and write in the app goes through here. The database is built on
first use by running data/sql/*.sql in order — each of those files holds one
part of the app's tables, their definitions followed by the rows to start
from — so a fresh clone comes up with a working database and no setup step.
Once it exists those files are never consulted again; the database is the only
copy of the data from that point on.

Rows are plain dicts, one per table row, and that is the whole interface:
`read_table` hands back every row, `write_table` replaces them. The tracking
and page modules never see SQL.

Two details are worth knowing, because the rest of the backend depends on
them:

A column that is NULL is left out of the row dict entirely. The app reads
optional fields as `row.get('x', <fallback>)` and tests `'met_deadline' in
row`, and those two spellings only agree if a value that was never written
stays missing rather than arriving as None. Writing follows the same rule in
reverse: a key the row does not have is stored as NULL when the column allows
it, and left to its DEFAULT when the column is NOT NULL.

Rows keep the order they were written in (`ORDER BY rowid`). The XP ledger is
append-only and "the latest event" is the last row, not the largest id.

The JSON files under data/backups/ are the JSON store this replaced, kept as a
record of the last JSON-era state. They are not read or written.
"""
import json
import os
import sqlite3
import threading
from datetime import datetime

from backend.config.settings import DB_PATH, SCHEMA_FILES, SQL_DIR

# Columns holding JSON. SQLite has no JSON type, so these are TEXT columns
# that get decoded on the way out and encoded on the way in — what the JSONB
# columns in the schema were for.
JSON_COLUMNS = {
    ('metric_snapshots', 'detail'),
    ('activity_log', 'detail'),
    ('user_settings', 'value'),
    ('setting_defaults', 'value'),
    ('library_items', 'tags'),
}

_build_lock = threading.Lock()
_built = False

# Columns added to a table after the database was first created.
#
# data/sql/*.sql is only ever executed to build a database that does not exist
# yet, so adding a column there reaches a fresh clone and nothing else — every
# database already in use keeps the shape it was built with, and `CREATE TABLE
# IF NOT EXISTS` will not repair it. Each entry below is applied once, on the
# first connection, and is a no-op from then on.
#
# Additive only, and that is the rule rather than the current state: an ALTER
# that dropped or retyped a column would destroy data the moment someone ran
# an older build against the same file. Anything of that kind is not a
# migration this list can carry.
ADDED_COLUMNS = (
    ('tasks', 'subject', 'TEXT'),
    # The ISO week a colour was claimed in, so the reservation can expire —
    # see backend/tracking/event.py. Existing rows get NULL, which reads as
    # "claimed before anyone was counting" and therefore as long expired.
    ('event_colors', 'claimed_week', 'TEXT'),

    # The outcome layer on goals. Everything a goal needed to stop being a
    # counter and start being something worth aiming at — see data/sql/goals.sql
    # and backend/api/goals.py. Every one is additive with a default, so a row
    # written before they existed reads as a goal with no category, no reason
    # and no numeric measure, which is exactly what it was.
    ('goals', 'category', 'TEXT'),
    ('goals', 'why', 'TEXT'),
    ('goals', 'start_date', 'TEXT'),
    ('goals', 'measure', 'TEXT'),
    ('goals', 'unit', 'TEXT'),
    ('goals', 'current_value', 'NUMERIC'),
    ('goals', 'target_number', 'NUMERIC'),
    ('goals', 'subject_ids', 'TEXT'),

    # Which goal and which checkpoint a task is execution for. Both nullable
    # and both meaningless to every task that already exists, which is the
    # honest reading: they were done for their own sake.
    ('tasks', 'goal_id', 'TEXT'),
    ('tasks', 'milestone_id', 'TEXT'),

    # How hard it was and how well it went, one to five, asked once when the
    # task is marked done. Null on every task finished before the prompt
    # existed and on every one where it was dismissed — see data/sql/tasks.sql
    # for why an unrated task must never be read as a zero.
    #
    # No CHECK constraint here, unlike the seed file: ALTER TABLE ADD COLUMN
    # cannot attach one to a table that already has rows, and rewriting the
    # table to add it is exactly the kind of migration ADDED_COLUMNS refuses to
    # carry. The range is enforced by the endpoint instead.
    ('tasks', 'difficulty', 'INTEGER'),
    ('tasks', 'execution', 'INTEGER'),
)

# Tables added to the app after the database was first created.
#
# `_build` runs the seed files once, when there is no database at all, so a new
# `CREATE TABLE IF NOT EXISTS` in data/sql reaches a fresh clone and nothing
# else — the same hole ADDED_COLUMNS exists to patch, one level up.
#
# Every statement here is `IF NOT EXISTS` and is run on each start, which is
# what makes it safe: creating a table that is already there is a no-op, so
# there is no "have I run this yet" flag to get wrong. Additive only, for the
# same reason ADDED_COLUMNS is.
#
# The DDL is a copy of the one in data/sql. The duplication is deliberate: the
# seed file is what a fresh database is built from and has to read as a whole
# schema, and this is what an existing one is caught up with.
ADDED_TABLES = ('''
    CREATE TABLE IF NOT EXISTS goal_milestones (
        id           TEXT PRIMARY KEY,
        goal_id      TEXT NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
        user_id      TEXT NOT NULL,
        title        TEXT NOT NULL,
        note         TEXT DEFAULT '',
        position     INTEGER DEFAULT 0,
        status       TEXT DEFAULT 'pending'
                     CHECK (status IN ('pending', 'active', 'done')),
        target_date  TEXT,
        completed_at TEXT,
        created_at   TEXT
    )
''', '''
    CREATE INDEX IF NOT EXISTS goal_milestones_goal_idx
        ON goal_milestones (goal_id, position)
''')


# --------------------------------------------------------------------------
# The connection
# --------------------------------------------------------------------------
def _build(path):
    """Create the database and fill it from data/sql/*.sql."""
    con = sqlite3.connect(path)
    try:
        # The seed inserts rows in file order, and a child file's rows can name
        # a parent that a later file creates. Keys are enforced from the first
        # real connection onward; a one-time build does not need them.
        con.execute('PRAGMA foreign_keys = OFF')
        for name in SCHEMA_FILES:
            sql_file = os.path.join(SQL_DIR, name + '.sql')
            if os.path.exists(sql_file):
                with open(sql_file, 'r') as handle:
                    con.executescript(handle.read())
        con.commit()
    finally:
        con.close()


def _catch_up(path):
    """Bring an existing database up to the shape the app expects.

    Tables first, then columns: a column cannot be added to a table that is not
    there, and the tables here are new ones rather than new shapes of old ones.
    """
    con = sqlite3.connect(path)
    try:
        for statement in ADDED_TABLES:
            con.execute(statement)
        for table, column, sql_type in ADDED_COLUMNS:
            columns = con.execute(
                'PRAGMA table_info("{}")'.format(table)).fetchall()
            # No such table: a database built before that part of the app
            # existed at all. Not this list's problem.
            if not columns or any(row[1] == column for row in columns):
                continue
            con.execute('ALTER TABLE "{}" ADD COLUMN "{}" {}'.format(
                table, column, sql_type))
        con.commit()
    finally:
        con.close()


def _ensure_database():
    """Build the database the first time anything asks for it."""
    global _built
    if _built:
        return
    with _build_lock:
        if _built:
            return
        directory = os.path.dirname(DB_PATH)
        if directory and not os.path.isdir(directory):
            os.makedirs(directory)
        if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
            _build(DB_PATH)
        # Run for a fresh build too. It costs one PRAGMA per entry and it
        # means there is one code path that decides what the tables look
        # like, rather than a build that is right and a catch-up that has to
        # be remembered to agree with it.
        _catch_up(DB_PATH)
        _built = True


def connect():
    """A connection to the database, built if it isn't there yet.

    One per call rather than one shared: the dev server is threaded, and a
    SQLite connection belongs to the thread that opened it. Opening the file is
    cheap, and WAL means a reader never blocks on the writer.
    """
    _ensure_database()
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys = ON')
    con.execute('PRAGMA journal_mode = WAL')
    con.execute('PRAGMA synchronous = NORMAL')
    return con


# --------------------------------------------------------------------------
# Columns
# --------------------------------------------------------------------------
def _schema(con, table):
    """[(name, declared type, nullable)] for a table, or [] if there isn't one."""
    rows = con.execute('PRAGMA table_info("{}")'.format(table)).fetchall()
    return [(r['name'], (r['type'] or '').upper(), not r['notnull']) for r in rows]


def _decode(table, column, value, sql_type):
    """One stored value as the app expects to see it."""
    if value is None:
        return None
    if (table, column) in JSON_COLUMNS:
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return {}
    # SQLite keeps booleans as 0 and 1; the app and its JSON responses want
    # real booleans.
    if sql_type == 'BOOLEAN':
        return bool(value)
    return value


def _encode(table, column, value):
    """One app value as something SQLite can store."""
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True)
    if (table, column) in JSON_COLUMNS and value is not None:
        return json.dumps(value, sort_keys=True)
    return value


# --------------------------------------------------------------------------
# Reading and writing a table
# --------------------------------------------------------------------------
def read_table(table):
    """Every row in a table, in the order they were written.

    Columns that are NULL are left out of the dict rather than set to None —
    see the note at the top of this module.
    """
    con = connect()
    try:
        columns = _schema(con, table)
        if not columns:
            return []
        types = {name: sql_type for name, sql_type, _ in columns}
        rows = []
        for record in con.execute('SELECT * FROM "{}" ORDER BY rowid'.format(table)):
            row = {}
            for name in record.keys():
                value = record[name]
                if value is not None:
                    row[name] = _decode(table, name, value, types.get(name, ''))
            rows.append(row)
        return rows
    finally:
        con.close()


def write_table(table, rows, columns=None):
    """Replace a table's rows with `rows`, all or nothing.

    The whole table is rewritten because that is what every caller wants: they
    read the rows, change one, and hand the list back. It runs inside a single
    transaction, so a reader either sees all of the old rows or all of the new.

    Foreign keys are off while the rows are swapped, and this is not optional.
    Every table that belongs to an account declares ON DELETE CASCADE, so
    clearing `users` for a rewrite would take that account's tasks, goals and
    XP with it — and `refresh_streak` rewrites `users` on every page load. The
    rows are being replaced, not deleted, so the cascade must not fire. What
    the keys are actually for is still checked, on the way out: once the new
    rows are in, every reference this table makes has to point at something
    real, or the whole write is rolled back.
    """
    con = connect()
    try:
        schema = _schema(con, table)
        if not schema:
            return
        wanted = set(columns) if columns else None
        fields = [(name, nullable) for name, _, nullable in schema
                  if wanted is None or name in wanted]

        statements = []
        for row in rows:
            # A missing value is stored as NULL where the column allows one, so
            # it reads back missing. Where it doesn't, the column is left out
            # and its DEFAULT stands in.
            present = [(name, nullable) for name, nullable in fields
                       if name in row or nullable]
            names = [name for name, _ in present]
            values = [_encode(table, name, row.get(name)) for name in names]
            statements.append((
                'INSERT INTO "{}" ({}) VALUES ({})'.format(
                    table,
                    ', '.join('"{}"'.format(n) for n in names),
                    ', '.join('?' for _ in names)),
                values))

        # Has to be set before the transaction opens; inside one it does
        # nothing.
        con.execute('PRAGMA foreign_keys = OFF')
        try:
            with con:
                con.execute('DELETE FROM "{}"'.format(table))
                for sql, values in statements:
                    con.execute(sql, values)
                broken = con.execute(
                    'PRAGMA foreign_key_check("{}")'.format(table)).fetchall()
                if broken:
                    raise sqlite3.IntegrityError(
                        '{} rows in {} reference a row that does not exist'
                        .format(len(broken), table))
        finally:
            con.execute('PRAGMA foreign_keys = ON')
    finally:
        con.close()


def new_id(table):
    """A fresh id for `table`: the current millisecond, stepped past collisions.

    Ids are millisecond timestamps, and two rows created inside the same
    millisecond would collide on the primary key. Stepping forward keeps ids
    ordered, which `last_task_completion` relies on.
    """
    con = connect()
    try:
        if not _schema(con, table):
            taken = set()
        else:
            taken = {str(r[0]) for r in
                     con.execute('SELECT id FROM "{}"'.format(table))}
    finally:
        con.close()
    stamp = int(datetime.now().timestamp() * 1000)
    while str(stamp) in taken:
        stamp += 1
    return str(stamp)


# --------------------------------------------------------------------------
# One load/save pair per store
# --------------------------------------------------------------------------
def users():
    return read_table('users')


def save_users(rows):
    write_table('users', rows)


def tasks():
    return read_table('tasks')


def save_tasks(rows):
    write_table('tasks', rows)


def goals():
    return read_table('goals')


def save_goals(rows):
    write_table('goals', rows)


def goal_milestones():
    return read_table('goal_milestones')


def save_goal_milestones(rows):
    write_table('goal_milestones', rows)


def xp_events():
    return read_table('xp_events')


def save_xp_events(rows):
    write_table('xp_events', rows)


def calendar_entries():
    return read_table('calendar_entries')


def save_calendar_entries(rows):
    write_table('calendar_entries', rows)


def calendar_events():
    return read_table('calendar_events')


def save_calendar_events(rows):
    write_table('calendar_events', rows)


def focus_days():
    return read_table('focus_days')


def save_focus_days(rows):
    write_table('focus_days', rows)


def day_focus_notes():
    return read_table('day_focus_notes')


def save_day_focus_notes(rows):
    write_table('day_focus_notes', rows)


def metric_snapshots():
    return read_table('metric_snapshots')


def save_metric_snapshots(rows):
    write_table('metric_snapshots', rows)


def event_colors():
    """Every colour handed out, as `{color, claimed_week}` in assignment order.

    `claimed_week` is an ISO week — "2026-W33" — and is absent on rows written
    before colours were dated. The caller decides what to do with an undated
    row; see backend/tracking/event.py, which treats it as expired.
    """
    return [r for r in read_table('event_colors') if r.get('color')]


def save_event_colors(rows):
    """Replace the colour table. Rows are `{color, claimed_week}` dicts."""
    write_table(
        'event_colors',
        [{'color': r['color'], 'claimed_week': r.get('claimed_week')} for r in rows],
        columns=['color', 'claimed_week'],
    )


def user_settings():
    return read_table('user_settings')


def save_user_settings(rows):
    write_table('user_settings', rows)


def user_setting(username, key):
    """One account's value for one key, already decoded, or None.

    `value` is in JSON_COLUMNS, so what comes back is whatever was stored —
    usually a dict. None means the account has never set this key, which is a
    real answer and is not the same as an empty one: the analytics page shows a
    new reader the baseline setup screen precisely because the key is absent.
    """
    for row in read_table('user_settings'):
        if row.get('user_id') == username and row.get('key') == key:
            return row.get('value')
    return None


def set_user_setting(username, key, value):
    """Write one account's value for one key, replacing any previous one.

    The whole table is rewritten because that is what `write_table` does and
    what every other saver here relies on — see the note on it. The table holds
    one short row per preference per account, so the cost of the rewrite is not
    a consideration at this size.
    """
    rows = [row for row in read_table('user_settings')
            if not (row.get('user_id') == username and row.get('key') == key)]
    rows.append({'user_id': username, 'key': key, 'value': value})
    write_table('user_settings', rows, columns=['user_id', 'key', 'value'])
    return value
