/**
 * Skill Tree — a branching graph per subject, grown out of finished work.
 *
 * The route `/growth-tree` reserved this page for a long time and described it
 * as "a branching skill tree: which nodes are unlocked, and what unlocks the
 * next one". That is what this is, with one condition the placeholder did not
 * state: **nothing on it is invented**. There is no skill graph on the account,
 * no talent to spend a point on and no build to choose. Every node is a
 * threshold on a quantity the record already holds, and a locked one prints the
 * number that opens it rather than a padlock and a shrug.
 *
 * ## The three tiers, and where each comes from
 *
 *   **The root** is the view — one category, or everything. Its level is the
 *   mastery ladder read on the summed XP of the subjects under it, and the line
 *   beneath says so, because a root is a total rather than a thing you are good
 *   at.
 *   **A branch** is a subject you have finished work in. Its level is that
 *   subject's own place on the same ladder — the figure the Subjects tab of
 *   Analytics prints, so the two pages cannot disagree.
 *   **A leaf** is one of the three disciplines the tree measures: Depth (XP),
 *   Output (finished tasks), Rhythm (separate days worked). Five nodes each,
 *   and the leaf's state is how many of the five are open.
 *
 * The categories down the left are the catalogue's own nine groups
 * (backend/config/subjects.py), which were section comments in that file until
 * this page needed them to be data. Only groups the account has work in appear:
 * seven greyed-out chips say nothing except that the app has a taxonomy.
 *
 * Related and deliberately not duplicated: the Subjects tab has the same
 * subjects on the same ladder with the curve, the radar and the projection. It
 * answers *how good am I getting at this*. This answers *what opens next and
 * what opens it* — a shorter question, and the only one a tree is shaped for.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import { useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import { iconUrl } from '@/services/subjects';
import { format } from '@/utils';
import {
  daysAcross,
  skillTrees,
  treeCategories,
  treeRoot,
  unfiledTasks,
  type SkillTree,
  type TreeBranch,
  type TreeNode,
} from '@/utils/skillTree';
import type { CSSProperties } from 'react';
import '@/styles/skilltree.css';

/** One colour per discipline, and the same three the analytics page uses. */
const BRANCH_TONE: Record<TreeBranch['key'], string> = {
  depth: 'var(--stx-violet)',
  output: 'var(--stx-blue)',
  rhythm: 'var(--stx-green)',
};

/**
 * What each discipline is, in one line, for the panel on the right.
 *
 * Written here rather than reusing `branch.measure` from the model: that one is
 * addressed to somebody looking at a branch and reads as a caption, this one is
 * addressed to somebody who just clicked it and reads as an answer.
 */
const BRANCH_BLURB: Record<TreeBranch['key'], string> = {
  depth: 'How far into the subject you have gone, measured in XP and read on the hundred-level mastery ladder.',
  output: 'How much you have actually finished in it. Not the same as XP — one large task and thirty small ones can weigh the same.',
  rhythm: 'How many separate days carried work in it. What separates a habit from a fortnight you had once.',
};

/** How far the zoom control will go, and the step it moves in. */
const ZOOM = { min: 0.6, max: 1.4, step: 0.1 };

// --------------------------------------------------------------------------
// Small pieces
// --------------------------------------------------------------------------
/** The donut on the first stat tile. One arc, no legend, no library. */
function Ring({ percent }: { percent: number }) {
  const size = 46;
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <svg className="stx-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="stx-ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="stx-ring-arc"
        strokeDasharray={`${filled} ${circumference - filled}`}
        // Starts at twelve o'clock rather than three, which is where a reader
        // expects a progress ring to begin.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function SubjectIcon({ tree }: { tree: Pick<SkillTree, 'icon' | 'label'> }) {
  if (tree.icon) {
    return (
      <i
        className="cal-ico"
        style={{ '--ico': `url(${iconUrl({ icon: tree.icon })})` } as CSSProperties}
      />
    );
  }
  return <i className="stx-initial">{tree.label.slice(0, 1)}</i>;
}

/** Open, part-way, or not started — the three states a leaf can be in. */
function leafState(branch: TreeBranch): 'done' | 'part' | 'locked' {
  if (branch.unlocked >= branch.nodes.length) return 'done';
  return branch.unlocked > 0 ? 'part' : 'locked';
}

// --------------------------------------------------------------------------
// The graph
// --------------------------------------------------------------------------
/**
 * The connectors between a subject and its three leaves.
 *
 * Drawn as one SVG per row against a fixed viewBox rather than as CSS borders,
 * because the shape is three curves fanning out from a single point and CSS can
 * draw an elbow but not that. The geometry is fixed — the row's height is set
 * by the stylesheet and the three leaves are evenly spaced inside it — so the
 * path needs no measurement and no observer, which is what keeps it correct
 * while the panel is being zoomed and resized.
 */
function Fan() {
  const w = 32;
  const h = 176;
  const mid = h / 2;
  const stops = [26, mid, h - 26];
  return (
    <svg className="stx-fan" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {stops.map((y) => (
        <path key={y} d={`M0,${mid} C${w * 0.55},${mid} ${w * 0.45},${y} ${w},${y}`} />
      ))}
    </svg>
  );
}

interface GraphProps {
  root: ReturnType<typeof treeRoot>;
  trees: SkillTree[];
  chosen: string;
  chosenBranch: TreeBranch['key'];
  onChoose: (key: string, branch?: TreeBranch['key']) => void;
}

function Graph({ root, trees, chosen, chosenBranch, onChoose }: GraphProps) {
  return (
    <div className="stx-graph">
      <div className="stx-root-col">
        <div className="stx-node stx-root">
          <span className="stx-node-icon stx-root-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21v-8M12 13 7.5 9.5M12 13l4.5-3.5" />
              <circle cx="12" cy="4" r="2.2" />
              <circle cx="5.5" cy="8" r="2.2" />
              <circle cx="18.5" cy="8" r="2.2" />
            </svg>
          </span>
          <span className="stx-node-body">
            <strong>{root.label}</strong>
            <em>Level {root.level.tier}</em>
          </span>
          <i className="stx-node-bar">
            <span style={{ width: `${root.level.percent}%` }} />
          </i>
        </div>
        <span className="stx-junction" aria-hidden="true" />
      </div>

      <div className="stx-branch-col">
        {trees.map((tree) => (
          <div className="stx-row" key={tree.key}>
            <button
              type="button"
              className={`stx-node stx-branch${chosen === tree.key ? ' is-chosen' : ''}`}
              onClick={() => onChoose(tree.key)}
            >
              <span className="stx-node-icon" aria-hidden="true">
                <SubjectIcon tree={tree} />
              </span>
              <span className="stx-node-body">
                <strong>{tree.name}</strong>
                <em>Level {tree.level.tier}</em>
              </span>
              <i className="stx-node-bar">
                <span style={{ width: `${tree.level.percent}%` }} />
              </i>
            </button>

            <Fan />

            <div className="stx-leaf-col">
              {tree.branches.map((branch) => {
                const state = leafState(branch);
                return (
                  <button
                    type="button"
                    key={branch.key}
                    className={`stx-node stx-leaf is-${state}${
                      chosen === tree.key && chosenBranch === branch.key ? ' is-chosen' : ''
                    }`}
                    style={{ '--tone': BRANCH_TONE[branch.key] } as CSSProperties}
                    onClick={() => onChoose(tree.key, branch.key)}
                    title={`${branch.name} — ${branch.unlocked} of ${branch.nodes.length} nodes open`}
                  >
                    <span className="stx-leaf-mark" aria-hidden="true">
                      {state === 'done' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      ) : state === 'locked' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="10" width="16" height="11" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="8" />
                          <path d="M12 8v4l3 2" />
                        </svg>
                      )}
                    </span>
                    <span className="stx-node-body">
                      <strong>{branch.name}</strong>
                      <em>
                        {branch.unlocked}/{branch.nodes.length} nodes
                      </em>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// The detail panel
// --------------------------------------------------------------------------
function Detail({ tree, branch }: { tree: SkillTree; branch: TreeBranch }) {
  const next = branch.nodes.find((node) => node.next) ?? null;
  const nodeUnit = (node: TreeNode) =>
    node.need === 0 ? 'from the start' : `${format.number(node.need)} ${branch.unit}`;

  return (
    <aside className="stx-detail">
      <header className="stx-detail-head">
        <span className="stx-detail-icon" aria-hidden="true">
          <SubjectIcon tree={tree} />
        </span>
        <div>
          <h2 title={tree.name}>{tree.name}</h2>
          <span className="stx-detail-level">Level {tree.level.tier}</span>
        </div>
        <span className="stx-detail-xp">
          {tree.level.maxed
            ? `${format.number(tree.xp)} XP`
            : `${format.number(tree.level.xpInLevel)} / ${format.number(tree.level.xpRequired)} XP`}
        </span>
      </header>

      <div className="stx-detail-bar">
        <i style={{ width: `${tree.level.percent}%` }} />
      </div>

      <p className="stx-detail-blurb">{BRANCH_BLURB[branch.key]}</p>

      {/* The mock-up this page was built to had a "Level Benefits" list here —
          three abilities the level unlocks. There are none: a level in Ascen
          is a reading of what you did, not a key that turns anything on, and a
          list of invented perks would be the one dishonest panel on the page.
          What a level is *made of* is a real list, it is the same three
          quantities the branches count, and it is the answer to the question
          somebody asks when they click a subject. */}
      <h3 className="stx-detail-title">What this level is made of</h3>
      <ul className="stx-detail-facts">
        <li>
          <span className="stx-tick" aria-hidden="true" />
          {format.number(tree.xp)} XP filed under {tree.label}
        </li>
        <li>
          <span className="stx-tick" aria-hidden="true" />
          {format.number(tree.tasks)} finished {tree.tasks === 1 ? 'task' : 'tasks'}
        </li>
        <li>
          <span className="stx-tick" aria-hidden="true" />
          {format.number(tree.days)} separate {tree.days === 1 ? 'day' : 'days'} worked
        </li>
      </ul>

      <h3 className="stx-detail-title">Opens next</h3>
      {next ? (
        <div className="stx-next">
          <span className="stx-next-mark" aria-hidden="true">
            <i style={{ height: `${next.percent}%` }} />
          </span>
          <div>
            <strong>{next.name}</strong>
            <span>
              {branch.name} · {format.number(next.remaining)} {branch.unit} to go
            </span>
          </div>
          <span className="stx-next-pct">{Math.round(next.percent)}%</span>
        </div>
      ) : (
        <p className="stx-detail-note">
          Every node on this branch is open. There is nothing above {branch.nodes[branch.nodes.length - 1]?.name} —
          the branch stops where the reading stops being worth drawing, not where the work does.
        </p>
      )}

      <h3 className="stx-detail-title">{branch.name} nodes</h3>
      <ul className="stx-milestones">
        {branch.nodes.map((node) => (
          <li key={node.id} className={node.unlocked ? 'is-open' : node.next ? 'is-next' : 'is-far'}>
            <span className="stx-ms-name">{node.name}</span>
            <span className="stx-ms-state">
              {node.unlocked ? 'Open' : node.next ? 'In progress' : nodeUnit(node)}
            </span>
          </li>
        ))}
      </ul>

      {/* The mock-up's "Continue Learning". It goes to the task list, because
          that is the only thing on the account that moves any of these — a
          button that opened a lesson would be promising a course this app has
          never had. */}
      <Link to="/tasks" className="stx-cta">
        Open Tasks
      </Link>
    </aside>
  );
}

// --------------------------------------------------------------------------
// The page
// --------------------------------------------------------------------------
export default function SkillTrees() {
  useDocumentTitle('Skill Tree');

  const { data, loading, error, reload, username } = useUserData();
  const subjects = useSubjectIndex(username);
  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  const all = useMemo(() => skillTrees(tasks, subjects), [subjects, tasks]);
  const categories = useMemo(() => treeCategories(all), [all]);
  const unfiled = useMemo(() => unfiledTasks(tasks, subjects), [subjects, tasks]);

  const [category, setCategory] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [chosenBranch, setChosenBranch] = useState<TreeBranch['key']>('depth');
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);

  const trees = useMemo(
    () => (category ? all.filter((tree) => tree.group === category) : all),
    [all, category],
  );

  const root = useMemo(
    () => treeRoot(trees, category || 'All Skills'),
    [category, trees],
  );

  /** Distinct days across the view — the one figure the trees cannot be summed for. */
  const days = useMemo(
    () => daysAcross(tasks, subjects, new Set(trees.map((tree) => tree.key))),
    [subjects, tasks, trees],
  );

  /** How many of the category's subjects have been touched at all. */
  const reach = useMemo(() => {
    const inScope = [...subjects.values()].filter(
      (subject) => !category || subject.group === category,
    );
    return { have: trees.length, of: inScope.length };
  }, [category, subjects, trees]);

  // The chosen subject, falling back to the biggest one in view. Held rather
  // than reset when the category changes, so switching to a category the
  // chosen subject is not in lands on that category's own leader.
  const tree = trees.find((entry) => entry.key === chosen) ?? trees[0] ?? null;
  const branch = tree?.branches.find((entry) => entry.key === chosenBranch) ?? tree?.branches[0] ?? null;

  const choose = useCallback((key: string, next?: TreeBranch['key']) => {
    setChosen(key);
    if (next) setChosenBranch(next);
  }, []);

  // Escape leaves the expanded canvas. The button is still there, but a panel
  // covering the window with no keyboard way out is a trap.
  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full]);

  if (loading) return <Loading label="Growing your trees" />;
  if (!data) {
    return <ErrorState message={error ?? 'No account data yet.'} onRetry={username ? reload : undefined} />;
  }

  const progress = root.total > 0 ? (root.nodes / root.total) * 100 : 0;

  return (
    <div className="stx-page">
      <Ambient />
      <div className="stx-shell page-shell">
        <header className="stx-head">
          <div>
            <h1>Skill Tree</h1>
            <p>Grow your skills. Unlock your potential.</p>
          </div>
          {categories.length > 1 && (
            /* The same control as the column inside the canvas, and wired to
               the same state on purpose: the column is where a reader browses
               and this is where somebody who knows the name goes straight to
               it. Two views of one choice, never two choices. */
            <label className="stx-select-wrap">
              <span className="stx-sr">Category</span>
              <select
                className="stx-select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.key === '' ? 'All Categories' : entry.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        {all.length === 0 ? (
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
          <div className="stx-layout">
            <section className="stx-stats">
              <div className="stx-stat">
                <Ring percent={progress} />
                <div>
                  <span>Overall Progress</span>
                  <strong>{Math.round(progress)}%</strong>
                  <em>Across {category || 'all skills'}</em>
                </div>
              </div>
              <div className="stx-stat">
                <span className="stx-stat-icon is-green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0" />
                  </svg>
                </span>
                <div>
                  <span>Nodes Unlocked</span>
                  <strong>
                    {root.nodes}
                    <i> / {root.total}</i>
                  </strong>
                  <em>
                    {reach.have} of {reach.of} subjects started
                  </em>
                </div>
              </div>
              <div className="stx-stat">
                <span className="stx-stat-icon is-violet" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8Z" />
                  </svg>
                </span>
                <div>
                  <span>XP Filed</span>
                  <strong>{format.number(root.xp)}</strong>
                  <em>
                    {format.number(root.tasks)} tasks over {format.number(days)} days
                  </em>
                </div>
              </div>
            </section>

            <section className={`stx-canvas${full ? ' is-full' : ''}`}>
              <nav className="stx-cats" aria-label="Category">
                {categories.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`stx-cat${category === entry.key ? ' is-on' : ''}`}
                    aria-pressed={category === entry.key}
                    onClick={() => setCategory(entry.key)}
                  >
                    <span className="stx-cat-label">{entry.label}</span>
                    <span className="stx-cat-count">{entry.count}</span>
                  </button>
                ))}
              </nav>

              <div className="stx-canvas-scroll">
                <div className="stx-canvas-zoom" style={{ zoom }}>
                  <Graph
                    root={root}
                    trees={trees}
                    chosen={tree?.key ?? ''}
                    chosenBranch={branch?.key ?? 'depth'}
                    onChoose={choose}
                  />
                </div>
              </div>

              <div className="stx-zoom">
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={zoom >= ZOOM.max}
                  onClick={() => setZoom((z) => Math.min(ZOOM.max, Number((z + ZOOM.step).toFixed(2))))}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={zoom <= ZOOM.min}
                  onClick={() => setZoom((z) => Math.max(ZOOM.min, Number((z - ZOOM.step).toFixed(2))))}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={full ? 'Leave full screen' : 'Fill the window'}
                  aria-pressed={full}
                  onClick={() => setFull((value) => !value)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  </svg>
                </button>
              </div>
            </section>

            {tree && branch ? (
              <Detail tree={tree} branch={branch} />
            ) : (
              <aside className="stx-detail">
                <p className="stx-detail-note">
                  Nothing in this category yet. Pick another, or file a task under one of its
                  subjects.
                </p>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
