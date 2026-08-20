/**
 * The shape a skill tree is drawn from — any skill tree.
 *
 * ## Why this exists beside utils/skillTree
 *
 * utils/skillTree knows what a skill tree *means* on this account: that Depth
 * is XP on the mastery ladder, that Output is finished tasks, that a node opens
 * when a threshold is crossed. It is one specific tree, derived from one
 * specific record, and the page used to be written against its shape — three
 * named branches, five nodes each, a fan of exactly three curves.
 *
 * This file knows none of that. A graph here is nodes and edges and a status
 * per node, and that is the whole model. It cannot say why a node is locked; it
 * is told. That split is the point: the renderer that hangs off this file draws
 * any number of nodes, edges, branches and categories in any arrangement, so
 * the day a generator produces a real per-account skill graph, the drawing code
 * does not change — only what feeds it. utils/skillGraphFromTrees is today's
 * feed and is deliberately the only file that knows both shapes.
 *
 * ## What this file does *not* do
 *
 * No progression, no unlock rules, no completion. `status` and `percent` arrive
 * decided. `requires` is drawn as an edge and read out in the panel, and is
 * never consulted to work out whether something is open — a graph whose statuses
 * disagree with its edges will render exactly what it was given, which is the
 * behaviour that makes a bad feed visible instead of silently corrected.
 */

/** Where a node stands. The four states everything visual keys off. */
export type NodeStatus = 'locked' | 'available' | 'progress' | 'complete';

/** The four tiers a tree flows through, foundation nearest the top. */
export type Difficulty = 'foundation' | 'intermediate' | 'advanced' | 'mastery';

export const DIFFICULTIES: Difficulty[] = [
  'foundation',
  'intermediate',
  'advanced',
  'mastery',
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  foundation: 'Foundation',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  mastery: 'Mastery',
};

export const STATUS_LABEL: Record<NodeStatus, string> = {
  locked: 'Locked',
  available: 'Available',
  progress: 'In progress',
  complete: 'Completed',
};

export interface GraphNode {
  id: string;
  /** What the node is called: "Binary Search", "Apprentice". */
  name: string;
  /** One or two sentences for the detail panel. */
  blurb: string;
  /** The reader's own heading. Free text — the toolbar builds its filter from
   *  whatever turns up rather than from a fixed list. */
  category: string;
  difficulty: Difficulty;
  status: NodeStatus;
  /** 0-100. What the ring and the bar draw. */
  percent: number;
  /** XP the node is worth, for the reward line. Zero prints nothing. */
  xp: number;
  /** Where the account stands and what opens the node, in `unit`. */
  have: number;
  need: number;
  unit: string;
  /** ISO day it completed, or '' — the completion date, where there is one. */
  on: string;
  /** Node ids that come before this one. Drawn as the incoming edges. */
  requires: string[];
  /** The requirement in words, printed on a locked node: "40 tasks". */
  gate: string;
}

export interface SkillGraph {
  id: string;
  name: string;
  nodes: GraphNode[];
}

/** How a connection is drawn, decided by the two nodes it joins. */
export type EdgeState = 'locked' | 'available' | 'active' | 'complete';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
/**
 * Node size and spacing, in canvas units.
 *
 * Held here rather than in the stylesheet because the layout below does the
 * arithmetic and the SVG connections are drawn in the same coordinate space —
 * three things that have to agree, so they read one number. The stylesheet sizes
 * a node from these via custom properties rather than repeating them.
 */
export const GEOM = {
  nodeW: 216,
  nodeH: 84,
  /** Gap between siblings, and between one rank and the next. */
  colGap: 26,
  rowGap: 82,
  /** Breathing room around the whole drawing. */
  pad: 44,
};

export interface PlacedNode {
  node: GraphNode;
  /** Top-left of the node box, in canvas units. */
  x: number;
  y: number;
  /** Which rank it sits on — 0 nearest the top. */
  rank: number;
}

export interface PlacedEdge {
  id: string;
  from: string;
  to: string;
  state: EdgeState;
  /** The cubic path, ready for a `d` attribute. */
  d: string;
}

export interface GraphLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

/**
 * How an edge is drawn, from the node it points *at*.
 *
 * The path takes its state from its destination rather than from its source or
 * from both: what a reader traces a line to find out is whether the thing on
 * the end of it is open, and a line whose two ends disagreed would have to pick
 * one anyway. A completed node's incoming paths are complete, which is what
 * makes the route you actually took legible from across the canvas.
 */
export function edgeState(target: GraphNode | undefined): EdgeState {
  if (!target) return 'locked';
  if (target.status === 'complete') return 'complete';
  if (target.status === 'progress') return 'active';
  if (target.status === 'available') return 'available';
  return 'locked';
}

/**
 * Place a graph on the canvas.
 *
 * Two passes and no measurement, so it is stable under zoom and needs no
 * observer:
 *
 * **Rank** is the longest path to the node from any node with nothing above it.
 * Longest rather than shortest, so a node that is reachable both directly and
 * the long way round sits below everything it depends on rather than beside the
 * first of them. That is what makes the canvas read foundation-to-mastery down
 * the page whatever shape the graph is.
 *
 * **Position across** is the tidy-tree walk: leaves take the next free slot,
 * every other node centres over the ones under it. A node with several
 * prerequisites is placed under the first one listed and joined to the rest by
 * a line that crosses — a real DAG cannot always be drawn without crossings,
 * and choosing a primary parent is how the drawing stays readable when it
 * cannot.
 *
 * Cycles cannot hang it: rank is computed with a seen-set per walk, and a node
 * reached again keeps the deeper of the two ranks.
 */
export function layoutGraph(graph: SkillGraph): GraphLayout {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const kids = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const node of graph.nodes) {
    // A requirement naming a node that is not in the graph — filtered out, or
    // a feed that referenced something it did not send — is dropped rather than
    // drawn to nowhere.
    const real = node.requires.filter((id) => byId.has(id));
    parents.set(node.id, real);
    for (const id of real) kids.set(id, [...(kids.get(id) ?? []), node.id]);
  }

  // ---- rank ---------------------------------------------------------------
  const rank = new Map<string, number>();
  const rankOf = (id: string, seen: Set<string>): number => {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);
    const above = parents.get(id) ?? [];
    const value = above.length === 0
      ? 0
      : Math.max(...above.map((parent) => rankOf(parent, seen) + 1));
    seen.delete(id);
    rank.set(id, value);
    return value;
  };
  for (const node of graph.nodes) rankOf(node.id, new Set());

  // ---- position across ----------------------------------------------------
  const step = GEOM.nodeW + GEOM.colGap;
  const centre = new Map<string, number>();
  let slot = 0;

  const walk = (id: string, seen: Set<string>): number => {
    const cached = centre.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return slot * step;
    seen.add(id);

    // Only the children this node is the *primary* parent of: a node under two
    // prerequisites belongs to the first one, or it would be counted twice and
    // both parents would centre on a span they do not own.
    const mine = (kids.get(id) ?? []).filter((kid) => (parents.get(kid) ?? [])[0] === id);

    let x: number;
    if (mine.length === 0) {
      x = slot * step;
      slot += 1;
    } else {
      const spans = mine.map((kid) => walk(kid, seen));
      x = (Math.min(...spans) + Math.max(...spans)) / 2;
    }
    seen.delete(id);
    centre.set(id, x);
    return x;
  };

  const roots = graph.nodes.filter((node) => (parents.get(node.id) ?? []).length === 0);
  for (const root of roots) walk(root.id, new Set());
  // Anything left is inside a cycle, or hangs off one. It still gets a slot.
  for (const node of graph.nodes) walk(node.id, new Set());

  const placed: PlacedNode[] = graph.nodes.map((node) => ({
    node,
    x: (centre.get(node.id) ?? 0) + GEOM.pad,
    y: (rank.get(node.id) ?? 0) * (GEOM.nodeH + GEOM.rowGap) + GEOM.pad,
    rank: rank.get(node.id) ?? 0,
  }));

  const at = new Map(placed.map((entry) => [entry.node.id, entry]));

  const edges: PlacedEdge[] = [];
  for (const node of graph.nodes) {
    for (const id of parents.get(node.id) ?? []) {
      const from = at.get(id);
      const to = at.get(node.id);
      if (!from || !to) continue;
      const x1 = from.x + GEOM.nodeW / 2;
      const y1 = from.y + GEOM.nodeH;
      const x2 = to.x + GEOM.nodeW / 2;
      const y2 = to.y;
      // Control points pulled vertically by half the gap, so the line leaves the
      // node it comes from going down and arrives at the next one going down —
      // a curve that reads as a route rather than as a diagonal.
      const bend = Math.max(24, (y2 - y1) / 2);
      edges.push({
        id: `${id}->${node.id}`,
        from: id,
        to: node.id,
        state: edgeState(node),
        d: `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`,
      });
    }
  }

  const right = placed.reduce((max, entry) => Math.max(max, entry.x + GEOM.nodeW), 0);
  const bottom = placed.reduce((max, entry) => Math.max(max, entry.y + GEOM.nodeH), 0);

  return { nodes: placed, edges, width: right + GEOM.pad, height: bottom + GEOM.pad };
}

// ---------------------------------------------------------------------------
// Filtering and counting
// ---------------------------------------------------------------------------
export interface GraphFilter {
  /** Matched against name, category and blurb. */
  query: string;
  /** '' for every category. */
  category: string;
  /** null for every difficulty. */
  difficulty: Difficulty | null;
  /** Empty for every status. */
  statuses: NodeStatus[];
}

export const NO_FILTER: GraphFilter = {
  query: '',
  category: '',
  difficulty: null,
  statuses: [],
};

export function filterActive(filter: GraphFilter): boolean {
  return Boolean(
    filter.query.trim() || filter.category || filter.difficulty || filter.statuses.length,
  );
}

/**
 * The graph with the nodes that do not match taken out.
 *
 * A node that survives keeps its `requires`, and `layoutGraph` drops the ones
 * pointing at nodes that did not — so filtering to "Completed" draws the
 * completed nodes and the paths *between* them, rather than a set of orphans
 * with lines running off the edge of the canvas.
 */
export function filterGraph(graph: SkillGraph, filter: GraphFilter): SkillGraph {
  if (!filterActive(filter)) return graph;
  const needle = filter.query.trim().toLowerCase();

  const nodes = graph.nodes.filter((node) => {
    if (filter.category && node.category !== filter.category) return false;
    if (filter.difficulty && node.difficulty !== filter.difficulty) return false;
    if (filter.statuses.length && !filter.statuses.includes(node.status)) return false;
    if (!needle) return true;
    return (
      node.name.toLowerCase().includes(needle) ||
      node.category.toLowerCase().includes(needle) ||
      node.blurb.toLowerCase().includes(needle)
    );
  });

  return { ...graph, nodes };
}

export interface GraphTally {
  total: number;
  complete: number;
  progress: number;
  available: number;
  locked: number;
  /** Complete as a share of every node, 0-100. */
  percent: number;
  /** XP on completed nodes. */
  xpEarned: number;
  /** XP on everything. */
  xpTotal: number;
}

export function tallyGraph(graph: SkillGraph): GraphTally {
  const count = (status: NodeStatus) =>
    graph.nodes.filter((node) => node.status === status).length;

  const total = graph.nodes.length;
  const complete = count('complete');

  return {
    total,
    complete,
    progress: count('progress'),
    available: count('available'),
    locked: count('locked'),
    percent: total > 0 ? (complete / total) * 100 : 0,
    xpEarned: graph.nodes
      .filter((node) => node.status === 'complete')
      .reduce((sum, node) => sum + node.xp, 0),
    xpTotal: graph.nodes.reduce((sum, node) => sum + node.xp, 0),
  };
}

/** The categories in use, most-populated first — what the toolbar offers. */
export function graphCategories(graph: SkillGraph): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    const name = node.category.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The nodes this one opens — the other half of `requires`, read backwards. */
export function unlockedBy(graph: SkillGraph, id: string): GraphNode[] {
  return graph.nodes.filter((node) => node.requires.includes(id));
}

/** The nodes this one waits on, in the order they were named. */
export function requirementsOf(graph: SkillGraph, node: GraphNode): GraphNode[] {
  const byId = new Map(graph.nodes.map((entry) => [entry.id, entry]));
  return node.requires.map((id) => byId.get(id)).filter((entry): entry is GraphNode => Boolean(entry));
}
