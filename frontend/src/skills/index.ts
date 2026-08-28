/**
 * The skill system: a library of what skills exist, the graph of what depends on
 * what, and an engine that grows a progression toward a goal out of both.
 *
 *     skills/types      what a skill is, and what a prerequisite rule is
 *     skills/library    the nodes themselves, one file per domain
 *     skills/graph      the derived relationships, and rule evaluation
 *     skills/goals      what somebody might be trying to do
 *     skills/generate   goal + person → a generated tree
 *
 * Nothing here draws anything, and nothing consumes `generateTree` yet: the
 * step that turns a `GeneratedTree` into the renderer's `SkillGraph` has not
 * been written. `graphFromSubjectTree` in skills/subjectTrees is the same
 * conversion for authored trees and is the shape to copy when it is.
 */
export * from './types';
export * from './graph';
export * from './goals';
export * from './generate';
export { ALL_NODES, skillLibrary, skillNode, skillName } from './library';
