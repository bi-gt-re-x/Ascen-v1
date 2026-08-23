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
 * back to `core-skill`.
 */
import type { NodeStatus, SkillGraph } from '@/utils/skillGraph';

export interface SubjectNode {
  id: string;
  /** The skill's name, drawn under its tile. */
  name: string;
  /** One or two sentences — what the detail panel prints. */
  desc: string;
  /** A file in utils/icons/tree_icons, without the extension. */
  icon: string;
  /** Node ids on this same tree that come before it. Solid incoming lines. */
  requires?: string[];
  /** Worth doing first, but not a gate. Dashed incoming lines. */
  recommends?: string[];
  /** Where the node stands. Defaults to locked. */
  state?: NodeStatus;
  /** 0-100. Defaults to what the state implies. */
  percent?: number;
  /** What the node is worth in full. */
  xp?: number;
  /** How much of that has been earned. Defaults to `percent` of `xp`. */
  xpDone?: number;
  /** A foundation of the subject rather than a leaf of it — drawn as a badge. */
  core?: boolean;
  /** A child tree id. Present makes this a navigation node — a diamond that
   *  opens that subject rather than a skill you hold. */
  navTo?: string;
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
const done: NodeStatus = 'complete';
const prog: NodeStatus = 'progress';
const open: NodeStatus = 'available';
const lock: NodeStatus = 'locked';

const CODING: SubjectTree = {
  id: 'coding',
  title: 'Coding',
  blurb: 'The craft under every language — and where it forks into its own worlds.',
  nodes: [
    { id: 'c.vars', name: 'Variables', icon: 'variables', core: true, state: done, percent: 100, xp: 2450,
      desc: 'Store and manage data values that can change during program execution.' },
    { id: 'c.types', name: 'Types', icon: 'types', requires: ['c.vars'], core: true, state: done, percent: 100, xp: 2100,
      desc: 'Numbers, text and booleans — and why adding one to another sometimes means two different things.' },
    { id: 'c.io', name: 'Input & Output', icon: 'terminal', requires: ['c.vars'], state: prog, percent: 85, xp: 1800,
      desc: 'Reading what a person typed and printing something back at them.' },
    { id: 'c.cond', name: 'Conditionals', icon: 'conditionals', requires: ['c.types'], state: done, percent: 90, xp: 1900,
      desc: 'Branching on a condition, and writing one that says what you actually meant.' },
    { id: 'c.loops', name: 'Loops', icon: 'loops', requires: ['c.cond'], state: prog, percent: 75, xp: 2000,
      desc: 'Repeating work over a range or a collection, and stopping when you meant to.' },
    { id: 'c.fns', name: 'Functions', icon: 'functions', requires: ['c.loops', 'c.io'], core: true, state: prog, percent: 60, xp: 2600,
      desc: 'Naming a piece of work so it can be done from more than one place.' },
    { id: 'c.debug', name: 'Debugging', icon: 'debugging', requires: ['c.cond'], recommends: ['c.io'], state: prog, percent: 60, xp: 1700,
      desc: 'Finding out what the program is really doing rather than what you assumed.' },
    { id: 'c.ds', name: 'Data Structures', icon: 'arrays', requires: ['c.fns'], state: open, percent: 20, xp: 2400,
      desc: 'Arrays, maps and the rest — choosing the shape that makes the work easy.' },
    { id: 'c.oop', name: 'Objects & Classes', icon: 'objects', requires: ['c.fns'], state: open, percent: 10, xp: 2300,
      desc: 'Bundling data with the operations that belong to it.' },
    { id: 'c.git', name: 'Version Control', icon: 'version-control', requires: ['c.debug'], state: open, percent: 15, xp: 1500,
      desc: 'Keeping every version of the work, and being able to go back to any of them.' },
    { id: 'c.err', name: 'Error Handling', icon: 'shield', requires: ['c.debug'], state: lock, percent: 0, xp: 1600,
      desc: 'Deciding what should happen when something goes wrong, before it does.' },
    { id: 'c.web', name: 'Web Development', icon: 'browser', requires: ['c.oop', 'c.git'], navTo: 'web', state: lock,
      desc: 'A subject of its own: pages, styling, state and everything it takes to ship one.' },
    { id: 'c.algo', name: 'Algorithms & Data Structures', icon: 'graph-nodes', requires: ['c.ds'], navTo: 'algorithms', state: lock,
      desc: 'A subject of its own: the structures worth knowing and the moves that run over them.' },
    { id: 'c.sys', name: 'Systems', icon: 'kernel', requires: ['c.ds', 'c.oop'], navTo: 'systems', state: lock,
      desc: 'A subject of its own: what the machine is actually doing underneath the code.' },
  ],
};

const WEB: SubjectTree = {
  id: 'web',
  title: 'Web Development',
  blurb: 'From a first page to something shipped, styled and signed in.',
  parent: 'coding',
  nodes: [
    { id: 'w.html', name: 'HTML', icon: 'html', core: true, state: done, percent: 100, xp: 1400,
      desc: 'The structure of a page: what is a heading, what is a list, what is a button.' },
    { id: 'w.css', name: 'CSS', icon: 'css', requires: ['w.html'], core: true, state: done, percent: 100, xp: 1900,
      desc: 'How the page looks, and the cascade that decides which rule wins.' },
    { id: 'w.layout', name: 'Layout & Flexbox', icon: 'layout', requires: ['w.css'], state: prog, percent: 70, xp: 1800,
      desc: 'Putting things where you want them, at every width the page will be read at.' },
    { id: 'w.dom', name: 'The DOM', icon: 'dom', requires: ['w.html'], state: prog, percent: 55, xp: 1700,
      desc: 'The page as a tree a program can read and change while it is on screen.' },
    { id: 'w.http', name: 'HTTP & Fetch', icon: 'http', requires: ['w.dom'], state: open, percent: 15, xp: 1600,
      desc: 'Asking another machine for something, and understanding what came back.' },
    { id: 'w.state', name: 'Client State', icon: 'client-state', requires: ['w.dom'], state: open, percent: 10, xp: 1800,
      desc: 'What the page currently knows, and keeping it true as things change.' },
    { id: 'w.react', name: 'Components', icon: 'components', requires: ['w.state', 'w.layout'], core: true, state: lock, percent: 0, xp: 2400,
      desc: 'Building a page out of pieces that own their own markup and behaviour.' },
    { id: 'w.routing', name: 'Routing', icon: 'routing', requires: ['w.react'], state: lock, percent: 0, xp: 1500,
      desc: 'One address per screen, so the back button and a pasted link both work.' },
    { id: 'w.apis', name: 'Talking to APIs', icon: 'api', requires: ['w.http', 'w.react'], state: lock, percent: 0, xp: 2000,
      desc: 'Loading real data into a page, including while it is still loading.' },
    { id: 'w.auth', name: 'Auth & Sessions', icon: 'auth', requires: ['w.apis'], state: lock, percent: 0, xp: 2200,
      desc: 'Knowing who is asking, and keeping that true for the rest of the visit.' },
    { id: 'w.deploy', name: 'Deploying', icon: 'deploy', requires: ['w.auth', 'w.routing'], state: lock, percent: 0, xp: 1900,
      desc: 'Getting it onto a machine that is not yours and keeping it running.' },
  ],
};

const ALGO: SubjectTree = {
  id: 'algorithms',
  title: 'Algorithms & Data Structures',
  blurb: 'The structures worth knowing, and the moves that run over them.',
  parent: 'coding',
  nodes: [
    { id: 'a.arrays', name: 'Arrays', icon: 'arrays', core: true, state: done, percent: 100, xp: 1500,
      desc: 'A run of values in order, and the cost of reaching each one.' },
    { id: 'a.strings', name: 'Strings', icon: 'strings', requires: ['a.arrays'], state: done, percent: 100, xp: 1400,
      desc: 'Text as data, and the operations that are cheaper than they look.' },
    { id: 'a.linked', name: 'Linked Lists', icon: 'linked-list', requires: ['a.arrays'], state: prog, percent: 65, xp: 1600,
      desc: 'Values joined by pointers rather than by position.' },
    { id: 'a.stacks', name: 'Stacks & Queues', icon: 'stack', requires: ['a.linked'], state: prog, percent: 50, xp: 1700,
      desc: 'Two orders of service — last in first out, and first in first out.' },
    { id: 'a.hash', name: 'Hash Maps', icon: 'hash-map', requires: ['a.strings'], core: true, state: open, percent: 25, xp: 2100,
      desc: 'Finding a value by its key without looking through everything.' },
    { id: 'a.recursion', name: 'Recursion', icon: 'recursion', requires: ['a.stacks'], core: true, state: open, percent: 15, xp: 2300,
      desc: 'A function that calls itself on a smaller version of the same problem.' },
    { id: 'a.trees', name: 'Trees', icon: 'tree-structure', requires: ['a.recursion'], state: lock, percent: 0, xp: 2200,
      desc: 'Branching structure, and the three orders you can walk it in.' },
    { id: 'a.sorting', name: 'Sorting', icon: 'sorting', requires: ['a.hash'], state: lock, percent: 0, xp: 1900,
      desc: 'Putting things in order, and what each way of doing it costs.' },
    { id: 'a.searching', name: 'Binary Search', icon: 'binary-search', requires: ['a.sorting'], state: lock, percent: 0, xp: 1800,
      desc: 'Halving the search space every step, once the data is in order.' },
    { id: 'a.complexity', name: 'Complexity', icon: 'complexity', requires: ['a.sorting'], recommends: ['a.recursion'], state: lock, percent: 0, xp: 2000,
      desc: 'How the time grows as the input does — the only comparison that survives a faster machine.' },
    { id: 'a.dp', name: 'Dynamic Programming', icon: 'dynamic-programming', requires: ['a.trees', 'a.searching'], state: lock, percent: 0, xp: 2800,
      desc: 'Solving a problem once and remembering the answer for every time it comes back.' },
    { id: 'a.greedy', name: 'Greedy', icon: 'greedy', requires: ['a.sorting'], state: lock, percent: 0, xp: 2000,
      desc: 'Taking the best step available and knowing when that is actually enough.' },
    { id: 'a.graphs', name: 'Graphs', icon: 'graph-nodes', requires: ['a.trees'], navTo: 'graphs', state: lock,
      desc: 'A subject of its own: traversal, shortest paths and flow.' },
  ],
};

const GRAPHS: SubjectTree = {
  id: 'graphs',
  title: 'Graph Algorithms',
  blurb: 'Once the trees fork into graphs, the traversals earn their own tree.',
  parent: 'algorithms',
  nodes: [
    { id: 'g.repr', name: 'Representations', icon: 'graph-nodes', core: true, state: open, percent: 30, xp: 1600,
      desc: 'Adjacency lists and matrices, and which one the problem wants.' },
    { id: 'g.bfs', name: 'Breadth-First Search', icon: 'traversal', requires: ['g.repr'], state: open, percent: 10, xp: 1900,
      desc: 'Exploring a level at a time — and why that gives the shortest unweighted path.' },
    { id: 'g.dfs', name: 'Depth-First Search', icon: 'branch', requires: ['g.repr'], state: lock, percent: 0, xp: 1900,
      desc: 'Following one route to its end before trying the next.' },
    { id: 'g.topo', name: 'Topological Sort', icon: 'sorting', requires: ['g.dfs'], state: lock, percent: 0, xp: 2100,
      desc: 'An order for things that depend on each other — which this very page is laid out by.' },
    { id: 'g.dijkstra', name: "Dijkstra's", icon: 'path-route', requires: ['g.bfs'], state: lock, percent: 0, xp: 2400,
      desc: 'Shortest paths when the edges have weights and none of them are negative.' },
    { id: 'g.mst', name: 'Minimum Spanning Tree', icon: 'tree-structure', requires: ['g.dijkstra'], state: lock, percent: 0, xp: 2300,
      desc: 'Joining everything together for the least total cost.' },
    { id: 'g.flow', name: 'Network Flow', icon: 'network', requires: ['g.topo', 'g.mst'], state: lock, percent: 0, xp: 3000,
      desc: 'How much can be pushed through a network at once, and where it jams.' },
  ],
};

const SYSTEMS: SubjectTree = {
  id: 'systems',
  title: 'Systems',
  blurb: 'What the machine is actually doing underneath the code.',
  parent: 'coding',
  nodes: [
    { id: 's.memory', name: 'Memory', icon: 'memory', core: true, state: open, percent: 25, xp: 2000,
      desc: 'Where values actually live, and what it costs to reach them.' },
    { id: 's.pointers', name: 'Pointers', icon: 'pointers', requires: ['s.memory'], state: open, percent: 10, xp: 2100,
      desc: 'A value that is the address of another value.' },
    { id: 's.processes', name: 'Processes', icon: 'process', requires: ['s.memory'], state: lock, percent: 0, xp: 1900,
      desc: 'A running program as the operating system sees it.' },
    { id: 's.threads', name: 'Threads', icon: 'threads', requires: ['s.processes'], state: lock, percent: 0, xp: 2200,
      desc: 'More than one thing happening inside a single program.' },
    { id: 's.concurrency', name: 'Concurrency', icon: 'concurrency', requires: ['s.threads'], state: lock, percent: 0, xp: 2600,
      desc: 'Sharing without corrupting, and the bugs that only appear sometimes.' },
    { id: 's.files', name: 'File Systems', icon: 'filesystem', requires: ['s.processes'], state: lock, percent: 0, xp: 1700,
      desc: 'Storage that survives the program exiting.' },
    { id: 's.net', name: 'Networking', icon: 'network', requires: ['s.files'], state: lock, percent: 0, xp: 2300,
      desc: 'Two machines agreeing on how to say something to each other.' },
    { id: 's.db', name: 'Databases', icon: 'database', requires: ['s.net', 's.concurrency'], state: lock, percent: 0, xp: 2500,
      desc: 'Storing data so it can be queried, and so it survives a crash mid-write.' },
  ],
};

const MATH: SubjectTree = {
  id: 'mathematics',
  title: 'Mathematics',
  blurb: 'The ladder most other subjects are quietly standing on.',
  nodes: [
    { id: 'm.arith', name: 'Arithmetic', icon: 'arithmetic', core: true, state: done, percent: 100, xp: 1200,
      desc: 'The four operations, done reliably and without a calculator.' },
    { id: 'm.fractions', name: 'Fractions', icon: 'fractions', requires: ['m.arith'], state: done, percent: 100, xp: 1300,
      desc: 'Parts of a whole, and why the denominators have to agree first.' },
    { id: 'm.algebra', name: 'Algebra', icon: 'algebra-x', requires: ['m.fractions'], core: true, state: prog, percent: 80, xp: 2000,
      desc: 'Letters standing in for numbers, and keeping an equation balanced.' },
    { id: 'm.geometry', name: 'Geometry', icon: 'geometry', requires: ['m.arith'], state: prog, percent: 60, xp: 1800,
      desc: 'Shape, angle and distance, and proving something about all of them at once.' },
    { id: 'm.functions', name: 'Functions', icon: 'functions-graph', requires: ['m.algebra'], core: true, state: open, percent: 35, xp: 2100,
      desc: 'One input, one output, and what the graph of that looks like.' },
    { id: 'm.trig', name: 'Trigonometry', icon: 'trigonometry', requires: ['m.geometry', 'm.functions'], state: open, percent: 15, xp: 2200,
      desc: 'Angles and ratios, and the two waves that come out of them.' },
    { id: 'm.stats', name: 'Statistics', icon: 'statistics', requires: ['m.algebra'], state: open, percent: 20, xp: 1900,
      desc: 'Describing data honestly, including how sure you are allowed to be.' },
    { id: 'm.prob', name: 'Probability', icon: 'probability', requires: ['m.stats'], recommends: ['m.functions'], state: lock, percent: 0, xp: 2000,
      desc: 'How likely something is, and why intuition is so often wrong about it.' },
    { id: 'm.precalc', name: 'Precalculus', icon: 'series', requires: ['m.trig'], state: lock, percent: 0, xp: 2300,
      desc: 'The last tightening of algebra and functions before the limits start.' },
    { id: 'm.linalg', name: 'Linear Algebra', icon: 'matrices', requires: ['m.functions'], state: lock, percent: 0, xp: 2600,
      desc: 'Vectors, matrices, and treating whole systems of equations as one object.' },
    { id: 'm.calc', name: 'Calculus', icon: 'calculus', requires: ['m.precalc'], navTo: 'calculus', state: lock,
      desc: 'A subject of its own: rates, areas, and the limit underneath both.' },
  ],
};

const CALCULUS: SubjectTree = {
  id: 'calculus',
  title: 'Calculus',
  blurb: 'Rates and areas — a subject the moment it stops being a single node.',
  parent: 'mathematics',
  nodes: [
    { id: 'k.limits', name: 'Limits', icon: 'limits', core: true, state: open, percent: 30, xp: 2000,
      desc: 'What a function approaches, whether or not it ever gets there.' },
    { id: 'k.deriv', name: 'Derivatives', icon: 'derivatives', requires: ['k.limits'], core: true, state: open, percent: 10, xp: 2400,
      desc: 'The rate something is changing at a single instant.' },
    { id: 'k.rules', name: 'Differentiation Rules', icon: 'equations', requires: ['k.deriv'], state: lock, percent: 0, xp: 2100,
      desc: 'Product, quotient and chain — the three that make derivatives quick.' },
    { id: 'k.optim', name: 'Optimization', icon: 'target', requires: ['k.rules'], state: lock, percent: 0, xp: 2300,
      desc: 'Finding the largest or smallest value something can take.' },
    { id: 'k.integral', name: 'Integrals', icon: 'integrals', requires: ['k.deriv'], state: lock, percent: 0, xp: 2500,
      desc: 'Adding up infinitely many infinitely small pieces.' },
    { id: 'k.ftc', name: 'The Fundamental Theorem', icon: 'star', requires: ['k.integral'], state: lock, percent: 0, xp: 2800,
      desc: 'That the two halves of calculus undo each other.' },
    { id: 'k.series', name: 'Series', icon: 'series', requires: ['k.ftc'], state: lock, percent: 0, xp: 2700,
      desc: 'Infinite sums that add up to something finite, and how to tell when.' },
  ],
};

const MUSIC: SubjectTree = {
  id: 'music',
  title: 'Music',
  blurb: 'Ear, hands and theory — the three that have to grow together.',
  nodes: [
    { id: 'mu.rhythm', name: 'Rhythm', icon: 'rhythm', core: true, state: done, percent: 100, xp: 1200,
      desc: 'Keeping time, and subdividing it without slowing down.' },
    { id: 'mu.notes', name: 'Reading Notes', icon: 'staff', requires: ['mu.rhythm'], core: true, state: prog, percent: 70, xp: 1500,
      desc: 'Turning a dot on a line into a sound, without counting up from the bottom.' },
    { id: 'mu.scales', name: 'Scales', icon: 'scales', requires: ['mu.notes'], state: prog, percent: 55, xp: 1700,
      desc: 'The ladders every melody is built out of.' },
    { id: 'mu.intervals', name: 'Intervals', icon: 'intervals', requires: ['mu.notes'], state: open, percent: 30, xp: 1600,
      desc: 'The distance between two notes, by ear and on the page.' },
    { id: 'mu.chords', name: 'Chords', icon: 'chords', requires: ['mu.scales', 'mu.intervals'], core: true, state: lock, percent: 0, xp: 2000,
      desc: 'Three or more notes at once, and why some combinations settle.' },
    { id: 'mu.keys', name: 'Keys & Signatures', icon: 'key-signature', requires: ['mu.scales'], state: lock, percent: 0, xp: 1800,
      desc: 'Which notes a piece has agreed to use before it starts.' },
    { id: 'mu.ear', name: 'Ear Training', icon: 'ear-training', requires: ['mu.intervals'], recommends: ['mu.chords'], state: lock, percent: 0, xp: 2200,
      desc: 'Naming what you heard — the skill the other seven are worth less without.' },
    { id: 'mu.progressions', name: 'Progressions', icon: 'progressions', requires: ['mu.chords'], state: lock, percent: 0, xp: 2100,
      desc: 'Chords in sequence, and why a handful of orders keep reappearing.' },
  ],
};

const SCIENCE: SubjectTree = {
  id: 'science',
  title: 'Science',
  blurb: 'The method first, then the three that use it.',
  nodes: [
    { id: 'sc.method', name: 'The Method', icon: 'scientific-method', core: true, state: done, percent: 100, xp: 1300,
      desc: 'Asking a question in a form that an experiment could actually answer.' },
    { id: 'sc.measure', name: 'Measurement', icon: 'measurement', requires: ['sc.method'], state: prog, percent: 65, xp: 1400,
      desc: 'Units, precision, and being honest about the error bars.' },
    { id: 'sc.physics', name: 'Physics', icon: 'physics', requires: ['sc.measure'], state: open, percent: 25, xp: 2200,
      desc: 'Motion, force and energy — the rules the rest of it inherits.' },
    { id: 'sc.chem', name: 'Chemistry', icon: 'chemistry', requires: ['sc.measure'], state: open, percent: 15, xp: 2200,
      desc: 'What things are made of, and what happens when they meet.' },
    { id: 'sc.bio', name: 'Biology', icon: 'biology', requires: ['sc.method'], state: open, percent: 20, xp: 2000,
      desc: 'Living systems, from one cell up to a whole population.' },
    { id: 'sc.energy', name: 'Energy', icon: 'energy', requires: ['sc.physics'], state: lock, percent: 0, xp: 2100,
      desc: 'The one quantity that is never created or destroyed, only moved.' },
    { id: 'sc.cells', name: 'Cells', icon: 'cells', requires: ['sc.bio'], state: lock, percent: 0, xp: 1900,
      desc: 'The smallest thing that counts as alive.' },
    { id: 'sc.dna', name: 'DNA', icon: 'dna', requires: ['sc.cells'], recommends: ['sc.chem'], state: lock, percent: 0, xp: 2400,
      desc: 'The instructions a cell copies, and what happens when the copy is wrong.' },
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
        difficulty: 'foundation' as const,
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
