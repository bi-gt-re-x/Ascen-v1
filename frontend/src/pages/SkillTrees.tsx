/**
 * Skill Tree — the page.
 *
 * ## What this file is
 *
 * Very little, and less than it was. It fetches, it holds a choice of tree, a
 * selection and a filter, and it hands a graph to a canvas. Everything that
 * draws lives in components/SkillTree and takes the generic shape in
 * utils/skillGraph; everything that decides *what is in* a tree lives in
 * skills/. This file is the seam and owns neither side.
 *
 * ## Two feeds, one canvas
 *
 *     Your subjects   utils/skillTree derives it from finished tasks, and
 *                     utils/skillGraphFromTrees puts it in the canvas's shape.
 *                     Real, and about this account.
 *     A goal          skills/generate grows it out of the shared node library,
 *                     and utils/skillGraphFromGenerated puts it in the same
 *                     shape. A curriculum, and about the skill rather than the
 *                     person.
 *
 * They are different kinds of claim and the picker says so rather than running
 * them together — the same separation the Records page keeps between what you
 * logged and what Ascen counted. Neither adapter knows the other exists, and the
 * canvas knows about neither.
 *
 * ## Nothing here is progress
 *
 * A generated tree's statuses come from evaluating prerequisite rules against
 * what the request says is held, and this page holds nothing yet — so a goal
 * tree opens with its roots available and everything above them locked. That is
 * the true reading of "nothing done so far" rather than a placeholder, and
 * wiring the account's real history into `completedNodes` is the whole of what
 * Part 3 has to do here: one argument, at the call to `generateTree` below.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import {
  NodeDetailPanel,
  ProgressIndicator,
  SkillTree as SkillTreeCanvas,
  SkillTreeToolbar,
} from '@/components/SkillTree';
import { useDocumentTitle, usePageEntrance, useSubjectIndex, useUserData } from '@/hooks';
import { GOALS, generateTree, goalById, skillLibrary } from '@/skills';
import { format } from '@/utils';
import {
  NO_FILTER,
  filterGraph,
  tallyGraph,
  type GraphFilter,
  type GraphNode,
} from '@/utils/skillGraph';
import { graphFromGenerated } from '@/utils/skillGraphFromGenerated';
import { graphFromTrees } from '@/utils/skillGraphFromTrees';
import { skillTrees, unfiledTasks } from '@/utils/skillTree';
import '@/styles/skilltree.css';

/** The subjects feed, which is not a goal and needs a value of its own. */
const SUBJECTS = 'your-subjects';

/** The header's headline figure and the bar under it. */
function Milestone({ done, total, unit }: { done: number; total: number; unit: string }) {
  // The next round number of nodes, or the finish line if it is nearer. A
  // milestone is meant to be close enough to be worth walking to; "all 240" from
  // a standing start is a number, not a target.
  const step = total <= 40 ? 10 : total <= 120 ? 25 : 50;
  const mark = Math.min(total, Math.ceil((done + 1) / step) * step);
  const floor = Math.max(0, mark - step);
  const percent = ((done - floor) / Math.max(1, mark - floor)) * 100;

  return (
    <div className="stx-milestone">
      <span className="stx-milestone-top">
        <b>{done}</b> of {mark} {unit}
        <em>{done >= total ? `every ${unit.replace(/s$/, '')} open` : `${mark - done} to the next milestone`}</em>
      </span>
      <ProgressIndicator percent={percent} shape="bar" />
    </div>
  );
}

export default function SkillTrees() {
  useDocumentTitle('Skill Tree');

  const { data, loading, error, reload, username } = useUserData();
  const subjects = useSubjectIndex(username);
  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  const trees = useMemo(() => skillTrees(tasks, subjects), [subjects, tasks]);
  const unfiled = useMemo(() => unfiledTasks(tasks, subjects), [subjects, tasks]);

  // The picker's value is the whole of the state, with no fallback laid over it.
  // An earlier version quietly redirected an account with no subject trees to a
  // goal tree, which read well and did two bad things: "Your subjects" became
  // unselectable, because choosing it recomputed straight back to the goal, and
  // the empty state below — the one that explains that finished tasks need a
  // subject on them — became unreachable code. The empty state points at the goal
  // trees instead, which gets a first-run account to the same place by saying so.
  const [source, setSource] = useState<string>(SUBJECTS);
  const goal = source === SUBJECTS ? null : goalById(source);

  const library = skillLibrary();
  const generated = useMemo(
    () =>
      goal
        ? // Part 3 fills these in from the account. The engine already takes
          // them, so the change is here and nowhere else.
          generateTree(library, {
            goal: goal.id,
            completedNodes: [],
          })
        : null,
    [goal, library],
  );

  const graph = useMemo(
    () =>
      generated
        ? graphFromGenerated(generated, library)
        : graphFromTrees(trees, 'Your subjects'),
    [generated, library, trees],
  );

  const [filter, setFilter] = useState<GraphFilter>(NO_FILTER);
  const shown = useMemo(() => filterGraph(graph, filter), [filter, graph]);

  // Counted on the whole graph, not the filtered one: a header that moved when a
  // filter was flicked would be reporting the filter rather than the tree.
  const totals = useMemo(() => tallyGraph(graph), [graph]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  const select = useCallback((node: GraphNode | null) => setSelectedId(node?.id ?? null), []);

  // A filter that hides the selected node clears it, or the panel describes
  // something no longer on the canvas and its two link lists point at nothing.
  // Changing tree does the same, for the same reason.
  useEffect(() => {
    if (selectedId && !shown.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
  }, [selectedId, shown.nodes]);

  useEffect(() => {
    setFilter(NO_FILTER);
    setSelectedId(null);
  }, [source]);

  /* The arrival cascade. Bound to the read rather than to mount, so it
     starts when there is something to animate — see hooks/usePageEntrance. */
  const entering = usePageEntrance(!loading);

  if (loading) return <Loading label="Growing your trees" />;
  if (!data) {
    return <ErrorState message={error ?? 'No account data yet.'} onRetry={username ? reload : undefined} />;
  }

  const bare = !goal && trees.length === 0;

  return (
    <div className="stx-page">
      <Ambient />
      <div className={`stx-shell page-shell${entering ? ' pg-enter' : ''}`}>
        <header className="stx-head">
          <div className="stx-head-text">
            <h1>Skill Tree</h1>
            <p>
              {goal
                ? goal.blurb
                : 'What you have worked on, and how far it goes.'}
            </p>
          </div>

          <div className="stx-head-figures">
            <label className="stx-field stx-source">
              <span className="stx-sr">Which tree</span>
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                <optgroup label="From your record">
                  <option value={SUBJECTS}>Your subjects</option>
                </optgroup>
                <optgroup label="Toward a goal">
                  {GOALS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            {!bare && (
              <>
                <div className="stx-level">
                  <ProgressIndicator percent={totals.percent} shape="ring" size={54} />
                  <div>
                    <span>{goal ? 'Done' : 'Overall'}</span>
                    <strong>{Math.round(totals.percent)}%</strong>
                  </div>
                </div>
                <Milestone done={totals.complete} total={totals.total} unit="nodes" />
                <p className="stx-head-xp">
                  {goal
                    ? `${format.number(totals.xpTotal)} XP on this path`
                    : /* Every node's XP summed, which on the subjects feed is the
                         roots and therefore the account's filed total. Not
                         `xpEarned`: that counts only nodes marked complete, and a
                         subject root is not complete until all fifteen of its
                         thresholds are. */
                      `${format.number(totals.xpTotal)} XP filed across ${trees.length} ${
                        trees.length === 1 ? 'subject' : 'subjects'
                      }`}
                </p>
              </>
            )}
          </div>
        </header>

        {bare ? (
          /* Not a locked screen and not the `NotBuilt` treatment: the page is
             built and the account is not behind on anything. It is missing one
             input, the input is a dropdown on a task, and saying which is more
             use than a countdown to nothing. The goals in the picker above work
             regardless — they are about skills rather than about this account. */
          <section className="stx-empty">
            <h2>No trees from your own work yet</h2>
            {unfiled.count > 0 ? (
              <p>
                You have finished <strong>{unfiled.count}</strong>{' '}
                {unfiled.count === 1 ? 'task' : 'tasks'} worth {format.number(unfiled.xp)} XP, and
                none of them carry a subject — so there is nothing to file a tree under. The
                subject picker is on the task itself; fill one in and the tree exists on the next
                finished task. The goal trees in the picker above need none of that.
              </p>
            ) : (
              <p>
                A tree of your own grows from finished tasks filed under a subject. Nothing is
                finished yet, so there is nothing to grow one from — but the goal trees in the
                picker above are built from the skill library and are there now.
              </p>
            )}
            <Link to="/tasks" className="stx-cta">
              Open Tasks
            </Link>
          </section>
        ) : (
          <>
            <SkillTreeToolbar
              graph={graph}
              filter={filter}
              onChange={setFilter}
              shown={shown.nodes.length}
            />

            <div className="stx-layout">
              <SkillTreeCanvas
                graph={shown}
                selectedId={selectedId}
                onSelect={select}
                empty={
                  <>
                    <strong>Nothing matches</strong>
                    <span>
                      No node in this tree carries all of that. Clear a filter and the canvas comes
                      back.
                    </span>
                  </>
                }
              />

              <NodeDetailPanel
                graph={graph}
                node={selected}
                onSelect={select}
                onClose={() => setSelectedId(null)}
                action={goal ? undefined : { label: 'Open Tasks', href: '/tasks' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
