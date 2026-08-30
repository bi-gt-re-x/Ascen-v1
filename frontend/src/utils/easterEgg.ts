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
 * `currentUser` is only ever *written* by frontend/secret/engine.html. Nothing
 * in the React app sets it, so `user()` reads 'Default' here — which is also
 * what the scripts read when nobody has been through the engine, so both
 * halves still agree on the key. It is the day that gates the clue anyway, not
 * the account.
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

/** Whose chain this is. See the note above about 'Default'. */
function user(): string {
  try {
    return localStorage.getItem('currentUser') || 'Default';
  } catch {
    return 'Default';
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

function dayKey(): string {
  return `easterEgg:${user()}:${today()}`;
}

/** Has the clue already been found today? */
export function unlockedToday(): boolean {
  try {
    return localStorage.getItem(dayKey()) === '1';
  } catch {
    return false;
  }
}

/** Remember it, so a reload keeps the clue rather than asking for ten more clicks. */
export function markUnlockedToday(): void {
  try {
    localStorage.setItem(dayKey(), '1');
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
 */
export function earnedTitle(): string | null {
  try {
    return localStorage.getItem(`ascenTitle:${user()}`);
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
