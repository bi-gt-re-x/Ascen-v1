/**
 * One node on the canvas.
 *
 * Positioned by the tree, not by itself: `x`/`y` arrive already worked out in
 * canvas units by `layoutGraph`, and the node's only job is to draw a box of
 * the agreed size at them. That is what lets the same component sit in a graph
 * of nine nodes or nine hundred without either the node or the layout knowing
 * how many there are.
 *
 * ## The four states say different things, not the same thing in four colours
 *
 * A card that only changed hue would be a legend nobody read. So each state
 * prints the line that is actually useful in it:
 *
 *     locked      what opens it — the number, never a padlock and a shrug
 *     available   how hard it is, and that nothing is in the way
 *     progress    where you are against where you need to be, and a bar
 *     complete    the date, when the record has one
 *
 * The badge and the difficulty pips carry the state in shape as well as colour;
 * see NodeStatusBadge for why that is not optional.
 */
import { GEOM, DIFFICULTY_LABEL, DIFFICULTIES, type GraphNode } from '@/utils/skillGraph';
import { NodeStatusBadge } from './NodeStatusBadge';
import { ProgressIndicator } from './ProgressIndicator';
import type { CSSProperties } from 'react';

const number = (value: number) => Math.round(value).toLocaleString();

/** "Aug 12, 2026". Built from parts — a bare YYYY-MM-DD parses as UTC. */
function day(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Four pips, filled to the tier. The difficulty indicator, small on purpose. */
function Pips({ node }: { node: GraphNode }) {
  const level = DIFFICULTIES.indexOf(node.difficulty) + 1;
  return (
    <span className="stx-pips" title={DIFFICULTY_LABEL[node.difficulty]}>
      <span className="stx-sr">{DIFFICULTY_LABEL[node.difficulty]}</span>
      {DIFFICULTIES.map((tier, index) => (
        <i key={tier} className={index < level ? 'is-on' : ''} aria-hidden="true" />
      ))}
    </span>
  );
}

export interface SkillNodeProps {
  node: GraphNode;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (node: GraphNode) => void;
}

export function SkillNode({ node, x, y, selected, onSelect }: SkillNodeProps) {
  const style = {
    left: x,
    top: y,
    width: GEOM.nodeW,
    minHeight: GEOM.nodeH,
  } as CSSProperties;

  const done = node.status === 'complete';
  const meta =
    node.status === 'progress'
      ? `${number(node.have)} / ${number(node.need)} ${node.unit}`
      : done
        ? node.on
          ? day(node.on)
          : 'Complete'
        : node.gate;

  return (
    <button
      type="button"
      className={`stx-node is-${node.status}${node.secondary ? ' is-secondary' : ''}${selected ? ' is-selected' : ''}`}
      style={style}
      aria-pressed={selected}
      onClick={() => onSelect(node)}
    >
      <span className="stx-node-top">
        <NodeStatusBadge status={node.status} compact />
        <span className="stx-node-name" title={node.name}>
          {node.name}
        </span>
        {node.xp > 0 && <span className="stx-node-xp">{number(node.xp)} XP</span>}
      </span>

      <span className="stx-node-meta">
        <Pips node={node} />
        <span className="stx-node-gate" title={meta}>
          {meta}
        </span>
      </span>

      {/* The bar is the one thing not drawn in every state. On a locked node it
          would be a flat track saying nothing, and on a complete one a full
          track saying what the tick already said. */}
      {(node.status === 'progress' || node.status === 'available') && (
        <ProgressIndicator percent={node.percent} shape="bar" />
      )}
    </button>
  );
}
