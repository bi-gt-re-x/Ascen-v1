/**
 * Which of your titles the rail shows.
 *
 * The foot of the rail names the band your level has reached — Apprentice,
 * Adept, Grand Champion. That is the honest default and stays the default, but
 * it is not the only true thing it could say: a reader at level 34 has been
 * every band below Master on the way up, and some of them meant more than the
 * one they happen to be standing in. So the three dots beside it offer the
 * lot, and the rail says whichever they pick.
 *
 * **Only downwards.** The list is the bands *reached*, never the ones ahead —
 * a title is a thing you have been, and a chooser that offered Eternal at
 * level 2 would make every one of them worthless. Outgrow a chosen title and
 * it stays chosen, because it is still true.
 *
 * The one entry that is not a band is the title the hidden chain hands out at
 * the end (`earnedTitle`, in utils/easterEgg.ts). It is offered here for the
 * same reason the rest are: it was earned, and there is nowhere else in the
 * app it could be worn.
 *
 * That one arrives already picked. frontend/secret/hidden-engine.js writes
 * *this file's* key alongside its own when the ADMIN ROOM hands the title
 * over, so the reader walks back to a rail that has changed. Anything else
 * makes a button that says TITLE EQUIPPED and equips nothing — the rail goes
 * on printing the band, and the prize is a menu entry the reader has no reason
 * to go looking for. It is a default, not a sentence: the bands are still in
 * the menu, and picking one back is the ordinary thing this file does.
 *
 * So `key()` below is a contract with that script, in the way the keys in
 * utils/easterEgg.ts are. Rename it here and the room still says the words,
 * but the rail stops listening.
 *
 * ## Why localStorage and not a preference
 *
 * Every other rail setting is on the account — `nav_collapsed` is, and the
 * note at the top of components/Rail.tsx is about exactly that. This one is
 * not, and it is worth saying why rather than leaving it to look like an
 * oversight: the secret title it can be set to is itself a localStorage fact
 * written by a script that never talks to the server
 * (frontend/secret/hidden-engine.js), so putting the choice on the account
 * would let a device sync a title the account has no idea exists. The choice
 * lives where the thing being chosen lives.
 */
import { TIERS } from '@/utils/mastery';
import { earnedTitle } from '@/utils/easterEgg';

/** The rail follows the level, which is what it does when nothing is chosen. */
export const AUTOMATIC = '';

function key(username: string): string {
  return `ascenRankTitle:${username || 'Default'}`;
}

/** The title this account has picked, or AUTOMATIC for "follow my level". */
export function chosenTitle(username: string): string {
  try {
    return localStorage.getItem(key(username)) ?? AUTOMATIC;
  } catch {
    return AUTOMATIC;
  }
}

/** Remember the pick. AUTOMATIC clears it rather than storing an empty string. */
export function chooseTitle(username: string, title: string): void {
  try {
    if (title === AUTOMATIC) localStorage.removeItem(key(username));
    else localStorage.setItem(key(username), title);
  } catch {
    /* storage blocked: the rail keeps the pick for this session and no longer */
  }
}

/**
 * Everything this account may call itself, best first.
 *
 * The earned title leads when there is one — it is the rarest thing in the
 * list — and the bands follow from the highest reached downwards, which is the
 * order somebody scanning for "the good one" reads in.
 */
export function titlesFor(level: number, earned: string | null): string[] {
  const reached = TIERS.filter((tier) => level >= tier.from)
    .map((tier) => tier.name)
    .reverse();
  return earned ? [earned, ...reached.filter((name) => name !== earned)] : reached;
}

/**
 * What to print. A chosen title the account can no longer justify — the secret
 * one, cleared out of storage — falls back to the band rather than to nothing.
 */
export function titleShown(account: string, rank: string, level: number): string {
  const chosen = chosenTitle(account);
  if (!chosen) return rank;
  return titlesFor(level, earnedTitle(account)).includes(chosen) ? chosen : rank;
}
