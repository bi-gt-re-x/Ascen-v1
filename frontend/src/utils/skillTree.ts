/**
 * A skill tree per subject, built only out of things the account recorded.
 *
 * `SkillsChapter` states the case against this page and it is worth repeating
 * here, because this is the file that has to answer it: a skill tree with
 * locked branches, prerequisites and invented levels would look wonderful and
 * mean nothing. The account stores no skill graph. There is no talent the
 * reader can spend a point on, no build to choose, and any tree offering those
 * would be a game bolted onto a record of study rather than a reading of it.
 *
 * What there *is*: a subject on every finished task, an XP value on it, and the
 * day it was finished. Three quantities, and each of them answers a different
 * question about how somebody is getting good at something —
 *
 *   **Depth** — lifetime XP in the subject, on the mastery ladder in
 *   utils/mastery. How far into it you have gone.
 *   **Output** — finished tasks filed under it. How much you have actually
 *   shipped, which is not the same thing: one enormous task and thirty small
 *   ones can carry identical XP.
 *   **Rhythm** — distinct days with a finished task in it. Whether the subject
 *   is a habit or a fortnight you had once.
 *
 * So the tree branches three ways, every node is a threshold crossed on one of
 * those three, and a locked node prints the number that opens it. Nothing here
 * is spent, chosen or assigned; the reader cannot build a character. They can
 * see which of the three they are furthest along and which one their next hour
 * moves, which is the honest version of what a skill tree is for.
 *
 * **A locked node is never a failure.** Most subjects on most accounts open one
 * or two nodes a branch, and the twelve above them are the shape of the thing
 * rather than a scolding — the same reason the difficulty grid on the Overview
 * draws all twenty-five cells. A tree that only drew what had been reached
 * would be a list of achievements, and the app already has one of those.
 */
import type { Subject } from '@/services/subjects';
import type { Task } from '@/types';
import { TIERS, masteryLevel, xpToReach, type MasteryLevel } from './mastery';

const num = (value: unknown) => Number(value) || 0;

export type BranchKey = 'depth' | 'output' | 'rhythm';

export interface TreeNode {
  id: string;
  /** What the node is called. "Apprentice", "Ten finished". */
  name: string;
  /** The measure's value this node opens at. */
  need: number;
  /** Whether the account has crossed it. */
  unlocked: boolean;
  /**
   * Progress from the node before it to this one, 0-100.
   *
   * Measured between the two thresholds rather than from zero, so the bar under
   * a node answers "how far to the next one" rather than "how far into the
   * whole branch" — which the row of nodes already shows.
   */
  percent: number;
  /** The first locked node in the branch: the one being worked toward. */
  next: boolean;
  /** What is still needed, in the branch's own unit. Zero once unlocked. */
  remaining: number;
}

export interface TreeBranch {
  key: BranchKey;
  name: string;
  /** One line saying what is being counted, printed under the branch name. */
  measure: string;
  /** "XP", "tasks", "days" — for the numbers beside a node. */
  unit: string;
  /** Where the account stands on this branch's measure. */
  have: number;
  nodes: TreeNode[];
  /** How many of this branch's nodes are open. */
  unlocked: number;
}

export interface SkillTree {
  /** The subject id. */
  key: string;
  /** The short form a pill prints. */
  label: string;
  /** The full name. */
  name: string;
  /**
   * Which of the catalogue's nine groups the subject sits in.
   *
   * The category column on the page is built from these rather than from a
   * list of its own — see backend/config/subjects.py, where the groups were
   * section comments until this page needed them to be data.
   */
  group: string;
  /** The icon file under /static/icons, where the catalogue has one. */
  icon?: string;
  xp: number;
  tasks: number;
  days: number;
  /** The subject's place on the mastery ladder. Same ladder the Subjects tab uses. */
  level: MasteryLevel;
  /** The last day a task in this subject was finished, or null. */
  lastOn: string | null;
  branches: TreeBranch[];
  unlocked: number;
  total: number;
}

/**
 * The five rungs the Depth branch draws, by mastery tier.
 *
 * The first five bands of the ladder in utils/mastery, which is 21 bands and
 * 100 levels long. Five because a branch a reader can take in at a glance is
 * worth more than a complete one: Skilled is level 21 and roughly 4,400 XP in
 * one subject, which is further than most accounts will get in a year, and the
 * bands above it are on the Subjects tab for anyone who wants the whole climb.
 */
const DEPTH_TIERS = TIERS.slice(0, 5);

/** Finished tasks in the subject. Chosen to land roughly a season apart. */
const OUTPUT_STEPS = [1, 5, 15, 40, 100];

/** Distinct days with a finished task in the subject. */
const RHYTHM_STEPS = [1, 7, 21, 50, 120];

const OUTPUT_NAMES = ['Started', 'Getting somewhere', 'A body of work', 'Prolific', 'A hundred deep'];
const RHYTHM_NAMES = ['First day', 'A week of days', 'A habit', 'A season', 'Part of your life'];

/**
 * One branch, from its thresholds and where the account actually is.
 *
 * `percent` on each node is measured from the threshold below it, so the bar
 * under the node being worked toward is the distance still to cover rather
 * than the share of the whole branch. Nodes already open sit at 100 and nodes
 * beyond the next one at 0 — a node two steps away has no meaningful progress
 * toward it yet, and drawing one would be arithmetic pretending to be news.
 */
function branch(
  key: BranchKey,
  name: string,
  measure: string,
  unit: string,
  have: number,
  steps: number[],
  names: string[],
): TreeBranch {
  let nextTaken = false;
  const nodes = steps.map((need, index) => {
    const unlocked = have >= need;
    const floor = index === 0 ? 0 : steps[index - 1]!;
    const isNext = !unlocked && !nextTaken;
    if (isNext) nextTaken = true;
    return {
      id: `${key}-${index}`,
      name: names[index] ?? `Step ${index + 1}`,
      need,
      unlocked,
      percent: unlocked
        ? 100
        : isNext
          ? Math.max(0, Math.min(100, ((have - floor) / Math.max(1, need - floor)) * 100))
          : 0,
      next: isNext,
      remaining: unlocked ? 0 : Math.max(0, need - have),
    };
  });

  return {
    key,
    name,
    measure,
    unit,
    have,
    nodes,
    unlocked: nodes.filter((node) => node.unlocked).length,
  };
}

/**
 * One tree per subject the account has finished work in, deepest first.
 *
 * Unfiled tasks get no tree, for the same reason they get no card on the
 * Subjects tab: they are XP with nothing to say about what it was for, and a
 * tree called "Other" would be the biggest one on most accounts and the least
 * meaningful. `unfiledTasks` below is what the page says about them instead.
 */
export function skillTrees(tasks: Task[], subjects: Map<string, Subject>): SkillTree[] {
  interface Bucket {
    label: string;
    name: string;
    group: string;
    icon?: string;
    xp: number;
    tasks: number;
    days: Set<string>;
    lastOn: string | null;
  }

  const buckets = new Map<string, Bucket>();

  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    const day = (task.completed_at || '').slice(0, 10);
    if (!day) return;
    const subject = (task.subject && subjects.get(task.subject)) || null;
    if (!subject) return;

    const bucket = buckets.get(subject.id) ?? {
      label: subject.label,
      name: subject.name,
      // Older builds of /api/subjects did not send a group. An empty one lands
      // in "Uncategorised" on the page rather than throwing the tree away.
      group: subject.group || 'Uncategorised',
      ...(subject.icon ? { icon: subject.icon } : {}),
      xp: 0,
      tasks: 0,
      days: new Set<string>(),
      lastOn: null,
    };

    bucket.xp += num(task.xp_value);
    bucket.tasks += 1;
    bucket.days.add(day);
    if (!bucket.lastOn || day > bucket.lastOn) bucket.lastOn = day;
    buckets.set(subject.id, bucket);
  });

  const trees: SkillTree[] = [];
  buckets.forEach((bucket, key) => {
    const branches: TreeBranch[] = [
      branch(
        'depth',
        'Depth',
        'Lifetime XP filed under this subject, on the mastery ladder.',
        'XP',
        bucket.xp,
        DEPTH_TIERS.map((tier) => xpToReach(tier.from)),
        DEPTH_TIERS.map((tier) => tier.name),
      ),
      branch(
        'output',
        'Output',
        'Tasks you actually finished in it. Not the same as XP — one big task and thirty small ones can weigh the same.',
        'tasks',
        bucket.tasks,
        OUTPUT_STEPS,
        OUTPUT_NAMES,
      ),
      branch(
        'rhythm',
        'Rhythm',
        'Separate days with a finished task in it. Whether the subject is a habit or a fortnight you had once.',
        'days',
        bucket.days.size,
        RHYTHM_STEPS,
        RHYTHM_NAMES,
      ),
    ];

    trees.push({
      key,
      label: bucket.label,
      name: bucket.name,
      group: bucket.group,
      ...(bucket.icon ? { icon: bucket.icon } : {}),
      xp: bucket.xp,
      tasks: bucket.tasks,
      days: bucket.days.size,
      level: masteryLevel(bucket.xp),
      lastOn: bucket.lastOn,
      branches,
      unlocked: branches.reduce((sum, entry) => sum + entry.unlocked, 0),
      total: branches.reduce((sum, entry) => sum + entry.nodes.length, 0),
    });
  });

  return trees.sort((a, b) => b.xp - a.xp || b.tasks - a.tasks);
}

/** Finished tasks carrying no subject — the XP that could not grow a tree. */
export function unfiledTasks(tasks: Task[], subjects: Map<string, Subject>): {
  count: number;
  xp: number;
} {
  let count = 0;
  let xp = 0;
  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    if (task.subject && subjects.has(task.subject)) return;
    count += 1;
    xp += num(task.xp_value);
  });
  return { count, xp };
}

// --------------------------------------------------------------------------
// Categories, and the trunk the branches come off
// --------------------------------------------------------------------------
export interface TreeCategory {
  /** The group's name, or '' for the everything view. */
  key: string;
  label: string;
  /** Trees this category holds. */
  count: number;
}

/**
 * The column down the left of the tree: "All Skills", then what you have.
 *
 * Built from the trees rather than from the catalogue's nine groups, and that
 * is the same rule the recommendations page's category chips follow: an
 * account with work in two groups should see two, because seven greyed-out
 * ones say nothing except that the app has a taxonomy.
 */
export function treeCategories(trees: SkillTree[]): TreeCategory[] {
  const counts = new Map<string, number>();
  trees.forEach((tree) => counts.set(tree.group, (counts.get(tree.group) ?? 0) + 1));
  return [
    { key: '', label: 'All Skills', count: trees.length },
    ...[...counts.entries()].map(([key, count]) => ({ key, label: key, count })),
  ];
}

export interface TreeRoot {
  /** "All Skills", or the category's name. */
  label: string;
  /** What the level under it was counted from, in words. */
  measure: string;
  xp: number;
  tasks: number;
  level: MasteryLevel;
  subjects: number;
  nodes: number;
  total: number;
}

/**
 * The node everything hangs off: the whole view, summed.
 *
 * Its level is the same mastery ladder a subject uses, read on the XP of every
 * subject in view — so the root of a one-subject category is that subject's own
 * level, and the root of "All Skills" is higher than any branch under it. That
 * is arithmetic rather than a rank: the root is not a thing you are good at,
 * it is the total of the things you are, and `measure` is printed under it so
 * nobody reads it as a second account level. The account's real level is on
 * the rail, counted on a different ladder — see utils/mastery.
 */
export function treeRoot(trees: SkillTree[], label: string): TreeRoot {
  const xp = trees.reduce((sum, tree) => sum + tree.xp, 0);
  return {
    label,
    measure: `${trees.length} ${trees.length === 1 ? 'subject' : 'subjects'} with finished work`,
    xp,
    tasks: trees.reduce((sum, tree) => sum + tree.tasks, 0),
    level: masteryLevel(xp),
    subjects: trees.length,
    nodes: trees.reduce((sum, tree) => sum + tree.unlocked, 0),
    total: trees.reduce((sum, tree) => sum + tree.total, 0),
  };
}

/**
 * Distinct days with a finished task in any of these subjects.
 *
 * The one figure the trees cannot be summed for — a day carrying three
 * subjects is one day, and adding three per-subject counts would report it as
 * three. Recomputed from the tasks instead, which is cheap and cannot be
 * wrong. See the note in `treeRoot`.
 */
export function daysAcross(
  tasks: Task[],
  subjects: Map<string, Subject>,
  keys: Set<string>,
): number {
  const days = new Set<string>();
  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    if (!task.subject || !keys.has(task.subject) || !subjects.has(task.subject)) return;
    const day = (task.completed_at || '').slice(0, 10);
    if (day) days.add(day);
  });
  return days.size;
}

export interface TreeTotals {
  trees: number;
  unlocked: number;
  total: number;
  /** The subject furthest up the mastery ladder, or null with no trees. */
  deepest: SkillTree | null;
  /** The one with the most nodes still to open below its next threshold. */
  closest: { tree: SkillTree; branch: TreeBranch; node: TreeNode } | null;
}

/**
 * The strip across the top of the page.
 *
 * `closest` is the one figure here that is a recommendation rather than a
 * count, and it is picked by remaining work in the branch's own unit — so a
 * subject four tasks from a node beats one two thousand XP from a tier. The
 * units are not comparable and the page says which unit it is quoting rather
 * than pretending they are.
 */
export function treeTotals(trees: SkillTree[]): TreeTotals {
  if (trees.length === 0) {
    return { trees: 0, unlocked: 0, total: 0, deepest: null, closest: null };
  }

  let closest: TreeTotals['closest'] = null;
  trees.forEach((tree) => {
    tree.branches.forEach((entry) => {
      const node = entry.nodes.find((candidate) => candidate.next);
      if (!node) return;
      // Compared as a share of the step rather than as a raw remainder: "40% of
      // the way to the next node" means the same thing on all three branches,
      // where "four away" means nothing across XP, tasks and days.
      if (!closest || node.percent > closest.node.percent) {
        closest = { tree, branch: entry, node };
      }
    });
  });

  return {
    trees: trees.length,
    unlocked: trees.reduce((sum, tree) => sum + tree.unlocked, 0),
    total: trees.reduce((sum, tree) => sum + tree.total, 0),
    deepest: [...trees].sort((a, b) => b.level.exact - a.level.exact)[0] ?? null,
    closest,
  };
}
