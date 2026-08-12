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
  Band,
  ConfirmModal,
  GoalCard,
  GoalDetail,
  GoalInsights,
  GoalModal,
  GoalTimeline,
  NewGoalWizard,
  OutcomeCard,
  OverviewStrip,
  RecentlyCompleted,
  goalNumbers,
  isOverdue,
  measureOf,
  msUntilNextDeadline,
} from '@/components/Goals';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useAuth, useDocumentTitle, useUserData } from '@/hooks';
import { goals as goalService } from '@/services';
import type { NewGoal } from '@/services/goals';
import type { Goal, Milestone, MilestoneStatus } from '@/types';
import '@/styles/goals.css';

/** How often to re-read while a focus goal is running. */
const FOCUS_POLL_MS = 30_000;

/** How many goals get a large card before the rest go in the quiet list. */
const PRIORITY_GOALS = 4;

export default function Goals() {
  useDocumentTitle('Goals');
  const { username } = useAuth();
  const account = useUserData();

  const [list, setList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      const result = await goalService.getGoals(username);
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

  // ---- Goal writes --------------------------------------------------------
  const createGoal = useCallback(
    async (draft: NewGoal) => {
      if (!username) return;
      const ok = await write(() => goalService.addGoal(username, draft));
      if (ok) setWizardOpen(false);
    },
    [username, write],
  );

  const saveGoal = useCallback(
    async (draft: NewGoal) => {
      if (!username) return;
      const ok = await write(() =>
        draft.id
          ? goalService.updateGoal(username, draft.id, {
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
          : goalService.addGoal(username, draft),
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
      void write(() => goalService.updateGoal(username, goal.id, { current_value: value }));
    },
    [username, write],
  );

  const confirmDelete = useCallback(async () => {
    if (!username || !pendingDelete) return;
    const gone = pendingDelete.id;
    await write(() => goalService.deleteGoal(username, gone));
    setPendingDelete(null);
    // The drawer was showing the goal that no longer exists.
    setOpenId((current) => (current === gone ? null : current));
  }, [username, pendingDelete, write]);

  // ---- Milestone writes ---------------------------------------------------
  const addMilestone = useCallback(
    (goal: Goal, title: string) => {
      if (!username) return;
      void write(() => goalService.addMilestone(username, goal.id, { title }));
    },
    [username, write],
  );

  const setMilestoneStatus = useCallback(
    (milestone: Milestone, status: MilestoneStatus) => {
      if (!username) return;
      void write(() => goalService.updateMilestone(username, milestone.id, { status }));
    },
    [username, write],
  );

  const removeMilestone = useCallback(
    (milestone: Milestone) => {
      if (!username) return;
      void write(() => goalService.deleteMilestone(username, milestone.id));
    },
    [username, write],
  );

  const reorder = useCallback(
    (goal: Goal, order: string[]) => {
      if (!username) return;
      void write(() => goalService.reorderMilestones(username, goal.id, order));
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
  /** The four counters the app feeds itself. Kept, not extended. */
  const counters = useMemo(
    () => active.filter((goal) => !['number', 'milestones'].includes(measureOf(goal))),
    [active],
  );

  const open = list.find((goal) => goal.id === openId) ?? null;

  if (loading) return <Loading label="Reading your goals" />;
  if (error && !list.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="gx-page">
      <Ambient />
      <div className="gx-shell page-shell">
        <header className="gx-head">
          <div>
            <h1>Goals</h1>
            <p className="gx-quiet">Turn long-term ambitions into measurable progress.</p>
          </div>
          <div className="gx-head-tools">
            <RefreshButton busy={busy} onRefresh={() => void load(true)} />
            <button
              type="button"
              className="gx-btn"
              onClick={() => setShowCompleted((on) => !on)}
            >
              {showCompleted ? 'Hide completed' : 'View completed'}
            </button>
            <button type="button" className="gx-btn is-primary" onClick={() => setWizardOpen(true)}>
              + New Goal
            </button>
          </div>
        </header>

        {error && <ErrorState message={error} onRetry={() => void load()} />}

        {/* ---- 1. Where everything stands ------------------------------- */}
        <OverviewStrip goals={list} tasks={tasks} />

        {/* ---- 2. The goals themselves ---------------------------------- */}
        <Band
          title="Your goals"
          hint="The ones that matter most first. Open one to see its checkpoints and why it is moving at the rate it is."
        >
          {outcomes.length === 0 ? (
            <p className="gx-empty">
              No outcome goals yet. An outcome is something you either got to or did not — reach
              USACO Gold, ship Ascen v2, read 24 books — as opposed to a counter, which is what the
              older goals below are.
            </p>
          ) : (
            <div className="gx-cards">
              {outcomes.slice(0, PRIORITY_GOALS).map((goal) => (
                <OutcomeCard
                  key={goal.id}
                  goal={goal}
                  tasks={tasks}
                  onOpen={(entry) => setOpenId(entry.id)}
                />
              ))}
            </div>
          )}

          {outcomes.length > PRIORITY_GOALS && (
            <ul className="gx-rest">
              {outcomes.slice(PRIORITY_GOALS).map((goal) => {
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
          )}
        </Band>

        {/* ---- 3. What is coming ---------------------------------------- */}
        <div className="gx-two">
          <Band title="What comes next" hint="Every unreached checkpoint, in date order.">
            <GoalTimeline goals={list} onOpen={(goal) => setOpenId(goal.id)} />
          </Band>

          <Band title="Goal insights" hint="Read off the work linked to each goal — never estimated.">
            <GoalInsights goals={list} tasks={tasks} onOpen={(goal) => setOpenId(goal.id)} />
          </Band>
        </div>

        {/* ---- 4. The counters, kept ------------------------------------- */}
        {counters.length > 0 && (
          <Band
            title="Tracked counters"
            hint="Goals the app fills in for you — XP, streaks, tasks and focus time."
          >
            {/* The old cards were drawn for a page that painted the whole
                document dark. `gx-legacy` gives them that surface back
                locally, rather than this page giving up its own. */}
            <div className="gx-legacy goals-list">
              {counters.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  busy={busy}
                  onEdit={(entry) => {
                    setEditing(entry);
                    setModalOpen(true);
                  }}
                  onDelete={setPendingDelete}
                  onAddProgress={() => undefined}
                  onSetProgress={() => undefined}
                  onGiveUp={setPendingDelete}
                  onMoreTime={(entry) => {
                    setEditing(entry);
                    setModalOpen(true);
                  }}
                />
              ))}
            </div>
          </Band>
        )}

        {/* ---- 5. What has been reached ---------------------------------- */}
        {showCompleted && (
          <Band title="Recently completed" hint="Goals and checkpoints already behind you.">
            <RecentlyCompleted goals={list} />
          </Band>
        )}
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
