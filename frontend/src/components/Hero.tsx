/**
 * The card a page opens with.
 *
 * One element, one line per page: wrap the header the page already had, name a
 * tone, and the page arrives with a sky, a range and a shadow instead of an
 * `<h1>` sitting on the ground. The drawing is components/Range.tsx and the
 * card is styles/summit.css; this is the seam between them, and it is
 * deliberately thin — a hero that took a title, a subtitle and an actions slot
 * as props would be a second way to write a header, and every page here
 * already has one that works.
 *
 * ## Why the tone is a prop and not derived
 *
 * The colour is how a reader knows which part of the app they are in before
 * they have read the title, so it has to be a decision rather than a hash of
 * the route: neighbouring pages want neighbouring colours, and pages that do
 * the same kind of work want the same one. The list of what each page wears is
 * in the pages themselves, next to the header it dresses.
 *
 * `variant` is separate from `tone` on purpose. Two pages can share a colour
 * and must not share a range — the mountains are what makes a page look like
 * itself — so the seed is the page's own name and the tone is its section's.
 */
import type { ReactNode } from 'react';
import { Range } from './Range';

/**
 * The eight skies.
 *
 * Enough that no two pages a reader moves between are the same colour, few
 * enough that each is a section rather than a page. Defined in
 * styles/summit.css, where the dark values are lifted.
 */
export type HeroTone =
  | 'violet'
  | 'indigo'
  | 'blue'
  | 'teal'
  | 'green'
  | 'amber'
  | 'rose'
  | 'slate';

export interface PageHeroProps {
  /**
   * Which range to draw. The page's own name — the same string gets the same
   * mountains for ever, and two names get two places.
   */
  variant: string;
  /** The sky, and the rock under it. */
  tone?: HeroTone;
  /** An extra class, for a page that needs to size or space its own hero. */
  className?: string;
  /** The header this hero is standing behind. */
  children: ReactNode;
}

export function PageHero({ variant, tone = 'violet', className, children }: PageHeroProps) {
  const classes = ['peak-hero', `peak-tone-${tone}`];
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')}>
      {/* Keyed, so a page that swaps its variant while it is open — the
          analytics tabs are the one that does — remounts the drawing and
          replays the rise in styles/summit.css. Without the key React would
          patch the paths in place and the new range would simply be there. */}
      <Range key={variant} variant={variant} />
      {children}
    </div>
  );
}
