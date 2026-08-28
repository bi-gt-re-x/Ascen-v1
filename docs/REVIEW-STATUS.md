# Review remediation — status and what is left

Working notes for the twelve-point code review. Item 1 is now complete apart
from the date-windowing described below; seven items are done or substantially
done and committed on `copy-pass`; the rest are described below
in enough detail to pick up cold.

Every "not verified" note below means the same thing: the pages behind the
login could not be checked, because that needs credentials.

---

## Done

| # | Item | Commit |
|---|------|--------|
| 1 (half) | Stop fetching the same data three times | `e60810c` |
| 1 (most) | Split the endpoint; task read is demand-gated | this branch |
| 1 (rest) | Calendar events off localStorage-only | this branch |
| 10 | Accessibility: inert disclosures, heading outline | this branch |
| CSS | All nine class collisions cleared, LEGACY empty | this branch |
| 2 | Frontend tests, from zero | `a131c7c` |
| 3 | Analytics monolith, 1,879 → 423 lines | `ada6da3` |
| 4 | CSS collisions become a build failure | `17ebcb8` |
| 6 (part) | Login rate limiting + Secure cookie | `5ef1864` |
| 6 (main) | Off end-of-life Python, 3.9.6 → 3.13.15 | `aa69eed` |
| 12 | Delete unrendered components | `61dd7cf` |

Current gate: `npm run build` (typecheck + 3 data lints + vite), 224 frontend
tests (`npm test`), 89 backend tests (`.venv-fastapi/bin/python -m pytest`).

---

## 1. The data architecture — mostly done

**The three-requests-per-page half** was fixed by `UserDataProvider`
(`e60810c`). **The payload half is now fixed too**, for every page that does
not render a task.

### What the numbers actually were

Measured against this database — 8 accounts, 10,660 tasks, the largest account
holding 9,547 of them:

| endpoint | payload | server time |
|---|---|---|
| `/api/get_user_data` (before, and still, for task pages) | 2,869 KB | 40 ms |
| `/api/stats` | 0.1 KB | <1 ms |
| `/api/alerts` | 0.2 KB | 16 ms |
| `/api/tasks/search?q=…` | 2.2 KB | 2 ms |

**A page that renders no task now costs 0.3 KB instead of 2.9 MB.**

Note this corrects two figures that were guessed rather than measured. The
payload is 2.9 MB, not the 4.4 MB a raw SQLite dump suggests — the API drops
NULL columns. And date-windowing the read, which the original notes put first
in value order, turns out to be worth only ~40%: the largest account has 5,428
*open* tasks, and no date window excludes those. Splitting the endpoint was
worth far more, so it was done first.

### What was done

1. **`/api/stats`** — the six integers, by themselves. The rail and the top bar
   read this. **It owns the streak decay**, which is the "exactly one caller"
   constraint: the rail mounts outside the router and never unmounts, so
   `/api/stats` is fetched once per session at precisely the moment
   `/api/get_user_data` used to be. The decay did not move in time, only in
   which endpoint carries it. `/api/get_user_data` no longer decays and must
   not start again.
2. **`/api/alerts`** — the bell's three facts as four numbers and two titles,
   aggregated in SQL. The top bar used to filter the whole task list for this.
3. **`/api/tasks/search`** — title search with a capped `LIMIT`. Also the top
   bar, also formerly a `.filter()` over everything.
4. **The task read is demand-gated.** `UserDataProvider` does not fetch until
   something calls `useUserData`. The gate latches on for the session, so
   navigating away and back does not re-fetch megabytes.
5. **`StatsProvider` is the only stats state.** `UserDataProvider` still reads
   `/api/get_user_data` and deliberately drops its stats block. Two copies
   would reintroduce the exact bug the provider was built to kill — the top bar
   showing the XP from before a completion.

Callers moved off the heavy read: the rail, the top bar, `pages/Settings.tsx`
and `pages/Achievements.tsx` (both held it to read a `username`; `useAuth` has
one).

### What is left

**Push the date window into the query.** `useAnalyticsModel` still slices
`from`/`to` in the browser after downloading the whole history. Analytics is a
genuine task consumer — it counts the subject breakdown and finished-in-window
totals off individual rows — so it cannot simply stop reading; it needs a
scoped read. Worth ~40% on that page and on dashboard, tasks, calendar, goals
and records.

`pages/Records.tsx` is the awkward one: `personalRecords` asks all-time
questions ("most tasks in a day, ever"), so a window would break it. That one
wants server-side aggregation rather than a narrower read.

### The calendar was localStorage-only — fixed

`frontend/src/utils/calendarStore.ts` documented it:

> The backend has endpoints for calendar entries, but the month, week and day
> views never used them, so every event any user of this app has ever made is
> in this store and nowhere else.

**Confirmed against the database before touching anything:** `calendar_events`
held 7 rows, every one `is_default = 1` with `user_id = NULL`. `calendar_entries`
held 0. Not one user-created event existed server-side. The data was not merely
fragile — it was *invisible*, sitting in each user's own browser where it could
not be backed up, inspected or restored.

**The dead endpoints were not a home for it**, which is the part the original
note got wrong. They model the old coarse calendar and cannot hold what the
store keeps:

| store field | `calendar_events` |
|---|---|
| `startTime` / `endTime` (`"HH:MM"`) | `time_block`, a string like `'morning'` |
| `subtasks[]`, `hasSubtasks` | — |
| `xp` | — |
| `family` / `color` / `colorIndex` | — (colours are a global 30-row table) |
| `recurrence` + `recurrenceDays[]` | `recurrence-week` as `"mon, tue, wed"` |

Wiring the views to them would have dropped four fields per event — turning a
risk of data loss into certain data loss.

**What was done instead:** a `calendar_documents` table holding one account's
whole calendar as the JSON the views already keep, with
`GET`/`PUT /api/calendar_store`. A document rather than rows because nothing
queries individual events, and because the alternative was translating through
a schema that loses fields. When something does need to ask questions of single
events, that is the moment for a real table — the DDL comment says so.

Three properties make it safe on a database full of accounts whose only copy is
local, and each has a test that fails if the logic is removed (verified by
mutation, not assumed):

1. **localStorage is still written every time** — it is the offline copy and
   what paints the first frame. Nothing was taken away.
2. **An empty server answer means "never uploaded", not "empty"** — so the
   local copy migrates up instead of being wiped.
3. **Nothing uploads before the first read returns** — otherwise a browser that
   has never opened the account would push an empty calendar over a good one.

Uploads are debounced 700 ms and flushed on unmount and on tab-hide, so leaving
the page mid-edit does not leave the server a version behind.

**Not yet verified visually** — the calendar is behind the login.

---

## CSS collisions — all nine cleared

`scripts/check_css.mjs` carried nine known collisions. **The list is now
empty**, which is the state its own comment describes as the finished one.

The working theory was that six of the nine were `goals.css` vs `growth.css`
and could be scoped under `.gr-scope` in one edit. That turned out not to hold:
`.gr-scope` only ever qualifies `gr-`-prefixed classes, and the six colliding
rules were unscoped globals in a 3,129-line sheet that loads whole the moment
Analytics mounts.

**Eight of the nine were not styling problems at all — the classes were dead.**
`.bottom-nav`, `.home-btn`, `.nav-btn`, `.tab-btn`, `.tab-navigation`,
`.theme-selector-wrap` appear **zero times in the built bundle**; `.task-name`
appears only as `wk-`, `dash-` and `day-` prefixed variants, never bare. They
are leftovers from the server-rendered pages this app grew out of. Deleting the
rules cleared the collision because there had never been anything on either
side of it — 384 lines gone, which is also a small down-payment on item 8.

**One was live, and visibly so.** `.theme-select` is written by both
`dashboard.css` and `homepage.css`, and `Dashboard.tsx` is imported *eagerly*
in `App.tsx`, so `dashboard.css` loads on every page including the public
landing page. The landing page's theme control was rendering as a mix:
`background`, `border`, `padding` and `font-size` from `homepage.css`, but
`appearance: none` and `border-radius: 20px` bleeding in from `dashboard.css`.
Combined with `homepage.css`'s `background-image: none`, `appearance: none`
left the `<select>` with **no dropdown indicator at all** — it read as plain
text rather than a control. Confirmed in the browser before and after:
`appearance` went `none` → `auto` and the chevron came back.

Nothing on the dashboard uses `.theme-select` any more — the theme control
moved to the top bar — so that rule was dead *and* harmful.

**`.xp-input-field` was the only genuine two-component collision**: the
dashboard's Add Task popup and the calendar's both write the class, from two
sheets. Each is scoped to its own modal id now, matching what
`calendar/week.css` already did for its half.

### A note on how the deletion was done

The rules were removed with a throwaway CSS-aware pruner rather than by hand,
and it was wrong twice before it was right. First it deleted the comments above
the rules it removed — unacceptable in these files. Then its brace scanner
desynchronised on comments *containing* CSS: `calendar/month.css` has
`` `body { overflow: hidden }` `` inside a comment, and the scanner counted
those braces, mangling the file. Both were caught by inspection and reverted.
The final version skips comments and strings while scanning, and was checked by
round-tripping all 32 stylesheets with a class that does not exist — every file
came back byte-identical.

The eighteen comments left orphaned by the deletions were found by comparing
what followed each comment before and after, and removed too. A label for a
rule that no longer exists is worse than no label.

**Pre-existing, not fixed:** the legacy Jinja pages (`careers.html`,
`aboutus.html`, `contact-support.html`) render a `class="nav-btn home-btn"`
button, and the two stylesheets they load have never defined either class, so
it shows as a raw browser button. Unaffected by this work — those pages never
loaded the sheets the rules lived in — but it is now the only place those names
appear.

---

## 5. Conventions → systems

Partly addressed as a side effect: `scripts/check_css.mjs` joins
`check_trees` / `check_steps` in the build gate, and `tests/test_ratelimit.py`
walks the route table so a new auth endpoint without a limit fails.

Still convention-only:
- migration rules
- API conventions
- component organisation
- documentation rules

The pattern that works here is the one the three `check_*.mjs` scripts use: a
table that is the whole answer, a walker that fails on anything not in it, and
an explicit shrink-only list of known exceptions.

---

## 6. Security — what is left

Done: login/signup/resend/AI rate limiting, `Secure` + `HttpOnly` +
`SameSite=lax` session cookie, **and the Python upgrade** — the venv is on
3.13.15 (Homebrew) instead of the end-of-life 3.9.6 that shipped with Xcode's
command line tools. Every pin in `requirements.txt` installed unchanged and all
83 backend tests pass on it.

**Still open:**

- **CSRF is partial.** `SameSite=lax` blocks the cross-site form POST, which is
  the common case, but there is no token on state-changing endpoints. Lax does
  not cover top-level GET navigations that mutate — worth auditing whether any
  `GET` route changes state.
- **react-router-dom advisory** — documented in `package.json` as a deliberate
  accepted trade, with reasoning. That call looks right: no fixed release
  exists and downgrading reintroduces 14 worse advisories. Revisit when >8.2.0
  ships; the note says to delete itself then.
- **`ASCEN_TRUST_PROXY`** must be set if this ever runs behind a proxy, or every
  caller shares one rate-limit bucket. `backend/middleware/limit.py:client_ip`
  explains why it is off by default.
- **The limiter is per-process.** Two workers = two budgets. Fine for one
  process and SQLite; replace with a shared store before scaling out.

---

## 7. Backend scaling

Not urgent at 8 users, and the review agrees. The item worth doing *now*,
because it gets harder later, is #1 above. Everything else on that list
(async handlers, caching, background jobs) is premature.

---

## 8. Too much code for the product

86.8k TS/Python + 32.4k CSS. `61dd7cf` removed ~3,000 lines of dead components
but **the bundle did not shrink by a byte** — Rollup was already tree-shaking
them. So this item is about maintenance surface, not performance.

The files the review flagged as suspiciously large are still there:

```
1,304  frontend/src/skills/improve.ts
1,256  frontend/src/utils/growthSummary.ts
1,351  frontend/src/pages/Settings.tsx
1,060  frontend/src/utils/advice.ts
1,044  frontend/src/pages/Notes.tsx
  866  frontend/src/utils/growthFocus.ts
  784  frontend/src/utils/habits.ts
```

The honest question for each is the review's: genuinely complex domain, or a
simple idea implemented at length? Worth reading `advice.ts` and
`growthSummary.ts` first — they are the two most likely to be rule tables that
could be data.

`Settings.tsx` and `Notes.tsx` are the same shape of problem as Analytics was
and would take the same treatment (state/fetch/calculation/render split), but
neither is as tangled as Analytics was.

---

## 9. Documentation may be excessive

**The subtlest item, and the one I would not touch without a steer.**

This codebase's comments are unusually good — most explain *why*, name the bug
they prevent, and several directly enabled the fixes above. The `.modal`
collision fix in `17ebcb8` came straight out of a comment in `dashboard.css`
that had diagnosed the bug and prescribed the fix.

So the risk of over-trimming is real. If pursued, the test is the review's:
keep anything answering **"why is this weird?"**, cut anything narrating
**"what does this obvious function do?"**. Decision records stay.

One concrete instance was already found and fixed: the Analytics barrel had a
paragraph explaining why three components were deliberately unrendered. The
paragraph was correct and well-written and the right fix was deleting the
components, not the paragraph.

---

## 10. Accessibility — done, but not the work that was described

The review said "Analytics has 0 ARIA attributes". These notes already
corrected that once, for the charts. Auditing the rest, **both remaining claims
were also wrong, and there were real defects underneath them that neither
named.**

### The claims, checked

**"17 `<button>` elements with no accessible name."** There are exactly 17
buttons under `components/Analytics/`, so the count was right. Every one of
them has text content, which *is* an accessible name. Most also carry correct
state — `aria-pressed` on the chip groups, `aria-current` on the view tabs,
`aria-expanded` on the disclosures. The single icon-only button, the heat-map
cell in `Habits.tsx`, already had an `aria-label`. **Unnamed buttons: zero.**

**"Zero ARIA in all seven tab components — headings-and-landmarks work."** The
tab files do contain almost no ARIA and only two literal `<h2>` tags. But their
panels are rendered by the shared `Panel` in `charts.tsx`, which emits an
`<h2>` per panel, and `Header.tsx` emits the page's `<h1>`. The heading outline
was already there; it was just not written in those files.

### What was actually wrong

**Two disclosures were closed to the eye and open to everything else.** Both
collapses — `.ax-group-body` (`PanelGroup`) and `.ax-finding-body`
(`FindingCard`) — are a grid row going to `0fr` with `overflow: hidden`. That
clips the content visually and does nothing else: it stayed in the
accessibility tree and in the tab order. So a group announcing
`aria-expanded="false"` had a screen reader read its charts out anyway, and a
keyboard user tabbed into controls that were not on the screen. `inert` while
shut is the fix.

This is the one that mattered — it is a WCAG 4.1.2 and 2.4.3 failure, and it
affects every reader using a keyboard or a screen reader on the two densest
tabs.

**`PanelGroup` titles were not headings.** They were `<strong>` inside a
button. The three groups are what organise the Insights tab — the file's own
comment says so — and they were absent from the outline, leaving fifteen equal
`<h2>`s and no structure. The title is now a real heading wrapped around the
button, and `Panel` picks its level from a context, so a grouped panel renders
`<h3>` and an ungrouped one still renders `<h2>`. Three CSS selectors match the
level rather than the tag.

**`Trajectory`'s chips claimed to be tabs.** `role="tab"` commits to a
`tabpanel` named by `aria-controls` and to arrow-key movement across the set,
and there was neither — a screen reader announced "tab, 1 of 5" and the arrow
keys did nothing. They are not tabs: nothing is swapped, the same chart redraws
for a different series. They are `aria-pressed` toggles now, which is what
every other chip group on the page already was.

### Verified

Three tests in `components/Analytics/disclosure.test.tsx`, each checked by
breaking the code it covers — all three fail when their guard is removed.

**Not verified visually**; the page is behind the login.

---

## 11. Unbuilt routes — smaller than it looks

Three placeholders remain, in `frontend/src/pages/Unbuilt.tsx`:

| Path | Name | Backing |
|------|------|---------|
| `/focus` | Focus | `backend/api/focus.py` exists and is wired; `frontend/js/timer.js` to port |
| `/library` | Library | `backend/api/library.py` is a stub; schema only |
| `/history` | History | `backend/api/history.py` is a stub; schema only |

**None of them is in the rail** — the rail's ten entries do not include any of
these, and nothing links to them. They are reachable only by typing the URL.

So the review's advice ("consider removing them from the navigation entirely")
is already satisfied. The remaining question is narrower: delete the three
placeholders and their routes, or keep them as the documented note for whoever
builds them. `Unbuilt.tsx`'s own header argues for the latter, and given they
are invisible in normal use, that argument is decent. **Lowest value item on
this list.**

---

## CSS collisions still listed

`npm run check:css` passes but names nine known ones, all real:

```
.bottom-nav           goals.css, growth.css
.home-btn             calendar/month.css, growth.css
.nav-btn              calendar/month.css, growth.css
.tab-btn              goals.css, growth.css
.tab-navigation       goals.css, growth.css
.task-name            calendar/month.css, dashboard.css
.theme-select         dashboard.css, homepage.css
.theme-selector-wrap  goals.css, growth.css
.xp-input-field       calendar/week.css, dashboard.css
```

Six of nine are `goals.css` vs `growth.css`. Since the growth page merged into
Analytics, `growth.css` is now only loaded by the Analytics tabs inside
`.gr-scope` — so scoping those six under `.gr-scope` is probably one edit and
clears most of the list. The pattern to follow is `17ebcb8`, which scoped
`.modal` under `.gx-page` and `.calendar-container`.

Deleting an entry from `LEGACY` in `scripts/check_css.mjs` is required when one
is fixed — a stale entry fails the build on purpose.

---

## Suggested order

1. **Python upgrade** (#6) — two commands, highest security value, unblocks nothing else
2. **The `get_user_data` payload** (#1) — the item that gets harder with time
3. **The calendar localStorage finding** (#1) — potential silent data loss
4. **Accessibility** (#10) — contained, and cheap now
5. **CSS collisions** — six of nine likely fall to one edit
6. **`Settings.tsx` / `Notes.tsx`** (#3, #8) — same treatment as Analytics
7. **Doc trimming** (#9) — only with a steer; high risk of removing good comments
8. **Unbuilt routes** (#11) — lowest value; arguably already fine
