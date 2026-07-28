-- growth — the XP ledger the growth page is built on.
--
-- One append-only row per XP-earning moment. It is the source of truth for
-- "how much did I earn, and when": the growth chart, the calendar's daily XP
-- and the report card all read it rather than recomputing from tasks.
--
-- Two reasons are written:
--   task_completion  one completed task, tasks_completed = 1
--   daily_xp         a rolled-up day total, tasks_completed = the day's count

CREATE TABLE IF NOT EXISTS xp_events (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users (username) ON DELETE CASCADE,

    amount           INTEGER DEFAULT 0,
    reason           TEXT DEFAULT 'task_completion',

    -- The moment it happened, and the day it counts toward. The day is kept
    -- alongside so a day's total is an equality test, not a range scan. Older
    -- rows predate the date column and carry only the timestamp.
    timestamp        TEXT,
    date             TEXT,

    tasks_completed  INTEGER,
    avg_task_xp      NUMERIC
);

CREATE INDEX IF NOT EXISTS xp_events_user_date_idx ON xp_events (user_id, date);

-- The growth chart's series: one row per day with anything recorded. The app
-- fills the gaps so the x-axis is real time rather than a list of active days.
CREATE OR REPLACE VIEW growth_daily AS
SELECT
    user_id,
    COALESCE(date, left(timestamp, 10))          AS day,
    SUM(amount)                                  AS xp_earned,
    SUM(COALESCE(tasks_completed, 1))            AS tasks_completed
FROM xp_events
GROUP BY user_id, COALESCE(date, left(timestamp, 10));

-- ---- rows: xp_events ----
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450610795', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:30.795412');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450611584', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:31.584100');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450611751', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:31.751835');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450611901', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:31.901438');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450612083', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:32.083693');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450612267', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:32.267385');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450616967', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:36.967972');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450617117', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:37.117114');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450617283', 'gayguy', 10, 'task_completion', '2026-06-14T10:23:37.283108');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450928691', 'gayguy', 10, 'task_completion', '2026-06-14T10:28:48.691640');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450934575', 'gayguy', 54, 'task_completion', '2026-06-14T10:28:54.575412');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781450953617', 'gayguy', 54, 'task_completion', '2026-06-14T10:29:13.617416');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451668661', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:08.661421');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451669313', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:09.313103');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451669649', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:09.649533');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451669882', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:09.882756');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451670099', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:10.099380');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451670320', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:10.320283');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451671157', 'gayguy', 54, 'task_completion', '2026-06-14T10:41:11.157571');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451900893', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:00.893862');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451901398', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:01.398111');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451901546', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:01.546734');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451901713', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:01.713383');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451904547', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:04.547962');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451905047', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:05.047510');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451905399', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:05.399407');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451905597', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:05.597151');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451905763', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:05.763877');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451905946', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:05.946159');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451906446', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:06.446649');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451906981', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:06.981186');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451907463', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:07.463106');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451907912', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:07.912566');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451908214', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:08.214565');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451908396', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:08.396457');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451908561', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:08.561987');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451908729', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:08.729995');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451908879', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:08.879575');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451909047', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:09.047458');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451909363', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:09.363069');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451909531', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:09.531623');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451909713', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:09.713554');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451909880', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:09.880483');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451910064', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:10.064921');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451910280', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:10.280189');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451910480', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:10.480347');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451910663', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:10.663359');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451910880', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:10.880613');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451911063', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:11.063243');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451911265', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:11.265945');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451911447', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:11.447740');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451911731', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:11.731376');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451911913', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:11.913865');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451912098', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:12.098599');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451912263', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:12.263939');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451912430', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:12.430792');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451912597', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:12.597110');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451912780', 'gayguy', 10, 'task_completion', '2026-06-14T10:45:12.780238');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451995572', 'gayguy', 10, 'task_completion', '2026-06-14T10:46:35.572983');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451995714', 'gayguy', 10, 'task_completion', '2026-06-14T10:46:35.714197');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451995862', 'gayguy', 10, 'task_completion', '2026-06-14T10:46:35.862060');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451996001', 'gayguy', 10, 'task_completion', '2026-06-14T10:46:36.001551');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451996147', 'gayguy', 10, 'task_completion', '2026-06-14T10:46:36.147509');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781451996288', 'gayguy', 10, 'task_completion', '2026-06-14T10:46:36.288897');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781452035181', 'gayguy', 10, 'task_completion', '2026-06-14T10:47:15.181063');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781452403600', 'gayguy', 10, 'task_completion', '2026-06-14T10:53:23.600762');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781452404170', 'gayguy', 10, 'task_completion', '2026-06-14T10:53:24.170046');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781452404589', 'gayguy', 10, 'task_completion', '2026-06-14T10:53:24.589516');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781453239597', 'gayguy', 25, 'task_completion', '2026-06-14T11:07:19.597660');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781453243655', 'gayguy', 10, 'task_completion', '2026-06-14T11:07:23.655669');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781453247755', 'gayguy', 67, 'task_completion', '2026-06-14T11:07:27.755216');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781453257047', 'gayguy', 10, 'task_completion', '2026-06-14T11:07:37.047761');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781455461361', 'gayguy', 53, 'task_completion', '2026-06-14T11:44:21.361755');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781456287211', 'gayguy', 10, 'task_completion', '2026-06-14T11:58:07.211170');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781456825672', 'gayguy', 100, 'task_completion', '2026-06-14T12:07:05.672481');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781460973985', 'gayguy', 10, 'task_completion', '2026-06-14T13:16:13.985007');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781461071021', 'gayguy', 100, 'task_completion', '2026-06-14T13:17:51.021735');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781461571364', 'gayguy', 10, 'task_completion', '2026-06-14T13:26:11.364023');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781489663588', 'gayguy', 87, 'task_completion', '2026-06-14T21:14:23.588117');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781532260136', 'gayguy', 10, 'task_completion', '2026-06-15T09:04:20.136274');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781533026750', 'gayguy', 100, 'task_completion', '2026-06-15T09:17:06.750417');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781533044166', 'gayguy', 91, 'task_completion', '2026-06-15T09:17:24.166657');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781533648362', 'gayguy', 68, 'task_completion', '2026-06-15T09:27:28.362552');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781533889142', 'gayguy', 56, 'task_completion', '2026-06-15T09:31:29.142484');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781533918925', 'gayguy', 56, 'task_completion', '2026-06-15T09:31:58.925312');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781533929838', 'gayguy', 82, 'task_completion', '2026-06-15T09:32:09.838162');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781535564997', 'gayguy', 55, 'task_completion', '2026-06-15T09:59:24.997606');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781535902194', 'gayguy', 10, 'task_completion', '2026-06-15T10:05:02.194250');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781536072405', 'gayguy', 93, 'task_completion', '2026-06-15T10:07:52.405140');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781536091758', 'gayguy', 10, 'task_completion', '2026-06-15T10:08:11.758668');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781536766299', 'gayguy', 57, 'task_completion', '2026-06-15T10:19:26.299705');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781563687864', 'gayguy', 10, 'task_completion', '2026-06-15T17:48:07.864911');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781563700637', 'gayguy', 96, 'task_completion', '2026-06-15T17:48:20.637277');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781564240846', 'gayguy', 10, 'task_completion', '2026-06-15T17:57:20.846634');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781564241295', 'gayguy', 10, 'task_completion', '2026-06-15T17:57:21.295931');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781564241702', 'gayguy', 10, 'task_completion', '2026-06-15T17:57:21.702188');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781564389469', 'gayguy', 10, 'task_completion', '2026-06-15T17:59:49.469882');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781565160138', 'gayguy', 10, 'task_completion', '2026-06-15T18:12:40.138091');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781626812705', 'gayguy', 10, 'task_completion', '2026-06-16T11:20:12.705466');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781628783122', 'gayguy', 10, 'task_completion', '2026-06-16T11:53:03.122530');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781648296977', 'gayguy', 10, 'task_completion', '2026-06-16T17:18:16.977644');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781648409399', 'gayguy', 10, 'task_completion', '2026-06-16T17:20:09.399738');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1781704586690', 'gayguy', 10, 'task_completion', '2026-06-17T08:56:26.690274');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782663349993', 'gayguy', 10, 'task_completion', '2026-06-28T11:15:49.993689');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782663353523', 'gayguy', 10, 'task_completion', '2026-06-28T11:15:53.523030');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782663469552', 'gayguy', 10, 'task_completion', '2026-06-28T11:17:49.552798');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782663913241', 'gayguy', 10, 'task_completion', '2026-06-28T11:25:13.241851');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782747800352', 'gayguy', 42, 'task_completion', '2026-06-29T10:43:20.352502');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782748006805', 'gayguy', 45, 'task_completion', '2026-06-29T10:46:46.805083');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782748014840', 'gayguy', 45, 'task_completion', '2026-06-29T10:46:54.840967');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782748106145', 'gayguy', 27, 'task_completion', '2026-06-29T10:48:26.145225');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782748113121', 'gayguy', 10, 'task_completion', '2026-06-29T10:48:33.121363');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782748202745', 'gayguy', 23, 'task_completion', '2026-06-29T10:50:02.745267');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782748215195', 'gayguy', 15, 'task_completion', '2026-06-29T10:50:15.195710');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782841275936', 'gayguy', 18, 'task_completion', '2026-06-30T12:41:15.936077');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782842155491', 'gayguy', 20, 'task_completion', '2026-06-30T12:55:55.491786');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782842156892', 'gayguy', 10, 'task_completion', '2026-06-30T12:55:56.892421');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782842186401', 'gayguy', 41, 'task_completion', '2026-06-30T12:56:26.401490');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782842232612', 'gayguy', 25, 'task_completion', '2026-06-30T12:57:12.612548');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782842274705', 'gayguy', 10, 'task_completion', '2026-06-30T12:57:54.705365');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782862835379', 'gayguy', 10, 'task_completion', '2026-06-30T18:40:35.379543');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782862842399', 'gayguy', 41, 'task_completion', '2026-06-30T18:40:42.399394');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782862854992', 'gayguy', 44, 'task_completion', '2026-06-30T18:40:54.992869');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp) VALUES ('1782923628303', 'men', 54, 'task_completion', '2026-07-01T11:33:48.304020');
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783089165468', 'men', 41, 'task_completion', '2026-07-03T09:32:45.468880', '2026-07-03', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783113247864', 'gayguy', 42, 'task_completion', '2026-07-03T16:14:07.864915', '2026-07-03', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783267342980', 'gayguy', 44, 'task_completion', '2026-07-05T11:02:22.980508', '2026-07-05', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783268072269', 'gayguy', 37, 'task_completion', '2026-07-05T11:14:32.269310', '2026-07-05', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783271781985', 'gayguy', 50, 'task_completion', '2026-07-05T12:16:21.985020', '2026-07-05', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783271830409', 'gayguy', 50, 'task_completion', '2026-07-05T12:17:10.409375', '2026-07-05', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783291693708', 'gayguy', 73, 'task_completion', '2026-07-05T17:48:13.708483', '2026-07-05', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349006727', 'gayguy', 100, 'task_completion', '2026-07-06T09:43:26.727265', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349007686', 'gayguy', 100, 'task_completion', '2026-07-06T09:43:27.686269', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349008473', 'gayguy', 97, 'task_completion', '2026-07-06T09:43:28.473561', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349009152', 'gayguy', 100, 'task_completion', '2026-07-06T09:43:29.152272', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349009986', 'gayguy', 100, 'task_completion', '2026-07-06T09:43:29.986957', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349010765', 'gayguy', 99, 'task_completion', '2026-07-06T09:43:30.765925', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349011500', 'gayguy', 100, 'task_completion', '2026-07-06T09:43:31.500172', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783349012611', 'gayguy', 100, 'task_completion', '2026-07-06T09:43:32.611320', '2026-07-06', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783440848532', 'gayguy', 5, 'task_completion', '2026-07-07T11:14:08.532793', '2026-07-07', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783440849124', 'gayguy', 5, 'task_completion', '2026-07-07T11:14:09.124818', '2026-07-07', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783441033572', 'gayguy', 52, 'task_completion', '2026-07-07T11:17:13.572540', '2026-07-07', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783458245343', 'gayguy', 100, 'task_completion', '2026-07-07T16:04:05.343509', '2026-07-07', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783458246087', 'gayguy', 100, 'task_completion', '2026-07-07T16:04:06.087574', '2026-07-07', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783458246710', 'gayguy', 100, 'task_completion', '2026-07-07T16:04:06.710826', '2026-07-07', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783521613543', 'gayguy', 37, 'task_completion', '2026-07-08T09:40:13.543714', '2026-07-08', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783521899210', 'gayguy', 49, 'task_completion', '2026-07-08T09:44:59.210113', '2026-07-08', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783543646631', 'gayguy', 22, 'task_completion', '2026-07-08T15:47:26.631373', '2026-07-08', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783624338367', 'gayguy', 37, 'task_completion', '2026-07-09T14:12:18.367061', '2026-07-09', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783695366920', 'gayguy', 99, 'task_completion', '2026-07-10T09:56:06.920424', '2026-07-10', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783695367845', 'gayguy', 100, 'task_completion', '2026-07-10T09:56:07.845785', '2026-07-10', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783713172862', 'gayguy', 37, 'task_completion', '2026-07-10T14:52:52.862197', '2026-07-10', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783907042002', 'gayguy', 73, 'task_completion', '2026-07-12T20:44:02.002112', '2026-07-12', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783907052107', 'gayguy', 74, 'task_completion', '2026-07-12T20:44:12.107225', '2026-07-12', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783907068559', 'gayguy', 10, 'task_completion', '2026-07-12T20:44:28.559017', '2026-07-12', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783955356267', 'gayguy', 100, 'task_completion', '2026-07-13T10:09:16.267185', '2026-07-13', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1783981604305', 'gayguy', 10, 'task_completion', '2026-07-13T17:26:44.305914', '2026-07-13', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784039932112', 'gayguy', 100, 'task_completion', '2026-07-14T09:38:52.112273', '2026-07-14', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784039933206', 'gayguy', 62, 'task_completion', '2026-07-14T09:38:53.206917', '2026-07-14', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784043591026', 'gayguy', 84, 'task_completion', '2026-07-14T10:39:51.026843', '2026-07-14', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784310584846', 'men', 10, 'task_completion', '2026-07-17T12:49:44.846772', '2026-07-17', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784476597617', 'men', 10, 'task_completion', '2026-07-19T10:56:37.617491', '2026-07-19', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784476598352', 'men', 200, 'task_completion', '2026-07-19T10:56:38.352509', '2026-07-19', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784476598987', 'men', 10, 'task_completion', '2026-07-19T10:56:38.987540', '2026-07-19', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643697742', 'men', 88, 'task_completion', '2026-07-21T09:21:37.742640', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643698517', 'men', 68, 'task_completion', '2026-07-21T09:21:38.517700', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643699202', 'men', 68, 'task_completion', '2026-07-21T09:21:39.202807', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643700020', 'men', 68, 'task_completion', '2026-07-21T09:21:40.020763', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643700712', 'men', 68, 'task_completion', '2026-07-21T09:21:40.712375', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643701465', 'men', 68, 'task_completion', '2026-07-21T09:21:41.465914', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643702204', 'men', 68, 'task_completion', '2026-07-21T09:21:42.204089', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643702909', 'men', 68, 'task_completion', '2026-07-21T09:21:42.909491', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643724595', 'men', 68, 'task_completion', '2026-07-21T09:22:04.595316', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643725303', 'men', 68, 'task_completion', '2026-07-21T09:22:05.303241', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643726151', 'men', 68, 'task_completion', '2026-07-21T09:22:06.151983', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643726983', 'men', 68, 'task_completion', '2026-07-21T09:22:06.983030', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643727713', 'men', 68, 'task_completion', '2026-07-21T09:22:07.713122', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643728509', 'men', 68, 'task_completion', '2026-07-21T09:22:08.509371', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643729248', 'men', 68, 'task_completion', '2026-07-21T09:22:09.248514', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643730102', 'men', 68, 'task_completion', '2026-07-21T09:22:10.102350', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643731160', 'men', 68, 'task_completion', '2026-07-21T09:22:11.160132', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643732073', 'men', 68, 'task_completion', '2026-07-21T09:22:12.073775', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643732836', 'men', 68, 'task_completion', '2026-07-21T09:22:12.836694', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643734127', 'men', 68, 'task_completion', '2026-07-21T09:22:14.127123', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643734919', 'men', 68, 'task_completion', '2026-07-21T09:22:14.919281', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643735667', 'men', 68, 'task_completion', '2026-07-21T09:22:15.667246', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643736423', 'men', 68, 'task_completion', '2026-07-21T09:22:16.423870', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643737125', 'men', 68, 'task_completion', '2026-07-21T09:22:17.125118', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643737845', 'men', 68, 'task_completion', '2026-07-21T09:22:17.845204', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643738608', 'men', 68, 'task_completion', '2026-07-21T09:22:18.608064', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643739272', 'men', 68, 'task_completion', '2026-07-21T09:22:19.272617', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643740137', 'men', 68, 'task_completion', '2026-07-21T09:22:20.137546', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643740889', 'men', 68, 'task_completion', '2026-07-21T09:22:20.889091', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643741611', 'men', 68, 'task_completion', '2026-07-21T09:22:21.611932', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643742329', 'men', 68, 'task_completion', '2026-07-21T09:22:22.329709', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643742991', 'men', 68, 'task_completion', '2026-07-21T09:22:22.991203', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643743673', 'men', 68, 'task_completion', '2026-07-21T09:22:23.673646', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643744361', 'men', 68, 'task_completion', '2026-07-21T09:22:24.361294', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643745083', 'men', 68, 'task_completion', '2026-07-21T09:22:25.083907', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643745781', 'men', 68, 'task_completion', '2026-07-21T09:22:25.781463', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643746532', 'men', 68, 'task_completion', '2026-07-21T09:22:26.532083', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643747303', 'men', 68, 'task_completion', '2026-07-21T09:22:27.303828', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643748050', 'men', 68, 'task_completion', '2026-07-21T09:22:28.050241', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643748675', 'men', 68, 'task_completion', '2026-07-21T09:22:28.675911', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643749337', 'men', 68, 'task_completion', '2026-07-21T09:22:29.337864', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643750081', 'men', 68, 'task_completion', '2026-07-21T09:22:30.081346', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643750798', 'men', 68, 'task_completion', '2026-07-21T09:22:30.798266', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643751547', 'men', 68, 'task_completion', '2026-07-21T09:22:31.547033', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643752273', 'men', 68, 'task_completion', '2026-07-21T09:22:32.273938', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643753020', 'men', 68, 'task_completion', '2026-07-21T09:22:33.020891', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643753747', 'men', 68, 'task_completion', '2026-07-21T09:22:33.747589', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643754516', 'men', 68, 'task_completion', '2026-07-21T09:22:34.516702', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643755184', 'men', 68, 'task_completion', '2026-07-21T09:22:35.184590', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643755962', 'men', 68, 'task_completion', '2026-07-21T09:22:35.962625', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643756736', 'men', 68, 'task_completion', '2026-07-21T09:22:36.736448', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643757488', 'men', 68, 'task_completion', '2026-07-21T09:22:37.488099', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643758251', 'men', 68, 'task_completion', '2026-07-21T09:22:38.251494', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643759024', 'men', 68, 'task_completion', '2026-07-21T09:22:39.024799', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643759795', 'men', 68, 'task_completion', '2026-07-21T09:22:39.795504', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643760577', 'men', 68, 'task_completion', '2026-07-21T09:22:40.577995', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784643761381', 'men', 68, 'task_completion', '2026-07-21T09:22:41.381090', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784672538875', 'gayguy', 67, 'task_completion', '2026-07-21T17:22:18.875216', '2026-07-21', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784750848986', 'men', 47, 'task_completion', '2026-07-22T15:07:28.986266', '2026-07-22', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784755832398', 'men', 35, 'task_completion', '2026-07-22T16:30:32.398450', '2026-07-22', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784755833718', 'men', 10, 'task_completion', '2026-07-22T16:30:33.718831', '2026-07-22', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784755835185', 'men', 10, 'task_completion', '2026-07-22T16:30:35.185673', '2026-07-22', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784756214603', 'men', 100, 'task_completion', '2026-07-22T16:36:54.603374', '2026-07-22', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784756216079', 'men', 100, 'task_completion', '2026-07-22T16:36:56.079413', '2026-07-22', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1784819494678', 'men', 98, 'task_completion', '2026-07-23T10:11:34.678230', '2026-07-23', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1785078053267', 'dude', 10, 'task_completion', '2026-07-26T10:00:53.267339', '2026-07-26', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1785078054353', 'dude', 10, 'task_completion', '2026-07-26T10:00:54.353784', '2026-07-26', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1785109746661', 'SMYLES', 75, 'task_completion', '2026-07-26T18:49:06.661921', '2026-07-26', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1785109747861', 'SMYLES', 43, 'task_completion', '2026-07-26T18:49:07.861954', '2026-07-26', 1);
INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date, tasks_completed) VALUES ('1785109750413', 'SMYLES', 62, 'task_completion', '2026-07-26T18:49:10.413314', '2026-07-26', 1);
