/**
 * Skill Tree — the page.
 *
 * ## What this file is, after the rebuild
 *
 * Very little. It fetches, it holds the selection and the filter, and it hands
 * a graph to a canvas. Everything that draws lives in components/SkillTree and
 * takes the generic shape in utils/skillGraph, which is the point of the
 * rebuild: the old page was written *against* the specific tree — three named
 * branches, five rungs, a fan of exactly three curves in a fixed viewBox — so
 * any change to what a tree contains was a change to the page. Nothing here
 * knows how many nodes there are, how they connect, or what they measure.
 *
 * ## The data is real, and the brief expected placeholders
 *
 * The brief this was built to says to leave node generation, progression and
 * completion for a later phase and to stand the visual system up on its own.
 * The visual system is built exactly that way — it will render any graph — but
 * it is fed the account's own subject trees rather than an invented curriculum,
 * because this app already derives a real one and putting fabricated skills at
 * fabricated percentages on a live account would be the single dishonest screen
 * in it. utils/skillGraphFromTrees is the adapter, and it is the only file that
 * would be replaced by a generator.
 *
 * ## Where the numbers come from
 *
 * Unchanged, and deliberately: utils/skillTree still derives Depth, Output and
 * Rhythm from finished tasks, and the Subjects tab of Analytics reads the same
 * mastery ladder, so the two pages cannot disagree about a level. This page
 * answers *what opens next and what opens it*; that one answers *how good am I
 * getting at this*.
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
import { useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import { format } from '@/utils';
import {
  NO_FILTER,
  filterGraph,
  tallyGraph,
  type GraphFilter,
  type GraphNode,
} from '@/utils/skillGraph';
import { graphFromTrees } from '@/utils/skillGraphFromTrees';
import { skillTrees, unfiledTasks } from '@/utils/skillTree';
import '@/styles/skilltree.css';

/** The header's headline figure and the bar under it. */
function Milestone({ done, total }: { done: number; total: number }) {
  // The next round hundred of nodes, or the finish line if it is nearer. A
  // milestone is meant to be close enough to be worth walking to; "all 240"
  // from a standing start is a number, not a target.
  const step = total <= 40 ? 10 : total <= 120 ? 25 : 50;
  const mark = Math.min(total, Math.ceil((done + 1) / step) * step);
  const floor = Math.max(0, mark - step);
  const percent = ((done - floor) / Math.max(1, mark - floor)) * 100;

  return (
    <div className="stx-milestone">
      <span className="stx-milestone-top">
        <b>{done}</b> of {mark} nodes
        <em>{done >= total ? 'every node open' : `${mark - done} to the next milestone`}</em>
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

  const graph = useMemo(() => graphFromTrees(trees), [trees]);
  const [filter, setFilter] = useState<GraphFilter>(NO_FILTER);
  const shown = useMemo(() => filterGraph(graph, filter), [filter, graph]);

  // Counted on the whole graph, not the filtered one: a header that moved when
  // a filter was flicked would be reporting the filter rather than the account.
  const totals = useMemo(() => tallyGraph(graph), [graph]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  const select = useCallback((node: GraphNode | null) => setSelectedId(node?.id ?? null), []);

  // A filter that hides the selected node clears it, or the panel describes
  // something no longer on the canvas and its two link lists point at nothing.
  useEffect(() => {
    if (selectedId && !shown.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
  }, [selectedId, shown.nodes]);

  if (loading) return <Loading label="Growing your trees" />;
  if (!data) {
    return <ErrorState message={error ?? 'No account data yet.'} onRetry={username ? reload : undefined} />;
  }

  return (
    <div className="stx-page">
      <Ambient />
      <div className="stx-shell page-shell">
        <header className="stx-head">
          <div className="stx-head-text">
            <h1>Skill Tree</h1>
            <p>Build your skills, unlock new abilities, and see how far you have come.</p>
          </div>

          {trees.length > 0 && (
            <div className="stx-head-figures">
              <div className="stx-level">
                <ProgressIndicator percent={totals.percent} shape="ring" size={54} />
                <div>
                  <span>Overall</span>
                  <strong>{Math.round(totals.percent)}%</strong>
                </div>
              </div>
              <Milestone done={totals.complete} total={totals.total} />
              {/* Every node's XP summed, which on this feed is the subject roots
                  and therefore the account's filed total. Not `xpEarned`: that
                  counts only nodes marked complete, and a subject root is not
                  complete until all fifteen of its thresholds are, so an
                  account halfway up three subjects would read zero. */}
              <p className="stx-head-xp">
                {format.number(totals.xpTotal)} XP filed across{' '}
                {trees.length} {trees.length === 1 ? 'subject' : 'subjects'}
              </p>
            </div>
          )}
        </header>

        {trees.length === 0 ? (
          /* Not a locked screen and not the `NotBuilt` treatment: the page is
             built and the account is not behind on anything. It is missing one
             input, the input is a dropdown on a task, and saying which is more
             use than a countdown to nothing. */
          <section className="stx-empty">
            <h2>No trees yet</h2>
            {unfiled.count > 0 ? (
              <p>
                You have finished <strong>{unfiled.count}</strong>{' '}
                {unfiled.count === 1 ? 'task' : 'tasks'} worth {format.number(unfiled.xp)} XP, and
                none of them carry a subject — so there is nothing to file a tree under. The
                subject picker is on the task itself; fill one in and the tree exists on the next
                finished task.
              </p>
            ) : (
              <p>
                A tree grows from finished tasks filed under a subject. Nothing is finished yet,
                so there is nothing to grow one from.
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

            <div className={`stx-layout${selected ? ' is-open' : ''}`}>
              <SkillTreeCanvas
                graph={shown}
                selectedId={selectedId}
                onSelect={select}
                empty={
                  <>
                    <strong>Nothing matches</strong>
                    <span>
                      No node in the tree carries all of that. Clear a filter and the canvas comes
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
                action={{ label: 'Open Tasks', href: '/tasks' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
