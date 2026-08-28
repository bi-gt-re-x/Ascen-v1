# Review remediation — status and what is left

Working notes for the twelve-point code review. Five items are done and
committed on `copy-pass`; the rest are described below in enough detail to pick
up cold.

Every "not verified" note below means the same thing: the pages behind the
login could not be checked, because that needs credentials.

---

## Done

| # | Item | Commit |
|---|------|--------|
| 1 (half) | Stop fetching the same data three times | `e60810c` |
| 2 | Frontend tests, from zero | `a131c7c` |
| 3 | Analytics monolith, 1,879 → 423 lines | `ada6da3` |
| 4 | CSS collisions become a build failure | `17ebcb8` |
| 6 (part) | Login rate limiting + Secure cookie | `5ef1864` |
| 12 | Delete unrendered components | `61dd7cf` |

Current gate: `npm run build` (typecheck + 3 data lints + vite), 213 frontend
tests (`npm test`), 83 backend tests (`.venv-fastapi/bin/python -m pytest`).

---

## 1. The data architecture — the big one, still open

**Half done.** `UserDataProvider` (`e60810c`) fixed the *three requests per
page* half: the dashboard, top bar and rail now share one read.

**The other half is untouched and is the review's #1 concern.**
`/api/get_user_data` (`backend/api/dashboard.py:35`) still returns
`db.tasks_for(username)` — every task the account has ever created, on every
page load. Performance scales with history rather than with what is on screen.

What a fix looks like, roughly in order of value:

1. **Paginate or scope the task read.** The dashboard needs today's plate plus
   recent completions; Analytics needs a date window it already computes
   (`useAnalyticsModel` slices `from`/`to` client-side after downloading
   everything). Push that window into the query.
2. **Split the endpoint.** `stats` is six integers and is what the top bar and
   rail actually want; `tasks` is the megabytes. They are one response only
   because one page once needed both.
3. **Do not break the streak decay.** Reading `get_user_data` has a side
   effect — `xp_tracking.refresh_streak` — and pages currently rely on it. Any
   split has to keep exactly one call doing that, or move it.

Related finding, from the #12 work — **calendar events are localStorage-only**.
`frontend/src/utils/calendarStore.ts` documents it:

> The backend has endpoints for calendar entries, but the month, week and day
> views never used them, so every event any user of this app has ever made is
> in this store and nowhere else.

So: `backend/api/calendar.py` endpoints are dead, the ten matching wrappers in
`frontend/src/services/events.ts` are dead (left in place deliberately — see
`61dd7cf`), and user-created calendar events do not survive clearing site data
or changing browser. That is a data-loss bug wearing a dead-code costume, and
it belongs to this item rather than to #12.

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
`SameSite=lax` session cookie.

**Still open:**

- **Python 3.9.6 is end of life** (October 2025, no security patches). This is
  the highest-value remaining item and it is two commands.
  `requirements.txt` already carries the exact steps. Left undone here because
  installing a Python changes the machine rather than the project.
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
