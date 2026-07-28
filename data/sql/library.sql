-- library — saved resources and reference material.
--
-- Not built yet. The Library page is where a user keeps the things they study
-- from — links, files, readings — and ties them to the work they did.

CREATE TABLE IF NOT EXISTS library_items (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    kind         TEXT NOT NULL DEFAULT 'link'
                 CHECK (kind IN ('link', 'file', 'note', 'book')),
    url          TEXT,

    -- Free tags, since a resource rarely belongs to exactly one subject.
    tags         TEXT NOT NULL DEFAULT '[]',

    archived     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_opened  TEXT
);

-- What a library item was used for.
CREATE TABLE IF NOT EXISTS library_task_links (
    item_id  TEXT NOT NULL REFERENCES library_items (id) ON DELETE CASCADE,
    task_id  TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,

    PRIMARY KEY (item_id, task_id)
);

CREATE INDEX IF NOT EXISTS library_items_user_idx ON library_items (user_id, archived);
-- (a GIN index on tags has no SQLite equivalent; the tags column is JSON text and is filtered in Python)
