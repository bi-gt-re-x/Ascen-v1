/**
 * The void, at the end of the hidden chain.
 *
 * The pentagon's arrow on the landing page leaves a lone button that sends the
 * reader to `/calendar#void`. There is no calendar on the other side of it:
 * the page is emptied to a flat dark field with one riddle hanging in it, and
 * answering the riddle drops you into `/engine`. All of that — the emptying,
 * the riddle, the cracks, the shatter — is frontend/secret/void.js and
 * frontend/secret/void.css, and this hook is only the switch.
 *
 * ## Why it is mounted on the whole app and not on the calendar
 *
 * `/calendar` is a redirect. It reads the account's saved view and sends the
 * reader on to `/calendar/week` or `/calendar/day` — and a redirect does not
 * carry a fragment, so by the time any calendar component mounts the `#void`
 * that asked for all this is gone. Reading it up here, above the router,
 * catches it on arrival and before the redirect; the class then stays through
 * the navigation that follows, which is why losing the hash does not matter.
 *
 * It also means the void is not the calendar's business, which is right: the
 * calendar has nothing to do with any of this beyond being the door it was
 * hidden behind.
 *
 * The class goes on in a layout effect so that it is set *before*
 * hooks/useSecretScripts.ts appends the script — void.js opens the riddle by
 * itself when it loads into a document already marked `egg-void`, and that is
 * the path this takes.
 */
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useSecretScripts } from '@/hooks/useSecretScripts';

/** The fragment the pentagon's arrow arrives with. */
const VOID = '#void';

export function useVoid(): void {
  const { hash } = useLocation();
  const inVoid = hash === VOID;

  useLayoutEffect(() => {
    if (!inVoid) return;
    const root = document.documentElement;
    root.classList.add('egg-void');
    return () => {
      root.classList.remove('egg-void');
      /* The riddle is appended to the body by void.js, which has no idea a
         router exists. Navigating out of the void has to take it with us, or
         it hangs invisibly over whatever page comes next. */
      document.getElementById('voidRiddle')?.remove();
    };
  }, [inVoid]);

  useSecretScripts(inVoid ? ['void.css', 'void.js'] : []);
}
