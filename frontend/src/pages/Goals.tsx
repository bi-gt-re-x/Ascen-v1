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
  GoalDetail,
  GoalInsights,
  GoalLadder,
  GoalModal,
  GoalNotes,
  GoalsGreeting,
  GrowthAreas,
  Momentum,
  NextMoves,
  Trajectory,
  GoalStats,
  GoalTimeline,
  GoalsCta,
  HealthRing,
  MilestoneCalendar,
  NewGoalWizard,
  NextMilestones,
  OverviewStrip,
  RecentlyCompleted,
  VisionLine,
  goalNumbers,
  isOverdue,
  measureOf,
  msUntilNextDeadline,
  GoalsSidebar,
} from '@/components/Goals';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useAuth, useDocumentTitle, useUserData } from '@/hooks';
import { goals as goalService, notes as noteService, tasks as taskService } from '@/services';
import type { NewGoal } from '@/services/goals';
import type { Note } from '@/services/notes';
import type { Goal, Milestone, MilestoneStatus, Task } from '@/types';
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

  const [openId, setOpenId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  /** The margin notes. Read here so the band below can show them per goal. */
  const [notes, setNotes] = useState<Note[]>([]);

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

  /* The goal notes. Its own read rather than part of `load`: a note failing to
     arrive must not stop the goals rendering, so this one is quiet about its
     own failure and the band simply shows empty boxes. */
  const loadNotes = useCallback(async () => {
    if (!username) return;
    const result = await noteService.list(username);
    if (result.success) setNotes(result.notes.filter((note) => note.goal_id));
  }, [username]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

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
      const result = await taskService.completeTask(username, task.id);
      setBusy(false);
      if (!result.success) {
        setError(result.message ?? 'That task could not be completed.');
        return;
      }
      await Promise.all([load(true), account.reload()]);
    },
    [account, busy, load, username],
  );

  /** Write one goal's margin note. An emptied box deletes it rather than saving ''. */
  const saveNote = useCallback(
    async (goal: Goal, body: string, existing?: Note) => {
      if (!username) return;
      if (!body && existing) {
        await noteService.remove(username, existing.id);
        await loadNotes();
        return;
      }
      if (!body) return;
      const result = await noteService.save(username, {
        ...(existing ? { id: existing.id } : {}),
        title: goal.title,
        body,
        goal_id: goal.id,
      });
      if (!result.success) setError(result.message);
      await loadNotes();
    },
    [loadNotes, username],
  );

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

  /** When a checkpoint is meant to be reached. Empty string clears it. */
  const setMilestoneDate = useCallback(
    (milestone: Milestone, date: string) => {
      if (!username) return;
      void write(() => goalService.updateMilestone(username, milestone.id, { target_date: date }));
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
      const result = await goalService.suggestMilestones(username, { goalId: goal.id });
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
      return write(() => goalService.setMilestones(username, goal.id, titles));
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

  /** Which of the rail's two tabs is showing. See components/Goals/GoalsSidebar. */
  const [railTab, setRailTab] = useState<'goals' | 'system'>('goals');

  const open = list.find((goal) => goal.id === openId) ?? null;

  if (loading) return <Loading label="Reading your goals" />;
  if (error && !list.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="gx-page">
      <Ambient />
      <div className="gx-shell page-shell">
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
            <p className="gx-quiet">Turn long-term ambitions into measurable progress.</p>
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

        {/* The page and the rail beside it. Everything that was the page is
            now the left column; the rail is the standing answer to "what am I
            carrying", in the same place on every visit — the calendar's
            arrangement, for the same reason. */}
        <div className="gx-body">
        <div className="gx-main">

        {/* ---- 1. The goals themselves, and the route through each one ----
            The top of the page is the plan: every goal you are working on,
            how far into it you are, and the five checkpoints between here and
            done. Everything below this is commentary on it. */}
        <Band
          title="Your Goals"
          hint="Each one broken into five checkpoints. Tick one off as you reach it, rewrite any that stop being true, or have them suggested."
        >
          {shown.length === 0 ? (
            <p className="gx-empty">
              No outcome goals yet. An outcome is something you either got to or did not — reach
              USACO Gold, ship Ascen v2, read 24 books — as opposed to a counter, which is what the
              older goals below are.
            </p>
          ) : (
            <ol className="gx-ladders">
              {shown.map((goal) => (
                <GoalLadder
                  key={goal.id}
                  goal={goal}
                  busy={busy}
                  onOpen={(entry) => setOpenId(entry.id)}
                  onStatus={setMilestoneStatus}
                  onSave={saveMilestones}
                  onSuggest={suggestMilestones}
                />
              ))}
            </ol>
          )}

          {/* The eleventh goal onward. Still reachable, still counted — just
              not drawn as something being actively pursued. */}
          {outcomes.length > LIST_GOALS && (
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
          )}
        </Band>

        {/* ---- 1b. What to actually do -----------------------------------
            The page's answer to "so what now". Everything above describes the
            plan; this is the list of real, open, goal-linked tasks that move
            it, with the tick right here. It sits directly under the ladders
            because the two are one thought — the checkpoint and the work that
            reaches it — and everything below is commentary on both. */}
        <div className="gx-two gx-two-wide">
          <Band
            title="Next moves"
            hint="Open tasks that name one of your goals, soonest first. Ticking one here counts exactly as it would on the dashboard."
          >
            <NextMoves
              goals={list}
              tasks={tasks}
              busy={busy}
              onComplete={(task) => void completeMove(task)}
              onOpen={(goal) => setOpenId(goal.id)}
            />
          </Band>

          <Band
            title="Momentum"
            hint="The last seven days, counted off goal-linked work only."
          >
            <Momentum goals={list} tasks={tasks} />
          </Band>
        </div>

        {/* ---- 2. Where everything stands -------------------------------- */}
        <Band
          title="Where you stand"
          hint="Counted off the goals above — a goal is complete when its own checkpoints say so."
        >
          <GoalStats goals={list} />
          <OverviewStrip goals={list} tasks={tasks} />
        </Band>

        {/* ---- 3. What comes next --------------------------------------- */}
        <Band title="Next Milestones" hint="The checkpoint each goal is on now.">
          <NextMilestones goals={list} tasks={tasks} onOpen={(goal) => setOpenId(goal.id)} />
        </Band>

        {/* ---- 3b. Where each one is going -------------------------------
            A percentage says 88% and hides what 88% is of. The rail draws the
            scale, marks the value on it and prints what is left — and a
            checkpoint goal, which has no scale, gets its stops instead. */}
        <Band
          title="Your trajectory"
          hint="Where each goal stands on its own scale, and what is still to cover."
        >
          <Trajectory goals={outcomes} onOpen={(goal) => setOpenId(goal.id)} />
        </Band>

        <Band
          title="Growth areas"
          hint="Your active goals grouped by field, with progress weighted by how much each matters."
        >
          <GrowthAreas goals={list} />
        </Band>

        {/* ---- 4. Why ---------------------------------------------------- */}
        <div className="gx-two">
          <Band title="Goal Insights" hint="Counted off the work linked to each goal — never estimated.">
            <GoalInsights goals={list} tasks={tasks} onOpen={(goal) => setOpenId(goal.id)} />
          </Band>

          <Band title="Goal Health" hint="How much of what you are carrying is going to happen.">
            <HealthRing goals={list} tasks={tasks} />
          </Band>
        </div>

        {/* ---- 5. The counters ------------------------------------------
            Moved to the rail's System Goals tab. They were here under
            "Tracked counters", drawn with the old GoalCard inside a
            `gx-legacy` wrapper whose only job was to hand those cards back the
            dark surface they were designed against — a stylesheet this page
            stopped using. See components/Goals/GoalsSidebar. */}

        {/* ---- 6. When, goal by goal -------------------------------------
            One rail each, rather than the single merged rail this page used
            to draw. A combined timeline answers "what happens next to me",
            which is what Next Milestones above already says; a rail per goal
            answers "how does this one actually land", and that is a question
            about one goal at a time. Ten rows each, for the same reason the
            ladder holds five: a rail long enough to scroll past is a rail
            nobody reads to the end of. */}
        {shown.length > 0 && (
          <Band
            title="Goal Timelines"
            hint="Each goal on its own rail — what you have reached, and what is queued."
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

        {/* ---- 7. What has been reached ---------------------------------- */}
        {showCompleted && (
          <Band title="Recently Completed" hint="Goals and milestones already behind you.">
            <RecentlyCompleted goals={list} />
          </Band>
        )}

        {/* ---- 7b. Your own words ----------------------------------------
            The one thing on the page that is not derived. See components/
            Goals/GoalNotes for why a goals page needs somewhere to put the
            reason a number cannot hold. */}
        <Band
          title="Goal notes"
          hint="A line each, in your words. Saved when you click away, and readable from the notes page like any other note."
        >
          <GoalNotes
            goals={outcomes}
            notes={notes}
            busy={busy}
            onSave={(goal, body, existing) => void saveNote(goal, body, existing)}
            onOpen={(goal) => setOpenId(goal.id)}
          />
        </Band>

        {/* ---- 8. The same checkpoints, as months --------------------------
            Last on the page because it is the widest view of the smallest
            thing: every rail above is one goal in order, and this is all of
            them at once, on the days they actually land. It answers the
            question the lists cannot — which weeks are full — so it belongs
            after them rather than instead of them. */}
        <Band
          title="Milestone Calendar"
          hint="Every dated checkpoint on the day it lands. Darker days carry more; pick one to see what."
        >
          <MilestoneCalendar goals={list} onOpen={(goal) => setOpenId(goal.id)} />
        </Band>

        <GoalsCta onNew={() => setWizardOpen(true)} />
        </div>

          <GoalsSidebar
            outcomes={outcomes}
            counters={counters}
            tab={railTab}
            onTab={setRailTab}
            onOpen={(goal) => setOpenId(goal.id)}
            onEdit={(goal) => {
              setEditing(goal);
              setModalOpen(true);
            }}
            onDelete={setPendingDelete}
            onNew={() => setWizardOpen(true)}
          />
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
