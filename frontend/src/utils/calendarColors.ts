/**
 * Which colour family a calendar block belongs to.
 *
 * The palette itself is `utils/eventPalette` and the shades are
 * `styles/calendar/palette.css`. This file answers the one question those two
 * do not: given a thing on the calendar, which of the twelve families is it?
 *
 * There are three answers and they are tried in order, which is the whole of
 * this module:
 *
 *   1. the family the event was given when it was made;
 *   2. for an event made before families existed, the family nearest the
 *      random hex it was given instead;
 *   3. for one older still, which carries only an index into the eight-colour
 *      palette that came before *that*, the family that index maps to.
 *
 * Every calendar any user of this app has ever made is in localStorage (see
 * calendarStore), so all three cases are live and none of them may be dropped.
 * What has gone is the fourth: blocks are no longer given a random hex apiece.
 * Colour means something now — see the note at the top of eventPalette.
 */
import { nearestFamily, isFamily, type Family } from './eventPalette';
import type { CalendarSection } from './calendarStore';

/**
 * The pre-hex palette, as families.
 *
 * The original eight colours in the order they were declared, each mapped to
 * the family it is nearest. An event created before hex colours carries only
 * its index into that list.
 */
const LEGACY_FAMILIES: Family[] = [
  'purple', // violet
  'rose', // pink
  'teal', // teal
  'orange', // orange
  'purple', // fuchsia
  'cyan', // cyan
  'purple', // purple
  'red', // rose
];

/** The palette index for an event with no hex: its own, or a hash of its name. */
function legacyIndex(section: Pick<CalendarSection, 'colorIndex' | 'task'>): number {
  const count = LEGACY_FAMILIES.length;
  if (typeof section.colorIndex === 'number') {
    return ((section.colorIndex % count) + count) % count;
  }
  const name = String(section.task || '');
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

/** An event's family. See the three cases at the top. */
export function familyForSection(
  section: Pick<CalendarSection, 'family' | 'color' | 'colorIndex' | 'task'>,
): Family {
  if (isFamily(section.family)) return section.family;
  if (section.color) return nearestFamily(section.color);
  return LEGACY_FAMILIES[legacyIndex(section)] ?? 'gray';
}
