/**
 * Goals — what you are ultimately trying to accomplish.
 *
 * ## What this page is for, and what it is not
 *
 * The app has six pages that could all become a list of things to do, so the
 * line between them is drawn deliberately and this one is the strategic end of
 * it: the Dashboard answers *what should I do right now*, the Calendar answers
 * *when*, Analytics answers *why is this going the way it is*, Growth answers
 * *how capable am I becoming*, and this answers *what am I trying to accomplish
 * and what gets me there*. It connects to those without duplicating them —
 * which is why there is no task list here, no chart of XP over time, and no
 * skill levels.
 *
 * The hierarchy the whole page is built on:
 *
 *     GOAL       the outcome                Reach USACO Gold
 *      → MILESTONE   the checkpoint          Master Silver DP
 *         → TASK        the action           Solve ten DP problems
 *
 * A milestone is not a small task and a task is not a small milestone. The
 * checkpoint is a state the goal reaches; the tasks are evidence it is being
 * reached. That distinction is enforced everywhere: milestones drive the
 * percentage, tasks drive the health.
 *
 * ## Where the truth lives
 *
 * Nowhere on this page. `progress`, `status` and the checkpoint order are the
 * server's (backend/api/goals.py recomputes them after every write); health
 * and the readings are utils/goalHealth and utils/goalAnalytics. Every write
 * here is followed by a re-read rather than a patch, which is the rule the old
 * page already followed and the reason its numbers could not drift.
 *
 * ## The old page is still in here
 *
 * `GoalCard`, `GoalModal` and `MilestonesPanel` are the counter goals — earn N
 * XP, reach an N-day streak — and they still work exactly as they did. They
 * are under "Tracked counters" at the bottom, because an account that has been
 * using them has them and deleting somebody's data to tidy up a page is not a
 * refactor. New goals are outcomes; the counters are kept, not extended.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActiveGoalCard,
  Band,
  ConfirmModal,
  GoalDetail,
  GoalInsights,
  GoalModal,
  GoalsGreeting,
  GrowthAreas,
  Trajectory,
  GoalStats,
  GoalTable,
  GoalTabs,
  HealthBreakdown,
  GoalTimeline,
  GoalsCta,
  HealthRing,
  MilestoneCalendar,
  NewGoalWizard,
  NextMilestones,
  OverviewStrip,
  RecentlyCompleted,
  SystemGoals,
  VisionLine,
  goalNumbers,
  isOverdue,
  measureOf,
  msUntilNextDeadline,
} from '@/components/Goals';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useAuth, useDocumentTitle, usePageEntrance, useSubjectIndex, useUserData } from '@/hooks';
import { goals as goalService, tasks as taskService } from '@/services';
import type { NewGoal } from '@/services/goals';
import type { Goal, Milestone, MilestoneStatus, Task } from '@/types';
import type { TabId } from '@/components/Goals';
import '@/styles/goals.css';

/** How often to re-read while a focus goal is running. */
const FOCUS_POLL_MS = 30_000;

/**
 * How many goals the ladder and the timelines draw.
 *
 * Not a rendering budget — a statement about how many things can actually be
 * pursued at once. Past ten, a goals page stops being a plan and becomes a
 * list of things you feel bad about, and the eleventh goal is never the one
 * being worked on. Anything beyond it is still there, still counted in the
 * stats, and reachable from the quiet list below the ladder.
 */
const LIST_GOALS = 10;

/** Rows on one goal's rail. Same reasoning as above, applied to checkpoints. */
const TIMELINE_ROWS = 10;

export default function Goals() {
  useDocumentTitle('Goals');
  const { username } = useAuth();
  const account = useUserData();

  const [list, setList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The arrival cascade, which runs once — the shared one every page uses now.
     It has to stop: the bands remount when the tab changes, and a class still
     on the shell would replay the whole page every time somebody switched tab.
     See hooks/usePageEntrance for why it is bound to the read. */
  const entering = usePageEntrance(!loading);

  const [openId, setOpenId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  /** Bumped when a deadline passes, so the cards that just went overdue redraw. */
  const [, setTick] = useState(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!username) {
        setLoading(false);
        setError('Sign in to see your goals.');
        return;
      }
      if (!quiet) setLoading(true);
      const result = await goalService.getGoals();
      if (result.success) {
        setList(result.goals ?? []);
        setError(null);
      } else {
        setError(result.message);
      }
      setLoading(false);
    },
    [username],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const hasRunningFocus = useMemo(
    () => list.some((goal) => measureOf(goal) === 'focus' && goal.status === 'active'),
    [list],
  );

  useEffect(() => {
    if (!hasRunningFocus) return;
    const timer = setInterval(() => void load(true), FOCUS_POLL_MS);
    return () => clearInterval(timer);
  }, [hasRunningFocus, load]);

  useEffect(() => {
    const wait = msUntilNextDeadline(list);
    if (wait === null) return;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.max(wait, 0));
    return () => clearTimeout(timer);
  }, [list]);

  /** Every write goes through here: do it, then re-read rather than patching. */
  const write = useCallback(
    async (action: () => Promise<{ success: boolean; message?: string }>) => {
      setBusy(true);
      try {
        const result = await action();
        if (!result.success) {
          setError(result.message ?? 'That did not work.');
          return false;
        }
        await load(true);
        return true;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const tasks = useMemo(() => account.data?.tasks ?? [], [account.data]);

  /* The catalogue, so a chart that groups by subject can print "Competitive
     Math" rather than `competitive_math`. Falls back to a tidied id when a task
     names a subject the catalogue no longer has. */
  const subjects = useSubjectIndex(username);
  const subjectName = useCallback(
    (id: string) => subjects.get(id)?.name ?? id.replace(/_/g, ' '),
    [subjects],
  );

  /**
   * Tick off one of the next moves.
   *
   * Goes through the tasks service exactly as the dashboard does, so the XP,
   * the streak and the goal's own progress all move the way they would have if
   * it had been ticked off there — this is a second door onto the same act,
   * not a second implementation of it. Both reads are refreshed after: the
   * task list is the account's, and the goal's percentage is the server's.
   */
  const completeMove = useCallback(
    async (task: Task) => {
      if (!username || busy) return;
      setBusy(true);
      const result = await taskService.completeTask(task.id);
      setBusy(false);
      if (!result.success) {
        setError(result.message ?? 'That task could not be completed.');
        return;
      }
      await Promise.all([load(true), account.reload()]);
    },
    [account, busy, load, username],
  );

  /**
   * Add an action to a goal, from the goal's own card.
   *
   * A real task, created through the same service the tasks page uses, so it
   * shows on the dashboard, appears on the calendar and pays the same XP. It
   * carries the goal — and the checkpoint being worked on, where there is one —
   * which is what makes it come back to the card it was typed on. Nothing could
   * write that link until now; see `_link` in backend/api/tasks.py.
   */
  const addAction = useCallback(
    async (goal: Goal, title: string, milestoneId?: string) => {
      if (!username) return;
      const result = await taskService.createTask({
        name: title,
        priority: 'medium',
        xp_reward: 25,
        goal_id: goal.id,
        ...(milestoneId ? { milestone_id: milestoneId } : {}),
      });
      if (!result.success) {
        setError(result.message ?? 'That action could not be added.');
        return;
      }
      await Promise.all([load(true), account.reload()]);
    },
    [account, load, username],
  );

  /**
   * Point a task that already exists at this goal.
   *
   * The other half of "Add new action": work is often written down before the
   * goal it turns out to serve is, and retyping it would leave two tasks where
   * there is one piece of work. It is the same link `addAction` writes, through
   * the edit the tasks page already uses — so the task keeps its due date, its
   * subject and its history, and simply starts counting here.
   */
  const linkTask = useCallback(
    async (goal: Goal, task: Task, milestoneId?: string) => {
      if (!username) return;
      const result = await taskService.updateTask(task.id, {
        goal_id: goal.id,
        milestone_id: milestoneId ?? null,
      });
      if (!result.success) {
        setError(result.message ?? 'That task could not be linked.');
        return;
      }
      await Promise.all([load(true), account.reload()]);
    },
    [account, load, username],
  );

  // ---- Goal writes --------------------------------------------------------
  const createGoal = useCallback(
    async (draft: NewGoal) => {
      if (!username) return;
      const ok = await write(() => goalService.addGoal(draft));
      if (ok) setWizardOpen(false);
    },
    [username, write],
  );

  const saveGoal = useCallback(
    async (draft: NewGoal) => {
      if (!username) return;
      const ok = await write(() =>
        draft.id
          ? goalService.updateGoal(draft.id, {
              title: draft.title,
              description: draft.description,
              goal_type: draft.goal_type,
              priority: draft.priority,
              deadline: draft.deadline,
              target_xp: draft.target_xp,
              target_streak: draft.target_streak,
              target_tasks: draft.target_tasks,
              target_focus: draft.target_focus,
            })
          : goalService.addGoal(draft),
      );
      if (ok) {
        setModalOpen(false);
        setEditing(undefined);
      }
    },
    [username, write],
  );

  const setValue = useCallback(
    (goal: Goal, value: number) => {
      if (!username) return;
      void write(() => goalService.updateGoal(goal.id, { current_value: value }));
    },
    [username, write],
  );

  const confirmDelete = useCallback(async () => {
    if (!username || !pendingDelete) return;
    const gone = pendingDelete.id;
    await write(() => goalService.deleteGoal(gone));
    setPendingDelete(null);
    // The drawer was showing the goal that no longer exists.
    setOpenId((current) => (current === gone ? null : current));
  }, [username, pendingDelete, write]);

  // ---- Milestone writes ---------------------------------------------------
  const addMilestone = useCallback(
    (goal: Goal, title: string) => {
      if (!username) return;
      void write(() => goalService.addMilestone(goal.id, { title }));
    },
    [username, write],
  );

  const setMilestoneStatus = useCallback(
    (milestone: Milestone, status: MilestoneStatus) => {
      if (!username) return;
      void write(() => goalService.updateMilestone(milestone.id, { status }));
    },
    [username, write],
  );

  /** When a checkpoint is meant to be reached. Empty string clears it. */
  const setMilestoneDate = useCallback(
    (milestone: Milestone, date: string) => {
      if (!username) return;
      void write(() => goalService.updateMilestone(milestone.id, { target_date: date }));
    },
    [username, write],
  );

  const removeMilestone = useCallback(
    (milestone: Milestone) => {
      if (!username) return;
      void write(() => goalService.deleteMilestone(milestone.id));
    },
    [username, write],
  );

  const reorder = useCallback(
    (goal: Goal, order: string[]) => {
      if (!username) return;
      void write(() => goalService.reorderMilestones(goal.id, order));
    },
    [username, write],
  );

  /**
   * Ask the model to break a goal into its five checkpoints.
   *
   * Deliberately not routed through `write`: nothing is saved, so there is
   * nothing to re-read, and holding the page's busy flag for the length of a
   * model call would disable every other goal's buttons while one goal thinks.
   * The ladder owns its own spinner for exactly that reason.
   *
   * A failure here is a sentence on the page — no key configured, model
   * unreachable, an answer that could not be read — so it lands in `error`
   * beside every other message rather than throwing.
   */
  const suggestMilestones = useCallback(
    async (goal: Goal): Promise<string[] | null> => {
      if (!username) return null;
      const result = await goalService.suggestMilestones({ goalId: goal.id });
      if (!result.success) {
        setError(result.message);
        return null;
      }
      setError(null);
      return result.milestones ?? null;
    },
    [username],
  );

  /** Write a goal's whole checkpoint list. One call, then the usual re-read. */
  const saveMilestones = useCallback(
    (goal: Goal, titles: string[]) => {
      if (!username) return Promise.resolve(false);
      return write(() => goalService.setMilestones(goal.id, titles));
    },
    [username, write],
  );

  // ---- What goes where ----------------------------------------------------
  const active = useMemo(
    () =>
      list
        .filter((goal) => goal.status !== 'completed')
        .sort((a, b) => {
          // Overdue first, then by how much it matters, then by how close the
          // date is — which is the order a reader would put them in themselves.
          const overdue = Number(isOverdue(b)) - Number(isOverdue(a));
          if (overdue) return overdue;
          const weight = (Number(b.priority) || 5) - (Number(a.priority) || 5);
          if (weight) return weight;
          return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1;
        }),
    [list],
  );

  /** The outcome goals — what this page is now about. */
  const outcomes = useMemo(
    () => active.filter((goal) => ['number', 'milestones'].includes(measureOf(goal))),
    [active],
  );
  /** The ones drawn as ladders and given their own rail. See LIST_GOALS. */
  const shown = useMemo(() => outcomes.slice(0, LIST_GOALS), [outcomes]);

  /** The four counters the app feeds itself. Kept, not extended. */
  const counters = useMemo(
    () => active.filter((goal) => !['number', 'milestones'].includes(measureOf(goal))),
    [active],
  );

  /**
   * Which part of the page is showing.
   *
   * State rather than a route — see components/Goals/GoalTable for why. Every
   * band below is still built on every tab; only which of them render moves,
   * so switching tabs costs nothing and loses no scroll position within one.
   */
  const [tab, setTab] = useState<TabId>('active');
  const on = (...ids: TabId[]) => ids.includes(tab);

  const open = list.find((goal) => goal.id === openId) ?? null;

  if (loading) return <Loading label="Reading your goals" />;
  if (error && !list.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="gx-page">
      <Ambient />
      <div className={`gx-shell page-shell${entering ? ' pg-enter' : ''}`}>
        <header className="gx-head">
          <div>
            <h1>
              <span className="gx-head-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
              </span>
              Goals
            </h1>
            <p className="gx-quiet">What you are working toward.</p>
            <VisionLine goals={list} />
            {/* What you are carrying, before anything is described. The counts
                come from the same `goalsOverview` the tiles below read. */}
            <GoalsGreeting goals={list} tasks={tasks} />
          </div>
          <div className="gx-head-tools">
            <RefreshButton busy={busy} onRefresh={() => void load(true)} />
            <button
              type="button"
              className="gx-btn"
              onClick={() => setShowCompleted((shown) => !shown)}
            >
              {showCompleted ? 'Hide completed' : 'View completed'}
            </button>
            <button type="button" className="gx-btn is-primary" onClick={() => setWizardOpen(true)}>
              + New Goal
            </button>
          </div>
        </header>

        <GoalTabs tab={tab} onTab={setTab} />

        {error && <ErrorState message={error} onRetry={() => void load()} />}

        <div className="gx-main pg-stagger">

        {/* ---- Active Goals ---------------------------------------------
            One card per goal, at full width, and the card carries what used
            to be four separate bands: the ladder, the trajectory, the next
            moves against that goal, and its dates. See
            components/Goals/ActiveGoalCard. */}
        {on('active') && (
          <>
            {shown.length === 0 ? (
              <p className="gx-empty">
                No outcome goals yet. Something you either reached or did not — reach USACO
                Gold, ship Ascen v2, read 24 books.
                <button type="button" className="gx-link" onClick={() => setWizardOpen(true)}>
                  Set your first
                </button>
              </p>
            ) : (
              <div className="ag-list">
                {shown.map((goal) => (
                  <ActiveGoalCard
                    key={goal.id}
                    goal={goal}
                    tasks={tasks}
                    busy={busy}
                    onOpen={(entry) => setOpenId(entry.id)}
                    onEdit={(entry) => {
                      setEditing(entry);
                      setModalOpen(true);
                    }}
                    onDelete={setPendingDelete}
                    onComplete={(task) => void completeMove(task)}
                    onAddAction={(entry, title, milestoneId) =>
                      void addAction(entry, title, milestoneId)
                    }
                    onLinkTask={(entry, task, milestoneId) =>
                      void linkTask(entry, task, milestoneId)
                    }
                    onSuggest={suggestMilestones}
                    onSaveStones={saveMilestones}
                    nameOf={subjectName}
                  />
                ))}
              </div>
            )}

            {/* The eleventh goal onward. Still reachable, still counted — just
                not drawn as something being actively pursued. */}
            {outcomes.length > LIST_GOALS && (
              <Band
                title="Also carrying"
                hint="Still counted, not drawn as cards"
              >
                <ul className="gx-rest">
                  {outcomes.slice(LIST_GOALS).map((goal) => {
                    const numbers = goalNumbers(goal);
                    return (
                      <li key={goal.id}>
                        <button type="button" onClick={() => setOpenId(goal.id)}>
                          <span className="gx-rest-title">{goal.title}</span>
                          <span className="gx-quiet">{Math.round(numbers.progress)}%</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Band>
            )}
          </>
        )}

        {/* ---- Timeline ---------------------------------------------------
            When things land. One rail per goal rather than a single merged
            one: a combined timeline answers "what happens next to me", which
            Next Milestones already says; a rail per goal answers "how does
            this one land", and that is a question about one goal at a time.
            The calendar under them is the same checkpoints as months — the
            widest view of the smallest thing, so it goes last. */}
        {on('timeline') && (
          <>
            <Band title="Next Milestones" hint="What each goal is on now">
              <NextMilestones goals={list} tasks={tasks} onOpen={(goal) => setOpenId(goal.id)} />
            </Band>

            {shown.length > 0 && (
              <Band
                title="Goal Timelines"
                hint="Reached, and queued"
              >
                <div className="gx-rails">
                  {shown.map((goal) => (
                    <section className="gx-rail" key={goal.id}>
                      <button
                        type="button"
                        className="gx-rail-head"
                        onClick={() => setOpenId(goal.id)}
                      >
                        <span className="gx-rail-title">{goal.title}</span>
                        <span className="gx-quiet">{Math.round(goalNumbers(goal).progress)}%</span>
                      </button>
                      <GoalTimeline
                        goals={[goal]}
                        onOpen={(entry) => setOpenId(entry.id)}
                        onDate={setMilestoneDate}
                        limit={TIMELINE_ROWS}
                      />
                    </section>
                  ))}
                </div>
              </Band>
            )}

            <Band
              title="Milestone Calendar"
              hint="Darker days carry more"
            >
              <MilestoneCalendar goals={list} onOpen={(goal) => setOpenId(goal.id)} />
            </Band>
          </>
        )}

        {/* ---- System Goals -----------------------------------------------
            The counters the app keeps: XP, streak, tasks, focus. A tab of
            their own because they are a different kind of goal rather than a
            second view of the same ones — see components/Goals/SystemGoals. */}
        {on('system') && (
          <Band
            title="System Goals"
            hint="You set the target, Ascen keeps the count"
          >
            <SystemGoals
              counters={counters}
              onEdit={(goal) => {
                setEditing(goal);
                setModalOpen(true);
              }}
              onDelete={setPendingDelete}
              onNew={() => setWizardOpen(true)}
            />
          </Band>
        )}

        {/* ---- Stats ------------------------------------------------------
            Where you stand and what moves it. Everything here is commentary
            on the cards in the first tab, which is why none of it is on them:
            a card says how one goal is going, and these say how the set of
            them is going. */}
        {on('stats') && (
          <>
            <Band
              title="Where you stand"
              hint="Counted off your goals"
            >
              <GoalStats goals={list} />
              <OverviewStrip goals={list} tasks={tasks} />
            </Band>

            <Band
              title="Your trajectory"
              hint="How far each one has to go"
            >
              <Trajectory goals={outcomes} onOpen={(goal) => setOpenId(goal.id)} />
            </Band>

            <div className="gx-two">
              <Band title="Goal Insights" hint="From linked work only">
                <GoalInsights goals={list} tasks={tasks} onOpen={(goal) => setOpenId(goal.id)} />
              </Band>

              <Band title="Goal Health" hint="What is going to happen">
                <HealthRing goals={list} tasks={tasks} />
                <HealthBreakdown
                  goals={outcomes}
                  tasks={tasks}
                  onOpen={(goal) => setOpenId(goal.id)}
                />
              </Band>
            </div>

            <Band
              title="Growth areas"
              hint="Grouped by field, weighted by priority"
            >
              <GrowthAreas goals={list} />
            </Band>

            <Band
              title="All Goals"
              hint="Same columns for every goal"
            >
              <GoalTable
                goals={outcomes}
                tasks={tasks}
                onOpen={(goal) => setOpenId(goal.id)}
                onEdit={(goal) => {
                  setEditing(goal);
                  setModalOpen(true);
                }}
              />
            </Band>
          </>
        )}

        {/* ---- What has been reached --------------------------------------
            Not a tab of its own: it is one band, and the header button that
            reveals it works from wherever you are. */}
        {showCompleted && (
          <Band title="Recently Completed" hint="Already behind you">
            <RecentlyCompleted goals={list} />
          </Band>
        )}

        <GoalsCta onNew={() => setWizardOpen(true)} />
        </div>
      </div>


      {open && (
        <GoalDetail
          goal={open}
          tasks={tasks}
          busy={busy}
          onClose={() => setOpenId(null)}
          onEdit={(goal) => {
            setEditing(goal);
            setModalOpen(true);
          }}
          onDelete={setPendingDelete}
          onAddMilestone={addMilestone}
          onMilestoneStatus={setMilestoneStatus}
          onDeleteMilestone={removeMilestone}
          onReorder={reorder}
          onValue={setValue}
        />
      )}

      <NewGoalWizard
        open={wizardOpen}
        busy={busy}
        onClose={() => setWizardOpen(false)}
        onSave={(draft) => void createGoal(draft)}
      />

      <GoalModal
        open={modalOpen}
        goal={editing}
        busy={busy}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSave={saveGoal}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete this goal?"
        body="Its checkpoints go with it. Any tasks linked to it are kept — they lose the link, not the work."
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
