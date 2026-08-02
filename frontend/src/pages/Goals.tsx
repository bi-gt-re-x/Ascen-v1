/**
 * Goals — targets, their progress, and the milestones they become.
 *
 * Ported from frontend/js/goal.js (1,371 lines) and frontend/html/goals.html.
 * The markup and class names are the originals, so styles/goals.css dresses
 * this page unchanged; what has actually changed is where the truth lives.
 *
 * **The backend decides.** The original kept `allGoals` as a module-level
 * array and hand-patched it after every write — updating a card's DOM in place
 * on success, recomputing the counters, re-rendering the milestones panel —
 * so the same numbers were derived in two places and could disagree after a
 * failed write. Here a write is followed by a re-read, and every derived
 * figure (the weighted overall bar, the three counters, the donut, the
 * milestone list) is computed from that one array on render. There is no
 * second copy to fall out of step.
 *
 * **The focus poll.** A focus goal advances on its own, from tracked focus
 * time, so the original re-pulled the list every 30s while one was active.
 * That is kept, and it is why `getGoals` is the refresh call: the backend
 * re-syncs the self-tracking types while answering it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ConfirmModal,
  GoalCard,
  GoalModal,
  GoalsHeader,
  GoalsSummaryRow,
  MilestonesPanel,
  goalNumbers,
  isOverdue,
  msUntilNextDeadline,
} from '@/components/Goals';
import { ErrorState, Loading } from '@/components';
import { useAuth, useDocumentTitle } from '@/hooks';
import { goals as goalService } from '@/services';
import type { NewGoal } from '@/services/goals';
import type { Goal } from '@/types';
import '@/styles/goals.css';

/** How often to re-read while a focus goal is running. */
const FOCUS_POLL_MS = 30_000;

export default function Goals() {
  useDocumentTitle('Goals');
  const { username } = useAuth();

  const [list, setList] = useState<Goal[]>([]);
  const [avgXpPerDay, setAvgXpPerDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const [pendingGiveUp, setPendingGiveUp] = useState<Goal | null>(null);
  const [extending, setExtending] = useState<Goal | null>(null);
  const [newDeadline, setNewDeadline] = useState('');

  /**
   * Bumped when a deadline passes, so the cards that just went overdue
   * re-render. The original armed a `setTimeout` per goal; one timer for the
   * soonest deadline does the same work — see msUntilNextDeadline for why the
   * delay is clamped.
   */
  const [, setTick] = useState(0);

  /**
   * Read the goals. `quiet` skips the spinner, which is what the 30s focus
   * poll wants — a page that flickers back to "Loading…" twice a minute is
   * worse than one that simply updates.
   */
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
        setAvgXpPerDay(result.avg_xp_per_day ?? 0);
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

  // Focus goals creep forward on their own; keep the page honest while one is
  // running, and stop asking the moment none is.
  const hasRunningFocus = useMemo(
    () => list.some((g) => g.goal_type === 'focus' && g.status === 'active'),
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

  const addProgress = useCallback(
    (goal: Goal, amount: number) => {
      const key =
        goal.goal_type === 'tasks'
          ? 'tasks'
          : goal.goal_type === 'streak'
            ? 'streak'
            : 'xp';
      void write(() => goalService.addProgress(goal.id, { [key]: amount }));
    },
    [write],
  );

  /**
   * The "Set" box raises the counter to a figure typed in. The endpoint adds
   * rather than assigns, so the difference is what gets sent — and a figure at
   * or below the current one is a no-op rather than a negative nudge.
   */
  const setProgress = useCallback(
    (goal: Goal, value: number) => {
      const { current } = goalNumbers(goal);
      const delta = value - current;
      if (delta <= 0) return;
      addProgress(goal, delta);
    },
    [addProgress],
  );

  const confirmGiveUp = useCallback(async () => {
    if (!username || !pendingGiveUp) return;
    await write(() => goalService.deleteGoal(username, pendingGiveUp.id));
    setPendingGiveUp(null);
  }, [username, pendingGiveUp, write]);

  const saveDeadline = useCallback(async () => {
    if (!username || !extending || !newDeadline) return;
    const ok = await write(() =>
      goalService.updateGoal(username, extending.id, { deadline: newDeadline }),
    );
    if (ok) {
      setExtending(null);
      setNewDeadline('');
    }
  }, [username, extending, newDeadline, write]);

  const confirmDelete = useCallback(async () => {
    if (!username || !pendingDelete) return;
    await write(() => goalService.deleteGoal(username, pendingDelete.id));
    setPendingDelete(null);
  }, [username, pendingDelete, write]);

  const openAdd = useCallback(() => {
    setEditing(undefined);
    setModalOpen(true);
  }, []);

  // Overdue first — the original moved the node to the head of the list; this
  // is the same order without touching the DOM.
  const active = list
    .filter((g) => g.status !== 'completed')
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));

  if (loading) return <Loading />;
  if (error && !list.length)
    return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="goals-page">
      <div className="goals-shell">
        <GoalsHeader goals={list} onNewGoal={openAdd} />

        <div className="goals-columns">
          <div className="goals-main">
            <GoalsSummaryRow goals={list} avgXpPerDay={avgXpPerDay} />

            {/* Active goals only live here — completed ones become Milestones. */}
            <div className="goals-toolbar">
              <h2 className="goals-heading">Active Goals</h2>
              <button type="button" className="add-goal-btn" onClick={openAdd}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add New Goal
              </button>
            </div>

            <div className="goals-list" id="goalsList">
              {active.length === 0 ? (
                <div className="no-goals" id="noGoals">
                  <p>
                    No goals yet. Create your first goal to start tracking your
                    progress!
                  </p>
                </div>
              ) : (
                active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    busy={busy}
                    onEdit={(g) => {
                      setEditing(g);
                      setModalOpen(true);
                    }}
                    onDelete={setPendingDelete}
                    onAddProgress={addProgress}
                    onSetProgress={setProgress}
                    onGiveUp={setPendingGiveUp}
                    onMoreTime={(g) => {
                      setExtending(g);
                      setNewDeadline(g.deadline ?? '');
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <MilestonesPanel goals={list} onDelete={setPendingDelete} />
        </div>
      </div>

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
        title="Delete Goal"
        body="Are you sure you want to delete this goal? This action cannot be undone."
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmModal
        open={pendingGiveUp !== null}
        title="Give Up on Goal?"
        body="Are you sure you want to give up on this goal? This will delete it permanently and cannot be undone."
        confirmLabel="Yes, Give Up"
        cancelLabel="No, Keep It"
        busy={busy}
        onCancel={() => setPendingGiveUp(null)}
        onConfirm={() => void confirmGiveUp()}
      />

      {extending && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <span
              className="close"
              role="button"
              aria-label="Close"
              onClick={() => setExtending(null)}
            >
              ×
            </span>
            <h2>Extend Goal Deadline</h2>
            <label htmlFor="newGoalDeadline">New Deadline:</label>
            <input
              type="date"
              id="newGoalDeadline"
              className="due-date-input"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />
            <button
              type="button"
              className="confirm-add-btn"
              disabled={busy || !newDeadline}
              onClick={() => void saveDeadline()}
            >
              Update Deadline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
