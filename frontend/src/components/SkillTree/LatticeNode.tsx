/**
 * One tile on a subject lattice.
 *
 * The compact counterpart to {@link SkillNode}: where that draws a labelled
 * card, this draws a rounded square holding the skill's icon, with the name
 * under it and the percentage under that. Three pieces of a fixed size, so a
 * lattice of ninety of them still reads as a shape rather than as a paragraph.
 *
 * The icon is painted as a **CSS mask** rather than loaded as an image — see
 * utils/icons/tree_icons/README.md. That is what lets one file be grey on a
 * locked tile and green on a mastered one without a second copy of the drawing:
 * the alpha is the shape, and the colour is whatever the tile has decided.
 *
 * A **navigation** tile is the one exception to "a node is a skill": it is a
 * diamond rather than a square, and clicking it walks into the child subject it
 * names rather than selecting anything. The page hands that behaviour in
 * through `onNavigate`; the tile only knows to draw itself differently.
 *
 * Placement, size and state come from the layout and the graph exactly as they
 * do for the card node — this component owns none of it.
 */
import type { CSSProperties } from 'react';
import { iconUrl } from '@/skills/subjectTrees';
import { DIFFICULTY_LABEL, type GraphNode, type PlacedNode } from '@/utils/skillGraph';

export interface LatticeNodeProps {
  placed: PlacedNode;
  /** Node width/height, from the lattice geometry. */
  size: number;
  selected: boolean;
  onSelect: (node: GraphNode | null) => void;
  /** Present when the tile opens a child subject rather than a skill. */
  onNavigate?: () => void;
}

export function LatticeNode({ placed, size, selected, onSelect, onNavigate }: LatticeNodeProps) {
  const { node, x, y } = placed;
  const nav = Boolean(onNavigate);

  const style = {
    left: x,
    top: y,
    width: size,
    height: size,
    // Read by the mask rule in the stylesheet. A custom property rather than an
    // inline background, so the stylesheet keeps deciding how it is painted.
    ['--ico' as string]: `url(${iconUrl(node.icon)})`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`stx-tile is-${node.status} tier-${node.difficulty}${nav ? ' is-nav' : ''}${selected ? ' is-selected' : ''}`}
      style={style}
      aria-pressed={nav ? undefined : selected}
      aria-label={nav ? `Open ${node.name}` : node.name}
      title={nav ? `${node.name} →` : node.name}
      onClick={() => (nav ? onNavigate?.() : onSelect(node))}
    >
      <span className="stx-tile-face" aria-hidden="true">
        <i className="stx-ico" />
      </span>
      {/* Both are hidden from the accessibility tree: the button already
          carries the name in `aria-label`, and a percentage read out twice —
          once here, once in the panel — is noise rather than information. */}
      <span className="stx-tile-name" aria-hidden="true">
        {node.name}
      </span>
      {/* The tier is a fact about the skill, so every tile carries it —
          including the diamonds, where it says how deep the subject behind it
          goes. The percentage is about the reader and only appears where there
          is progress to report. */}
      <span className="stx-tile-meta" aria-hidden="true">
        <span className="stx-tile-tier">{DIFFICULTY_LABEL[node.difficulty]}</span>
        {!nav && <span className="stx-tile-pct">{Math.round(node.percent)}%</span>}
      </span>
    </button>
  );
}
