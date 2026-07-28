-- goals — "earn N XP", "reach an N-day streak", "complete N tasks",
-- "focus N minutes".
--
-- Each type counts with its own pair of columns rather than a shared
-- current/target, because a goal keeps its other targets when its type is
-- edited.
--
-- XP and task goals are fed by the app when a task is completed. Streak and
-- focus goals track themselves: a streak goal follows the account's live
-- streak, and a focus goal measures the focus time accumulated since it was
-- set, which is what focus_baseline_seconds remembers.

CREATE TABLE IF NOT EXISTS goals (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    title                   TEXT NOT NULL,
    description             TEXT DEFAULT '',
    goal_type               TEXT DEFAULT 'xp'
                            CHECK (goal_type IN ('xp', 'streak', 'tasks', 'focus')),

    target_xp               INTEGER DEFAULT 0,
    current_xp              INTEGER DEFAULT 0,
    target_streak           INTEGER DEFAULT 0,
    current_streak          INTEGER DEFAULT 0,
    target_tasks            INTEGER DEFAULT 0,
    current_tasks           INTEGER DEFAULT 0,
    target_focus            INTEGER DEFAULT 0,
    current_focus           NUMERIC DEFAULT 0,

    -- The account's lifetime focus seconds when a focus goal was created;
    -- progress is (lifetime total now - this).
    focus_baseline_seconds  NUMERIC DEFAULT 0,

    -- Denormalised copies of the active type's target and percentage, which
    -- the goals page renders directly.
    target_value            INTEGER DEFAULT 0,
    progress                NUMERIC DEFAULT 0,

    priority                INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    deadline                TEXT,
    status                  TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at              TEXT
);

CREATE INDEX IF NOT EXISTS goals_user_status_idx ON goals (user_id, status);
CREATE INDEX IF NOT EXISTS goals_user_type_idx ON goals (user_id, goal_type);

-- ---- rows: goals ----
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783024779328', 'gayguy', '1', '1', 'xp', 1111, 1111, 0, 0, 0, 0, 1111, 100.0, '', 'completed', '2026-07-02T15:39:39.328509');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783025498928', 'gayguy', '1', '1', 'xp', 1111, 1111, 0, 0, 0, 0, 1111, 100.0, '', 'completed', '2026-07-02T15:51:38.928766');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783088079825', 'men', '111', '1', 'xp', 1111, 1111, 0, 0, 0, 0, 1111, 100.0, '', 'completed', '2026-07-03T09:14:39.825908');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783088802509', 'men', '1', '1', 'xp', 11, 11, 0, 0, 0, 0, 11, 100.0, '', 'completed', '2026-07-03T09:26:42.509860');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783268965278', 'gayguy', '1', '1', 'xp', 1111, 1111, 0, 0, 0, 0, 1111, 100.0, '', 'completed', '2026-07-05T11:29:25.278569');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783521600877', 'gayguy', '1', '1', 'tasks', 0, 0, 0, 0, 1, 1, 1, 100.0, '', 'completed', '2026-07-08T09:40:00.877716');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1783522332245', 'gayguy', '1', '', 'streak', 0, 0, 23, 0, 0, 0, 23, 0.0, '', 'active', '2026-07-08T09:52:12.245764');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_value, progress, deadline, status, created_at) VALUES ('1784643719670', 'men', '888', '9', 'xp', 8888, 313, 0, 0, 0, 0, 8888, 3.5, '2027-02-17', 'active', '2026-07-21T09:21:59.670652');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_focus, current_focus, focus_baseline_seconds, target_value, progress, priority, deadline, status, created_at) VALUES ('1784758126242', 'Default', 'Master JavaScript', '', 'xp', 8888, 0, 0, 0, 0, 0, 0, 0, 0, 8888, 0, 9, '2026-08-22', 'active', '2026-07-22T17:08:46.242846');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_focus, current_focus, focus_baseline_seconds, target_value, progress, priority, deadline, status, created_at) VALUES ('1784758144379', 'Default', 'Deep Focus Week', '', 'focus', 0, 0, 0, 0, 0, 0, 30, 0, 0.0, 30, 0, 7, '', 'active', '2026-07-22T17:09:04.380070');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_focus, current_focus, focus_baseline_seconds, target_value, progress, priority, deadline, status, created_at) VALUES ('1784758332444', 'Default', 'HTML Basics', '', 'xp', 888, 888, 0, 0, 0, 0, 0, 0, 0, 888, 100.0, 6, '', 'completed', '2026-07-22T17:12:12.445279');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_focus, current_focus, focus_baseline_seconds, target_value, progress, priority, deadline, status, created_at) VALUES ('1784905626865', 'men', '1111', '23', 'focus', 0, 0, 0, 0, 0, 0, 1500, 0, 30432.0, 1500, 0, 3, '', 'active', '2026-07-24T10:07:06.865807');
INSERT INTO goals (id, user_id, title, description, goal_type, target_xp, current_xp, target_streak, current_streak, target_tasks, current_tasks, target_focus, current_focus, focus_baseline_seconds, target_value, progress, priority, deadline, status, created_at) VALUES ('1785110011644', 'SMYLES', '9999', 'r', 'xp', 1000, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 0, 10, '2026-07-28', 'active', '2026-07-26T18:53:31.645393');
