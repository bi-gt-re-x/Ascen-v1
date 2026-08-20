/**
 * A generated tree, in the shape the canvas draws.
 *
 * The last link in the chain skills/types describes: the library says what a
 * skill is, skills/generate says how it appears in this person's progression,
 * and this joins the two into the flat model the renderer takes. It is the only
 * file that knows both shapes, which is the same job utils/skillGraphFromTrees
 * does for the account's derived subject trees — two feeds, one canvas, and
 * neither of them visible to the other.
 *
 * ## The join is by id, and that is the point
 *
 * A `GeneratedNode` carries an id, a position, a status and nothing else about
 * the skill. Everything a reader sees — the name, the description, the tags, the
 * XP — is looked up in the library at draw time. So the same node appearing in
 * the competitive-programming tree and the machine-learning tree is not two
 * records that could drift; it is one record, read twice.
 *
 * ## What `have / need` means here
 *
 * The renderer's node model wants a figure and a target, because its other feed
 * measures XP and finished tasks. A library node has no such quantity — a skill
 * is not 40% learned in this phase — so the pair carries the thing that *is*
 * countable and is what the reader actually wants to know: how many of the
 * node's prerequisites are met, out of how many it needs. On a 3-of-5 that reads
 * "2 / 3 prerequisites", which is the honest reading of a threshold rule.
 *
 * `percent` follows from the same pair rather than being a progress figure, and
 * a complete node is 100 because it is complete. There is no in-progress state
 * anywhere in this file: progression is Part 3's, and inventing a percentage to
 * fill the gap would put a number on screen that nothing measured.
 */
import { describeRule, evaluate, ruleGroups, type SkillLibraryGraph } from '@/skills/graph';
import { formatTime } from '@/skills/library';
import { DIFFICULTY_LABEL } from '@/skills/types';
import type { GeneratedTree } from '@/skills/generate';
import type { GraphNode, SkillGraph } from './skillGraph';

/** How a node's skill type reads in the panel. */
const TYPE_LABEL: Record<string, string> = {
  concept: 'Concept',
  technique: 'Technique',
  tool: 'Tool',
  practice: 'Practice',
  project: 'Project',
};

export function graphFromGenerated(
  tree: GeneratedTree,
  library: SkillLibraryGraph,
  /** What the reader holds. Only used for the wording of the gate line. */
  held: ReadonlySet<string> = new Set(),
): SkillGraph {
  const inTree = new Set(tree.nodes.map((entry) => entry.id));
  const nameOf = (id: string) => library.nodes.get(id)?.name ?? id;

  const nodes: GraphNode[] = [];

  for (const placed of tree.nodes) {
    const skill = library.nodes.get(placed.id);
    // A generated tree naming a node the library does not have would be a bug in
    // the engine rather than in the content, and drawing a blank box would hide
    // it. Skipped, and the edges to it fall away with it — see `layoutGraph`,
    // which drops a requirement pointing at a node that is not present.
    if (!skill) continue;

    const result = evaluate(skill.prerequisites, held);
    const done = placed.status === 'complete';

    // Which choice, if any, this node's own rule is. Printed on the node so a
    // 3-of-5 does not read as five separate requirements.
    const groups = ruleGroups(skill.prerequisites);
    const choice = groups.find((group) => group.need < group.total);

    const gate = done
      ? 'Complete'
      : placed.status === 'available'
        ? DIFFICULTY_LABEL[skill.difficulty]
        : describeRule(skill.prerequisites, nameOf) || DIFFICULTY_LABEL[skill.difficulty];

    const facts: { label: string; value: string }[] = [
      { label: 'Time', value: formatTime(skill.estimatedTime) },
      { label: 'Type', value: TYPE_LABEL[skill.skillType] ?? skill.skillType },
    ];
    if (choice) {
      facts.push({ label: 'Choice', value: `${choice.need} of ${choice.total}` });
    }
    if (placed.optional) {
      facts.push({
        label: 'Required',
        value: placed.reason === 'branch' ? 'Optional branch' : 'One of a choice',
      });
    }

    nodes.push({
      id: placed.id,
      name: skill.name,
      blurb: skill.description,
      // The subcategory rather than the category: inside one generated tree the
      // category is very often the same on every node, and a filter whose every
      // option selects everything is not a filter. "Algorithms" and "Data
      // Structures" cut a competitive-programming tree usefully; "Computer
      // Science" does not.
      category: skill.subcategory,
      difficulty: skill.difficulty,
      status: placed.status,
      percent: done ? 100 : result.need === 0 ? 0 : (result.have / result.need) * 100,
      xp: skill.xpReward,
      have: done ? result.need : result.have,
      need: result.need,
      unit: result.need === 1 ? 'prerequisite' : 'prerequisites',
      on: '',
      requires: placed.prerequisites.filter((id) => inTree.has(id)),
      gate,
      facts,
      tags: skill.tags,
      // Everything the goal does not oblige you to do is drawn quieter — the
      // options on a choice and the branches off the path both. The panel says
      // which of the two it is; the canvas only needs to say "you could skip
      // this", and one treatment for both is what keeps that legible at a
      // distance.
      secondary: placed.optional,
    });
  }

  return { id: tree.id, name: tree.name, nodes };
}
