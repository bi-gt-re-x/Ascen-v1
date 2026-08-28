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
    # The third rating question's answer. Existing rows get NULL, which reads
    # as "not asked" — which is exactly what it was, since the question did not
    # exist. See data/sql/tasks.sql and REASONS in backend/api/tasks.py.
    ('tasks', 'reason', 'TEXT'),
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
    # What the badge wall needs a badge to carry beyond its threshold: which
    # of the five headings it is filed under, what it is worth toward the
    # achievement score, whether it is one of the five nobody is told about,
    # and the title it confers if it is Ascended. Every one is additive with a
    # null default, and a row written before they existed reads as an
    # uncategorised, unweighted, visible badge — which is what it was.
    ('achievements', 'category', 'TEXT'),
    ('achievements', 'xp_reward', 'INTEGER'),
    ('achievements', 'hidden', 'INTEGER'),
    ('achievements', 'title', 'TEXT'),

    ('tasks', 'difficulty', 'INTEGER'),
    ('tasks', 'execution', 'INTEGER'),

    # What a note is about, and which shelf it is on. Both empty on every note
    # written before the notes page could say either, which is the honest
    # reading of a note nobody tagged. No NOT NULL and no DEFAULT: ALTER TABLE
    # gives existing rows NULL, and every reader here treats NULL and '' alike.
    ('notes', 'subject_ids', 'TEXT'),
    ('notes', 'notebook', 'TEXT'),

    # The checklist under a checkpoint — a JSON array of {id, title, done}.
    # Existing checkpoints get NULL, which the API reads as "no checklist yet"
    # and fills with placeholders on first write, so a goal written before this
    # existed is not a goal with a broken one. See data/sql/goals.sql.
    ('goal_milestones', 'steps', 'TEXT'),
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
''', '''
    CREATE TABLE IF NOT EXISTS user_subjects (
        user_id     TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
        subject_id  TEXT NOT NULL,
        name        TEXT NOT NULL DEFAULT '',
        family      TEXT,
        custom      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, subject_id)
    )
''', '''
    CREATE INDEX IF NOT EXISTS user_subjects_user_idx
        ON user_subjects (user_id)
''', '''
    -- The hall of fame the account writes itself. Mirrors data/sql/records.sql,
    -- which only ever reaches a database that does not exist yet.
    CREATE TABLE IF NOT EXISTS records (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,
        kind         TEXT NOT NULL DEFAULT 'record'
                     CHECK (kind IN ('record', 'milestone')),
        name         TEXT NOT NULL DEFAULT '',
        category     TEXT NOT NULL DEFAULT '',
        value        NUMERIC NOT NULL DEFAULT 0,
        target       NUMERIC NOT NULL DEFAULT 0,
        unit         TEXT NOT NULL DEFAULT '',
        note         TEXT NOT NULL DEFAULT '',
        achieved_on  TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
''', '''
    CREATE INDEX IF NOT EXISTS records_user_idx ON records (user_id, kind)
''', '''
    CREATE INDEX IF NOT EXISTS records_name_idx ON records (user_id, name, achieved_on)
''', '''
    -- The last two account-scoped tables with nothing leading on user_id.
    -- Every other one is covered, either by an index written with it or by a
    -- composite primary key that starts with the column (focus_days,
    -- user_achievements). `rows_for` reads through these, so a table without
    -- one falls back to scanning every account's rows to find one account's.
    CREATE INDEX IF NOT EXISTS goal_milestones_user_idx
        ON goal_milestones (user_id, goal_id)
''', '''
    CREATE INDEX IF NOT EXISTS calendar_events_user_idx
        ON calendar_events (user_id, date)
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


# --------------------------------------------------------------------------
# Reading and writing one row
# --------------------------------------------------------------------------
# `read_table` + `write_table` is the pair the whole backend was built on, and
# it is the wrong pair for a change to a single row. A caller that reads every
# task, sets one field and hands the list back makes the database do this:
#
#     SELECT * FROM tasks            -- 10,660 rows into Python
#     DELETE FROM tasks              -- all of them
#     INSERT INTO tasks ...          -- 10,660 times
#
# measured at 245 ms on this database for one checkbox. Three things are wrong
# with it and only the first is speed:
#
#   * **It scales with everybody's data, not yours.** The tables are shared, so
#     one account ticking off a task rewrites every account's rows. Ten users
#     and the cost is ten times, for the same click.
#   * **It loses writes.** Two requests read the table, each changes a
#     different row, each writes the whole thing back. The second overwrites
#     the first with a copy that predates it. Nothing errors; the change is
#     simply gone. Two devices, or two tabs, is enough.
#   * **It makes deleting feel expensive**, so code stops doing it — which is
#     how `user_achievements` came to hold rows for badges the catalogue
#     dropped, and how "71 earned" ended up over a wall of 68.
#
# The five below are the targeted versions. They are additive: `write_table`
# stays for the callers that genuinely replace a whole table (the catalogue
# sync, the settings reset), and every caller that changes one row moves to
# these. `_encode` and the missing-key rules are shared with `write_table`, so
# a row written by either reads back the same.


def _columns_for(con, table, row):
    """The columns of `table` that `row` has something to say about.

    For UPDATE, where the dict is a list of changes: a key that is not there is
    a column this write is not about, and is left alone.
    """
    schema = _schema(con, table)
    return [name for name, _, _ in schema if name in row]


def _insert_columns(con, table, row):
    """The columns an INSERT of `row` names — `write_table`'s rule, exactly.

    A key the row does not have is stored as NULL where the column allows one,
    so it reads back missing, and is left out where it does not so the column's
    DEFAULT stands in. That is the convention the whole backend reads by (see
    the note at the top of this module), and the two write paths have to agree
    on it or a row's shape would depend on which function wrote it — an
    `insert_row` task getting `priority: 'medium'` from a DEFAULT where a
    `write_table` one got NULL and read back with no priority at all.
    """
    return [name for name, _, nullable in _schema(con, table)
            if name in row or nullable]


#: How many times `insert_row` will step a colliding id before giving up.
#: Reached only if the same millisecond is contended by more than this many
#: writers at once, which is not a situation a bigger number rescues.
ID_RETRIES = 25


def insert_row(table, row, key='id'):
    """Add one row. Returns the row, with `key` set to the id actually used.

    The whole-table version of this appended to a list and rewrote everything;
    this is the INSERT that was always underneath it.

    A duplicate primary key is retried rather than raised, because ids are
    millisecond timestamps and two writers in the same millisecond is a normal
    thing rather than an error — see `new_id`. Any other IntegrityError is a
    real constraint being violated and is left to raise.
    """
    con = connect()
    try:
        names = _insert_columns(con, table, row)
        if not names:
            return row
        sql = 'INSERT INTO "{}" ({}) VALUES ({})'.format(
            table,
            ', '.join('"{}"'.format(n) for n in names),
            ', '.join('?' for _ in names))

        for _ in range(ID_RETRIES):
            try:
                with con:
                    con.execute(sql, [_encode(table, n, row.get(n)) for n in names])
                return row
            except sqlite3.IntegrityError as clash:
                collided = ('UNIQUE constraint failed' in str(clash)
                            and key in names
                            and str(row.get(key, '')).isdigit())
                if not collided:
                    raise
                row[key] = str(int(row[key]) + 1)
                with _id_lock:
                    _last_id[table] = max(_last_id.get(table, 0), int(row[key]))
        raise sqlite3.IntegrityError(
            'could not find a free {}.{} after {} tries'.format(
                table, key, ID_RETRIES))
    finally:
        con.close()


def update_row(table, row_id, changes, user_id=None, key='id'):
    """Change some columns of one row. Returns True if a row was changed.

    `user_id` is the ownership check and is not optional in spirit: an UPDATE
    matched on id alone will happily edit somebody else's row, which is the
    same hole the API had before backend/api/guard.py. Pass it wherever the
    table has the column, and the WHERE clause carries it.

    A `changes` value of None writes NULL, which is how a field is cleared —
    unlike `read_table`, where a missing key means the column was NULL. The
    difference is deliberate: this says what to change, not what the row is.
    """
    if not changes:
        return False
    con = connect()
    try:
        names = _columns_for(con, table, changes)
        if not names:
            return False
        clause = 'WHERE "{}" = ?'.format(key)
        params = [_encode(table, n, changes.get(n)) for n in names] + [row_id]
        if user_id is not None:
            clause += ' AND user_id = ?'
            params.append(user_id)
        with con:
            cursor = con.execute(
                'UPDATE "{}" SET {} {}'.format(
                    table, ', '.join('"{}" = ?'.format(n) for n in names), clause),
                params)
        return cursor.rowcount > 0
    finally:
        con.close()


def add_to_row(table, row_id, deltas, changes=None, user_id=None, key='id'):
    """Add to some columns of one row, in SQL. Returns the row after the write.

    `UPDATE ... SET xp = COALESCE(xp, 0) + ?` rather than reading the value,
    adding to it in Python and writing it back. The difference only shows under
    load, and then it is the whole ballgame: thirty task completions arriving
    at once each read `tasks_completed` as 4,120 and each wrote 4,121, so
    twenty-nine of them vanished. Measured, on this database, before this
    existed — the ledger got all thirty rows, because appending is safe, and
    the counter on the account moved by one.

    `changes` is for the fields that are set rather than accumulated — the
    streak, the level, `last_task_date` — and is applied in the same statement
    so the row is never half-written. Those still race in the sense that the
    last writer wins, but a streak is a value derived from a date rather than a
    running total, so two writers agreeing on it is the correct outcome.
    """
    if not deltas and not changes:
        return None
    con = connect()
    try:
        names = _columns_for(con, table, deltas)
        setters = ['"{0}" = COALESCE("{0}", 0) + ?'.format(n) for n in names]
        params = [deltas[n] for n in names]

        for name in _columns_for(con, table, changes or {}):
            setters.append('"{}" = ?'.format(name))
            params.append(_encode(table, name, changes[name]))

        if not setters:
            return None
        clause = 'WHERE "{}" = ?'.format(key)
        params.append(row_id)
        if user_id is not None:
            clause += ' AND user_id = ?'
            params.append(user_id)
        with con:
            con.execute('UPDATE "{}" SET {} {}'.format(
                table, ', '.join(setters), clause), params)
    finally:
        con.close()
    return find_row(table, row_id, user_id=user_id, key=key)


def delete_row(table, row_id, user_id=None, key='id'):
    """Remove one row. Returns True if there was one to remove.

    Scoped by `user_id` for the reason `update_row` gives.
    """
    con = connect()
    try:
        clause = 'WHERE "{}" = ?'.format(key)
        params = [row_id]
        if user_id is not None:
            clause += ' AND user_id = ?'
            params.append(user_id)
        with con:
            cursor = con.execute(
                'DELETE FROM "{}" {}'.format(table, clause), params)
        return cursor.rowcount > 0
    finally:
        con.close()


def _decode_records(con, table, records):
    """Cursor rows as the app expects to see them.

    Split out of `rows_for` because the scoped task reads further down answer a
    different WHERE clause but must hand back rows in exactly the same shape —
    same decoding, same dropping of NULLs. Two copies of this loop would be two
    places for a BOOLEAN to start arriving as a 0.
    """
    columns = _schema(con, table)
    if not columns:
        return []
    types = {name: sql_type for name, sql_type, _ in columns}
    rows = []
    for record in records:
        row = {}
        for name in record.keys():
            value = record[name]
            if value is not None:
                row[name] = _decode(table, name, value, types.get(name, ''))
        rows.append(row)
    return rows


def rows_for(table, user_id, order='rowid'):
    """Every row of `table` belonging to one account, in written order.

    The filter the callers were all doing in Python after reading the whole
    table. In SQL it uses the `user_id` index, so the cost is this account's
    rows rather than everybody's.
    """
    con = connect()
    try:
        if not _schema(con, table):
            return []
        query = 'SELECT * FROM "{}" WHERE user_id = ? ORDER BY {}'.format(table, order)
        return _decode_records(con, table, con.execute(query, (user_id,)))
    finally:
        con.close()


def find_row(table, row_id, user_id=None, key='id'):
    """One row by id, scoped to an account when one is given, or None."""
    con = connect()
    try:
        columns = _schema(con, table)
        if not columns:
            return None
        types = {name: sql_type for name, sql_type, _ in columns}
        query = 'SELECT * FROM "{}" WHERE "{}" = ?'.format(table, key)
        params = [row_id]
        if user_id is not None:
            query += ' AND user_id = ?'
            params.append(user_id)
        record = con.execute(query, params).fetchone()
        if record is None:
            return None
        row = {}
        for name in record.keys():
            value = record[name]
            if value is not None:
                row[name] = _decode(table, name, value, types.get(name, ''))
        return row
    finally:
        con.close()


#: The last id handed out per table, so two callers in the same millisecond
#: cannot be handed the same one. Guarded by `_id_lock`.
_last_id = {}
_id_lock = threading.Lock()


def new_id(table):
    """A fresh id for `table`: the current millisecond, stepped past collisions.

    Ids are millisecond timestamps, and two rows created inside the same
    millisecond would collide on the primary key. Stepping forward keeps ids
    ordered, which `last_task_completion` relies on.

    ## Why this holds a lock

    It used to be a `SELECT id` and a step past what it found, with no memory
    between calls — so two requests arriving in the same millisecond read the
    same set, stepped to the same free value, and were both handed it. Under
    `write_table` that ended as a silent lost update: each rewrote the whole
    table from its own copy and the later write won. It is visible now only
    because `insert_row` INSERTs, and an INSERT of a duplicate primary key
    raises rather than quietly winning.

    The lock fixes the requests inside one process. `insert_row` retries on a
    collision, which covers the rest — a second worker, or the first call after
    a restart, when `_last_id` is empty and the table is the only memory.
    """
    with _id_lock:
        con = connect()
        try:
            if not _schema(con, table):
                highest = 0
            else:
                row = con.execute(
                    'SELECT MAX(CAST(id AS INTEGER)) FROM "{}"'.format(table)
                ).fetchone()
                highest = int(row[0] or 0)
        finally:
            con.close()

        stamp = int(datetime.now().timestamp() * 1000)
        # Past the highest id in the table and past the last one this process
        # handed out, whichever is further along.
        floor = max(highest, _last_id.get(table, 0))
        if stamp <= floor:
            stamp = floor + 1
        _last_id[table] = stamp
        return str(stamp)


# --------------------------------------------------------------------------
# One load/save pair per store
# --------------------------------------------------------------------------
def users():
    return read_table('users')


def save_users(rows):
    write_table('users', rows)


def save_user(user):
    """Write back one account row, matched on its id.

    The pair above rewrote the whole users table, and `refresh_streak` calls
    into it on every page load — so a page view cost one DELETE and one INSERT
    per account in the system, and two people loading a page at the same
    moment could each write a copy of the table that predated the other.

    Matched on `id`, and **`username` is never written here**. Every
    account-owned table has a foreign key onto `users.username`, and SQLite
    refuses an UPDATE that moves a parent key out from under a child row. That
    is why `write_table` turns foreign keys off for its swap, and it is why
    renaming an account is `tracking.auth.rename_user`'s job and not this
    function's — it moves the children across too. Leaving the column out here
    means an ordinary save can never trip over it.

    Only the keys the dict carries are written. A field is cleared by setting
    it to None, not by deleting the key — `read_table` leaves NULL columns out
    of the dict, so a missing key means "was already NULL" and must not be
    read as "set this to NULL".
    """
    if not user or not user.get('id'):
        return False
    changes = {k: v for k, v in user.items() if k not in ('id', 'username')}
    return update_row('users', user['id'], changes)


def tasks():
    return read_table('tasks')


def save_tasks(rows):
    write_table('tasks', rows)


def tasks_for(username):
    """One account's tasks. See `rows_for`."""
    return rows_for('tasks', username)


def save_task(task, username):
    """Write back one task, scoped to its owner."""
    changes = {k: v for k, v in task.items() if k != 'id'}
    return update_row('tasks', task['id'], changes, user_id=username)


# --------------------------------------------------------------------------
# Asking about the tasks without reading them
# --------------------------------------------------------------------------
# The two questions the top bar asks on every page. Both used to be answered in
# the browser, by filtering the account's entire task list — which is why the
# bar needed that list at all, and why every page paid megabytes to render a
# bell and a search box. In SQL they are an aggregate and a LIMIT 8.
#
# The day is passed in rather than computed here. Stored stamps are local ISO
# text with no zone (see backend/tracking/xp.py), so "today" is the caller's
# day, and the caller is the only one who knows it.


def task_alert_counts(username, day):
    """What the top bar's bell needs, as four numbers and two titles.

    Answers three questions in one round trip: how many open tasks are past
    their date (and the oldest one's title), how many are due today (and one
    title), and whether anything at all was finished today — the last being
    what decides whether a live streak is still at risk.

    Titles come back with the counts because the panel shows one of each, and
    a second query to fetch two strings would be the same round trip twice.
    """
    con = connect()
    try:
        if not _schema(con, 'tasks'):
            return {'late': 0, 'late_title': None,
                    'due_today': 0, 'due_today_title': None,
                    'finished_today': False}

        # substr(due_date, 1, 10) rather than date(due_date): the column holds
        # either a bare day or a full stamp, and substr treats both the same
        # way the client's .slice(0, 10) always has.
        late = con.execute(
            'SELECT COUNT(*) AS n, MIN(substr(due_date, 1, 10)) AS oldest '
            'FROM tasks WHERE user_id = ? AND status != ? '
            "AND substr(due_date, 1, 10) != '' AND substr(due_date, 1, 10) < ?",
            (username, 'done', day)).fetchone()

        late_title = None
        if late['n']:
            row = con.execute(
                'SELECT title FROM tasks WHERE user_id = ? AND status != ? '
                'AND substr(due_date, 1, 10) = ? ORDER BY rowid LIMIT 1',
                (username, 'done', late['oldest'])).fetchone()
            late_title = row['title'] if row else None

        due = con.execute(
            'SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND status != ? '
            'AND substr(due_date, 1, 10) = ?',
            (username, 'done', day)).fetchone()

        due_title = None
        if due['n']:
            row = con.execute(
                'SELECT title FROM tasks WHERE user_id = ? AND status != ? '
                'AND substr(due_date, 1, 10) = ? ORDER BY rowid LIMIT 1',
                (username, 'done', day)).fetchone()
            due_title = row['title'] if row else None

        finished = con.execute(
            'SELECT 1 FROM tasks WHERE user_id = ? AND status = ? '
            'AND substr(completed_at, 1, 10) = ? LIMIT 1',
            (username, 'done', day)).fetchone()

        return {
            'late': late['n'] or 0,
            'late_title': late_title,
            'due_today': due['n'] or 0,
            'due_today_title': due_title,
            'finished_today': finished is not None,
        }
    finally:
        con.close()


def search_tasks(username, needle, limit=8):
    """One account's tasks whose title contains `needle`, unfinished first.

    The ordering is the one the search panel has always applied after
    downloading everything: a search on a to-do list is nearly always somebody
    looking for something they still have to do.

    An empty needle matches nothing rather than everything — the panel shows no
    results until something is typed, and a LIKE '%%' here would mean the one
    query in the app that returns the whole table.
    """
    needle = (needle or '').strip()
    if not needle:
        return []

    con = connect()
    try:
        if not _schema(con, 'tasks'):
            return []
        # ESCAPE, so a title search for "50%" is a search for "50%" rather than
        # a wildcard that matches every row in the table.
        pattern = '%' + needle.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        query = (
            'SELECT * FROM tasks WHERE user_id = ? '
            "AND lower(title) LIKE lower(?) ESCAPE '\\' "
            'ORDER BY (status = ?), rowid LIMIT ?')
        return _decode_records(
            con, 'tasks',
            con.execute(query, (username, pattern, 'done', int(limit))))
    finally:
        con.close()


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


def user_subjects():
    """What each account has changed about the subject catalogue.

    One row per (account, subject): a subject the account invented, or a
    colour it chose for one of the hundred. See data/sql/subjects.sql for why
    those are one table rather than two.
    """
    return read_table('user_subjects')


def save_user_subjects(rows):
    write_table('user_subjects', rows)


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


def notes():
    return read_table('notes')


def save_notes(rows):
    write_table('notes', rows)


def records():
    return read_table('records')


def save_records(rows):
    write_table('records', rows)


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
