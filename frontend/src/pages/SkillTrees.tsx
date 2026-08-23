/**
 * Skill Tree — the page.
 *
 * ## The shape of it
 *
 * A band of figures across the top, the lattice and its detail panel side by
 * side under that, and a legend along the bottom. The page holds which tree is
 * open and which node is picked and does nothing else: the canvas owns pan,
 * zoom, the vertical scroll and full screen, the layout in utils/skillGraph
 * owns placement, and skills/subjectTrees owns what is in a tree and where it
 * forks. This file is the seam between them.
 *
 * ## Walking between subjects
 *
 * A subject too big for one canvas forks into others, and a fork is a single
 * navigation node — a diamond that, clicked, opens the child tree rather than
 * selecting a skill. The child names its parent, so the breadcrumb is the way
 * back up, and the switcher jumps between the top-level subjects outright.
 * Changing tree clears the selection, or the panel would be describing a node
 * no longer on the canvas.
 *
 * ## The figures are counted, not stored
 *
 * Every number in the band is `tallyGraph` on the tree that is open — there is
 * no second copy of "how many are mastered" to drift from the tiles. Skill
 * level is the one derived thing, and it is derived here rather than in the
 * data because it is a reading of the tally rather than a fact about a subject.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ambient } from '@/components';
import {
  LatticeNode,
  LatticePanel,
  ProgressIndicator,
  SkillTree as SkillTreeCanvas,
} from '@/components/SkillTree';
import { useDocumentTitle, usePageEntrance } from '@/hooks';
import {
  DEFAULT_TREE,
  ROOT_SUBJECTS,
  graphFromSubjectTree,
  iconUrl,
  navTargets,
  parentChain,
  subjectTreeById,
} from '@/skills/subjectTrees';
import { LATTICE_GEOM, tallyGraph, type GraphNode, type GraphTally } from '@/utils/skillGraph';
import '@/styles/skilltree.css';

/** The drawing, painted through the shared mask. */
function Ico({ icon, className }: { icon: string; className: string }) {
  return <i className={className} style={{ ['--ico' as string]: `url(${iconUrl(icon)})` }} />;
}

/**
 * What to call how far down a tree somebody is.
 *
 * Bands rather than a number, because "Advanced" answers the question a reader
 * is actually asking and "61%" is already printed two inches to the left.
 */
function skillLevel(tally: GraphTally): string {
  if (tally.total === 0) return 'Unstarted';
  const share = (tally.complete + tally.progress * 0.5) / tally.total;
  if (share >= 0.85) return 'Master';
  if (share >= 0.6) return 'Expert';
  if (share >= 0.35) return 'Advanced';
  if (share >= 0.15) return 'Intermediate';
  if (share > 0) return 'Beginner';
  return 'Unstarted';
}

/** One figure in the band across the top. */
function Figure({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: string;
  tone?: string;
}) {
  return (
    <div className={`stx-figure${tone ? ` is-${tone}` : ''}`}>
      <div className="stx-figure-text">
        <span className="stx-figure-label">{label}</span>
        <strong className="stx-figure-value">
          {value}
          {sub && <em>{sub}</em>}
        </strong>
      </div>
      {icon && (
        <span className="stx-figure-badge">
          <Ico icon={icon} className="stx-ico stx-figure-ico" />
        </span>
      )}
    </div>
  );
}

export default function SkillTrees() {
  useDocumentTitle('Skill Tree');

  const [treeId, setTreeId] = useState<string>(DEFAULT_TREE.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tree = subjectTreeById(treeId) ?? DEFAULT_TREE;

  const graph = useMemo(() => graphFromSubjectTree(tree), [tree]);
  const nav = useMemo(() => navTargets(tree), [tree]);
  const totals = useMemo(() => tallyGraph(graph), [graph]);
  const chain = useMemo(() => parentChain(tree.id), [tree.id]);

  // The root ancestor of whatever tree is open, so the switcher highlights the
  // subject you are inside even three forks deep.
  const rootId = chain[0]?.id ?? tree.id;

  const goTo = useCallback((id: string) => {
    setTreeId(id);
    setSelectedId(null);
  }, []);

  const selected = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  // Picking the same node again puts the panel and the lit run back.
  const select = useCallback(
    (node: GraphNode | null) =>
      setSelectedId((current) => (node && current !== node.id ? node.id : null)),
    [],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [treeId]);

  const entering = usePageEntrance(true);
  const unlocked = totals.total - totals.locked;

  return (
    <div className="stx-page stx-page--lattice">
      <Ambient />
      <div className={`stx-shell page-shell${entering ? ' pg-enter' : ''}`}>
        <nav className="stx-subjects" aria-label="Subjects">
          {ROOT_SUBJECTS.map((subject) => (
            <button
              key={subject.id}
              type="button"
              className={`stx-subject${subject.id === rootId ? ' is-on' : ''}`}
              aria-current={subject.id === rootId ? 'true' : undefined}
              onClick={() => goTo(subject.id)}
            >
              {subject.title}
            </button>
          ))}
        </nav>

        <header className="stx-lead">
          {chain.length > 1 && (
            <nav className="stx-crumbs" aria-label="Where this tree sits">
              {chain.map((crumb, index) => {
                const here = crumb.id === tree.id;
                return (
                  <span key={crumb.id} className="stx-crumb">
                    {here ? (
                      <span aria-current="page">{crumb.title}</span>
                    ) : (
                      <button type="button" onClick={() => goTo(crumb.id)}>
                        {crumb.title}
                      </button>
                    )}
                    {index < chain.length - 1 && <i aria-hidden="true">›</i>}
                  </span>
                );
              })}
            </nav>
          )}
          <h1>{tree.title}</h1>
          <p className="stx-lead-sub">{tree.blurb}</p>
        </header>

        {/* ---- the band of figures ---- */}
        <section className="stx-band" aria-label="Where this tree stands">
          <div className="stx-figure stx-figure--ring">
            <div className="stx-figure-text">
              <span className="stx-figure-label">Overall Progress</span>
              <strong className="stx-figure-value stx-figure-big">
                {Math.round(totals.percent)}%
              </strong>
            </div>
            <ProgressIndicator percent={totals.percent} shape="ring" size={54} />
          </div>

          <Figure label="Skills Unlocked" value={unlocked} sub={`/ ${totals.total}`} tone="accent" />
          <Figure label="Mastered" value={totals.complete} icon="trophy" tone="done" />
          <Figure label="In Progress" value={totals.progress} icon="in-progress" tone="prog" />
          <Figure label="Locked" value={totals.locked} icon="locked" tone="lock" />
          <Figure label="Skill Level" value={skillLevel(totals)} icon="gem" tone="level" />
        </section>

        {/* ---- the lattice and what a node is ---- */}
        <div className="stx-layout">
          <SkillTreeCanvas
            graph={graph}
            selectedId={selectedId}
            onSelect={select}
            geom={LATTICE_GEOM}
            renderNode={(placed, ctx) => {
              const to = nav.get(placed.node.id);
              return (
                <LatticeNode
                  placed={placed}
                  size={LATTICE_GEOM.nodeW}
                  selected={ctx.selected}
                  onSelect={ctx.onSelect}
                  onNavigate={to ? () => goTo(to) : undefined}
                />
              );
            }}
          />

          <LatticePanel
            graph={graph}
            node={selected}
            onSelect={select}
            placeholder={
              <>
                <Ico icon="target" className="stx-ico stx-lp-blank-ico" />
                <strong>Pick a skill</strong>
                <span>
                  Every tile on the lattice opens here — what it is, how far along you are, and what
                  it leads to. The diamonds open a subject of their own.
                </span>
              </>
            }
          />
        </div>

        {/* ---- legend ---- */}
        <footer className="stx-legend">
          <ul className="stx-legend-keys">
            {[
              ['done', 'Mastered'],
              ['prog', 'In Progress'],
              ['open', 'Available'],
              ['lock', 'Locked'],
            ].map(([key, label]) => (
              <li key={key}>
                <i className={`stx-legend-dot is-${key}`} aria-hidden="true" />
                {label}
              </li>
            ))}
            <li className="stx-legend-line">
              <svg viewBox="0 0 28 6" aria-hidden="true">
                <path d="M1 3h26" />
              </svg>
              Prerequisite
            </li>
            <li className="stx-legend-line">
              <svg viewBox="0 0 28 6" aria-hidden="true">
                <path d="M1 3h26" strokeDasharray="4 4" />
              </svg>
              Recommended
            </li>
          </ul>
          <p className="stx-legend-tip">
            <Ico icon="idea" className="stx-ico stx-legend-tip-ico" />
            <b>Tip:</b> drag the canvas to explore · ⌘ or Ctrl + scroll to zoom
          </p>
        </footer>
      </div>
    </div>
  );
}
