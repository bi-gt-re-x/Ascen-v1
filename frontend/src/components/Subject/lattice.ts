/**
 * What there is to learn in a subject, and how much of it you have touched.
 *
 * ## Two kinds of fact, and they must not be mixed
 *
 * The skill trees in skills/trees are **authored**. Somebody wrote every node,
 * every prerequisite and every `state`, and that file's own note says the
 * states are illustrative. So a node marked `done` in the seed is not evidence
 * that this reader has done anything, and reporting it as progress would be
 * printing a designer's guess as somebody's record — the exact thing the
 * subject page exists not to do.
 *
 * What *is* the reader's own is `utils/skillProgress`: the store their
 * practice clicks write to. That is a real record of a real action, kept per
 * account, and it is the only number here that describes the person.
 *
 * So this returns the two separately and names them as what they are:
 *
 *   `nodes`, `branches`, `core`, `categories`  — the shape of the curriculum
 *   `practised`                                — what the reader has done
 *
 * Nothing here computes a percentage across the two. "You are 12% through
 * Mathematics" would need the seed's states to mean something about the
 * reader, and they do not.
 *
 * ## Why it is shared
 *
 * Two surfaces read it — the Subjects tab of the analytics page, which lists
 * every subject worked in the window, and the subject page itself, which goes
 * deeper on one. Written twice they would drift, and the first thing to drift
 * would be the distinction above.
 */
import { treeForSubject } from '@/skills/subjectMap';
import { childrenOf, parentChain, subjectTreeById } from '@/skills/subjectTrees';
import type { SkillProgress } from '@/utils/skillProgress';

export interface LatticeBranch {
  id: string;
  title: string;
  /** How many skills are on it. */
  nodes: number;
}

export interface Lattice {
  id: string;
  title: string;
  blurb: string;
  /** Root first, this tree last. One entry when the tree is a root. */
  path: Array<{ id: string; title: string }>;
  /** The trees this one forks into, if any. */
  branches: LatticeBranch[];
  /** Skills on this tree. A fact about the curriculum. */
  nodes: number;
  /** Of those, the ones marked as core. Also a fact about the curriculum. */
  core: number;
  /**
   * Skills on this tree the reader has practised at least once.
   *
   * The one figure here that is about the reader. Read from the practice
   * store, which is per-account and written only by their own clicks.
   */
  practised: number;
  /** Whether this is a branch the reader chose, or the subject's own root. */
  chosen: boolean;
}

/**
 * The lattice a subject opens on, and what the reader has touched of it.
 *
 * `depth` is the branch named in `analytics_subject_depth`, when there is one.
 * A branch that no longer resolves falls back to the subject's own root — the
 * same degradation the rail makes for a deleted subject, and for the same
 * reason: a shorter answer beats a broken one.
 */
export function latticeFor(
  subjectId: string,
  group: string | undefined,
  depth: string | undefined,
  progress: SkillProgress,
): Lattice | null {
  const chosenTree = depth ? subjectTreeById(depth) : null;
  const tree = chosenTree ?? subjectTreeById(treeForSubject(subjectId, group).tree);
  if (!tree) return null;

  const branches = childrenOf(tree.id).map((child) => ({
    id: child.id,
    title: child.title,
    nodes: child.nodes.length,
  }));

  return {
    id: tree.id,
    title: tree.title,
    blurb: tree.blurb,
    /* `parentChain` already ends with this tree — it unshifts the current one
       before walking up — so a root returns a single-entry chain and this
       reads as a breadcrumb either way. Appending `tree` here would print the
       leaf twice. */
    path: parentChain(tree.id).map((entry) => ({ id: entry.id, title: entry.title })),
    branches,
    nodes: tree.nodes.length,
    core: tree.nodes.filter((node) => node.core).length,
    practised: tree.nodes.filter((node) => (progress[node.id] ?? 0) > 0).length,
    chosen: Boolean(chosenTree),
  };
}
