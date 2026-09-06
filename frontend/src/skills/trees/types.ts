/**
 * What one lattice is made of — the vocabulary every file in this folder writes
 * in, and nothing else.
 *
 * This module holds the shape and the four status shorthands, and deliberately
 * imports nothing from `skills/subjectTrees` above it: the trees are the data
 * and `subjectTrees` is the catalogue and the conversion to the renderer's
 * model, so the dependency runs one way — a tree file knows what a node is and
 * knows nothing about the page that draws it, or about the other forty trees it
 * sits beside.
 *
 * The prose in `skills/subjectTrees` explains *why* the model is this shape;
 * this file is the shape itself.
 */
import type { Difficulty } from '../types';
import type { NodeStatus } from '@/utils/skillGraph';

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
  /**
   * Which of the subject catalogue's nine groups this belongs to, on a root.
   *
   * Roots only: a child tree is inside whatever group its root is in, and
   * repeating it on the child would be the same fact written twice. The value
   * matches a name in `GROUPS` in backend/config/subjects.py, because the
   * switcher across the top of the page files the subjects under exactly those
   * headings and two hand-written lists of nine would drift within a month.
   */
  group?: string;
  nodes: SubjectNode[];
}

/* The four states, spelled short. Every tree file in this folder writes
   `state: done` rather than `state: 'complete'`, which is what keeps a node to
   one line plus its description. */
export const done: NodeStatus = 'complete';
export const prog: NodeStatus = 'progress';
export const open: NodeStatus = 'available';
export const lock: NodeStatus = 'locked';
