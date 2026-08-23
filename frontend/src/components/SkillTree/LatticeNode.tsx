/**
 * One tile on a subject lattice.
 *
 * The compact counterpart to {@link SkillNode}: where that draws a labelled
 * card, this draws a square the size of an icon with the skill's name under it.
 * The square itself stays empty — that is where the icon lands in a later part —
 * so the name is what identifies a tile until then, and it sits *outside* the
 * square rather than inside it: a 64px box cannot hold "Algorithms & Data
 * Structures" at a readable size, and the lattice's shape is the tiles, which
 * the label must not be allowed to push apart.
 *
 * A **navigation** tile is the one exception to "a node is a skill": it is a
 * diamond rather than a square, and clicking it walks into the child subject it
 * names rather than selecting anything. The page hands that behaviour in through
 * `onNavigate`; the tile only knows to draw itself differently and call it.
 *
 * Placement, size and state come from the layout and the graph exactly as they
 * do for the card node — this component owns none of it.
 */
import type { CSSProperties } from 'react';
import type { GraphNode, PlacedNode } from '@/utils/skillGraph';

export interface LatticeNodeProps {
  placed: PlacedNode;
  /** Node width/height, from the lattice geometry. */
  size: number;
  selected: boolean;
  onSelect: (node: GraphNode | null) => void;
  /** Present when the tile opens a child subject rather than a skill. */
  onNavigate?: () => void;
  /** The small corner figure, as in the reference lattice. */
  rank?: number;
}

export function LatticeNode({ placed, size, selected, onSelect, onNavigate, rank }: LatticeNodeProps) {
  const { node, x, y } = placed;
  const nav = Boolean(onNavigate);

  const style = {
    left: x,
    top: y,
    width: size,
    height: size,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`stx-tile is-${node.status}${nav ? ' is-nav' : ''}${selected ? ' is-selected' : ''}`}
      style={style}
      aria-pressed={nav ? undefined : selected}
      aria-label={nav ? `Open ${node.name}` : node.name}
      title={nav ? `${node.name} →` : node.name}
      onClick={() => (nav ? onNavigate?.() : onSelect(node))}
    >
      {/* The face. Empty for now — the icon lands here later. */}
      <span className="stx-tile-face" aria-hidden="true" />
      {rank ? (
        <span className="stx-tile-rank" aria-hidden="true">
          {rank}
        </span>
      ) : null}
      {/* Hidden from the accessibility tree because the button already carries
          the name in `aria-label`; announcing it twice is worse than not
          drawing it at all. */}
      <span className="stx-tile-name" aria-hidden="true">
        {node.name}
      </span>
    </button>
  );
}
