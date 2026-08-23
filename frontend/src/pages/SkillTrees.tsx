/**
 * Skill Tree — the page.
 *
 * ## The shape of it
 *
 * One subject, one lattice. The page holds which tree is open and which node is
 * picked, hands the tree's graph to the canvas, and does nothing else — the
 * canvas owns pan, zoom, the vertical scroll and the full-screen; the layout in
 * utils/skillGraph owns placement; the data in skills/subjectTrees owns what is
 * in a tree and where it forks. This file is the seam.
 *
 * ## Walking between subjects
 *
 * A subject too big for one canvas forks into others, and a fork is a single
 * navigation node — a diamond that, clicked, opens the child tree rather than
 * selecting a skill. The child names its parent, so the breadcrumb at the top is
 * the way back, and the root switcher is always there to jump between the
 * top-level subjects outright. Changing tree clears the selection, or the lit
 * run would point at nodes no longer on the canvas.
 *
 * ## Icons, later
 *
 * The tiles carry no icon and no label yet — that is a deliberate next part, not
 * an oversight. A tile is a square the size of an icon with room kept for one;
 * the skill's name is on hover and read to assistive tech until then.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ambient } from '@/components';
import { LatticeNode, SkillTree as SkillTreeCanvas } from '@/components/SkillTree';
import { useDocumentTitle, usePageEntrance } from '@/hooks';
import {
  DEFAULT_TREE,
  ROOT_SUBJECTS,
  graphFromSubjectTree,
  navTargets,
  nodeRanks,
  parentChain,
  subjectTreeById,
} from '@/skills/subjectTrees';
import { LATTICE_GEOM, tallyGraph, type GraphNode } from '@/utils/skillGraph';
import '@/styles/skilltree.css';

export default function SkillTrees() {
  useDocumentTitle('Skill Tree');

  const [treeId, setTreeId] = useState<string>(DEFAULT_TREE.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tree = subjectTreeById(treeId) ?? DEFAULT_TREE;

  const graph = useMemo(() => graphFromSubjectTree(tree), [tree]);
  const nav = useMemo(() => navTargets(tree), [tree]);
  const ranks = useMemo(() => nodeRanks(tree), [tree]);
  const totals = useMemo(() => tallyGraph(graph), [graph]);
  const chain = useMemo(() => parentChain(tree.id), [tree.id]);

  // The root ancestor of whatever tree is open, so the switcher highlights the
  // subject you are inside even three forks deep.
  const rootId = chain[0]?.id ?? tree.id;

  const goTo = useCallback((id: string) => {
    setTreeId(id);
    setSelectedId(null);
  }, []);

  // A selection only ever lights the run of lines touching it; picking the same
  // node again puts them back.
  const select = useCallback(
    (node: GraphNode | null) =>
      setSelectedId((current) => (node && current !== node.id ? node.id : null)),
    [],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [treeId]);

  const entering = usePageEntrance(true);

  return (
    <div className="stx-page stx-page--lattice">
      <Ambient />
      <div className={`stx-shell page-shell${entering ? ' pg-enter' : ''}`}>
        {/* ---- the subject switcher ---- */}
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

        {/* ---- title at the top ---- */}
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

          <p className="stx-lead-label">{tree.title} · Points Available</p>
          <p className="stx-lead-figure">{totals.available}</p>
          <p className="stx-lead-sub">{tree.blurb}</p>
        </header>

        {/* ---- the lattice ---- */}
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
                rank={ranks.get(placed.node.id)}
              />
            );
          }}
        />
      </div>
    </div>
  );
}
