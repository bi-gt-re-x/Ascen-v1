/**
 * Skill Trees — a tree per subject, grown out of finished work.
 *
 * The route `/growth-tree` reserved this page for a long time and described it
 * as "a branching skill tree: which nodes are unlocked, and what unlocks the
 * next one". That is exactly what this is, with one condition attached that the
 * placeholder did not state: **nothing on it is invented**. Every node is a
 * threshold on a quantity the account recorded — XP filed under the subject,
 * tasks finished in it, days it was worked — and a locked node prints the
 * number that opens it rather than a lock icon and a shrug. The arithmetic is
 * all in utils/skillTree; this file turns it into shapes.
 *
 * The three branches are three different questions, which is the whole reason
 * there are three rather than one long ladder: Depth is how far in you have
 * gone, Output is how much you have actually finished, and Rhythm is whether
 * the subject is a habit. A subject can be deep and arrhythmic — one heroic
 * fortnight — or shallow and daily, and those two accounts need opposite
 * advice. One bar could not tell them apart.
 *
 * Related, and deliberately not duplicated: the Subjects tab of Analytics has
 * the same subjects on the same mastery ladder with the curve, the radar and
 * the projection. That page answers *how good am I getting at this*. This one
 * answers *what opens next and what opens it* — a shorter question, and the
 * only one a tree is actually shaped to answer.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import { iconUrl } from '@/services/subjects';
import { format } from '@/utils';
import {
  skillTrees,
  treeTotals,
  unfiledTasks,
  type SkillTree,
  type TreeBranch,
  type TreeNode,
} from '@/utils/skillTree';
import type { CSSProperties } from 'react';
import '@/styles/skilltree.css';

/** The mastery ladder's own colour per branch, so a branch means one thing. */
const BRANCH_TONE: Record<TreeBranch['key'], string> = {
  depth: 'var(--st-violet)',
  output: 'var(--st-blue)',
  rhythm: 'var(--st-green)',
};

// --------------------------------------------------------------------------
// A node
// --------------------------------------------------------------------------
/**
 * One node on a branch: open, next, or further off.
 *
 * Three states rather than two. "Locked" collapses the node you are four tasks
 * from with the one you are ninety-five away from, and those are not the same
 * news — the first is this week and the second is the shape of the branch. Only
 * the next node carries a progress bar and a remainder, because only the next
 * node has a remainder worth quoting.
 */
function Node({ node, unit, tone }: { node: TreeNode; unit: string; tone: string }) {
  const state = node.unlocked ? 'is-open' : node.next ? 'is-next' : 'is-far';
  return (
    <li className={`st-node ${state}`} style={{ '--tone': tone } as CSSProperties}>
      <span className="st-node-dot" aria-hidden="true">
        {node.unlocked ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        ) : (
          <i style={{ height: `${node.percent}%` }} />
        )}
      </span>
      <span className="st-node-name">{node.name}</span>
      <span className="st-node-need">
        {/* The entry rung of the Depth branch costs nothing — level 1 is where
            every subject starts — and "0 XP" under it reads as a bug rather
            than as the bottom of a ladder. */}
        {node.unlocked
          ? node.need === 0
            ? 'from the start'
            : `${format.number(node.need)} ${unit}`
          : `${format.number(node.remaining)} ${unit} to go`}
      </span>
    </li>
  );
}

// --------------------------------------------------------------------------
// A branch
// --------------------------------------------------------------------------
function Branch({ branch }: { branch: TreeBranch }) {
  const tone = BRANCH_TONE[branch.key];
  return (
    <section className="st-branch" style={{ '--tone': tone } as CSSProperties}>
      <header className="st-branch-head">
        <h3>{branch.name}</h3>
        <span className="st-branch-count">
          {branch.unlocked}/{branch.nodes.length}
        </span>
        <span className="st-branch-have">
          {format.number(branch.have)} {branch.unit}
        </span>
      </header>
      <p className="st-branch-measure">{branch.measure}</p>
      <ol className="st-nodes">
        {branch.nodes.map((node) => (
          <Node key={node.id} node={node} unit={branch.unit} tone={tone} />
        ))}
      </ol>
    </section>
  );
}

// --------------------------------------------------------------------------
// A tree
// --------------------------------------------------------------------------
function Tree({ tree }: { tree: SkillTree }) {
  return (
    <article className="st-tree">
      <header className="st-tree-head">
        <span className="st-tree-icon" aria-hidden="true">
          {tree.icon ? (
            <i className="cal-ico" style={{ '--ico': `url(${iconUrl({ icon: tree.icon })})` } as CSSProperties} />
          ) : (
            <i className="st-tree-initial">{tree.label.slice(0, 1)}</i>
          )}
        </span>
        <div className="st-tree-title">
          <h2 title={tree.name}>{tree.name}</h2>
          <span className="st-tree-rank">
            Level {tree.level.tier} · {tree.level.rank}
          </span>
        </div>
        <span className="st-tree-progress">
          <strong>
            {tree.unlocked}
            <em>/{tree.total}</em>
          </strong>
          <span>nodes open</span>
        </span>
      </header>

      {/* The subject's place on the mastery ladder, which is the trunk the
          three branches come off. Printed once here rather than repeated at
          the top of the Depth branch — it is the same number. */}
      <div className="st-trunk">
        <div className="st-trunk-bar" role="progressbar" aria-valuenow={Math.round(tree.level.percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`Level ${tree.level.tier} progress`}>
          <i style={{ width: `${tree.level.percent}%` }} />
        </div>
        <span className="st-trunk-note">
          {tree.level.maxed
            ? `${format.number(tree.xp)} XP — the top of the ladder.`
            : `${format.number(tree.level.toNext)} XP to level ${tree.level.tier + 1}, out of ${format.number(tree.xp)} banked here.`}
        </span>
      </div>

      <div className="st-branches">
        {tree.branches.map((branch) => (
          <Branch key={branch.key} branch={branch} />
        ))}
      </div>
    </article>
  );
}

// --------------------------------------------------------------------------
// The page
// --------------------------------------------------------------------------
export default function SkillTrees() {
  useDocumentTitle('Skill Trees');

  const { data, loading, error, reload, username } = useUserData();
  const subjects = useSubjectIndex(username);
  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  const trees = useMemo(() => skillTrees(tasks, subjects), [subjects, tasks]);
  const totals = useMemo(() => treeTotals(trees), [trees]);
  const unfiled = useMemo(() => unfiledTasks(tasks, subjects), [subjects, tasks]);

  if (loading) return <Loading label="Growing your trees" />;
  if (!data) {
    return <ErrorState message={error ?? 'No account data yet.'} onRetry={username ? reload : undefined} />;
  }

  return (
    <div className="st-page">
      <Ambient />
      <div className="st-shell page-shell">
        <header className="st-head">
          <div>
            <h1>Skill Trees</h1>
            <p>
              One tree per subject you have finished work in. Every node is a number you
              already reached, or the number that opens it — nothing here is awarded.
            </p>
          </div>
          <RefreshButton onRefresh={reload} busy={loading} />
        </header>

        {trees.length === 0 ? (
          /* Not the `NotBuilt` treatment and not a locked screen: the page is
             built and the account is not behind on anything. It is missing one
             input, the input is a dropdown on a task, and saying which is more
             use than a countdown to nothing. */
          <section className="st-empty">
            <h2>No trees yet</h2>
            {unfiled.count > 0 ? (
              <p>
                You have finished <strong>{unfiled.count}</strong>{' '}
                {unfiled.count === 1 ? 'task' : 'tasks'} worth{' '}
                {format.number(unfiled.xp)} XP, and none of them carry a subject — so
                there is nothing to file a tree under. The subject picker is on the task
                itself; fill one in and the tree exists on the next finished task.
              </p>
            ) : (
              <p>
                A tree grows from finished tasks filed under a subject. Nothing is
                finished yet, so there is nothing to grow one from.
              </p>
            )}
            <Link to="/tasks" className="st-btn">
              Open Tasks
            </Link>
          </section>
        ) : (
          <>
            <section className="st-totals">
              <div className="st-total">
                <span>Trees growing</span>
                <strong>{totals.trees}</strong>
                <em>one per subject</em>
              </div>
              <div className="st-total">
                <span>Nodes open</span>
                <strong>
                  {totals.unlocked}
                  <i>/{totals.total}</i>
                </strong>
                <em>across every tree</em>
              </div>
              <div className="st-total">
                <span>Deepest subject</span>
                <strong className="st-total-word">{totals.deepest?.label ?? '—'}</strong>
                <em>
                  {totals.deepest
                    ? `Level ${totals.deepest.level.tier} · ${totals.deepest.level.rank}`
                    : 'nothing filed yet'}
                </em>
              </div>
              <div className="st-total">
                <span>Closest node</span>
                <strong className="st-total-word">
                  {totals.closest ? totals.closest.node.name : '—'}
                </strong>
                <em>
                  {totals.closest
                    ? `${totals.closest.tree.label} · ${format.number(totals.closest.node.remaining)} ${totals.closest.branch.unit} to go`
                    : 'every node on every tree is open'}
                </em>
              </div>
            </section>

            <div className="st-grid">
              {trees.map((tree) => (
                <Tree key={tree.key} tree={tree} />
              ))}
            </div>

            <section className="st-note">
              <h2>How to read these</h2>
              <p>
                <strong>Depth</strong> is lifetime XP in the subject, on the same
                hundred-level ladder the{' '}
                <Link to="/subjects">Subjects tab</Link> uses. <strong>Output</strong> is
                finished tasks. <strong>Rhythm</strong> is separate days worked. A
                subject can be deep and arrhythmic — one heroic fortnight — or shallow
                and daily, and one bar could not tell those apart.
              </p>
              <p>
                Nothing here is spent or chosen. There is no build to pick and no branch
                that closes another, because the app records what you did rather than
                what you meant to specialise in.
                {unfiled.count > 0 && (
                  <>
                    {' '}
                    {unfiled.count} finished{' '}
                    {unfiled.count === 1 ? 'task carries' : 'tasks carry'} no subject and
                    are in none of these.
                  </>
                )}
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
