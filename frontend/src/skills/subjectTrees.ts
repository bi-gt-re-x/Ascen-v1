/**
 * Subject trees — one talent lattice per subject, and the links between them.
 *
 * ## What this is, and what it is not
 *
 * This is a *designed* hierarchy, not a reading of the account's record. The
 * task-derived trees in utils/skillTree answer "how far into this subject have
 * you actually gone"; this answers a different question — "what is the shape of
 * the subject, and where does one part of it hand off to another." The two live
 * side by side on purpose, the same way the Records page keeps what you logged
 * apart from what Ascen counted.
 *
 * ## Where the data is
 *
 * In skills/trees, one file per subject, collected by skills/trees/index. This
 * file is the catalogue and the conversion to the renderer's model: what the
 * trees *are* lives next door, and everything here is derived from it. The split
 * happened when the data outgrew a file — fifty-five lattices of authored
 * description is not something anybody reviews as one document.
 *
 * ## Navigation nodes
 *
 * A subject like Coding does not fit on one lattice. Its foundations do, but the
 * moment it forks into web development, algorithms and systems, each fork is a
 * whole tree of its own. Cramming all three onto one canvas gives a wall no one
 * can read; drawing only the foundations loses the forks entirely.
 *
 * So a fork is a single **navigation node** — `navTo` names the child tree it
 * opens. Clicking it is not selecting a skill, it is walking into that subject.
 * The child names its `parent`, so the walk has a way back, and a tree can be
 * both a child of one subject and hold navigation nodes of its own: the
 * hierarchy is arbitrarily deep, and the page draws whichever level you are on.
 *
 * A navigation node is a leaf on purpose. Nothing requires one, because a
 * doorway cannot be completed, and a node gated behind something uncompletable
 * would be a node nobody can ever reach.
 *
 * ## Required, and merely recommended
 *
 * `requires` gates a node and decides where it sits — it is the prerequisite,
 * drawn solid. `recommends` is a suggestion, drawn dashed, and is kept out of
 * the ranking on purpose: the moment a suggestion moved a node down the canvas
 * it would be a rule wearing a dashed line.
 *
 * ## States are illustrative for now
 *
 * `state`, `percent` and `xpDone` are written into the data rather than derived,
 * because nothing in the account is wired to spend a point on a lattice node
 * yet — that is a later part, and when it lands it replaces these literals with
 * a reading of real progress. Until then they are a plausible walk down each
 * tree, which is what makes the lit-versus-locked drawing worth looking at.
 *
 * Icons name a file in utils/icons/tree_icons (served at
 * `/static/icons/tree_icons`), without the extension. Anything missing falls
 * back to `core-skill` — and scripts/check_trees.py fails if any tree is relying
 * on that fallback.
 */
import type { NodeStatus, SkillGraph } from '@/utils/skillGraph';
import { DEFAULT_TREE, TREES } from './trees';
import type { SubjectNode, SubjectTree } from './trees/types';

export type { SubjectNode, SubjectTree };
export { DEFAULT_TREE };

/** Every lattice, in catalogue order. */
export const SUBJECT_TREES: readonly SubjectTree[] = TREES;

const BY_ID = new Map(SUBJECT_TREES.map((tree) => [tree.id, tree]));

export function subjectTreeById(id: string): SubjectTree | null {
  return BY_ID.get(id) ?? null;
}

/** The top-level subjects — the ones the switcher across the page offers. */
export const ROOT_SUBJECTS: readonly SubjectTree[] = SUBJECT_TREES.filter((tree) => !tree.parent);

/** The trees that branch off this one — the other end of `parent`. */
export function childrenOf(id: string): SubjectTree[] {
  return SUBJECT_TREES.filter((tree) => tree.parent === id);
}

/** The tree this one branched off, if it is not a root. */
export function parentOf(id: string): SubjectTree | null {
  const tree = BY_ID.get(id);
  return tree?.parent ? BY_ID.get(tree.parent) ?? null : null;
}

/**
 * Every tree that branches off the same parent as this one — its siblings,
 * itself excluded. Web Development, Algorithms and Systems are each other's.
 */
export function siblingsOf(id: string): SubjectTree[] {
  const tree = BY_ID.get(id);
  if (!tree?.parent) return [];
  return SUBJECT_TREES.filter((entry) => entry.parent === tree.parent && entry.id !== id);
}

/**
 * The chain from a root down to this tree, in reading order, so the header can
 * draw it as a breadcrumb. `[Coding, Web Development]` for the web tree.
 */
export function parentChain(id: string): SubjectTree[] {
  const chain: SubjectTree[] = [];
  let current = BY_ID.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parent ? BY_ID.get(current.parent) : undefined;
  }
  return chain;
}

/**
 * Which of the catalogue's nine groups a tree belongs to.
 *
 * `group` is stated on roots only — a child tree is inside whatever group its
 * root is in — so this walks up to the root rather than reading the field, and
 * answers for Calculus ("Maths and science") as readily as for Mathematics.
 *
 * It exists because how a subject is *practised* follows the group and almost
 * nothing else: reading a proof, running a set of squats and cutting a draft
 * are three different verbs, and advice general enough to cover all three says
 * nothing about any of them. See skills/improve.
 */
export function groupOf(id: string): string {
  return parentChain(id)[0]?.group ?? '';
}

// ---------------------------------------------------------------------------
// To the renderer's shape
// ---------------------------------------------------------------------------
/** What a state implies about progress, where a node did not say. */
const IMPLIED: Record<NodeStatus, number> = {
  complete: 100,
  progress: 50,
  available: 0,
  locked: 0,
};

export const ICON_BASE = '/static/icons/tree_icons';

/** The URL for a node's drawing, falling back to the generic one. */
export function iconUrl(icon: string | undefined): string {
  return `${ICON_BASE}/${icon || 'core-skill'}.svg`;
}

/**
 * One subject tree as the graph the canvas draws.
 *
 * The one place the designed shape above meets the generic model — everything
 * downstream of here is the renderer's vocabulary rather than this file's.
 */
export function graphFromSubjectTree(tree: SubjectTree): SkillGraph {
  return {
    id: tree.id,
    name: tree.title,
    nodes: tree.nodes.map((node) => {
      const status = node.state ?? 'locked';
      const percent = node.percent ?? IMPLIED[status];
      const xp = node.xp ?? 0;
      return {
        id: node.id,
        name: node.name,
        blurb: node.desc,
        category: tree.title,
        difficulty: node.tier,
        status,
        percent,
        xp,
        // The reward line reads "earned / worth", so a node states both. Where
        // it states only the total, the share earned is what the bar is already
        // showing rather than a second number that could disagree with it.
        have: node.xpDone ?? Math.round((xp * percent) / 100),
        need: xp,
        unit: 'XP',
        on: '',
        requires: node.requires ?? [],
        recommends: node.recommends ?? [],
        gate: '',
        icon: node.icon,
        tags: node.core ? ['Core Skill'] : undefined,
      };
    }),
  };
}

/** The navigation targets on a tree, node id → child tree id. */
export function navTargets(tree: SubjectTree): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of tree.nodes) if (node.navTo) map.set(node.id, node.navTo);
  return map;
}
