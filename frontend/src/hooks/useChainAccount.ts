/**
 * Keeping the hidden chain pointed at whoever is actually signed in.
 *
 * The chain's four scripts in frontend/secret/ are plain `<script>` files.
 * They cannot read a context or call a hook, so they identify the account the
 * only way they can: a localStorage key, `currentUser`. utils/easterEgg.ts
 * reads the same key, and the long note at the top of it is the story of what
 * that key used to be worth — written once, by the last page in the chain, and
 * therefore either absent (everyone shares one progression) or stale (everyone
 * is read as the person who finished it first).
 *
 * This is the writer that makes it true. It runs above the router, so it has
 * set the name before any page has had a chance to mount a script that reads
 * it, and it re-runs whenever the account changes — signing in, signing out,
 * or a session that resolves a moment after the first paint.
 *
 * ## Why a copy of the username exists at all
 *
 * components/../pages/Homepage.tsx says the server-rendered page's habit of
 * writing the username into localStorage was deliberately dropped, because
 * `useAuth` asks the server and a copy can go stale. That reasoning is about
 * *displaying* a name, and it still holds — nothing renders this. This is a
 * key, needed by four files that have no other way to ask, and the answer to
 * "it can go stale" is to write it whenever it changes rather than to leave
 * the chain guessing.
 *
 * It is deliberately not the whole session: a name, not a token, not a claim
 * about being signed in. Everything gated on an account is gated by the
 * backend (backend/middleware/gate.py); this only decides whose day's progress
 * a secret is counting.
 *
 * ## It answers as well as writes
 *
 * React's own callers do not read the key back — they take the account from
 * here. Reading it back would mean depending on when the effect below ran
 * relative to theirs, and effects run child-first: a component asking in the
 * same commit that the session resolved would get the name from *before* the
 * write, with no later commit to correct it. Returning the answer removes the
 * question. `null` means "not yet", and every caller waits on it.
 */
import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { ANON, rememberAccount } from '@/utils/easterEgg';

/**
 * Whose hidden chain this is: the signed-in name, ANON for a visitor, or
 * `null` while the session check is still in flight.
 */
export function useChainAccount(): string | null {
  const { status, username } = useAuth();

  /* 'loading' is not an answer, and treating it as one is the bug this whole
     file exists to stop: a reader who unlocked the clue and pressed F5 would
     spend the first moment of the new page being somebody else. */
  const account = status === 'loading' ? null : status === 'signed-in' ? username : ANON;

  useEffect(() => {
    if (account === null) return;
    rememberAccount(account === ANON ? null : account);
  }, [account]);

  return account;
}
