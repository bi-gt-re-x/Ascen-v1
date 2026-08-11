/**
 * Which colour families are spoken for, and for how long.
 *
 * `utils/eventPalette` knows the twelve families and how to pick the one
 * furthest from a given set. This is the set. It is module-level rather than a
 * hook's state because there is one calendar and three views of it — Day, Week
 * and Month all create events, and three copies of "what is taken" is three
 * views quietly handing out the same family.
 *
 * **Two kinds of reservation, and the difference is the point.**
 *
 *   *Live* — the family of something on the calendar right now: an event in the
 *   store, including every recurrence of it. It blocks for exactly as long as
 *   the event does. Deleting the event frees the family; nothing else does.
 *
 *   *This week's* — every family handed out since the week began, whether or
 *   not the thing it went to still exists. These expire: the server stamps each
 *   claim with the ISO week it was made in and returns only the current one, so
 *   on Monday the palette is open again apart from what is still on the
 *   calendar.
 *
 * Without the live half, deleting and re-adding events inside one week would
 * walk through all twelve families and start repeating; without the weekly
 * half, a year of deleted events would leave every family permanently spoken
 * for and the choice meaningless.
 *
 * Tasks are not here at all. A task's colour is its subject — see
 * `familyForSubject` — so it is looked up rather than claimed, and two tasks in
 * the same subject are *supposed* to match.
 *
 * The wire format is still a hex, because the table behind it is a table of
 * hexes: a family is posted as its accent shade and read back by finding the
 * family that hex belongs to. That keeps a schema this change had no reason to
 * touch, and the mapping is exact — the accents are twelve fixed values.
 */
import { events as eventService } from '@/services';
import {
  FAMILIES,
  PALETTE,
  chooseFamily,
  nearestFamily,
  type Family,
} from './eventPalette';

/** The rung a family is posted and recognised by. Matches `eventPalette`. */
const ACCENT = 4;

/** Families claimed since this week began, as the server last reported them. */
let thisWeek: Family[] = [];

/** Families of events that are on the calendar right now. */
const live = new Set<Family>();

/** So the fetch happens once for the app rather than once per view. */
let priming: Promise<void> | null = null;

/**
 * Read this week's claims from the server, once.
 *
 * Failure is survivable and deliberately not retried: the live set alone keeps
 * the calendar on screen from repeating a family, and the worst a missing week
 * costs is a new event landing on a family something deleted on Tuesday had.
 */
export function primeColorRegistry(): Promise<void> {
  if (!priming) {
    priming = eventService
      .eventColors()
      .then((result) => {
        if (result.success) thisWeek = result.colors.map(nearestFamily);
      })
      .catch(() => {
        /* best effort — see the note above */
      });
  }
  return priming;
}

/**
 * Note that these families are on the calendar.
 *
 * Called with every family a view can see, whenever what it can see changes.
 * Idempotent, and never removes: a family drops out of the live set by the
 * whole set being rebuilt — see `resetLiveColors`.
 */
export function reserveFamilies(families: Iterable<Family>): void {
  for (const family of families) live.add(family);
}

/** Forget every live reservation. The views re-declare what they can see. */
export function resetLiveColors(): void {
  live.clear();
}

/** Everything a new event should keep away from. */
export function reservedFamilies(): Family[] {
  return FAMILIES.filter((family) => live.has(family) || thisWeek.includes(family));
}

/**
 * A family for a new event, reserved on the way out.
 *
 * Reserved in both sets immediately — before the server has confirmed anything
 * — because the next event may be created in the same second, and a claim that
 * only counts once a round trip lands is a claim two events can win.
 */
export function claimFamily(): Family {
  const family = chooseFamily(reservedFamilies());
  thisWeek.push(family);
  live.add(family);
  void eventService.addEventColor(PALETTE[family][ACCENT]).catch(() => {
    /* best effort: the next event may pick a nearer family, nothing worse */
  });
  return family;
}
