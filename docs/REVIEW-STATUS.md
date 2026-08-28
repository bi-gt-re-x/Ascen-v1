# Review remediation — status and what is left

Working notes for the twelve-point code review. Seven items are done or
substantially done and committed on `copy-pass`; the rest are described below
in enough detail to pick up cold.

Every "not verified" note below means the same thing: the pages behind the
login could not be checked, because that needs credentials.

---

## Done

| # | Item | Commit |
|---|------|--------|
| 1 (half) | Stop fetching the same data three times | `e60810c` |
| 1 (most) | Split the endpoint; task read is demand-gated | this branch |
| 2 | Frontend tests, from zero | `a131c7c` |
| 3 | Analytics monolith, 1,879 → 423 lines | `ada6da3` |
| 4 | CSS collisions become a build failure | `17ebcb8` |
| 6 (part) | Login rate limiting + Secure cookie | `5ef1864` |
| 6 (main) | Off end-of-life Python, 3.9.6 → 3.13.15 | `aa69eed` |
| 12 | Delete unrendered components | `61dd7cf` |

Current gate: `npm run build` (typecheck + 3 data lints + vite), 216 frontend
tests (`npm test`), 83 backend tests (`.venv-fastapi/bin/python -m pytest`).

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

Related finding, from the #12 work — **calendar events are localStorage-only**.
`frontend/src/utils/calendarStore.ts` documents it:

> The backend has endpoints for calendar entries, but the month, week and day
> views never used them, so every event any user of this app has ever made is
> in this store and nowhere else.

So: `backend/api/calendar.py` endpoints are dead, the ten matching wrappers in
`frontend/src/services/events.ts` are dead (left in place deliberately — see
`61dd7cf`), and user-created calendar events do not survive clearing site data
or changing browser. That is a data-loss bug wearing a dead-code costume, and
it belongs to this item rather than to #12. **Still open, and the next thing
worth doing.**

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

## 10. Accessibility — recommended next

The review's "Analytics has 0 ARIA attributes" is now literally true of
`pages/Analytics.tsx` (423 lines of shell) but the picture is more nuanced:

```
27  pages/Notes.tsx          9  pages/SkillTrees.tsx     1  pages/Goals.tsx
22  pages/Records.tsx        9  pages/Achievements.tsx   0  pages/Analytics.tsx
17  pages/Settings.tsx       8  pages/Tasks.tsx          0  all 7 Analytics tabs
                             2  pages/Dashboard.tsx
```

The charts are **better than the review implies** — `components/Analytics/
charts.tsx` already has `role="img"` + `aria-label` on the area chart, radar
and scatter, and `<title>` on radar axes.

The real gaps:
- **17 `<button>` elements in `components/Analytics/` with no accessible name**
  beyond their text content — several are icon-only.
- **Zero ARIA in all seven tab components** (`components/Analytics/tabs/*`) —
  these are the panel/section wrappers, so headings-and-landmarks work rather
  than chart work.
- `pages/Goals.tsx` (1 attribute) and `pages/Dashboard.tsx` (2) are thinner
  than Analytics now is.

This is contained, and the Analytics refactor made it much cheaper — the work
is now in seven small files instead of one 1,879-line one.

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
