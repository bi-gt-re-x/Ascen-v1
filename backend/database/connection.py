"""The datastore: the per-table .sql files under data/postgresql/.

Each file holds one table's definition followed by its rows as INSERT
statements — a schema and its data in the same place, in the SQL the app is
migrating to. Reading parses the INSERTs; writing regenerates the file's data
section, leaving the CREATE TABLE and every comment above it untouched.

Values keep their types. Each column's SQL type decides what comes back:
INTEGER -> int, NUMERIC/REAL -> float, BOOLEAN -> bool, JSONB -> the decoded
object, everything else -> str. NULL is None either way.

Writes are atomic. A temp file in the same directory is os.replace()d over the
target, so a concurrent reader sees the whole old file or the whole new one,
never a half-written one — the threaded dev server makes that a real case.

The JSON files under data/backups/ are what this replaced; they are kept as a
backup of the last JSON-era state and are not read or written any more.
"""
import json
import os
import re
import tempfile
from datetime import datetime

from backend.config.settings import SQL_DIR

# table -> the file it lives in. Several tables share a file when they describe
# one part of the app (a calendar entry and a calendar event are both events).
TABLE_FILES = {
    'users': 'users.sql',
    'tasks': 'tasks.sql',
    'goals': 'goals.sql',
    'xp_events': 'growth.sql',
    'focus_days': 'focus.sql',
    'day_focus_notes': 'focus.sql',
    'calendar_entries': 'events.sql',
    'calendar_events': 'events.sql',
    'event_colors': 'events.sql',
    'metric_snapshots': 'analytics.sql',
}

# Each table's rows sit under a marker line of their own, so a file can hold
# several tables and a write only ever replaces one of them. Everything above
# the first marker is the schema, and is preserved word for word.
MARKER_PREFIX = '-- ---- rows: '


def _marker(table):
    return '{}{} ----'.format(MARKER_PREFIX, table)


def _path(table):
    return os.path.join(SQL_DIR, TABLE_FILES[table])


def _read(table):
    path = _path(table)
    if not os.path.exists(path):
        return ''
    with open(path, 'r') as f:
        return f.read()


# --------------------------------------------------------------------------
# SQL literals
# --------------------------------------------------------------------------
IDENT_RE = re.compile(r'^[a-z_][a-z0-9_]*$')


def _ident(name):
    """A column name as SQL: quoted when it isn't a plain identifier.

    The calendar writes `recurrence-week` and `recurrence-month` hyphenated, so
    those columns only exist as quoted identifiers.
    """
    return name if IDENT_RE.match(name) else '"{}"'.format(name.replace('"', '""'))


def _plain(name):
    name = name.strip()
    return name[1:-1].replace('""', '"') if name.startswith('"') else name


def _quote(value):
    """A Python value as a SQL literal."""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, (dict, list)):
        value = json.dumps(value, sort_keys=True)
    return "'" + str(value).replace("'", "''") + "'"


def _split_values(text):
    """One VALUES tuple as a list of (was_quoted, text) literals.

    Whether a literal was quoted has to survive the split: '1' is the string
    "1" and 1 is the number, and the formatting space in front of it must not
    blur the two.
    """
    out, buf, i, quoted, seen_quote = [], [], 0, False, False
    while i < len(text):
        ch = text[i]
        if quoted:
            if ch == "'":
                if text[i + 1:i + 2] == "'":     # '' is an escaped quote
                    buf.append("'")
                    i += 2
                    continue
                quoted = False
            else:
                buf.append(ch)
        elif ch == "'":
            quoted, seen_quote = True, True
            buf = []                             # drop the formatting space
        elif ch == ',':
            out.append((seen_quote, ''.join(buf)))
            buf, seen_quote = [], False
        else:
            buf.append(ch)
        i += 1
    out.append((seen_quote, ''.join(buf)))
    return out


def _cast(literal, sql_type):
    """One parsed literal, typed by its column."""
    was_quoted, text = literal
    if not was_quoted:
        text = text.strip()
        if text.upper() == 'NULL':
            return None
        if text.upper() == 'TRUE':
            return True
        if text.upper() == 'FALSE':
            return False
        if re.fullmatch(r'-?\d+', text):
            return int(text)
        if re.fullmatch(r'-?\d*\.\d+(e-?\d+)?', text, re.I):
            return float(text)
        return text or None
    if 'JSON' in (sql_type or '').upper():
        try:
            return json.loads(text)
        except (ValueError, TypeError):
            return {}
    return text


def _columns(src, table):
    """{column: sql type} from the file's CREATE TABLE."""
    m = re.search(r'CREATE TABLE (?:IF NOT EXISTS )?' + table + r'\s*\((.*?)\n\);',
                  src, re.S | re.I)
    if not m:
        return {}
    cols = {}
    for line in m.group(1).split('\n'):
        line = line.split('--')[0].strip().rstrip(',')
        if not line or line.upper().startswith(('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK', 'CONSTRAINT')):
            continue
        parts = line.split()
        if len(parts) >= 2:
            cols[_plain(parts[0])] = parts[1]
    return cols


# --------------------------------------------------------------------------
# Reading and writing a table
# --------------------------------------------------------------------------
def read_table(table):
    """Every row in a table, as a list of dicts."""
    src = _read(table)
    if not src:
        return []
    types = _columns(src, table)
    rows = []
    pattern = re.compile(
        r'INSERT INTO ' + table + r'\s*\(([^)]*)\)\s*VALUES\s*\((.*?)\);\s*$',
        re.S | re.I | re.M)
    for m in pattern.finditer(src):
        names = [_plain(c) for c in m.group(1).split(',')]
        values = _split_values(m.group(2))
        if len(values) != len(names):
            continue
        rows.append({n: _cast(v, types.get(n)) for n, v in zip(names, values)})
    return rows


def write_table(table, rows, columns=None):
    """Replace a table's rows, keeping its schema and comments untouched."""
    path = _path(table)
    src = _read(table)
    types = _columns(src, table)
    cols = columns or list(types) or (list(rows[0]) if rows else [])

    lines = [_marker(table)]
    for row in rows:
        present = [c for c in cols if c in row]
        lines.append('INSERT INTO {} ({}) VALUES ({});'.format(
            table, ', '.join(_ident(c) for c in present),
            ', '.join(_quote(row[c]) for c in present)))
    block = '\n'.join(lines) + '\n'

    marker = _marker(table)
    if marker in src:
        head, _, tail = src.partition(marker)
        # this table's rows run to the next table's marker, or the end
        after = tail.split(MARKER_PREFIX, 1)
        rest = MARKER_PREFIX + after[1] if len(after) > 1 else ''
        new = head + block + ('\n' + rest if rest else '')
    else:
        new = src.rstrip('\n') + '\n\n' + block

    _atomic_write(path, new)


def new_id(table):
    """A fresh id for `table`: the current millisecond, stepped past collisions.

    Ids are millisecond timestamps, and two rows created inside the same
    millisecond used to get the same one — which the tables now forbid, since
    id is their primary key. Stepping forward keeps ids ordered, which
    `last_task_completion` relies on.
    """
    taken = {str(r.get('id')) for r in read_table(table)}
    stamp = int(datetime.now().timestamp() * 1000)
    while str(stamp) in taken:
        stamp += 1
    return str(stamp)


def _atomic_write(path, text):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path) or '.', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


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
    """The hex colours already handed out, in the order they were assigned."""
    return [r['color'] for r in read_table('event_colors') if r.get('color')]


def save_event_colors(colors):
    write_table('event_colors', [{'color': c} for c in colors], columns=['color'])
