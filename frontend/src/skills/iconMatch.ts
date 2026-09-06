/**
 * Finding the drawing that goes with a skill's name.
 *
 * A reader who renames "Refactoring" to "Binary Search" should get the binary
 * search drawing, because the alternative is a tree where the pictures slowly
 * stop meaning anything. The icons are named after what they show —
 * `binary-search.svg`, `free-body-diagram.svg`, `squat.svg` — so the match is
 * between a title and a file name, and both are just words.
 *
 * ## No match is a real answer
 *
 * The important half. "Refactoring" has no drawing, and the wrong response is
 * to reach for something vaguely related: a skill wearing a picture of a
 * different skill is worse than one keeping the picture it already had. So this
 * returns `undefined` rather than a best guess, and the caller leaves the icon
 * alone. Every rule below is a rule about *when the words are the same*, never
 * about when they are similar — there is no fuzzy matching here and there
 * should not be, because the failure mode of fuzzy matching is confident
 * nonsense on a page nobody is checking.
 *
 * ## Most specific first
 *
 * "Binary Search Trees" tries `binary-search-trees`, then `binary-search` and
 * `search-trees`, then `binary`, `search`, `trees`. The longest run of adjacent
 * words that names a real drawing wins, which is what stops a two-word title
 * matching on its least interesting half.
 *
 * Words that describe a level rather than a subject are skipped when it comes
 * down to single words, or "Advanced Recursion" would find `advanced` — a
 * drawing about difficulty — in preference to nothing. They are still allowed
 * inside a longer run, because `advanced-search` is a real thing to be called.
 */
import { ICONS } from './iconNames';

/**
 * Words that say how hard or how new something is, not what it is.
 *
 * Only consulted for a single-word match. The list is short on purpose: this is
 * for words that would produce an actively misleading drawing, not for every
 * word that happens to be common.
 */
const VAGUE = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with', 'your', 'my',
  'advanced', 'basic', 'basics', 'beginner', 'intro', 'introduction', 'intermediate',
  'expert', 'foundation', 'fundamentals', 'more', 'new', 'other', 'part', 'practical',
]);

/** The words of a title, lowercased, punctuation gone, "&" spelled out. */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * A slug and the singular or plural of it.
 *
 * English plurals done to the depth that pays: a trailing `s`, and `ies` for
 * the `y` words. Anything cleverer would be a stemmer, and a stemmer is how you
 * get "axis" matching "axe".
 */
function forms(slug: string): string[] {
  const out = [slug];
  if (slug.endsWith('ies')) out.push(`${slug.slice(0, -3)}y`);
  else if (slug.endsWith('es')) out.push(slug.slice(0, -2));
  if (slug.endsWith('s')) out.push(slug.slice(0, -1));
  else {
    out.push(`${slug}s`);
    if (slug.endsWith('y')) out.push(`${slug.slice(0, -1)}ies`);
  }
  return out;
}

/**
 * The drawing for a name, or `undefined` when nothing actually matches.
 *
 * Callers must treat `undefined` as "keep whatever icon it has" rather than as
 * "use the fallback drawing" — a rename that quietly replaced a good icon with
 * the generic one would be a worse outcome than not matching at all.
 */
export function iconForName(name: string): string | undefined {
  const words = wordsOf(name);
  if (words.length === 0) return undefined;

  // Runs of adjacent words, longest first, left to right within a length. The
  // whole title is simply the longest run, so it needs no special case.
  for (let length = words.length; length >= 2; length -= 1) {
    for (let start = 0; start + length <= words.length; start += 1) {
      for (const candidate of forms(words.slice(start, start + length).join('-'))) {
        if (ICONS.has(candidate)) return candidate;
      }
    }
  }

  // Down to single words, left to right, vague ones skipped.
  //
  // Reading from the right is the tempting alternative — English compounds are
  // head-final, so "Running Meetings" is a kind of meeting and would stop
  // finding `running`. It was tried and it is worse: run over the 1119 designed
  // names it disagrees with this order 106 times, and most of those the first
  // word is the informative one. "Vectors in Physics" wants the vector drawing
  // and not the physics one, "Quantum Physics" the same, "Responsive Design"
  // wants `responsive` rather than a generic `design`, "Sleep Habits" wants
  // `sleep` rather than `habit`. Titles are also not reliably compounds at all
  // — "Acid, Fat & Balance" is a list, and its head is nothing.
  //
  // So "Running Meetings" gets a jogger, and that is the known cost of the
  // rule. It is a cheap one: the reader can see the drawing they got the
  // instant they save, and renaming again is one click.
  for (const word of words) {
    if (VAGUE.has(word)) continue;
    for (const candidate of forms(word)) {
      if (ICONS.has(candidate)) return candidate;
    }
  }

  return undefined;
}
