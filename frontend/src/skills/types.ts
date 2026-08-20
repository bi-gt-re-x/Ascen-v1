/**
 * What a skill *is* — the permanent half of the system.
 *
 * ## The three things this architecture keeps apart
 *
 *     a node          "Binary Search exists, and here is what it is"
 *     a relationship  "Binary Search depends on Arrays, Sorting and Complexity"
 *     a generated tree "here is how Binary Search appears in this person's
 *                      competitive-programming progression"
 *
 * This file and skills/library define the first. skills/graph derives the second
 * from the first. skills/generate produces the third and stores none of it back.
 * Nothing in a generated tree is authoritative and nothing in the library knows
 * a tree exists — which is what lets one library grow a hundred different trees,
 * and what stops a change to one person's progression editing the definition of
 * a skill for everybody.
 *
 * ## Nodes are atomic
 *
 * "Loops", not "Learn Python". The whole value of the library is that
 * `programming.functions` is *one node* that a Python path, a competitive
 * programming path, a data-science path and a backend path all point at. Two
 * nodes called Python Functions in two categories would be the end of that, and
 * the fastest way to get there is to author a node for a course rather than for
 * a skill.
 *
 * ## Prerequisites are a rule, not a list
 *
 * `prerequisites` is a tree of rules — ALL of, ANY of, N of — rather than an
 * array, because a list can only express one of those and two of the three are
 * real. Advanced Visualisation wants Matplotlib *or* Plotly; Advanced Algorithms
 * wants three of five foundations, and which three is the reader's business. See
 * `Prerequisite` below, and `evaluate` in skills/graph.
 *
 * ## What is deliberately not stored
 *
 * **`unlocks`.** It is every node whose prerequisite rule names this one, which
 * makes it a query rather than a field — `graph.unlocks(id)`. Stored on both
 * ends it would be two records of one fact, free to disagree, and the first
 * disagreement would be silent. The same reasoning the Records timeline uses for
 * its edges.
 *
 * **Anything about a person.** No progress, no completion, no ordering. A node
 * is the same node for every account; where somebody stands against it belongs
 * to the generated tree, and completion belongs to a phase after this one.
 */

/**
 * The progression ladder, foundation first.
 *
 * Six rather than the four the renderer opened with, because a library needs
 * room between "you have never done this" and "this is the hard version of it"
 * that a four-rung ladder does not leave. Difficulty *influences* generation and
 * never overrides it: see the ordering rule in skills/generate — a node's
 * prerequisites decide where it can go, and difficulty only decides between
 * nodes that could equally go next.
 */
export const DIFFICULTY_ORDER = [
  'foundation',
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'mastery',
] as const;

export type Difficulty = (typeof DIFFICULTY_ORDER)[number];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  foundation: 'Foundation',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
  mastery: 'Mastery',
};

/** Where a difficulty sits, 0-5. Used to break ties, never to order outright. */
export const difficultyRank = (difficulty: Difficulty): number =>
  DIFFICULTY_ORDER.indexOf(difficulty);

/**
 * The domains the library is filed under.
 *
 * Adding an eleventh is this array plus a file in skills/library that exports an
 * array of nodes, plus one line in that folder's index. Nothing else in the
 * system enumerates categories — the goal picker, the filters and the generator
 * all read what the nodes actually carry.
 */
export const CATEGORIES = [
  'Mathematics',
  'Programming',
  'Computer Science',
  'AI / Machine Learning',
  'Fitness',
  'Music',
  'Productivity',
  'Chess',
  'Science',
  'Writing',
] as const;

export type SkillCategory = (typeof CATEGORIES)[number];

/**
 * What kind of thing the node is, which is not the same as how hard it is.
 *
 * It exists because a progression made entirely of `concept` is a reading list.
 * A generator that wants to put something to *do* after every three things to
 * know needs to be able to tell them apart, and a later phase almost certainly
 * will.
 */
export type SkillType =
  /** An idea you understand: recursion, big-O, key signatures. */
  | 'concept'
  /** A move you can execute: a fork, a two-pointer sweep, a shifted bow. */
  | 'technique'
  /** A specific thing you can drive: NumPy, git, a metronome. */
  | 'tool'
  /** Something you do repeatedly rather than finish: sight-reading, tactics. */
  | 'practice'
  /** Something you build once and have: a first backend, a first model. */
  | 'project';

/** An hours range, held in minutes so the formatting is one function's problem. */
export interface TimeSpan {
  minMinutes: number;
  maxMinutes: number;
}

// ---------------------------------------------------------------------------
// Prerequisites
// ---------------------------------------------------------------------------
/**
 * A prerequisite rule.
 *
 * Nested rather than flat: an option inside an ANY may itself be an ALL, so
 * "Arrays and Sorting and (Matplotlib or Plotly)" is expressible without a new
 * kind. Adding a kind — "all of these within the last N days", "any two from
 * each of two groups" — is a variant here and an entry in the evaluator table in
 * skills/graph, and nothing else in the system has a switch over rule kinds.
 */
export type Prerequisite =
  /** Nothing comes first. The roots of every tree. */
  | { kind: 'none' }
  /** Every one of them. */
  | { kind: 'all'; of: PrerequisiteRef[] }
  /** At least one of them. */
  | { kind: 'any'; of: PrerequisiteRef[] }
  /** At least `need` of them, and which ones is the reader's business. */
  | { kind: 'threshold'; need: number; of: PrerequisiteRef[] };

/** Either a node id, or another rule nested inside this one. */
export type PrerequisiteRef = string | Prerequisite;

export const NONE: Prerequisite = { kind: 'none' };
export const all = (...of: PrerequisiteRef[]): Prerequisite => ({ kind: 'all', of });
export const any = (...of: PrerequisiteRef[]): Prerequisite => ({ kind: 'any', of });
export const threshold = (need: number, ...of: PrerequisiteRef[]): Prerequisite => ({
  kind: 'threshold',
  need,
  of,
});
/** The common case, spelled short: one required node. */
export const after = (...ids: string[]): Prerequisite =>
  ids.length === 0 ? NONE : { kind: 'all', of: ids };

// ---------------------------------------------------------------------------
// The node
// ---------------------------------------------------------------------------
/**
 * Where a node came from, and what may rewrite it.
 *
 * `source` is the hook the AI phase hangs on. A generator that proposes a skill
 * the library does not have can mint it as `source: 'ai'` and it renders like
 * anything else — but it is visibly not `'library'`, so a review pass can find
 * every one of them, and the authored graph stays the thing of record. That is
 * the whole of "AI participates in generation without becoming the source of
 * truth": one field, and everything downstream can tell the difference.
 */
export interface NodeMetadata {
  source: 'library' | 'ai' | 'user';
  /** Bumped when the meaning of the node changes, not when a typo is fixed. */
  version: number;
  /** Free notes for whoever maintains the entry. Never shown to a reader. */
  notes?: string;
}

export interface SkillNode {
  /**
   * Stable, unique, and never the display name.
   *
   * `domain.slug`, lowercase, hyphenated: `algorithms.binary-search`. The prefix
   * is a namespace and not a category — `algorithms.*` nodes are filed under
   * Computer Science — because renaming a category should not rewrite an id, and
   * an id that has to change is an id that was describing presentation.
   */
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  /** The heading inside the category: "Algorithms", "Bowing", "Endgames". */
  subcategory: string;
  difficulty: Difficulty;
  /** What finishing it is worth. Sized against the difficulty ladder. */
  xpReward: number;
  prerequisites: Prerequisite;
  /** Free-form, lowercase. What makes a node relevant to a goal. */
  tags: string[];
  estimatedTime: TimeSpan;
  skillType: SkillType;
  metadata: NodeMetadata;
}

/**
 * What a library file writes. Everything a domain shares is filled in for it.
 *
 * See `defineDomain` in skills/library/define — the category, the default
 * subcategory and the metadata are the domain's, so the file holds one line per
 * skill rather than one paragraph per skill.
 */
export interface SkillNodeSpec
  extends Omit<SkillNode, 'category' | 'metadata' | 'prerequisites' | 'estimatedTime' | 'subcategory'> {
  subcategory?: string;
  prerequisites?: Prerequisite;
  /** Hours, as a pair or a single figure: `[2, 4]` or `3`. */
  hours?: [number, number] | number;
  metadata?: Partial<NodeMetadata>;
}
