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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ambient } from '@/components';
import {
  FocusTopics,
  LatticeNode,
  LatticePanel,
  ProgressIndicator,
  SkillTree as SkillTreeCanvas,
  SubjectRail,
} from '@/components/SkillTree';
import { useAuth, useDocumentTitle, usePageEntrance, useSubjects } from '@/hooks';
import { treeForSubject } from '@/skills/subjectMap';
import {
  DEFAULT_TREE,
  childrenOf,
  graphFromSubjectTree,
  iconUrl,
  navTargets,
  parentChain,
  parentOf,
  siblingsOf,
  subjectTreeById,
} from '@/skills/subjectTrees';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  LATTICE_GEOM,
  tallyGraph,
  type GraphNode,
  type GraphTally,
} from '@/utils/skillGraph';
import { FOCUS_COUNT, loadFocus, resolveFocus, saveFocus } from '@/utils/focusTopics';
import {
  applyProgress,
  loadProgress,
  practiceGain,
  saveProgress,
  type SkillProgress,
} from '@/utils/skillProgress';
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

  const { username } = useAuth();
  // The account's own catalogue, usage-ordered by the endpoint. Everything at
  // the top of this page is drawn from it: the five focus cards, the rail, and
  // half of what the search can find.
  const subjects = useSubjects(username);
  const [treeId, setTreeId] = useState<string>(DEFAULT_TREE.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Practice done on top of what the trees seed — see utils/skillProgress for
     why it lives in the browser. Loaded once per account, and written back on
     every change rather than on unmount, so a click survives a closed tab. */
  const [progress, setProgress] = useState<SkillProgress>({});
  useEffect(() => {
    setProgress(loadProgress(username));
  }, [username]);

  /* The five across the top. Null until this account has chosen, which is what
     lets the band follow the subjects they actually use until the moment they
     say otherwise — see utils/focusTopics. */
  const [chosenFocus, setChosenFocus] = useState<string[] | null>(null);
  useEffect(() => {
    setChosenFocus(loadFocus(username));
  }, [username]);

  const focus = useMemo(
    () => resolveFocus(chosenFocus, subjects.map((subject) => subject.id)),
    [chosenFocus, subjects],
  );

  const tree = subjectTreeById(treeId) ?? DEFAULT_TREE;

  const designed = useMemo(() => graphFromSubjectTree(tree), [tree]);
  // What is actually drawn: the designed tree with the account's practice added
  // and every status re-derived from the result. Everything downstream — the
  // canvas, the panel, the figures — reads this one graph, so a click cannot
  // move the tiles and leave the band behind.
  const graph = useMemo(() => applyProgress(designed, progress), [designed, progress]);
  const nav = useMemo(() => navTargets(tree), [tree]);
  const totals = useMemo(() => tallyGraph(graph), [graph]);
  const chain = useMemo(() => parentChain(tree.id), [tree.id]);
  // The three ways out of this tree, so walking the hierarchy never depends on
  // finding the right diamond on the canvas.
  const up = useMemo(() => parentOf(tree.id), [tree.id]);
  const into = useMemo(() => childrenOf(tree.id), [tree.id]);
  const beside = useMemo(() => siblingsOf(tree.id), [tree.id]);

  // Everything the reader is currently inside, root first. The focus cards and
  // the rail light from this, so walking three forks down does not put every
  // pill out — see the note on `openTrail` in SubjectRail.
  const trail = useMemo(() => chain.map((entry) => entry.id), [chain]);

  const goTo = useCallback((id: string) => {
    setTreeId(id);
    setSelectedId(null);
  }, []);

  /* Opening a tree *at* a node — what the search and the subject rail do.
     Every route into a different tree passes through here or through `goTo`,
     and both say what the selection becomes, which is why there is no effect
     watching the tree id to clear it: one would run after this and wipe the
     node the reader just searched for. */
  const openTree = useCallback((id: string, node?: string) => {
    setTreeId(id);
    setSelectedId(node ?? null);
  }, []);

  /** A catalogue subject — Mandarin, Gym, Taxes — routed to its lattice. */
  const openSubject = useCallback(
    (subjectId: string) => {
      const subject = subjects.find((row) => row.id === subjectId);
      const target = treeForSubject(subjectId, subject?.group);
      openTree(target.tree, target.node);
    },
    [openTree, subjects],
  );

  /* Changing one slot stores all five, including the ones that were still
     derived — otherwise the four the reader did not touch would keep moving as
     their task counts changed. */
  const setFocusAt = useCallback(
    (index: number, subjectId: string) => {
      setChosenFocus((current) => {
        const base = resolveFocus(current, subjects.map((subject) => subject.id));
        const next = Array.from({ length: FOCUS_COUNT }, (_, slot) => base[slot] ?? '')
          .map((id, slot) => (slot === index ? subjectId : id))
          .filter(Boolean);
        saveFocus(username, next);
        return next;
      });
    },
    [subjects, username],
  );

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

  /* The "+250 XP" that appears for a moment after a click. Held with its node
     id so switching selection mid-flash cannot show one node's gain on
     another, and the timer is cleared on unmount and on every new click. */
  const [flash, setFlash] = useState<{ id: string; gain: number } | null>(null);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const practise = useCallback(
    (node: GraphNode) => {
      const gain = practiceGain(node);
      setProgress((current) => {
        const next = { ...current, [node.id]: (current[node.id] ?? 0) + gain };
        saveProgress(username, next);
        return next;
      });
      setFlash({ id: node.id, gain });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
    },
    [username],
  );

  const entering = usePageEntrance(true);
  const unlocked = totals.total - totals.locked;

  return (
    <div className="stx-page stx-page--lattice">
      <Ambient />
      <div className={`stx-shell page-shell${entering ? ' pg-enter' : ''}`}>
        <FocusTopics
          subjects={subjects}
          focus={focus}
          openTrail={trail}
          onOpen={openSubject}
          onChange={setFocusAt}
        />

        <SubjectRail subjects={subjects} openTrail={trail} onOpen={openTree} />

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

        {/* ---- moving between trees ----
            The diamonds on the canvas walk downward and the breadcrumb walks
            up, but both mean hunting for a control. This says every tree
            adjacent to this one outright: the one above, the ones below, and
            the ones beside it. */}
        {(up || into.length > 0 || beside.length > 0) && (
          <nav className="stx-treenav" aria-label="Move between trees">
            {up && (
              <span className="stx-treenav-group">
                <span className="stx-treenav-label">Up</span>
                <button type="button" className="stx-treenav-link is-up" onClick={() => goTo(up.id)}>
                  <Ico icon="branch" className="stx-ico stx-treenav-ico" />
                  {up.title}
                </button>
              </span>
            )}
            {into.length > 0 && (
              <span className="stx-treenav-group">
                <span className="stx-treenav-label">Branches into</span>
                {into.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    className="stx-treenav-link is-into"
                    onClick={() => goTo(child.id)}
                  >
                    {child.title}
                    <i aria-hidden="true">›</i>
                  </button>
                ))}
              </span>
            )}
            {beside.length > 0 && (
              <span className="stx-treenav-group">
                <span className="stx-treenav-label">Beside</span>
                {beside.map((peer) => (
                  <button
                    key={peer.id}
                    type="button"
                    className="stx-treenav-link"
                    onClick={() => goTo(peer.id)}
                  >
                    {peer.title}
                  </button>
                ))}
              </span>
            )}
          </nav>
        )}

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
            fit
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
            onPractice={practise}
            gain={selected ? practiceGain(selected) : 0}
            flash={flash && selected && flash.id === selected.id ? flash.gain : null}
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
        {/* The tiles are coloured by difficulty, so that is what the legend has
            to explain. Status is on every tile already, in the percentage badge
            beside the tier and in the fill of a finished one. */}
        <footer className="stx-legend">
          <ul className="stx-legend-keys">
            {DIFFICULTIES.map((tier) => (
              <li key={tier}>
                <i className={`stx-legend-dot tier-${tier}`} aria-hidden="true" />
                {DIFFICULTY_LABEL[tier]}
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
