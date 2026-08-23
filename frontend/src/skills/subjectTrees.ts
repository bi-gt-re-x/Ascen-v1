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
 * ## States are illustrative for now
 *
 * `state` is written into the data rather than derived, because nothing in the
 * account is wired to spend a point on a lattice node yet — that is a later
 * part, and when it lands it replaces these literals with a reading of real
 * progress. Until then the states are a plausible walk down each tree, which is
 * what makes the lit-versus-locked styling visible. No icons are attached to a
 * node here; that, too, is deliberately later.
 */
import type { NodeStatus, SkillGraph } from '@/utils/skillGraph';

export interface SubjectNode {
  id: string;
  /** The skill's name. Not drawn on the node — nodes carry no label yet — but
   *  read out to assistive tech and shown on hover, so it is never omitted. */
  name: string;
  /** Node ids on this same tree that come before it. Drawn as incoming lines. */
  requires?: string[];
  /** Where the node stands. Defaults to locked. */
  state?: NodeStatus;
  /** A child tree id. Present makes this a navigation node — a diamond that
   *  opens that subject rather than a skill you hold. */
  navTo?: string;
  /** The small figure in the corner, as in the reference lattice. Optional. */
  rank?: number;
}

export interface SubjectTree {
  id: string;
  /** Shown at the top of the page while this tree is open. */
  title: string;
  /** One line under the title. */
  blurb: string;
  /** The tree this one branched off, if any — the way back up. */
  parent?: string;
  nodes: SubjectNode[];
}

// ---------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------
const S = {
  done: 'complete' as NodeStatus,
  prog: 'progress' as NodeStatus,
  open: 'available' as NodeStatus,
  lock: 'locked' as NodeStatus,
};

const CODING: SubjectTree = {
  id: 'coding',
  title: 'Coding',
  blurb: 'The craft under every language — and where it forks into its own worlds.',
  nodes: [
    { id: 'c.vars', name: 'Variables', state: S.done, rank: 1 },
    { id: 'c.types', name: 'Types', requires: ['c.vars'], state: S.done, rank: 1 },
    { id: 'c.io', name: 'Input & Output', requires: ['c.vars'], state: S.done, rank: 1 },
    { id: 'c.cond', name: 'Conditionals', requires: ['c.types'], state: S.done, rank: 1 },
    { id: 'c.loops', name: 'Loops', requires: ['c.cond'], state: S.done, rank: 2 },
    { id: 'c.fns', name: 'Functions', requires: ['c.loops', 'c.io'], state: S.prog, rank: 2 },
    { id: 'c.debug', name: 'Debugging', requires: ['c.cond'], state: S.open, rank: 1 },
    { id: 'c.ds', name: 'Data Structures', requires: ['c.fns'], state: S.open, rank: 2 },
    { id: 'c.oop', name: 'Objects & Classes', requires: ['c.fns'], state: S.open, rank: 2 },
    { id: 'c.git', name: 'Version Control', requires: ['c.debug'], state: S.open, rank: 1 },
    // The three forks — each a whole subject on its own canvas.
    { id: 'c.web', name: 'Web Development', requires: ['c.oop', 'c.git'], navTo: 'web', state: S.lock },
    { id: 'c.algo', name: 'Algorithms & Data Structures', requires: ['c.ds'], navTo: 'algorithms', state: S.lock },
    { id: 'c.sys', name: 'Systems', requires: ['c.ds', 'c.oop'], navTo: 'systems', state: S.lock },
  ],
};

const WEB: SubjectTree = {
  id: 'web',
  title: 'Web Development',
  blurb: 'From a first page to something shipped, styled and signed in.',
  parent: 'coding',
  nodes: [
    { id: 'w.html', name: 'HTML', state: S.done, rank: 1 },
    { id: 'w.css', name: 'CSS', requires: ['w.html'], state: S.done, rank: 1 },
    { id: 'w.layout', name: 'Layout & Flexbox', requires: ['w.css'], state: S.prog, rank: 2 },
    { id: 'w.dom', name: 'The DOM', requires: ['w.html'], state: S.open, rank: 1 },
    { id: 'w.http', name: 'HTTP & Fetch', requires: ['w.dom'], state: S.open, rank: 2 },
    { id: 'w.state', name: 'Client State', requires: ['w.dom'], state: S.lock, rank: 2 },
    { id: 'w.react', name: 'Components', requires: ['w.state', 'w.layout'], state: S.lock, rank: 3 },
    { id: 'w.routing', name: 'Routing', requires: ['w.react'], state: S.lock, rank: 2 },
    { id: 'w.apis', name: 'Talking to APIs', requires: ['w.http', 'w.react'], state: S.lock, rank: 3 },
    { id: 'w.auth', name: 'Auth & Sessions', requires: ['w.apis'], state: S.lock, rank: 2 },
    { id: 'w.deploy', name: 'Deploying', requires: ['w.auth', 'w.routing'], state: S.lock, rank: 3 },
  ],
};

const ALGO: SubjectTree = {
  id: 'algorithms',
  title: 'Algorithms & Data Structures',
  blurb: 'The structures worth knowing, and the moves that run over them.',
  parent: 'coding',
  nodes: [
    { id: 'a.arrays', name: 'Arrays', state: S.done, rank: 1 },
    { id: 'a.strings', name: 'Strings', requires: ['a.arrays'], state: S.done, rank: 1 },
    { id: 'a.linked', name: 'Linked Lists', requires: ['a.arrays'], state: S.prog, rank: 1 },
    { id: 'a.stacks', name: 'Stacks & Queues', requires: ['a.linked'], state: S.open, rank: 2 },
    { id: 'a.hash', name: 'Hash Maps', requires: ['a.strings'], state: S.open, rank: 2 },
    { id: 'a.recursion', name: 'Recursion', requires: ['a.stacks'], state: S.open, rank: 2 },
    { id: 'a.trees', name: 'Trees', requires: ['a.recursion'], state: S.lock, rank: 3 },
    { id: 'a.sorting', name: 'Sorting', requires: ['a.hash'], state: S.lock, rank: 3 },
    { id: 'a.searching', name: 'Binary Search', requires: ['a.sorting'], state: S.lock, rank: 3 },
    { id: 'a.graphs', name: 'Graphs', requires: ['a.trees'], navTo: 'graphs', state: S.lock },
    { id: 'a.dp', name: 'Dynamic Programming', requires: ['a.trees', 'a.searching'], state: S.lock, rank: 4 },
    { id: 'a.greedy', name: 'Greedy', requires: ['a.sorting'], state: S.lock, rank: 4 },
  ],
};

const GRAPHS: SubjectTree = {
  id: 'graphs',
  title: 'Graph Algorithms',
  blurb: 'Once the trees fork into graphs, the traversals earn their own tree.',
  parent: 'algorithms',
  nodes: [
    { id: 'g.repr', name: 'Representations', state: S.open, rank: 1 },
    { id: 'g.bfs', name: 'Breadth-First Search', requires: ['g.repr'], state: S.lock, rank: 1 },
    { id: 'g.dfs', name: 'Depth-First Search', requires: ['g.repr'], state: S.lock, rank: 1 },
    { id: 'g.topo', name: 'Topological Sort', requires: ['g.dfs'], state: S.lock, rank: 2 },
    { id: 'g.dijkstra', name: "Dijkstra's", requires: ['g.bfs'], state: S.lock, rank: 2 },
    { id: 'g.mst', name: 'Minimum Spanning Tree', requires: ['g.dijkstra'], state: S.lock, rank: 3 },
    { id: 'g.flow', name: 'Network Flow', requires: ['g.topo', 'g.mst'], state: S.lock, rank: 4 },
  ],
};

const SYSTEMS: SubjectTree = {
  id: 'systems',
  title: 'Systems',
  blurb: 'What the machine is actually doing underneath the code.',
  parent: 'coding',
  nodes: [
    { id: 's.memory', name: 'Memory', state: S.open, rank: 1 },
    { id: 's.pointers', name: 'Pointers', requires: ['s.memory'], state: S.lock, rank: 1 },
    { id: 's.processes', name: 'Processes', requires: ['s.memory'], state: S.lock, rank: 1 },
    { id: 's.threads', name: 'Threads', requires: ['s.processes'], state: S.lock, rank: 2 },
    { id: 's.concurrency', name: 'Concurrency', requires: ['s.threads'], state: S.lock, rank: 2 },
    { id: 's.files', name: 'File Systems', requires: ['s.processes'], state: S.lock, rank: 2 },
    { id: 's.net', name: 'Networking', requires: ['s.files'], state: S.lock, rank: 3 },
    { id: 's.db', name: 'Databases', requires: ['s.net', 's.concurrency'], state: S.lock, rank: 3 },
  ],
};

const MATH: SubjectTree = {
  id: 'mathematics',
  title: 'Mathematics',
  blurb: 'The ladder most other subjects are quietly standing on.',
  nodes: [
    { id: 'm.arith', name: 'Arithmetic', state: S.done, rank: 1 },
    { id: 'm.fractions', name: 'Fractions', requires: ['m.arith'], state: S.done, rank: 1 },
    { id: 'm.algebra', name: 'Algebra', requires: ['m.fractions'], state: S.prog, rank: 2 },
    { id: 'm.geometry', name: 'Geometry', requires: ['m.arith'], state: S.open, rank: 2 },
    { id: 'm.functions', name: 'Functions', requires: ['m.algebra'], state: S.open, rank: 2 },
    { id: 'm.trig', name: 'Trigonometry', requires: ['m.geometry', 'm.functions'], state: S.lock, rank: 3 },
    { id: 'm.stats', name: 'Statistics', requires: ['m.algebra'], state: S.lock, rank: 3 },
    { id: 'm.precalc', name: 'Precalculus', requires: ['m.trig'], state: S.lock, rank: 4 },
    { id: 'm.calc', name: 'Calculus', requires: ['m.precalc'], navTo: 'calculus', state: S.lock },
    { id: 'm.linalg', name: 'Linear Algebra', requires: ['m.functions'], state: S.lock, rank: 4 },
  ],
};

const CALCULUS: SubjectTree = {
  id: 'calculus',
  title: 'Calculus',
  blurb: 'Rates and areas — a subject the moment it stops being a single node.',
  parent: 'mathematics',
  nodes: [
    { id: 'k.limits', name: 'Limits', state: S.open, rank: 1 },
    { id: 'k.deriv', name: 'Derivatives', requires: ['k.limits'], state: S.lock, rank: 1 },
    { id: 'k.rules', name: 'Differentiation Rules', requires: ['k.deriv'], state: S.lock, rank: 2 },
    { id: 'k.optim', name: 'Optimization', requires: ['k.rules'], state: S.lock, rank: 2 },
    { id: 'k.integral', name: 'Integrals', requires: ['k.deriv'], state: S.lock, rank: 2 },
    { id: 'k.ftc', name: 'The Fundamental Theorem', requires: ['k.integral'], state: S.lock, rank: 3 },
    { id: 'k.series', name: 'Series', requires: ['k.ftc'], state: S.lock, rank: 4 },
  ],
};

const MUSIC: SubjectTree = {
  id: 'music',
  title: 'Music',
  blurb: 'Ear, hands and theory — the three that have to grow together.',
  nodes: [
    { id: 'mu.rhythm', name: 'Rhythm', state: S.done, rank: 1 },
    { id: 'mu.notes', name: 'Reading Notes', requires: ['mu.rhythm'], state: S.prog, rank: 1 },
    { id: 'mu.scales', name: 'Scales', requires: ['mu.notes'], state: S.open, rank: 2 },
    { id: 'mu.intervals', name: 'Intervals', requires: ['mu.notes'], state: S.open, rank: 2 },
    { id: 'mu.chords', name: 'Chords', requires: ['mu.scales', 'mu.intervals'], state: S.lock, rank: 3 },
    { id: 'mu.keys', name: 'Keys & Signatures', requires: ['mu.scales'], state: S.lock, rank: 3 },
    { id: 'mu.progressions', name: 'Progressions', requires: ['mu.chords'], state: S.lock, rank: 4 },
    { id: 'mu.ear', name: 'Ear Training', requires: ['mu.intervals'], state: S.lock, rank: 3 },
  ],
};

const SCIENCE: SubjectTree = {
  id: 'science',
  title: 'Science',
  blurb: 'The method first, then the three that use it.',
  nodes: [
    { id: 'sc.method', name: 'The Method', state: S.done, rank: 1 },
    { id: 'sc.measure', name: 'Measurement', requires: ['sc.method'], state: S.open, rank: 1 },
    { id: 'sc.physics', name: 'Physics', requires: ['sc.measure'], state: S.open, rank: 2 },
    { id: 'sc.chem', name: 'Chemistry', requires: ['sc.measure'], state: S.lock, rank: 2 },
    { id: 'sc.bio', name: 'Biology', requires: ['sc.method'], state: S.lock, rank: 2 },
    { id: 'sc.energy', name: 'Energy', requires: ['sc.physics'], state: S.lock, rank: 3 },
    { id: 'sc.cells', name: 'Cells', requires: ['sc.bio'], state: S.lock, rank: 3 },
  ],
};

/** Every tree, parents and children alike, keyed for lookup. */
export const SUBJECT_TREES: SubjectTree[] = [
  CODING, WEB, ALGO, GRAPHS, SYSTEMS, MATH, CALCULUS, MUSIC, SCIENCE,
];

const BY_ID = new Map(SUBJECT_TREES.map((tree) => [tree.id, tree]));

export function subjectTreeById(id: string): SubjectTree | null {
  return BY_ID.get(id) ?? null;
}

/** The top-level subjects — the ones no other tree is a parent of. These are
 *  what the subject switcher offers; children are reached by navigating in. */
export const ROOT_SUBJECTS: SubjectTree[] = SUBJECT_TREES.filter((tree) => !tree.parent);

/** The subject a fresh visit opens on. Always defined, so the page never has to
 *  reason about an empty hierarchy. */
export const DEFAULT_TREE: SubjectTree = CODING;

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

// ---------------------------------------------------------------------------
// To the renderer's shape
// ---------------------------------------------------------------------------
const PERCENT: Record<NodeStatus, number> = {
  complete: 100,
  progress: 55,
  available: 0,
  locked: 0,
};

/**
 * One subject tree as the graph the canvas draws.
 *
 * Everything the generic model wants but a lattice node does not use is filled
 * with an empty default — no blurb, no XP, no gate — because the compact node
 * draws none of it. What the node *does* need to know beyond the graph model —
 * that it is a navigation node, and its corner figure — the page reads back out
 * of the tree by id, so the graph stays exactly as generic as it was.
 */
export function graphFromSubjectTree(tree: SubjectTree): SkillGraph {
  return {
    id: tree.id,
    name: tree.title,
    nodes: tree.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      blurb: '',
      category: tree.title,
      difficulty: 'foundation',
      status: node.state ?? 'locked',
      percent: PERCENT[node.state ?? 'locked'],
      xp: 0,
      have: 0,
      need: 0,
      unit: '',
      on: '',
      requires: node.requires ?? [],
      gate: '',
    })),
  };
}

/** The navigation targets on a tree, node id → child tree id. */
export function navTargets(tree: SubjectTree): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of tree.nodes) if (node.navTo) map.set(node.id, node.navTo);
  return map;
}

/** The corner figures on a tree, node id → number. */
export function nodeRanks(tree: SubjectTree): Map<string, number> {
  const map = new Map<string, number>();
  for (const node of tree.nodes) if (node.rank) map.set(node.id, node.rank);
  return map;
}
