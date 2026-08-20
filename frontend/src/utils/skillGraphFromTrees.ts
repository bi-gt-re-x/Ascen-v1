/**
 * Today's feed: the account's real subject trees, in the generic graph shape.
 *
 * This is the only file that knows both models, and that is the whole reason it
 * exists as a file. utils/skillGraph draws nodes and edges and knows nothing
 * about XP or subjects; utils/skillTree knows about XP and subjects and nothing
 * about drawing. When a generator eventually produces a per-account skill graph
 * of its own, it replaces this module and nothing else — the canvas, the nodes,
 * the connections, the panel and the toolbar never learn that anything changed.
 *
 * ## Nothing here is invented, and that is a constraint, not a default
 *
 * The brief this page was rebuilt to asks for placeholder content — a
 * "Binary Search" at 72% with three prerequisites — so the visual system can be
 * finished before a real generator exists. It is built to render exactly that,
 * and it is not fed that: this app already derives a real tree from finished
 * work, and standing fabricated skills up on a live account would put numbers
 * on the screen the record cannot support. utils/skillTree's own header makes
 * that argument at length and it is not weakened by the tree being prettier.
 *
 * So the placeholder is the *shape*, which is what a visual phase actually
 * needs, and the content is the account's own.
 *
 * ## The mapping
 *
 *     a subject           the root of its own little tree
 *       its three branches  Depth, Output, Rhythm, hanging off the subject
 *         five nodes each   chained, so each waits on the one below it
 *
 * `requires` is what draws the connections, and chaining the five is the honest
 * edge: node three genuinely cannot open before node two, because they are
 * thresholds on one rising quantity.
 *
 * ## The one field the record cannot fill
 *
 * A node's `xp` is what the brief calls the XP reward, and there is no such
 * thing here — a threshold is a reading of work already done, not a prize for
 * doing it. It is left at zero on every threshold node, which is what makes the
 * UI hide the chip, and carries real filed XP only on a subject root where that
 * is a fact rather than an offer. What each node needs *is* stated, in the unit
 * it is counted in, which is the same information without the fiction.
 */
import {
  DIFFICULTIES,
  type Difficulty,
  type GraphNode,
  type NodeStatus,
  type SkillGraph,
} from './skillGraph';
import type { SkillTree, TreeBranch, TreeNode } from './skillTree';

/**
 * Where each of a branch's five rungs sits on the six-tier ladder.
 *
 * Five rungs onto six tiers, and Expert is the one left out rather than a tier
 * being shared. A branch's fifth rung — a hundred finished tasks, a hundred and
 * twenty separate days — is Mastery by any reading, and squeezing Expert in
 * below it would put two named tiers on one step of a ladder that only has five.
 */
const TIER_OF_STEP: Difficulty[] = [
  'foundation',
  'beginner',
  'intermediate',
  'advanced',
  'mastery',
];

/**
 * A threshold node's state.
 *
 * The middle line is the one worth stating: the branch's next node is
 * *available* when no progress has been made toward it and *in progress* once
 * some has. Both are unlocked in the sense that matters — nothing is stopping
 * you — and separating them is what lets the canvas show where the work
 * actually is rather than only where it could be.
 */
function statusOf(node: TreeNode): NodeStatus {
  if (node.unlocked) return 'complete';
  if (!node.next) return 'locked';
  return node.percent > 0 ? 'progress' : 'available';
}

const plural = (n: number, unit: string) => `${n.toLocaleString()} ${unit}`;

function branchNodes(tree: SkillTree, branch: TreeBranch): GraphNode[] {
  const branchId = `${tree.key}:${branch.key}`;
  const done = branch.unlocked >= branch.nodes.length;
  const started = branch.unlocked > 0;

  const head: GraphNode = {
    id: branchId,
    name: branch.name,
    blurb: branch.measure,
    category: tree.name,
    difficulty: 'foundation',
    status: done ? 'complete' : started ? 'progress' : 'available',
    percent: (branch.unlocked / Math.max(1, branch.nodes.length)) * 100,
    xp: 0,
    have: branch.unlocked,
    need: branch.nodes.length,
    unit: 'nodes',
    on: '',
    requires: [tree.key],
    gate: `${branch.unlocked} of ${branch.nodes.length} open`,
  };

  const rungs = branch.nodes.map((node, index): GraphNode => ({
    id: `${branchId}:${index}`,
    name: node.name,
    blurb:
      node.need === 0
        ? `Open from the start of ${tree.name}.`
        : `Opens at ${plural(node.need, branch.unit)} in ${tree.name}. ${branch.measure}`,
    category: tree.name,
    difficulty: TIER_OF_STEP[index] ?? 'mastery',
    status: statusOf(node),
    percent: node.percent,
    xp: 0,
    have: Math.min(branch.have, node.need),
    need: node.need,
    unit: branch.unit,
    // A threshold has no date: the record knows the day a *task* was finished,
    // not the day a running total crossed a line. Left empty rather than
    // guessed at, which is what makes the panel omit the line entirely.
    on: '',
    requires: [index === 0 ? branchId : `${branchId}:${index - 1}`],
    gate: node.unlocked ? 'Open' : plural(node.need, branch.unit),
  }));

  return [head, ...rungs];
}

/** One subject, as a root and everything under it. */
function treeNodes(tree: SkillTree): GraphNode[] {
  const root: GraphNode = {
    id: tree.key,
    name: tree.name,
    blurb: `Level ${tree.level.tier} in ${tree.name}, read on the same mastery ladder the Subjects tab uses. Everything below is a threshold on the work already filed under it.`,
    category: tree.name,
    difficulty: 'foundation',
    status: tree.unlocked >= tree.total ? 'complete' : 'progress',
    // Nodes open, not progress through the mastery level. The two are different
    // readings of the same subject and the ring has to agree with the figure
    // printed beside it: a maxed-out subject was drawing "Completed · 15 / 15
    // nodes" against a 53% ring, because 53% was how far into level 60 it was.
    // The level is the Subjects tab's job and it says so there.
    percent: (tree.unlocked / Math.max(1, tree.total)) * 100,
    // The one real XP figure in the graph: filed, not offered.
    xp: tree.xp,
    have: tree.unlocked,
    need: tree.total,
    unit: 'nodes',
    on: tree.lastOn ?? '',
    requires: [],
    gate: `${tree.unlocked} of ${tree.total} open`,
  };

  return [root, ...tree.branches.flatMap((branch) => branchNodes(tree, branch))];
}

/**
 * Every subject in view, as one graph.
 *
 * A forest rather than a single tree, and the layout handles that without being
 * told: several roots is just several nodes with nothing above them. There is
 * deliberately no synthetic "All Skills" node joining them at the top — it
 * would be the one node on the canvas that is not a thing anybody is getting
 * good at, and the header already carries the total it would have shown.
 */
export function graphFromTrees(trees: SkillTree[], name = 'All skills'): SkillGraph {
  return {
    id: 'subject-trees',
    name,
    nodes: trees.flatMap(treeNodes),
  };
}

/** Difficulty tiers in the order the canvas flows, for the toolbar. */
export const TIER_ORDER = DIFFICULTIES;
