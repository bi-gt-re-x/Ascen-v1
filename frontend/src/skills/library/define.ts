/**
 * The shorthand every domain file is written in.
 *
 * A `SkillNode` is a dozen fields and eight of them are the same for every node
 * in a file. Written out longhand, a domain would be a paragraph per skill and
 * nobody would read it to check whether a prerequisite was right — which is the
 * one thing the library actually needs to be reviewable for. So the category,
 * the default subcategory and the metadata come from the domain, hours arrive as
 * hours, and a node is a line or two.
 *
 * This is a convenience and not a second model: `defineDomain` returns plain
 * `SkillNode` objects with every field filled, and nothing downstream knows the
 * shorthand exists.
 */
import type {
  Prerequisite,
  SkillCategory,
  SkillNode,
  SkillNodeSpec,
  TimeSpan,
} from '../types';
import { NONE } from '../types';

const hoursToSpan = (hours: [number, number] | number | undefined): TimeSpan => {
  if (hours === undefined) return { minMinutes: 60, maxMinutes: 120 };
  if (typeof hours === 'number') return { minMinutes: hours * 60, maxMinutes: hours * 60 };
  return { minMinutes: hours[0] * 60, maxMinutes: hours[1] * 60 };
};

export interface DomainOptions {
  category: SkillCategory;
  /** Used by any node that does not name its own. */
  subcategory: string;
}

/**
 * Open a domain file. Returns the `node` writer that file uses throughout.
 *
 * The writer is deliberately not variadic over an array: one call per node keeps
 * a diff on one skill to one hunk, which is what makes the library reviewable as
 * it grows past what one person can hold in their head.
 */
export function defineDomain({ category, subcategory }: DomainOptions) {
  return function node(spec: SkillNodeSpec): SkillNode {
    const prerequisites: Prerequisite = spec.prerequisites ?? NONE;
    return {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      category,
      subcategory: spec.subcategory ?? subcategory,
      difficulty: spec.difficulty,
      xpReward: spec.xpReward,
      prerequisites,
      tags: spec.tags,
      estimatedTime: hoursToSpan(spec.hours),
      skillType: spec.skillType,
      metadata: {
        source: 'library',
        version: 1,
        ...spec.metadata,
      },
    };
  };
}

/** "2–4 hours", "45 minutes". One place, so no two screens round differently. */
export function formatTime({ minMinutes, maxMinutes }: TimeSpan): string {
  const one = (minutes: number) =>
    minutes < 60
      ? `${minutes} min`
      : minutes % 60 === 0
        ? `${minutes / 60} hr`
        : `${(minutes / 60).toFixed(1)} hr`;
  if (minMinutes === maxMinutes) return one(minMinutes);
  const low = minMinutes < 60 && maxMinutes < 60 ? `${minMinutes}` : one(minMinutes).replace(/ (min|hr)$/, '');
  return `${low}–${one(maxMinutes)}`;
}
