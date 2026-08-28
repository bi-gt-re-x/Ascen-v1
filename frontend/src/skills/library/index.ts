/**
 * The library: every skill node the system knows about, in one place.
 *
 * ## Adding a domain
 *
 * A file beside this one exporting an array of nodes, an entry in `CATEGORIES`
 * in skills/types if the category is new, and one line in `DOMAINS` below.
 * Nothing else in the system enumerates domains — the goal picker, the filters
 * and the generator all read what the nodes actually carry, so an eleventh
 * appears everywhere at once.
 *
 * ## The library is built once
 *
 * `skillLibrary()` memoises. Indexing is cheap at this size, but the graph is
 * identity-compared all over the generator and the renderer, and rebuilding it
 * per render would make every `useMemo` downstream miss.
 *
 * ## Problems are reported, never thrown
 *
 * A prerequisite pointing at a node nobody wrote is an editing mistake, and an
 * editing mistake in content should cost a console warning rather than a white
 * screen. `buildGraph` drops the smallest thing it can and records why; this
 * file prints them once in development. If the count is ever non-zero in a
 * released build, the library is wrong and the app still works.
 */
import { buildGraph, type SkillLibraryGraph } from '../graph';
import type { SkillNode } from '../types';

import { aiMl } from './ai-ml';
import { chess } from './chess';
import { computerScience } from './computer-science';
import { fitness } from './fitness';
import { mathematics } from './mathematics';
import { music } from './music';
import { productivity } from './productivity';
import { programming } from './programming';
import { science } from './science';
import { writing } from './writing';

/** Every domain file. The one list to add to. */
const DOMAINS: readonly SkillNode[][] = [
  mathematics,
  programming,
  computerScience,
  aiMl,
  fitness,
  music,
  productivity,
  chess,
  science,
  writing,
];

export const ALL_NODES: readonly SkillNode[] = DOMAINS.flat();

let cached: SkillLibraryGraph | null = null;

/** The indexed library. Built on first use and reused thereafter. */
export function skillLibrary(): SkillLibraryGraph {
  if (cached) return cached;
  cached = buildGraph(ALL_NODES);

  // `import.meta.env?` rather than `import.meta.env.`: nothing in skills/ imports
  // React, the DOM or anything else Vite-shaped, so this module is importable
  // from a plain Node script — a build-time validator, a future server-side
  // generator — where `import.meta.env` does not exist at all.
  if (import.meta.env?.DEV && cached.problems.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[skills] ${cached.problems.length} problem(s) in the node library:`,
      cached.problems,
    );
  }

  return cached;
}

/** A node by id, or undefined. The only lookup anything outside should need. */
export function skillNode(id: string): SkillNode | undefined {
  return skillLibrary().nodes.get(id);
}

/** The display name for an id, falling back to the id so a gap is visible. */
export function skillName(id: string): string {
  return skillLibrary().nodes.get(id)?.name ?? id;
}

export { defineDomain } from './define';
