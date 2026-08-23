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
import type { Difficulty } from './types';
import type { NodeStatus, SkillGraph } from '@/utils/skillGraph';

export interface SubjectNode {
  id: string;
  /** The skill's name, drawn under its tile. */
  name: string;
  /**
   * What the skill actually is, in two or three sentences.
   *
   * Written for somebody who has not met it yet: what it is, what it is *for*,
   * and the thing people get wrong about it. A description that only expands
   * the title — "Loops: repeating work" — tells a reader nothing they could not
   * see from the tile, which is the failure this field is written against.
   */
  desc: string;
  /** A file in utils/icons/tree_icons, without the extension. */
  icon: string;
  /**
   * How hard it is, which is a fact about the skill rather than about the
   * reader — an untouched Foundation node is still a Foundation node. This is
   * what the tile takes its colour from; status is carried by fill and ring
   * instead. See the note on the palette in styles/skilltree.css.
   */
  tier: Difficulty;
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
    { id: 'c.vars', name: 'Variables', icon: 'variables', tier: 'foundation', core: true, state: done, percent: 100, xp: 2450,
      desc: 'A name bound to a value the program can read and change later. The whole idea is that the name stays put while what it holds moves, which is what lets you write one instruction that works on data you have not seen yet. Most early confusion is really about when the value changes, not about the name.' },
    { id: 'c.types', name: 'Types', icon: 'types', tier: 'foundation', core: true, requires: ['c.vars'], state: done, percent: 100, xp: 2100,
      desc: 'What kind of thing a value is — a number, a piece of text, a true-or-false. The type decides what the operators actually do, which is why adding two numbers and adding two strings look identical and mean completely different things.' },
    { id: 'c.ops', name: 'Operators', icon: 'arithmetic', tier: 'foundation', requires: ['c.types'], state: done, percent: 100, xp: 1400,
      desc: 'Arithmetic, comparison and logic: the small set of symbols that combine values into new ones. Precedence is the part worth learning properly, because a wrong assumption there produces an answer rather than an error.' },
    { id: 'c.io', name: 'Input & Output', icon: 'terminal', tier: 'foundation', requires: ['c.vars'], state: prog, percent: 85, xp: 1800,
      desc: 'Getting information in from a person, a file or another program, and sending something back. It is the first point where your code meets the world, so it is also the first place your assumptions about what arrives get tested.' },
    { id: 'c.cond', name: 'Conditionals', icon: 'conditionals', tier: 'beginner', requires: ['c.ops'], state: done, percent: 90, xp: 1900,
      desc: 'Choosing between paths based on whether something is true. Writing the branch is easy; writing a condition that says exactly what you meant, including at the edges, is the actual skill.' },
    { id: 'c.loops', name: 'Loops', icon: 'loops', tier: 'beginner', requires: ['c.cond'], state: prog, percent: 75, xp: 2000,
      desc: 'Doing the same work repeatedly — over a range, over a collection, or until something becomes true. The two questions that matter are what changes each time round and what makes it stop.' },
    { id: 'c.lists', name: 'Lists & Collections', icon: 'arrays', tier: 'beginner', requires: ['c.loops'], state: prog, percent: 55, xp: 1900,
      desc: 'Holding many values under one name and working through them. Once you can build, filter and transform a list, most programs stop being about single values entirely.' },
    { id: 'c.strings', name: 'Text & Strings', icon: 'strings', tier: 'beginner', requires: ['c.lists'], state: open, percent: 30, xp: 1600,
      desc: 'Text as data you can slice, search, split and rebuild. It looks simple because you can read it, but encoding, whitespace and the cost of joining in a loop catch nearly everyone once.' },
    { id: 'c.fns', name: 'Functions', icon: 'functions', tier: 'beginner', core: true, requires: ['c.loops', 'c.io'], state: prog, percent: 60, xp: 2600,
      desc: 'A named piece of work with inputs and a result, callable from anywhere. This is the first real tool for managing size: it lets you stop holding the whole program in your head and think about one job at a time.' },
    { id: 'c.style', name: 'Readable Code', icon: 'book', tier: 'beginner', requires: ['c.fns'], state: open, percent: 25, xp: 1300,
      desc: 'Naming, shape and structure chosen so the next reader — usually you, months later — understands it without running it. Not decoration: unreadable code is where most bugs hide.' },
    { id: 'c.debug', name: 'Debugging', icon: 'debugging', tier: 'intermediate', requires: ['c.cond'], recommends: ['c.io'], state: prog, percent: 60, xp: 1700,
      desc: 'Finding out what the program is really doing instead of what you assumed. The method is the skill: reproduce it reliably, form one hypothesis, test that hypothesis, and only then change a line.' },
    { id: 'c.err', name: 'Error Handling', icon: 'shield', tier: 'intermediate', requires: ['c.debug'], state: open, percent: 20, xp: 1600,
      desc: 'Deciding in advance what should happen when something fails — a missing file, bad input, a network that vanished. The hard judgement is which errors to handle where, and which should be allowed to stop the program loudly.' },
    { id: 'c.ds', name: 'Data Structures', icon: 'arrays', tier: 'intermediate', requires: ['c.fns', 'c.lists'], state: open, percent: 20, xp: 2400,
      desc: 'Choosing the shape that fits the work: a list for order, a map for lookup, a set for membership. The choice is usually the difference between a fast program and a slow one, long before any clever algorithm is involved.' },
    { id: 'c.oop', name: 'Objects & Classes', icon: 'objects', tier: 'intermediate', requires: ['c.fns'], state: open, percent: 10, xp: 2300,
      desc: 'Bundling data together with the operations that belong to it, so a thing knows how to look after itself. Powerful and easy to overuse — plenty of code is clearer as plain functions over plain data.' },
    { id: 'c.modules', name: 'Modules & Packages', icon: 'package', tier: 'intermediate', requires: ['c.style'], state: open, percent: 15, xp: 1500,
      desc: 'Splitting a program across files with deliberate boundaries, and pulling in code other people wrote. What to expose and what to keep private is the decision that keeps a growing project navigable.' },
    { id: 'c.files', name: 'Files & Persistence', icon: 'filesystem', tier: 'intermediate', requires: ['c.err'], state: lock, percent: 0, xp: 1700,
      desc: 'Storing data so it survives the program exiting, and reading it back intact. Most of the difficulty is not writing the bytes but handling the cases where the file is missing, half-written or being changed by something else.' },
    { id: 'c.git', name: 'Version Control', icon: 'version-control', tier: 'intermediate', requires: ['c.debug'], state: open, percent: 15, xp: 1500,
      desc: 'Keeping every version of the work, with the ability to see what changed, why, and to go back. Branching turns it from a backup into a way of trying things without risk.' },
    { id: 'c.test', name: 'Testing', icon: 'checklist', tier: 'intermediate', requires: ['c.fns', 'c.err'], state: lock, percent: 0, xp: 2000,
      desc: 'Code that checks your code, so a change that breaks something old tells you immediately. The value is not proving correctness — it is the freedom to change things without fear.' },
    { id: 'c.refactor', name: 'Refactoring', icon: 'layers', tier: 'advanced', requires: ['c.test', 'c.style'], state: lock, percent: 0, xp: 2200,
      desc: 'Changing the shape of code without changing what it does. Done in small steps behind tests, it is how a program that grew badly becomes one you can keep working in.' },
    { id: 'c.async', name: 'Asynchronous Code', icon: 'concurrency', tier: 'advanced', requires: ['c.err', 'c.fns'], state: lock, percent: 0, xp: 2500,
      desc: 'Work that starts now and finishes later — a download, a timer, a database call — without freezing everything else. The mental shift is that the order lines appear in stops being the order they run in.' },
    { id: 'c.perf', name: 'Performance', icon: 'complexity', tier: 'advanced', requires: ['c.ds'], state: lock, percent: 0, xp: 2300,
      desc: 'Making a program fast enough, starting by measuring rather than guessing. Almost all real gains come from doing less work, not from micro-optimising the work you are already doing.' },
    { id: 'c.design', name: 'Program Design', icon: 'compass', tier: 'expert', core: true, requires: ['c.refactor', 'c.modules'], state: lock, percent: 0, xp: 3000,
      desc: 'Deciding what the pieces of a system are and how they should depend on each other, before there is much code. This is the skill that separates a program that survives its second year from one that gets rewritten.' },
    { id: 'c.web', name: 'Web Development', icon: 'browser', tier: 'intermediate', requires: ['c.oop', 'c.git'], navTo: 'web', state: lock,
      desc: 'A subject of its own: pages, styling, state, data and everything it takes to ship something people can open.' },
    { id: 'c.algo', name: 'Algorithms & Data Structures', icon: 'graph-nodes', tier: 'advanced', requires: ['c.ds'], navTo: 'algorithms', state: lock,
      desc: 'A subject of its own: the structures worth knowing and the moves that run over them.' },
    { id: 'c.sys', name: 'Systems', icon: 'kernel', tier: 'advanced', requires: ['c.perf', 'c.async'], navTo: 'systems', state: lock,
      desc: 'A subject of its own: what the machine is actually doing underneath the code you write.' },
  ],
};

const WEB: SubjectTree = {
  id: 'web',
  title: 'Web Development',
  blurb: 'From a first page to something shipped, styled, signed in and fast.',
  parent: 'coding',
  nodes: [
    { id: 'w.html', name: 'HTML', icon: 'html', tier: 'foundation', core: true, state: done, percent: 100, xp: 1400,
      desc: 'The structure of a page: what is a heading, a list, a button, a form. Choosing the tag that means the right thing is what gives you working keyboard support and screen-reader behaviour for free.' },
    { id: 'w.css', name: 'CSS', icon: 'css', tier: 'foundation', core: true, requires: ['w.html'], state: done, percent: 100, xp: 1900,
      desc: 'How the page looks, written as rules that match elements. The cascade and specificity decide which rule wins when several apply, and not knowing those two is why CSS feels random before it feels precise.' },
    { id: 'w.layout', name: 'Layout & Flexbox', icon: 'layout', tier: 'beginner', requires: ['w.css'], state: prog, percent: 70, xp: 1800,
      desc: 'Arranging boxes along a row, a column or a grid. Flexbox handles one direction and grid handles two; picking the wrong one is the usual reason a layout needs a fight to behave.' },
    { id: 'w.responsive', name: 'Responsive Design', icon: 'responsive', tier: 'beginner', requires: ['w.layout'], state: open, percent: 25, xp: 1600,
      desc: 'One page that works from a phone to a wide monitor. The good version comes from flexible units and content that reflows naturally, with breakpoints as a last resort rather than the plan.' },
    { id: 'w.dom', name: 'The DOM', icon: 'dom', tier: 'beginner', requires: ['w.html'], state: prog, percent: 55, xp: 1700,
      desc: 'The live tree of the page as a program can see it: find an element, read it, change it, listen for what a person does. Everything interactive on the web is ultimately this.' },
    { id: 'w.forms', name: 'Forms & Validation', icon: 'form', tier: 'beginner', requires: ['w.dom'], state: open, percent: 20, xp: 1500,
      desc: 'Collecting input and telling someone clearly when it is wrong. Validate in the browser for speed and on the server for safety — the browser copy is a courtesy, never the guarantee.' },
    { id: 'w.json', name: 'JSON & Data Shapes', icon: 'package', tier: 'beginner', requires: ['w.dom'], state: open, percent: 30, xp: 1300,
      desc: 'The format almost every web API speaks, and the habit of knowing exactly what shape you expect back. Most fetch bugs are shape bugs rather than network bugs.' },
    { id: 'w.a11y', name: 'Accessibility', icon: 'available', tier: 'intermediate', requires: ['w.forms'], state: lock, percent: 0, xp: 1900,
      desc: 'Making the page usable by keyboard, screen reader and anyone not using it the way you do. Most of it is choosing correct HTML and keeping focus visible, not adding extra machinery.' },
    { id: 'w.http', name: 'HTTP & Fetch', icon: 'http', tier: 'intermediate', requires: ['w.json'], state: open, percent: 15, xp: 1600,
      desc: 'How a browser asks another machine for something: method, path, headers, status, body. Knowing what a 401 means as distinct from a 403 saves hours you would otherwise spend guessing.' },
    { id: 'w.state', name: 'Client State', icon: 'client-state', tier: 'intermediate', requires: ['w.dom'], state: open, percent: 10, xp: 1800,
      desc: 'Everything the page currently knows, and keeping it true as things change. The discipline is to store each fact once and derive the rest, because two copies eventually disagree.' },
    { id: 'w.react', name: 'Components', icon: 'components', tier: 'intermediate', core: true, requires: ['w.state', 'w.layout'], state: lock, percent: 0, xp: 2400,
      desc: 'Building an interface from small pieces that own their own markup, style and behaviour. The payoff is that you can reason about, test and reuse one piece without loading the whole page into your head.' },
    { id: 'w.props', name: 'Props & Composition', icon: 'puzzle', tier: 'intermediate', requires: ['w.react'], state: lock, percent: 0, xp: 1700,
      desc: 'Passing data down and composing small components into bigger ones. Getting the boundaries right — who owns which piece of state — is most of what makes a component tree pleasant or painful.' },
    { id: 'w.routing', name: 'Routing', icon: 'routing', tier: 'intermediate', requires: ['w.react'], state: lock, percent: 0, xp: 1500,
      desc: 'One address per screen, so the back button, a refresh and a pasted link all do what a person expects. It is what makes an app feel like part of the web rather than a page that swallowed one.' },
    { id: 'w.build', name: 'Build Tools', icon: 'compile', tier: 'intermediate', requires: ['w.props'], state: lock, percent: 0, xp: 1500,
      desc: 'The step that turns the source you write into files a browser can load quickly. Worth understanding rather than copying: the config is where most mysterious failures live.' },
    { id: 'w.effects', name: 'Effects & Lifecycles', icon: 'timer', tier: 'advanced', requires: ['w.props'], state: lock, percent: 0, xp: 2100,
      desc: 'Running work when something appears, changes or goes away — and cleaning up after it. Almost every stubborn interface bug is an effect that ran too often or never got torn down.' },
    { id: 'w.apis', name: 'Talking to APIs', icon: 'api', tier: 'advanced', requires: ['w.http', 'w.effects'], state: lock, percent: 0, xp: 2000,
      desc: 'Loading real data into a real interface, including while it is still loading and when it fails. An empty result and an error are different states and a good screen never confuses them.' },
    { id: 'w.auth', name: 'Auth & Sessions', icon: 'auth', tier: 'advanced', requires: ['w.apis'], state: lock, percent: 0, xp: 2200,
      desc: 'Knowing who is asking and keeping that true for the rest of the visit. The rule that matters: the browser decides what to show, the server decides what is allowed.' },
    { id: 'w.perf', name: 'Web Performance', icon: 'energy', tier: 'advanced', requires: ['w.build'], state: lock, percent: 0, xp: 2000,
      desc: 'Making a page load and respond quickly on a normal connection and a normal phone. Measure first: the biggest wins are usually shipping less code and not blocking the first paint.' },
    { id: 'w.test', name: 'Testing the UI', icon: 'checklist', tier: 'advanced', requires: ['w.apis'], state: lock, percent: 0, xp: 1900,
      desc: 'Checking that a screen does what a person needs, driven the way a person drives it. Test behaviour rather than internals, or every refactor breaks a hundred tests that were describing the wrong thing.' },
    { id: 'w.deploy', name: 'Deploying', icon: 'deploy', tier: 'advanced', requires: ['w.auth', 'w.routing'], state: lock, percent: 0, xp: 1900,
      desc: 'Getting it onto a machine that is not yours and keeping it running. The goal is that shipping is boring: one command, repeatable, and reversible when it goes wrong.' },
    { id: 'w.security', name: 'Web Security', icon: 'security', tier: 'expert', requires: ['w.auth', 'w.test'], state: lock, percent: 0, xp: 2600,
      desc: 'The handful of attacks every web app faces — injected scripts, forged requests, leaked tokens — and the specific habits that prevent each. Assume every byte from the browser is hostile until proven otherwise.' },
  ],
};

const ALGO: SubjectTree = {
  id: 'algorithms',
  title: 'Algorithms & Data Structures',
  blurb: 'The structures worth knowing, and the moves that run over them.',
  parent: 'coding',
  nodes: [
    { id: 'a.arrays', name: 'Arrays', icon: 'arrays', tier: 'foundation', core: true, state: done, percent: 100, xp: 1500,
      desc: 'A block of values in order, reachable instantly by position. Everything else is built on understanding why reading by index is free and inserting in the middle is not.' },
    { id: 'a.strings', name: 'Strings', icon: 'strings', tier: 'foundation', requires: ['a.arrays'], state: done, percent: 100, xp: 1400,
      desc: 'Arrays of characters with their own set of classic problems. Most string questions are really array questions wearing different clothes, which is worth noticing early.' },
    { id: 'a.bigo', name: 'Big-O Notation', icon: 'complexity', tier: 'beginner', core: true, requires: ['a.arrays'], state: prog, percent: 70, xp: 1800,
      desc: 'A way of describing how the work grows as the input does, ignoring constants and hardware. It is the only comparison between two approaches that survives a faster machine.' },
    { id: 'a.sets', name: 'Sets', icon: 'layers', tier: 'beginner', requires: ['a.arrays'], state: prog, percent: 60, xp: 1300,
      desc: 'A collection with no duplicates and instant membership tests. Reaching for one is the single most common way an accidental n-squared loop becomes linear.' },
    { id: 'a.linked', name: 'Linked Lists', icon: 'linked-list', tier: 'beginner', requires: ['a.arrays'], state: prog, percent: 65, xp: 1600,
      desc: 'Values joined by references rather than by position, so inserting and removing are cheap but reaching the tenth item is not. Mostly valuable now as the place where pointer thinking is learned.' },
    { id: 'a.stacks', name: 'Stacks & Queues', icon: 'stack', tier: 'beginner', requires: ['a.linked'], state: prog, percent: 50, xp: 1700,
      desc: 'Two disciplines of access: last-in-first-out, and first-in-first-out. Which one a problem wants usually decides the whole shape of the solution, as with depth-first against breadth-first search.' },
    { id: 'a.hash', name: 'Hash Maps', icon: 'hash-map', tier: 'intermediate', core: true, requires: ['a.sets'], state: open, percent: 25, xp: 2100,
      desc: 'Storing and finding values by key in roughly constant time. The trade is memory for speed, and the assumption underneath is that your keys hash evenly — which is why collisions are worth understanding.' },
    { id: 'a.twopointer', name: 'Two Pointers', icon: 'pointers', tier: 'intermediate', requires: ['a.strings', 'a.bigo'], state: open, percent: 20, xp: 1700,
      desc: 'Walking a sequence with two indices that move under different rules. Turns a great many quadratic scans into a single pass, especially on sorted data.' },
    { id: 'a.sliding', name: 'Sliding Window', icon: 'measurement', tier: 'intermediate', requires: ['a.twopointer'], state: lock, percent: 0, xp: 1800,
      desc: 'Keeping a running view of a contiguous stretch, growing and shrinking it instead of recomputing. The pattern behind almost every "longest substring such that" problem.' },
    { id: 'a.recursion', name: 'Recursion', icon: 'recursion', tier: 'intermediate', core: true, requires: ['a.stacks'], state: open, percent: 15, xp: 2300,
      desc: 'A function defined in terms of a smaller version of the same problem. Write the base case first and trust the recursive call — trying to trace every level in your head is what makes it feel hard.' },
    { id: 'a.sorting', name: 'Sorting', icon: 'sorting', tier: 'intermediate', requires: ['a.hash'], state: lock, percent: 0, xp: 1900,
      desc: 'Putting things in order, and the reason n log n is the floor for comparison-based methods. In practice you call the built-in one; knowing how it works is for choosing keys and predicting cost.' },
    { id: 'a.searching', name: 'Binary Search', icon: 'binary-search', tier: 'intermediate', requires: ['a.sorting'], state: lock, percent: 0, xp: 1800,
      desc: 'Halving the search space each step on ordered data. The real power is searching over an answer rather than an array — the version most people meet years after the basic one.' },
    { id: 'a.bitwise', name: 'Bit Manipulation', icon: 'kernel', tier: 'intermediate', requires: ['a.bigo'], state: lock, percent: 0, xp: 1600,
      desc: 'Working directly with the binary digits of a number. Niche but occasionally decisive, and the fastest way to represent a small set of on-or-off facts.' },
    { id: 'a.heaps', name: 'Heaps & Priority Queues', icon: 'layers', tier: 'advanced', requires: ['a.sorting'], state: lock, percent: 0, xp: 2000,
      desc: 'A structure that always hands you the smallest or largest item next, without keeping everything sorted. The engine inside scheduling, streaming top-k, and shortest-path algorithms.' },
    { id: 'a.trees', name: 'Trees', icon: 'tree-structure', tier: 'advanced', requires: ['a.recursion'], state: lock, percent: 0, xp: 2200,
      desc: 'Branching structures with a single root and no cycles. Nearly every operation is naturally recursive, which makes them the place recursion finally feels obvious rather than clever.' },
    { id: 'a.bst', name: 'Binary Search Trees', icon: 'binary-search', tier: 'advanced', requires: ['a.trees', 'a.searching'], state: lock, percent: 0, xp: 2200,
      desc: 'A tree that keeps its values ordered, so search, insert and delete are logarithmic — as long as it stays balanced. What happens when it does not is the whole reason self-balancing trees exist.' },
    { id: 'a.tries', name: 'Tries', icon: 'tree-structure', tier: 'advanced', requires: ['a.trees', 'a.strings'], state: lock, percent: 0, xp: 2100,
      desc: 'A tree keyed by the characters of a word, so shared prefixes are stored once. The structure behind autocomplete and fast dictionary lookups.' },
    { id: 'a.unionfind', name: 'Union-Find', icon: 'network', tier: 'advanced', requires: ['a.trees'], state: lock, percent: 0, xp: 2100,
      desc: 'A structure for tracking which things are in the same group as merges happen. Tiny to implement, surprisingly fast, and exactly what connectivity and spanning-tree problems need.' },
    { id: 'a.backtracking', name: 'Backtracking', icon: 'branch', tier: 'advanced', requires: ['a.recursion'], state: lock, percent: 0, xp: 2400,
      desc: 'Building a solution one choice at a time and undoing a choice when it leads nowhere. Systematic brute force — and the skill is pruning branches early enough to make it finish.' },
    { id: 'a.greedy', name: 'Greedy', icon: 'greedy', tier: 'advanced', requires: ['a.sorting'], state: lock, percent: 0, xp: 2000,
      desc: 'Taking the locally best option each step and having that be globally right. It works far less often than it appears to, so the real skill is proving the greedy choice is safe.' },
    { id: 'a.dp', name: 'Dynamic Programming', icon: 'dynamic-programming', tier: 'expert', requires: ['a.backtracking', 'a.hash'], state: lock, percent: 0, xp: 2800,
      desc: 'Solving overlapping subproblems once and reusing the answers. Every DP is a recursion plus memory; write the recurrence in words before writing any code and most of the difficulty disappears.' },
    { id: 'a.graphs', name: 'Graphs', icon: 'graph-nodes', tier: 'advanced', requires: ['a.trees'], navTo: 'graphs', state: lock,
      desc: 'A subject of its own: traversal, shortest paths, spanning trees and flow.' },
  ],
};

const GRAPHS: SubjectTree = {
  id: 'graphs',
  title: 'Graph Algorithms',
  blurb: 'Once trees fork into graphs, the traversals earn a tree of their own.',
  parent: 'algorithms',
  nodes: [
    { id: 'g.repr', name: 'Representations', icon: 'graph-nodes', tier: 'intermediate', core: true, state: open, percent: 30, xp: 1600,
      desc: 'Storing a graph as adjacency lists or a matrix, and knowing which the problem wants. Lists for sparse graphs, a matrix when you need instant edge lookup — the choice sets the cost of everything after it.' },
    { id: 'g.bfs', name: 'Breadth-First Search', icon: 'traversal', tier: 'intermediate', requires: ['g.repr'], state: open, percent: 10, xp: 1900,
      desc: 'Exploring a level at a time with a queue. Because it reaches every node at distance one before distance two, it hands you shortest paths for free on unweighted graphs.' },
    { id: 'g.dfs', name: 'Depth-First Search', icon: 'branch', tier: 'intermediate', requires: ['g.repr'], state: lock, percent: 0, xp: 1900,
      desc: 'Following one route as far as it goes before backing up. Natural to write recursively, and the base for cycle detection, topological order and component finding.' },
    { id: 'g.components', name: 'Connected Components', icon: 'network', tier: 'intermediate', requires: ['g.dfs'], state: lock, percent: 0, xp: 1800,
      desc: 'Finding the separate islands in a graph that is not fully joined up. One traversal per unvisited node, and a surprising number of grid puzzles are exactly this.' },
    { id: 'g.cycles', name: 'Cycle Detection', icon: 'loops', tier: 'advanced', requires: ['g.dfs'], state: lock, percent: 0, xp: 2000,
      desc: 'Deciding whether a graph contains a loop — which differs between directed and undirected graphs. In a dependency graph a cycle is the thing that makes an ordering impossible.' },
    { id: 'g.topo', name: 'Topological Sort', icon: 'sorting', tier: 'advanced', requires: ['g.cycles'], state: lock, percent: 0, xp: 2100,
      desc: 'An order in which dependencies always come before what needs them. This page lays its own nodes out with exactly this idea, and a cycle is what makes it fail.' },
    { id: 'g.dijkstra', name: "Dijkstra's Algorithm", icon: 'path-route', tier: 'advanced', requires: ['g.bfs'], recommends: ['g.repr'], state: lock, percent: 0, xp: 2400,
      desc: 'Shortest paths with weighted edges, using a priority queue to always settle the nearest unfinished node. Correct only while every weight is non-negative, which is exactly what the next node fixes.' },
    { id: 'g.bellman', name: 'Bellman-Ford', icon: 'measurement', tier: 'expert', requires: ['g.dijkstra'], state: lock, percent: 0, xp: 2500,
      desc: 'Shortest paths that tolerate negative edges, by relaxing every edge repeatedly. Slower than Dijkstra, and the only one of the two that can also tell you a negative cycle exists.' },
    { id: 'g.mst', name: 'Minimum Spanning Tree', icon: 'tree-structure', tier: 'advanced', requires: ['g.dijkstra'], state: lock, percent: 0, xp: 2300,
      desc: 'Connecting every node for the least total edge weight. Kruskal sorts edges and uses union-find; Prim grows outward from one node — same answer, different shape of problem to suit.' },
    { id: 'g.astar', name: 'A* Search', icon: 'compass', tier: 'expert', requires: ['g.dijkstra'], state: lock, percent: 0, xp: 2600,
      desc: 'Dijkstra with a heuristic nudging the search toward the goal. As long as the heuristic never overestimates, the answer stays optimal and the search visits far fewer nodes.' },
    { id: 'g.bipartite', name: 'Bipartite Matching', icon: 'puzzle', tier: 'expert', requires: ['g.components'], state: lock, percent: 0, xp: 2500,
      desc: 'Pairing two sets so as many pairs as possible are matched. Scheduling, assignment and rota problems are usually this in disguise.' },
    { id: 'g.flow', name: 'Network Flow', icon: 'network', tier: 'mastery', requires: ['g.topo', 'g.mst', 'g.bipartite'], state: lock, percent: 0, xp: 3000,
      desc: 'How much can be pushed through a capacitated network, and where the bottleneck is. The max-flow min-cut theorem tying those two together is one of the genuinely beautiful results in the subject.' },
  ],
};

const SYSTEMS: SubjectTree = {
  id: 'systems',
  title: 'Systems',
  blurb: 'What the machine is actually doing underneath the code you write.',
  parent: 'coding',
  nodes: [
    { id: 's.memory', name: 'Memory', icon: 'memory', tier: 'intermediate', core: true, state: open, percent: 25, xp: 2000,
      desc: 'Where values actually live and what it costs to reach them. Once you can picture memory as one long addressable strip, a lot of otherwise arbitrary performance advice becomes obvious.' },
    { id: 's.stackheap', name: 'Stack & Heap', icon: 'layers', tier: 'intermediate', requires: ['s.memory'], state: open, percent: 15, xp: 1900,
      desc: 'Two places a program keeps things: a fast, automatically managed stack for call frames, and a flexible heap you allocate from. Which one a value lives on explains its lifetime and most of its cost.' },
    { id: 's.pointers', name: 'Pointers & References', icon: 'pointers', tier: 'intermediate', requires: ['s.memory'], state: open, percent: 10, xp: 2100,
      desc: 'A value that is the address of another value. Every "why did changing this change that" surprise in any language traces back to whether you copied the thing or a reference to it.' },
    { id: 's.processes', name: 'Processes', icon: 'process', tier: 'intermediate', requires: ['s.stackheap'], state: lock, percent: 0, xp: 1900,
      desc: 'A running program as the operating system sees it, with its own memory and its own view of the machine. Isolation is the point: one crashing process should not take the others with it.' },
    { id: 's.files', name: 'File Systems', icon: 'filesystem', tier: 'intermediate', requires: ['s.processes'], state: lock, percent: 0, xp: 1700,
      desc: 'How bytes are named, found and kept between runs. Paths, permissions and the fact that a write is not durable until it is flushed account for most surprises here.' },
    { id: 's.threads', name: 'Threads', icon: 'threads', tier: 'advanced', requires: ['s.processes'], state: lock, percent: 0, xp: 2200,
      desc: 'Several lines of execution inside one process, sharing its memory. The sharing is what makes threads fast and what makes them dangerous.' },
    { id: 's.concurrency', name: 'Concurrency', icon: 'concurrency', tier: 'advanced', requires: ['s.threads'], state: lock, percent: 0, xp: 2600,
      desc: 'Getting correct results when things happen at once or in an unpredictable order. Race conditions are the defining hazard: the bug is real, intermittent, and disappears when you look at it.' },
    { id: 's.locks', name: 'Locks & Deadlock', icon: 'locked', tier: 'expert', requires: ['s.concurrency'], state: lock, percent: 0, xp: 2500,
      desc: 'Protecting shared state, and the new failure that protection creates: two holders each waiting on the other forever. Consistent lock ordering is the cheapest cure.' },
    { id: 's.io', name: 'Buffered I/O', icon: 'cache', tier: 'advanced', requires: ['s.files'], state: lock, percent: 0, xp: 1800,
      desc: 'Why reading a file one byte at a time is thousands of times slower than reading it in blocks. Buffering is the general trick of paying a large fixed cost rarely instead of a small one constantly.' },
    { id: 's.net', name: 'Networking', icon: 'network', tier: 'advanced', requires: ['s.io'], state: lock, percent: 0, xp: 2300,
      desc: 'Two machines agreeing how to say something to each other, in layers. Knowing what DNS, TCP and TLS each did before your request left is what makes network debugging tractable.' },
    { id: 's.sockets', name: 'Sockets', icon: 'api', tier: 'advanced', requires: ['s.net'], state: lock, percent: 0, xp: 2200,
      desc: 'The actual programming interface behind every network call — open, write, read, close. Speaking HTTP by hand over one is the fastest way to stop treating the web as magic.' },
    { id: 's.server', name: 'Servers', icon: 'server', tier: 'advanced', requires: ['s.sockets', 's.concurrency'], state: lock, percent: 0, xp: 2400,
      desc: 'A program that waits for requests and answers many of them at once. How it handles that concurrency — threads, processes or an event loop — shapes everything about how it scales.' },
    { id: 's.db', name: 'Databases', icon: 'database', tier: 'advanced', requires: ['s.server'], state: lock, percent: 0, xp: 2500,
      desc: 'Storing data so it can be queried flexibly and survives a crash halfway through a write. Transactions are the promise that a group of changes either all happen or none do.' },
    { id: 's.indexes', name: 'Indexes & Query Plans', icon: 'searching', tier: 'expert', requires: ['s.db'], state: lock, percent: 0, xp: 2600,
      desc: 'Why one query returns instantly and an almost identical one takes a minute. Reading the plan tells you what the database decided to do, which is usually not what you assumed.' },
    { id: 's.caching', name: 'Caching', icon: 'cache', tier: 'advanced', requires: ['s.db'], state: lock, percent: 0, xp: 2300,
      desc: 'Keeping a copy of an expensive answer close by. Easy to add and hard to retire — deciding when a cached copy stops being true is the entire difficulty.' },
    { id: 's.scaling', name: 'Scaling', icon: 'cloud', tier: 'mastery', requires: ['s.caching', 's.indexes'], state: lock, percent: 0, xp: 3000,
      desc: 'Serving far more load than one machine can, and accepting the trade-offs that forces. Almost every hard distributed-systems problem starts the moment a second copy of the data exists.' },
  ],
};

const MATH: SubjectTree = {
  id: 'mathematics',
  title: 'Mathematics',
  blurb: 'The ladder most other subjects are quietly standing on.',
  nodes: [
    { id: 'm.arith', name: 'Arithmetic', icon: 'arithmetic', tier: 'foundation', core: true, state: done, percent: 100, xp: 1200,
      desc: 'The four operations, done reliably and with a sense of roughly what the answer should be. That estimate is the actual skill — it is what catches a mistake before it travels.' },
    { id: 'm.order', name: 'Order of Operations', icon: 'checklist', tier: 'foundation', requires: ['m.arith'], state: done, percent: 100, xp: 1000,
      desc: 'The agreed order for evaluating an expression, so one string of symbols means one thing. Small, but every algebraic error later either respects it or comes from ignoring it.' },
    { id: 'm.fractions', name: 'Fractions', icon: 'fractions', tier: 'foundation', requires: ['m.arith'], state: done, percent: 100, xp: 1300,
      desc: 'Parts of a whole, and arithmetic where the denominators have to agree first. Fluency here quietly decides how hard algebra feels two years later.' },
    { id: 'm.decimals', name: 'Decimals & Percents', icon: 'statistics', tier: 'foundation', requires: ['m.fractions'], state: done, percent: 95, xp: 1100,
      desc: 'Three ways of writing the same quantity, and moving between them without thinking. Percentage change is the one people keep getting wrong, in both directions.' },
    { id: 'm.negatives', name: 'Negative Numbers', icon: 'arithmetic', tier: 'foundation', requires: ['m.order'], state: prog, percent: 85, xp: 1100,
      desc: 'Quantities below zero and what the operations do to them. Signs are the single most common source of a wrong answer in otherwise correct algebra.' },
    { id: 'm.algebra', name: 'Algebra', icon: 'algebra-x', tier: 'beginner', core: true, requires: ['m.fractions', 'm.negatives'], state: prog, percent: 80, xp: 2000,
      desc: 'Letters standing in for numbers, and rearranging while keeping both sides equal. The shift is from computing an answer to manipulating a relationship, which is what makes the rest of mathematics possible.' },
    { id: 'm.linear', name: 'Linear Equations', icon: 'functions-graph', tier: 'beginner', requires: ['m.algebra'], state: prog, percent: 70, xp: 1600,
      desc: 'Equations whose graph is a straight line, and solving one or several at once. Slope and intercept are worth being able to read off in either direction without hesitation.' },
    { id: 'm.inequalities', name: 'Inequalities', icon: 'equations', tier: 'beginner', requires: ['m.linear'], state: open, percent: 30, xp: 1400,
      desc: 'Relationships that are less-than rather than equal, and the one rule that surprises everyone: multiplying by a negative flips the sign.' },
    { id: 'm.geometry', name: 'Geometry', icon: 'geometry', tier: 'beginner', requires: ['m.arith'], state: prog, percent: 60, xp: 1800,
      desc: 'Shape, angle, area and distance, and proving something is true for every case rather than the one you drew. Drawing the diagram first is not a study tip, it is the method.' },
    { id: 'm.coords', name: 'Coordinate Geometry', icon: 'functions-graph', tier: 'intermediate', requires: ['m.geometry', 'm.linear'], state: open, percent: 25, xp: 1700,
      desc: 'Shapes described by equations on a grid, which lets algebra answer geometric questions. The bridge that makes both subjects considerably more powerful than either alone.' },
    { id: 'm.quadratics', name: 'Quadratics', icon: 'functions-graph', tier: 'intermediate', requires: ['m.linear'], state: open, percent: 20, xp: 1800,
      desc: 'Equations with a squared term, and the parabola they draw. Three routes to a solution — factoring, completing the square, the formula — and knowing which is quickest matters.' },
    { id: 'm.functions', name: 'Functions', icon: 'functions-graph', tier: 'intermediate', core: true, requires: ['m.quadratics'], state: open, percent: 35, xp: 2100,
      desc: 'A rule taking each input to exactly one output, and the graph as its picture. Domain, range, composition and inverses are the vocabulary the whole of later mathematics assumes you have.' },
    { id: 'm.exponents', name: 'Exponents & Logarithms', icon: 'series', tier: 'intermediate', requires: ['m.functions'], state: lock, percent: 0, xp: 1900,
      desc: 'Repeated multiplication and the operation that undoes it. Logs turn multiplication into addition, which is why they appear everywhere from complexity to acoustics.' },
    { id: 'm.trig', name: 'Trigonometry', icon: 'trigonometry', tier: 'intermediate', requires: ['m.coords', 'm.functions'], state: open, percent: 15, xp: 2200,
      desc: 'Ratios in a right triangle that turn out to describe every wave. Derive the unit circle once rather than memorising the table and the identities stop being arbitrary.' },
    { id: 'm.stats', name: 'Statistics', icon: 'statistics', tier: 'intermediate', requires: ['m.decimals'], state: open, percent: 20, xp: 1900,
      desc: 'Describing data honestly: what is typical, how spread out it is, and how sure you are allowed to be. Most misuse is not bad arithmetic but a chart or an average answering a question nobody asked.' },
    { id: 'm.combinatorics', name: 'Counting & Combinatorics', icon: 'puzzle', tier: 'advanced', requires: ['m.algebra'], state: lock, percent: 0, xp: 2000,
      desc: 'Counting arrangements without listing them. Whether order matters and whether repetition is allowed are the two questions that decide which formula applies.' },
    { id: 'm.prob', name: 'Probability', icon: 'probability', tier: 'advanced', requires: ['m.stats', 'm.combinatorics'], recommends: ['m.functions'], state: lock, percent: 0, xp: 2000,
      desc: 'How likely something is, given what you already know. Conditional probability is where intuition fails hardest, which is why the classic paradoxes are all built from it.' },
    { id: 'm.sequences', name: 'Sequences & Series', icon: 'series', tier: 'advanced', requires: ['m.exponents'], state: lock, percent: 0, xp: 2100,
      desc: 'Ordered lists of numbers and what happens when you add them all up. Whether an infinite sum settles on a value is the question calculus later answers properly.' },
    { id: 'm.proof', name: 'Proof', icon: 'shield', tier: 'advanced', requires: ['m.geometry', 'm.algebra'], state: lock, percent: 0, xp: 2400,
      desc: 'Establishing that something is true for every case, not merely the ones you tried. Induction, contradiction and construction are the three moves worth being fluent in.' },
    { id: 'm.linalg', name: 'Linear Algebra', icon: 'matrices', tier: 'expert', requires: ['m.coords', 'm.functions'], state: lock, percent: 0, xp: 2600,
      desc: 'Vectors, matrices and treating an entire system of equations as one object. The mathematics underneath graphics, machine learning and most of scientific computing.' },
    { id: 'm.precalc', name: 'Precalculus', icon: 'series', tier: 'advanced', requires: ['m.trig', 'm.exponents'], state: lock, percent: 0, xp: 2300,
      desc: 'The last tightening of functions, graphs and algebra before limits begin. Not a subject so much as everything you will need fluently the moment calculus starts.' },
    { id: 'm.calc', name: 'Calculus', icon: 'calculus', tier: 'expert', requires: ['m.precalc'], navTo: 'calculus', state: lock,
      desc: 'A subject of its own: rates, areas, and the limit that sits underneath both.' },
  ],
};

const CALCULUS: SubjectTree = {
  id: 'calculus',
  title: 'Calculus',
  blurb: 'Rates and areas — a subject the moment it stops being a single node.',
  parent: 'mathematics',
  nodes: [
    { id: 'k.limits', name: 'Limits', icon: 'limits', tier: 'advanced', core: true, state: open, percent: 30, xp: 2000,
      desc: 'What a function approaches as the input closes in on a value, whether or not it ever arrives. Every idea in calculus is defined in terms of this one, so it is worth more time than it usually gets.' },
    { id: 'k.continuity', name: 'Continuity', icon: 'functions-graph', tier: 'advanced', requires: ['k.limits'], state: open, percent: 10, xp: 1800,
      desc: 'A function with no jumps, holes or gaps — one you could draw without lifting the pen. The theorems that follow all quietly require it, which is why the exceptions matter.' },
    { id: 'k.deriv', name: 'Derivatives', icon: 'derivatives', tier: 'advanced', core: true, requires: ['k.continuity'], state: lock, percent: 0, xp: 2400,
      desc: 'The rate at which something changes at a single instant, defined as a limit of average rates. Being able to say what it means for a real quantity matters more than being able to compute it.' },
    { id: 'k.rules', name: 'Differentiation Rules', icon: 'equations', tier: 'advanced', requires: ['k.deriv'], state: lock, percent: 0, xp: 2100,
      desc: 'Product, quotient and chain — the shortcuts that make derivatives fast once you have done a few from first principles. The chain rule is the one that keeps being the culprit.' },
    { id: 'k.implicit', name: 'Implicit Differentiation', icon: 'equations', tier: 'expert', requires: ['k.rules'], state: lock, percent: 0, xp: 2200,
      desc: 'Differentiating a relationship that is not written as y equals something. The trick is remembering that y is still a function of x, so the chain rule applies every time it appears.' },
    { id: 'k.optim', name: 'Optimization', icon: 'target', tier: 'expert', requires: ['k.rules'], state: lock, percent: 0, xp: 2300,
      desc: 'Finding the largest or smallest value something can take, by looking where the derivative is zero. The modelling is the hard half; the calculus is usually two lines.' },
    { id: 'k.related', name: 'Related Rates', icon: 'timer', tier: 'expert', requires: ['k.implicit'], state: lock, percent: 0, xp: 2200,
      desc: 'How fast one quantity changes given how fast another does, when the two are linked. Write the relationship first and differentiate with respect to time second — the reverse never works.' },
    { id: 'k.integral', name: 'Integrals', icon: 'integrals', tier: 'expert', requires: ['k.deriv'], state: lock, percent: 0, xp: 2500,
      desc: 'Adding up infinitely many infinitely small pieces to get an area, a total or an accumulation. Meeting it first as a Riemann sum is what stops it being an arbitrary new symbol.' },
    { id: 'k.ftc', name: 'The Fundamental Theorem', icon: 'star', tier: 'expert', requires: ['k.integral'], state: lock, percent: 0, xp: 2800,
      desc: 'That differentiation and integration undo each other. It is what turns integration from a limit you must compute into an antiderivative you can look up, and it deserves to feel surprising.' },
    { id: 'k.techniques', name: 'Integration Techniques', icon: 'puzzle', tier: 'expert', requires: ['k.ftc'], state: lock, percent: 0, xp: 2600,
      desc: 'Substitution, parts and partial fractions — the toolkit for integrals that do not yield directly. Recognising which to reach for is pattern matching that only practice builds.' },
    { id: 'k.applications', name: 'Areas & Volumes', icon: 'geometry', tier: 'expert', requires: ['k.techniques'], state: lock, percent: 0, xp: 2400,
      desc: 'Using integration for the area between curves and the volume of a solid of revolution. Sketch the region and the representative slice first; the integral then writes itself.' },
    { id: 'k.series', name: 'Series', icon: 'series', tier: 'mastery', requires: ['k.techniques'], state: lock, percent: 0, xp: 2700,
      desc: 'Infinite sums, and the tests that decide whether one settles on a finite value. A rare place where the answer is genuinely yes or no and the reasoning is the whole content.' },
    { id: 'k.taylor', name: 'Taylor Series', icon: 'spark', tier: 'mastery', requires: ['k.series'], state: lock, percent: 0, xp: 2900,
      desc: 'Approximating any well-behaved function by a polynomial built from its derivatives. This is how a calculator computes sine, and why the approximation gets worse away from the centre.' },
    { id: 'k.diffeq', name: 'Differential Equations', icon: 'physics', tier: 'mastery', requires: ['k.applications', 'k.taylor'], state: lock, percent: 0, xp: 3000,
      desc: 'Equations relating a quantity to its own rate of change, which is how nearly every physical law is written. Solving one means finding a whole function rather than a number.' },
  ],
};

const MUSIC: SubjectTree = {
  id: 'music',
  title: 'Music',
  blurb: 'Ear, hands and theory — the three that have to grow together.',
  nodes: [
    { id: 'mu.pulse', name: 'Pulse & Tempo', icon: 'metronome', tier: 'foundation', core: true, state: done, percent: 100, xp: 1000,
      desc: 'Feeling a steady beat and holding it without drifting. Everything rhythmic sits on this, and playing with a metronome exposes immediately how steady you actually are.' },
    { id: 'mu.rhythm', name: 'Rhythm', icon: 'rhythm', tier: 'foundation', core: true, requires: ['mu.pulse'], state: done, percent: 100, xp: 1200,
      desc: 'Dividing the beat into patterns and placing notes precisely inside it. Counting out loud feels childish and remains the fastest way to fix a rhythm you keep fluffing.' },
    { id: 'mu.notes', name: 'Reading Notes', icon: 'staff', tier: 'foundation', core: true, requires: ['mu.pulse'], state: prog, percent: 70, xp: 1500,
      desc: 'Turning a position on the stave into a pitch without counting up from the bottom line. Recognition needs to become instant, because the moment it does, sight reading stops being arithmetic.' },
    { id: 'mu.dynamics', name: 'Dynamics & Articulation', icon: 'progressions', tier: 'beginner', requires: ['mu.rhythm'], state: prog, percent: 50, xp: 1200,
      desc: 'How loud, and how each note is started and released. This is most of what separates a performance from a correct sequence of pitches.' },
    { id: 'mu.scales', name: 'Scales', icon: 'scales', tier: 'beginner', requires: ['mu.notes'], state: prog, percent: 55, xp: 1700,
      desc: 'The ordered set of pitches a piece draws from, and the pattern of steps that defines each type. Practising them is partly theory and partly the most efficient technique exercise there is.' },
    { id: 'mu.intervals', name: 'Intervals', icon: 'intervals', tier: 'beginner', requires: ['mu.notes'], state: open, percent: 30, xp: 1600,
      desc: 'The distance between two pitches, named by size and quality. Attaching each one to a song you already know is the trick that makes them recognisable by ear rather than by counting.' },
    { id: 'mu.keys', name: 'Keys & Signatures', icon: 'key-signature', tier: 'intermediate', requires: ['mu.scales'], state: open, percent: 20, xp: 1800,
      desc: 'Which notes a piece has agreed to use, declared once at the start. The circle of fifths turns fifteen separate facts into one picture worth being able to draw from memory.' },
    { id: 'mu.chords', name: 'Chords', icon: 'chords', tier: 'intermediate', core: true, requires: ['mu.scales', 'mu.intervals'], state: lock, percent: 0, xp: 2000,
      desc: 'Three or more notes sounding together, built by stacking intervals. Major, minor, diminished and augmented are four different feelings produced by moving one note a semitone.' },
    { id: 'mu.inversions', name: 'Inversions', icon: 'loops', tier: 'intermediate', requires: ['mu.chords'], state: lock, percent: 0, xp: 1700,
      desc: 'The same chord with a different note at the bottom. What changes is not the harmony but the smoothness of the movement, which is what voice leading is about.' },
    { id: 'mu.progressions', name: 'Progressions', icon: 'progressions', tier: 'intermediate', requires: ['mu.inversions', 'mu.keys'], state: lock, percent: 0, xp: 2100,
      desc: 'Chords in sequence, and why a handful of orders keep reappearing across centuries and genres. Tension and release is the whole mechanism, and cadences are where it resolves.' },
    { id: 'mu.ear', name: 'Ear Training', icon: 'ear-training', tier: 'advanced', requires: ['mu.intervals'], recommends: ['mu.chords'], state: lock, percent: 0, xp: 2200,
      desc: 'Naming what you heard: intervals, chord qualities, and eventually whole progressions. Five focused minutes daily beats an hour a week, and it is the skill the other seven are worth less without.' },
    { id: 'mu.sightread', name: 'Sight Reading', icon: 'book', tier: 'advanced', requires: ['mu.notes', 'mu.dynamics'], state: lock, percent: 0, xp: 2000,
      desc: 'Playing something you have never seen, in time, without stopping. Improved only by reading new material constantly and accepting that it will be rough.' },
    { id: 'mu.modes', name: 'Modes', icon: 'scales', tier: 'advanced', requires: ['mu.keys'], state: lock, percent: 0, xp: 2000,
      desc: 'The same seven notes started from a different degree, giving seven distinct colours. Hearing dorian as its own thing rather than as a displaced major scale is the point.' },
    { id: 'mu.harmony', name: 'Harmony', icon: 'chords', tier: 'advanced', requires: ['mu.progressions'], state: lock, percent: 0, xp: 2400,
      desc: 'How independent lines combine, and the conventions that make some combinations sound intentional. Voice leading — moving each part as little as possible — explains most of the rules.' },
    { id: 'mu.form', name: 'Musical Form', icon: 'layers', tier: 'advanced', requires: ['mu.progressions'], state: lock, percent: 0, xp: 1900,
      desc: 'The architecture of a piece: what repeats, what contrasts, and where it returns. Hearing structure while listening is what makes long pieces feel navigable rather than endless.' },
    { id: 'mu.improv', name: 'Improvisation', icon: 'spark', tier: 'expert', requires: ['mu.ear', 'mu.modes'], state: lock, percent: 0, xp: 2600,
      desc: 'Making music in real time inside a set of constraints. It is far less mysterious than it looks: a vocabulary of phrases, deep familiarity with the changes, and the nerve to commit.' },
    { id: 'mu.composition', name: 'Composition', icon: 'idea', tier: 'expert', requires: ['mu.harmony', 'mu.form'], state: lock, percent: 0, xp: 2700,
      desc: 'Writing music that goes somewhere. Craft rather than inspiration — a good idea developed properly beats four good ideas laid end to end.' },
    { id: 'mu.performance', name: 'Performance', icon: 'trophy', tier: 'mastery', requires: ['mu.sightread', 'mu.improv'], state: lock, percent: 0, xp: 3000,
      desc: 'Playing for other people, under pressure, and communicating something. A separate skill from playing well alone, and one that only performing actually trains.' },
  ],
};

const SCIENCE: SubjectTree = {
  id: 'science',
  title: 'Science',
  blurb: 'The method first, then the three subjects that use it.',
  nodes: [
    { id: 'sc.method', name: 'The Method', icon: 'scientific-method', tier: 'foundation', core: true, state: done, percent: 100, xp: 1300,
      desc: 'Turning a question into something an experiment could actually settle, with a control and a prediction that could fail. The willingness to be wrong is the part that makes it work.' },
    { id: 'sc.units', name: 'Units & Dimensions', icon: 'measurement', tier: 'foundation', requires: ['sc.method'], state: done, percent: 100, xp: 1100,
      desc: 'Every quantity carries a unit, and units follow through a calculation like algebra. Checking that they come out right catches more mistakes than rechecking the arithmetic.' },
    { id: 'sc.measure', name: 'Measurement', icon: 'measurement', tier: 'foundation', requires: ['sc.units'], state: prog, percent: 65, xp: 1400,
      desc: 'Getting a number off an instrument and knowing how much of it to believe. Precision, accuracy and uncertainty are three different things, and reporting all three honestly is the skill.' },
    { id: 'sc.data', name: 'Data & Graphs', icon: 'statistics', tier: 'beginner', requires: ['sc.measure'], state: prog, percent: 45, xp: 1500,
      desc: 'Turning readings into a picture that shows the relationship. Which variable goes on which axis, and whether a line through the points is justified at all, are decisions rather than conventions.' },
    { id: 'sc.motion', name: 'Motion', icon: 'forces', tier: 'beginner', requires: ['sc.data'], state: open, percent: 25, xp: 1700,
      desc: 'Describing how things move — position, velocity, acceleration — before asking what causes it. Getting comfortable that acceleration is a change in velocity, not a large velocity, is half of it.' },
    { id: 'sc.physics', name: 'Physics', icon: 'physics', tier: 'beginner', core: true, requires: ['sc.motion'], state: open, percent: 25, xp: 2200,
      desc: 'The rules that everything else inherits, expressed as a small number of laws with wide reach. Drawing the situation and labelling the forces solves most problems before any algebra starts.' },
    { id: 'sc.forces', name: 'Forces', icon: 'forces', tier: 'intermediate', requires: ['sc.physics'], state: lock, percent: 0, xp: 2000,
      desc: 'Pushes and pulls, and why an object with no net force keeps doing exactly what it was doing. A free-body diagram is not optional; it is where the answer comes from.' },
    { id: 'sc.energy', name: 'Energy', icon: 'energy', tier: 'intermediate', requires: ['sc.forces'], state: lock, percent: 0, xp: 2100,
      desc: 'The quantity that is never created or destroyed, only moved and converted. Often gives an answer in one line where tracking forces takes ten.' },
    { id: 'sc.waves', name: 'Waves', icon: 'rhythm', tier: 'advanced', requires: ['sc.energy'], state: lock, percent: 0, xp: 2200,
      desc: 'Energy travelling without matter travelling with it — sound, light, ripples. Frequency, wavelength and speed are locked together, so changing one forces another.' },
    { id: 'sc.electricity', name: 'Electricity', icon: 'energy', tier: 'advanced', requires: ['sc.energy'], state: lock, percent: 0, xp: 2300,
      desc: 'Charge in motion, and the relationship between voltage, current and resistance. Circuits are the rare topic where a correct mental model makes the calculations nearly trivial.' },
    { id: 'sc.chem', name: 'Chemistry', icon: 'chemistry', tier: 'beginner', core: true, requires: ['sc.units'], state: open, percent: 15, xp: 2200,
      desc: 'What matter is made of and what happens when different kinds meet. It becomes far less like memorisation once the periodic table reads as a map of behaviour rather than a list.' },
    { id: 'sc.atoms', name: 'Atoms & Elements', icon: 'atoms', tier: 'intermediate', requires: ['sc.chem'], state: lock, percent: 0, xp: 1900,
      desc: 'Protons, neutrons, electrons, and why the arrangement of the outer electrons decides almost everything an element does.' },
    { id: 'sc.bonding', name: 'Bonding', icon: 'linked-list', tier: 'intermediate', requires: ['sc.atoms'], state: lock, percent: 0, xp: 2000,
      desc: 'How atoms hold together by sharing or transferring electrons. Whether a substance melts, dissolves or conducts follows directly from which kind of bond it has.' },
    { id: 'sc.reactions', name: 'Reactions', icon: 'experiment', tier: 'advanced', requires: ['sc.bonding'], state: lock, percent: 0, xp: 2300,
      desc: 'Rearranging atoms into new substances, with nothing created or destroyed. Balancing an equation is that conservation written down, not a puzzle for its own sake.' },
    { id: 'sc.bio', name: 'Biology', icon: 'biology', tier: 'beginner', core: true, requires: ['sc.method'], state: open, percent: 20, xp: 2000,
      desc: 'Living systems from one cell up to a whole ecosystem. Structure and function are related everywhere in it, which is what turns endless facts into a smaller number of principles.' },
    { id: 'sc.cells', name: 'Cells', icon: 'cells', tier: 'intermediate', requires: ['sc.bio'], state: lock, percent: 0, xp: 1900,
      desc: 'The smallest thing that counts as alive, and the compartments inside it that each do a job. Following one molecule through the whole process beats memorising the diagram.' },
    { id: 'sc.genetics', name: 'Genetics', icon: 'dna', tier: 'advanced', requires: ['sc.cells'], recommends: ['sc.chem'], state: lock, percent: 0, xp: 2400,
      desc: 'The instructions a cell copies and passes on, and what happens when the copy is imperfect. DNA to RNA to protein is the sequence everything else in the subject hangs from.' },
    { id: 'sc.evolution', name: 'Evolution', icon: 'branch', tier: 'advanced', requires: ['sc.genetics'], state: lock, percent: 0, xp: 2300,
      desc: 'Variation, inheritance and differential survival — three simple facts whose consequence is every living thing. The common misreading is treating it as directed toward something.' },
    { id: 'sc.ecology', name: 'Ecology', icon: 'network', tier: 'intermediate', requires: ['sc.bio'], state: lock, percent: 0, xp: 1900,
      desc: 'How organisms interact with each other and their surroundings. Energy thins out dramatically at each step up a food chain, which explains most of the shape of an ecosystem.' },
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
