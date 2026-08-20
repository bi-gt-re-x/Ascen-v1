/**
 * What a node is, once you have clicked it.
 *
 * One component, two presentations, and the difference is CSS: it is a column
 * beside the canvas on a wide screen and a sheet over the bottom of it on a
 * narrow one. Not two components and not a portal — the content is identical,
 * the only thing that changes is where the box is, and a second implementation
 * would be a second place for the prerequisite list to drift.
 *
 * ## Prerequisites and unlocks are read from the graph, not from the node
 *
 * A node states what it `requires`; nothing states what it opens. That is the
 * right way round to store it — one edge, written once — so "Unlocks" is the
 * same edges read backwards, which is `unlockedBy`. Both lists are clickable
 * and select the node they name, which is what turns the panel from a caption
 * into the way you walk the tree.
 *
 * ## Lines that would be empty are absent
 *
 * A completion date the record does not have, an XP figure that is zero, a
 * prerequisite list on a root: each is omitted rather than printed as "—". A
 * panel of dashes reads as a form that failed to load.
 */
import {
  DIFFICULTY_LABEL,
  STATUS_LABEL,
  requirementsOf,
  unlockedBy,
  type GraphNode,
  type SkillGraph,
} from '@/utils/skillGraph';
import { NodeStatusBadge } from './NodeStatusBadge';
import { ProgressIndicator } from './ProgressIndicator';

const number = (value: number) => Math.round(value).toLocaleString();

function day(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Links({
  title,
  nodes,
  onSelect,
}: {
  title: string;
  nodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <>
      <h3 className="stx-panel-title">{title}</h3>
      <ul className="stx-links">
        {nodes.map((node) => (
          <li key={node.id}>
            <button type="button" onClick={() => onSelect(node)}>
              <NodeStatusBadge status={node.status} compact />
              <span>{node.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export interface NodeDetailPanelProps {
  graph: SkillGraph;
  node: GraphNode | null;
  onSelect: (node: GraphNode) => void;
  onClose: () => void;
  /** The action button. Given no href, the button is not drawn. */
  action?: { label: string; href: string };
}

export function NodeDetailPanel({ graph, node, onSelect, onClose, action }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <aside className="stx-panel is-empty">
        <p className="stx-panel-hint">
          Pick a node to see what it needs, what it opens, and how far along it is.
        </p>
      </aside>
    );
  }

  const done = node.status === 'complete';

  return (
    <aside className="stx-panel" aria-live="polite">
      <header className="stx-panel-head">
        <NodeStatusBadge status={node.status} />
        <button type="button" className="stx-panel-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <h2 className="stx-panel-name">{node.name}</h2>
      <p className="stx-panel-kind">
        {DIFFICULTY_LABEL[node.difficulty]}
        {node.category && <> · {node.category}</>}
      </p>
      <p className="stx-panel-blurb">{node.blurb}</p>

      <div className="stx-panel-progress">
        <ProgressIndicator percent={node.percent} shape="ring" size={62} label />
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{STATUS_LABEL[node.status]}</dd>
          </div>
          <div>
            {/* Three labels, because one would be wrong in two of the states:
                a node still being worked at is not "opening at" its figure, it
                is standing somewhere below it. */}
            <dt>{done ? 'Reached at' : node.status === 'progress' ? 'Progress' : 'Opens at'}</dt>
            <dd>
              {number(node.have)} / {number(node.need)} {node.unit}
            </dd>
          </div>
          {node.xp > 0 && (
            <div>
              <dt>XP</dt>
              <dd>{number(node.xp)}</dd>
            </div>
          )}
          {done && node.on && (
            <div>
              <dt>Completed</dt>
              <dd>{day(node.on)}</dd>
            </div>
          )}
        </dl>
      </div>

      <Links title="Prerequisites" nodes={requirementsOf(graph, node)} onSelect={onSelect} />
      <Links title="Unlocks" nodes={unlockedBy(graph, node.id)} onSelect={onSelect} />

      {action && (
        <a className="stx-cta" href={action.href}>
          {action.label}
        </a>
      )}
    </aside>
  );
}
