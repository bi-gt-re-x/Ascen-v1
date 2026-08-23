/**
 * What a lattice node is, once you have clicked it.
 *
 * The column beside the canvas: the skill's drawing and name, what kind of
 * thing it is and where it stands, a sentence about it, the progress and the XP
 * behind that progress, then the two lists that make the panel a way of walking
 * the tree rather than a caption — what this node opens, and what sits near it.
 *
 * ## Both lists are read from the graph, not from the node
 *
 * A node states what it `requires`; nothing states what it opens. That is the
 * right way round to store it — one edge, written once — so "Unlocks" is those
 * same edges read backwards, and "Related" is the node's own prerequisites plus
 * anything it merely recommends. Every row selects the node it names, which is
 * what turns the panel into navigation.
 *
 * ## Nothing empty is printed
 *
 * A list with no rows, an XP line on a node worth zero: each is absent rather
 * than drawn as a dash. A panel of dashes reads as a form that failed to load.
 */
import { iconUrl } from '@/skills/subjectTrees';
import {
  STATUS_LABEL,
  requirementsOf,
  unlockedBy,
  type GraphNode,
  type SkillGraph,
} from '@/utils/skillGraph';
import { ProgressIndicator } from './ProgressIndicator';

const number = (value: number) => Math.round(value).toLocaleString();

/** The skill's drawing, painted through the shared mask. */
function Ico({ icon, className }: { icon?: string; className: string }) {
  return <i className={className} style={{ ['--ico' as string]: `url(${iconUrl(icon)})` }} />;
}

function Rows({
  title,
  nodes,
  onSelect,
  showPercent,
}: {
  title: string;
  nodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
  /** Related skills print how far along they are; unlocks print a tick. */
  showPercent?: boolean;
}) {
  if (nodes.length === 0) return null;
  return (
    <section className="stx-lp-section">
      <h3>{title}</h3>
      <ul className="stx-lp-rows">
        {nodes.map((node) => (
          <li key={node.id}>
            <button type="button" className={`stx-lp-row is-${node.status}`} onClick={() => onSelect(node)}>
              <Ico icon={node.icon} className="stx-ico stx-lp-row-ico" />
              <span className="stx-lp-row-name">{node.name}</span>
              {showPercent ? (
                <span className="stx-lp-row-pct">{Math.round(node.percent)}%</span>
              ) : (
                <span className="stx-lp-row-tick" aria-hidden="true">
                  {node.status === 'complete' ? '✓' : ''}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface LatticePanelProps {
  graph: SkillGraph;
  node: GraphNode | null;
  onSelect: (node: GraphNode | null) => void;
  /** Shown when nothing is picked yet. */
  placeholder?: React.ReactNode;
}

export function LatticePanel({ graph, node, onSelect, placeholder }: LatticePanelProps) {
  if (!node) {
    return (
      <aside className="stx-lp is-empty">
        <div className="stx-lp-blank">{placeholder}</div>
      </aside>
    );
  }

  const opens = unlockedBy(graph, node.id);
  // Its own prerequisites first, then anything it suggests — the nodes a reader
  // would look at next in either direction.
  const near = [
    ...requirementsOf(graph, node),
    ...(node.recommends ?? [])
      .map((id) => graph.nodes.find((entry) => entry.id === id))
      .filter((entry): entry is GraphNode => Boolean(entry)),
  ];

  return (
    <aside className="stx-lp">
      <header className="stx-lp-head">
        <span className={`stx-lp-avatar is-${node.status}`}>
          <Ico icon={node.icon} className="stx-ico stx-lp-avatar-ico" />
        </span>
        <div>
          <h2>{node.name}</h2>
          <p className="stx-lp-badges">
            {node.tags?.map((tag) => (
              <span key={tag} className="stx-lp-badge is-kind">
                {tag}
              </span>
            ))}
            <span className={`stx-lp-badge is-state is-${node.status}`}>{STATUS_LABEL[node.status]}</span>
          </p>
        </div>
      </header>

      {node.blurb && <p className="stx-lp-blurb">{node.blurb}</p>}

      <section className={`stx-lp-progress is-${node.status}`}>
        <p className="stx-lp-line">
          <span>Progress</span>
          <b>{Math.round(node.percent)}%</b>
        </p>
        <ProgressIndicator percent={node.percent} shape="bar" />
        {node.need > 0 && (
          <p className="stx-lp-line stx-lp-xp">
            <span>XP Earned</span>
            <b>
              {number(node.have)} / {number(node.need)} XP
            </b>
          </p>
        )}
      </section>

      <Rows title="Unlocks" nodes={opens} onSelect={onSelect} />
      <Rows title="Related Skills" nodes={near} onSelect={onSelect} showPercent />

      <button type="button" className="stx-lp-cta" disabled={node.status === 'locked'}>
        <Ico icon="practice" className="stx-ico stx-lp-cta-ico" />
        {node.status === 'locked' ? 'Locked' : 'Practice This Skill'}
      </button>
    </aside>
  );
}
