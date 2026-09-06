/**
 * The hidden chain's storage, and nothing else.
 *
 * Two keys, and neither of them is this file's to name. The rest of the chain
 * is plain script served out of frontend/secret/ — pentagon-egg.js on the
 * landing page, void.js for the riddle, engine.js on the hidden page — and
 * every one of them builds these exact strings by hand, because a `<script
 * src>` cannot import a module. So the format below is a contract with three
 * files rather than an implementation detail: rename `easterEgg:<user>:<day>`
 * here and the pentagon stops waking up, silently, because it is still looking
 * for the old one.
 *
 * ## `currentUser`, and why React writes it
 *
 * Every one of those files identifies the account the same way: a localStorage
 * key called `currentUser`. Six readers — the four scripts, this file, and
 * frontend/secret/void.js — and until now exactly one writer:
 * frontend/secret/engine.html, which is the *last* page in the chain.
 *
 * That is one writer in the wrong place, and it made the account meaningless
 * in both directions. Before anybody reached the engine, `currentUser` was
 * unset and every account on a browser shared one progression under
 * 'Default'. After somebody reached it, the name was pinned to whoever that
 * was and never moved again — so the next person to sign in on that browser
 * was read as *them*: their day's unlock, and, fatally, their earned title.
 * A title retires the chain (`earnedTitle` below), so a second account found
 * the whole thing already over — ten clicks on the rail's title doing
 * nothing, no unlock written, and the pentagon on the landing page inert
 * because it had no unlock to find. Dead, with no symptom to read.
 *
 * So `rememberAccount` writes it, from the session React already knows about,
 * on every load and every sign-in. The scripts go on reading the key they
 * always read; it is simply true now. See hooks/useChainAccount.ts.
 *
 * Every read is wrapped: localStorage throws outright in a Safari private
 * window and where site data is blocked, and a secret is not worth a blank
 * dashboard. Unreadable storage means "not unlocked", which is the state a
 * first-time reader is in.
 */

/**
 * Announced when the tenth click lands, for a dashboard that is already open.
 *
 * The same device as `ascen:stats-changed` in components/Rail.tsx, for the
 * same reason: one fact, one direction, no reply. The door (the rail's title)
 * and the room (the dashboard's quote) are in two components that never share
 * a parent below the router.
 */
export const EGG_UNLOCKED = 'ascen:egg-unlocked';

/** Nobody signed in — the landing page's own door still works signed out. */
export const ANON = 'Default';

/**
 * Tell the chain who is signed in.
 *
 * Called with the account on every load and every change of it, so that the
 * four scripts in frontend/secret/ — which cannot ask React anything — read
 * the right person out of the only place they know to look.
 *
 * Signing out clears it rather than leaving the last name behind: a shared
 * machine should not hand the next person the previous one's progress, and
 * 'Default' is a real state, not a fallback, because the landing page's own
 * way in (frontend/secret/quote-egg.js) is open to visitors with no account.
 */
export function rememberAccount(username: string | null): void {
  try {
    if (username) localStorage.setItem('currentUser', username);
    else localStorage.removeItem('currentUser');
  } catch {
    /* storage blocked: everyone is 'Default', which is the signed-out chain */
  }
}

/**
 * Today, local, as YYYY-MM-DD.
 *
 * Built by hand rather than sliced off `toISOString()`, which is UTC: an
 * evening click in a western timezone would stamp tomorrow's key and the clue
 * would vanish at midnight UTC instead of midnight here.
 */
function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayKey(account: string): string {
  return `easterEgg:${account}:${today()}`;
}

/**
 * Has this account found the clue today?
 *
 * The account is passed in rather than read back out of `currentUser`, and
 * that is not tidiness. React writes that key from an effect above the router,
 * and effects run child-first — so a component asking this question in the
 * same commit that the session resolved would read the *previous* name, and
 * there is no later commit to put it right. hooks/useChainAccount.ts hands
 * every caller the answer instead, and holds them off until there is one.
 */
export function unlockedToday(account: string): boolean {
  try {
    return localStorage.getItem(dayKey(account)) === '1';
  } catch {
    return false;
  }
}

/** Remember it, so a reload keeps the clue rather than asking for ten more clicks. */
export function markUnlockedToday(account: string): void {
  try {
    localStorage.setItem(dayKey(account), '1');
  } catch {
    /* storage blocked: the clue is on screen, it just will not survive a reload */
  }
}

/**
 * The title handed out at the end of the chain, in the hidden ADMIN ROOM —
 * written by frontend/secret/hidden-engine.js.
 *
 * It is the chain's terminator: once a title has been earned the clue has done
 * its job and the dashboard goes back to reading normally.
 *
 * That script writes a second key at the same moment — the rail's chosen
 * title, so the prize is worn and not merely offered. utils/rankTitle.ts owns
 * that one and explains it.
 */
export function earnedTitle(account: string): string | null {
  try {
    return localStorage.getItem(`ascenTitle:${account}`);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
 * The reveal latch
 * ------------------------------------------------------------------------ */

/**
 * One bit, in memory, saying the reveal is owed a performance.
 *
 * The tenth click can land on any page, because the rail is on all of them —
 * so it sends the reader to the dashboard, and the theatrics have to survive
 * that trip. `unlockedToday()` cannot carry them: it is also true tomorrow
 * morning, when the clue should simply be sitting there rather than crashing
 * in again.
 *
 * A module variable and not sessionStorage, because the trip is a client-side
 * navigation and this is the same JavaScript context on the other side of it.
 * If a reload somehow intervenes the latch is lost, which is the right way to
 * fail: the clue is still there, it just arrives quietly.
 */
let owed = false;

/** The tenth click landed: the next quote to mount owes a reveal. */
export function armReveal(): void {
  owed = true;
}

/** Claim the reveal, if one is owed. Answers true at most once per arming. */
export function takeReveal(): boolean {
  const was = owed;
  owed = false;
  return was;
}
