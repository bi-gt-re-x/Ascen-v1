import { useEffect, useState } from 'react';

/**
 * How long the arrival cascade runs before the class comes off.
 *
 * The animation's own length plus the longest delay any rule in
 * styles/page-enter.css applies, with a little room at the end. Too short and
 * the class is pulled while the last band is still moving, which drops it back
 * to its start; too long and a page that re-renders early replays.
 */
const SETTLED_MS = 900;

/**
 * The arrival cascade, for a page that has just finished loading.
 *
 * Returns whether the page is still arriving. The caller puts `pg-enter` on the
 * element whose children are the page's bands — usually its `page-shell` — and
 * styles/page-enter.css does the rest.
 *
 * `ready` is the page's own answer to "is there something to show yet", which
 * is almost always `!loading`. It matters that the timer starts from that
 * rather than from mount: the shell is not on the page until the spinner
 * clears, and a timer begun behind the spinner would be half spent before the
 * first band existed — so on a slow read the cascade would be over before it
 * could be seen.
 *
 * It runs once. Once the last band has settled the class is dropped and does
 * not come back, so the filtering, tab-switching and ticking-off that these
 * pages do constantly re-render without replaying the entrance. A genuine
 * second arrival is a second mount, and gets a second cascade.
 */
export function usePageEntrance(ready: boolean): boolean {
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const settled = window.setTimeout(() => setEntering(false), SETTLED_MS);
    return () => window.clearTimeout(settled);
  }, [ready]);

  return ready && entering;
}
