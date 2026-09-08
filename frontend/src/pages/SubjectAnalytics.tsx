/**
 * One subject, on its own.
 *
 * ## What this page is for, and why it is not a tab
 *
 * The analytics page has a Subjects tab already, and it answers a different
 * question: it ranks the account's subjects against each other, so a reader
 * can see which of them is getting the work. This page answers the question
 * that ranking cannot — *how is this one going* — with the whole screen given
 * to a single subject rather than a row in a table of them.
 *
 * It is a page rather than an eighth tab because there is one of these per
 * followed subject. Tabs are a fixed set the reader learns; four of them
 * appearing because somebody answered a wizard question would make the tab bar
 * a different shape on every account, and the bar is already at seven. The
 * rail's Analytics entry unfolds into the list instead — Overall, then one row
 * per subject — which is the control that can grow without the page changing
 * shape. See `analytics_subjects` in services/settings.
 *
 * ## Where the numbers come from, and where they do not
 *
 * Two calls, and no more: `/api/analytics/tasks` — the same sixteen columns
 * the analytics page reads — and the goals. Nothing is fetched per panel and
 * nothing is fetched per subject: the filter is a comparison on
 * `task.subject`, so opening four of these pages costs what opening one does.
 * The arithmetic is in ./components/Subject/model, a pure function of the
 * tasks, the goals, the window and the day; this file lays out what it worked
 * out.
 *
 * The goals are the second call because **what to do next is read against what
 * the subject is for**. A page that ranks its advice by whichever of its own
 * measures is lowest is ranking by its arithmetic rather than by the reader's
 * intention — "Quality is the measure holding the grade down" is a true
 * sentence answering a question nobody asked. A goal on this subject leads the
 * recommendations, and the measures explain why it will or will not land.
 *
 * ## The skill tree is beside the record, not mixed into it
 *
 * Each subject opens a lattice (skills/subjectTrees), and the wizard lets a
 * reader name the branch of it they want to go deeper into. That tree is
 * **authored** — every node is written by hand and its state is illustrative —
 * so it is drawn as a route map next to the record rather than as a reading of
 * it. Mixing the two would put a designer's guess in the same panel as counted
 * evidence, and nothing on screen would say which was which.
 *
 * **The sections are the ones that were asked for. The figures are the ones
 * that are true.** A page about Mathematics wants to say "Geometry 68%,
 * Algebra 94%", and Ascen has no evidence for either: tasks carry a subject
 * and nothing finer, and the skill trees that do name sub-skills are authored
 * hierarchies whose states are illustrative. So the sub-skill breakdown is the
 * *difficulty bands*, which are recorded on every rated task, and the mistake
 * analysis is the *twelve reasons*, which exist as a closed vocabulary
 * precisely so they can be counted. The model's own note has the full mapping.
 * Nothing on this page is a placeholder, and nothing is invented — which is
 * the rule the analytics page states about itself and the reason its figures
 * are worth reading at all.
 *
 * ## A panel that has nothing to say does not draw
 *
 * Every section below is gated on its own evidence rather than on the page
 * having loaded. A subject with no rated tasks has no quality figure, no
 * bands and no reasons, and the honest page for it is a short one that says
 * what it is waiting for — not eight panels of dashes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import { AreaChart } from '@/components/Analytics';
import { WINDOWS, type WindowKey } from '@/components/Analytics/data';
import { subjectModel, type SubjectGoal } from '@/components/Subject/model';
import { latticeFor } from '@/components/Subject/lattice';
import { loadProgress } from '@/utils/skillProgress';
import { treeStanding } from '@/skills/standing';
import { useApi, useAuth, useDocumentTitle, useSettings, useSubjectIndex } from '@/hooks';
import {
  analyticsTasks,
  saveSubjectMilestones,
  subjectBriefAvailable,
  subjectMilestones,
  suggestSubjectGoal,
  writeGoalPlan,
  writeSubjectBrief,
  type GoalDraft,
  type GoalPlan,
  type SubjectBrief,
  type SubjectMilestone,
} from '@/services/analytics';
import { getGoals } from '@/services/goals';
import { format } from '@/utils';
import '@/styles/analytics.css';
import '@/styles/subject.css';

/** Today, as the ISO day every window here is measured back from. */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** A signed percentage, with the arrow the spec's own tables use. */
function Delta({ value, unit = '%' }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="sb-delta is-flat">—</span>;
  if (value === 0) return <span className="sb-delta is-flat">→ no change</span>;
  return (
    <span className={`sb-delta ${value > 0 ? 'is-up' : 'is-down'}`}>
      {value > 0 ? '↑' : '↓'} {Math.abs(value)}
      {unit}
    </span>
  );
}

/** A 0-100 bar. Labelled by its row, so it is decoration and hidden. */
function Bar({ percent }: { percent: number }) {
  return (
    <span className="sb-bar" aria-hidden="true">
      <span className="sb-bar-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

/** 0-100, for a width or an offset written straight into a style. */
function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** A figure with more than a couple of significant digits is noise here. */
function per(value: number): string {
  return value >= 10 ? Math.round(value).toLocaleString() : value.toFixed(1);
}

/**
 * The counted figures under one goal.
 *
 * Assembled rather than written out as JSX because every one of them is
 * conditional on its own evidence — a goal with no date has no days left, a
 * milestone goal has no quantity to be short of — and a grid of dashes is
 * worse than a shorter grid. Nothing here is computed: the model works all of
 * it out (components/Subject/model), and this decides which of it can honestly
 * be printed and what to call it.
 */
function planFacts(goal: SubjectGoal): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];

  if (goal.numeric && goal.target > 0) {
    facts.push({
      label: 'Still to go',
      value: `${per(goal.remaining ?? 0)} ${goal.unit}`,
    });
  }
  if (goal.stagesTotal > 0) {
    facts.push({
      label: 'Checkpoints',
      value: `${goal.stagesDone} of ${goal.stagesTotal}`,
    });
  }
  if (goal.daysLeft !== null) {
    facts.push({
      label: goal.daysLeft < 0 ? 'Overdue by' : 'Days left',
      value: `${Math.abs(goal.daysLeft)} ${Math.abs(goal.daysLeft) === 1 ? 'day' : 'days'}`,
    });
  }
  if (goal.need !== null) {
    facts.push({ label: 'Needs a week', value: `${per(goal.need * 7)} ${goal.unit}` });
  }
  if (goal.have !== null) {
    facts.push({ label: 'Getting a week', value: `${per(goal.have * 7)} ${goal.unit}` });
  }
  if (goal.lands && goal.deadline) {
    facts.push({ label: 'Lands', value: goal.lands });
  }
  /* The two that are this page's alone. Every other figure above is on the
     goals page too; these say what *this subject* has put into it, which is
     the thing a page about one subject can answer and a goal card cannot. */
  facts.push({
    label: 'Aimed at it',
    value: goal.ofFinished
      ? `${goal.aimed} of ${goal.ofFinished} tasks`
      : 'nothing finished here',
  });
  /* The fortnight is named in the value rather than the label, because it is
     the one figure here measured over something other than the page's window
     and a reader who missed that would read it as a share of the year. */
  facts.push({ label: 'Days worked', value: `${goal.recentDays} of last 14` });

  return facts;
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ax-panel sb-panel">
      <div className="ax-panel-head">
        <div className="ax-panel-title">
          <h2>{title}</h2>
        </div>
      </div>
      {note && <p className="ax-panel-note">{note}</p>}
      {children}
    </section>
  );
}

export default function SubjectAnalytics() {
  const { subjectId = '' } = useParams();
  const { username } = useAuth();
  const { prefs, update } = useSettings();
  const catalogue = useSubjectIndex(username);
  const subject = catalogue.get(subjectId);

  /* The window opens on the account's own analytics preference, so this page
     and the analytics page agree about what "recently" means on arrival. It is
     local state after that: the two pages are read in sequence and a picker
     that wrote back would change the other page under the reader. */
  const [span, setSpan] = useState<WindowKey>(prefs.analytics_window);

  const call = useMemo(
    () =>
      username
        ? analyticsTasks
        : () => Promise.resolve({ success: false as const, message: 'Sign in to see a subject.' }),
    [username],
  );
  const tasks = useApi(call, [username]);

  /* The second and last call. Goals lead the recommendations — what to do next
     is read against what the subject is *for* rather than against whichever
     internal measure is lowest — and there is no way to know that from tasks
     alone: the link is `subject_ids` on the goal. */
  const goalCall = useMemo(
    () =>
      username
        ? getGoals
        : () => Promise.resolve({ success: false as const, message: 'Sign in to see goals.' }),
    [username],
  );
  const goals = useApi(goalCall, [username]);

  const today = todayIso();
  const model = useMemo(
    () =>
      subjectModel(
        tasks.data?.tasks ?? [],
        subjectId,
        span,
        today,
        goals.data?.goals ?? [],
      ),
    [goals.data, span, subjectId, tasks.data, today],
  );

  /**
   * The model's write-up, and whether it can be asked for at all.
   *
   * Pressed rather than automatic, and that is not a performance decision: the
   * call costs the account's owner money, and a panel that spent it on every
   * page load would be spending it on every reader who came to look at a
   * number. Nothing on this page depends on it — the write-up is a reading of
   * findings that are already all on screen.
   */
  const [brief, setBrief] = useState<SubjectBrief | null>(null);
  const [writing, setWriting] = useState(false);
  const [briefError, setBriefError] = useState('');
  const [canWrite, setCanWrite] = useState(false);

  /* Asked once, so an install with no key draws no button at all. A control
     that is always there and says "no key" when pressed is a worse answer
     than no control. */
  useEffect(() => {
    if (!username) return;
    let live = true;
    void subjectBriefAvailable().then((result) => {
      if (live) setCanWrite(result.success && result.available);
    });
    return () => {
      live = false;
    };
  }, [username]);

  /* Cleared when the window or the subject changes: a reading of the last
     ninety days sitting under a page now showing seven is prose about figures
     that are no longer on screen. */
  useEffect(() => {
    setBrief(null);
    setBriefError('');
  }, [span, subjectId]);

  const write = useCallback(async () => {
    if (!subject) return;
    setWriting(true);
    setBriefError('');
    /* Exactly what the page is showing, and nothing it is not. The server
       sends these to the model and forbids it any number that is not among
       them — so a figure here that the page did not draw would be a figure
       the reader cannot check. */
    const result = await writeSubjectBrief({
      subject: subject.name,
      span: WINDOWS.find((option) => option.key === span)?.label ?? '',
      /* What this subject is for, in the reader's own words. It is what turns
         "your hardest band is weakest" into "and here is what to chase next" —
         without it the model is reading a table with no destination. */
      aim: ambition?.aim ?? '',
      level: ambition?.level ?? '',
      checkpoints: milestones.filter((entry) => !entry.done).map((entry) => entry.title),
      score: model.score,
      grade: model.grade,
      finished: model.finished,
      finished_before: model.finishedBefore,
      streak: model.streak,
      rates: model.rates
        .filter((rate) => rate.known)
        .map((rate) => ({ label: rate.label, now: Math.round(rate.now) })),
      bands: model.bands
        .filter((band) => band.done > 0)
        .map((band) => ({
          label: band.label,
          done: band.done,
          holding: band.holding === null ? null : Math.round(band.holding),
        })),
      struggles: model.struggles.map((driver) => ({
        label: driver.label,
        share: driver.share,
        count: driver.count,
      })),
      goals: model.goals.map((goal) => ({
        title: goal.title,
        progress: Math.round(goal.progress),
        deadline: goal.deadline,
        drift: goal.drift,
      })),
    });
    setWriting(false);
    if (result.success) setBrief(result.brief);
    else setBriefError(result.message || 'Could not write this up.');
  }, [model, span, subject]);

  /**
   * The lattice this subject opens on, and what the reader has practised of it.
   *
   * Read from the practice store rather than fetched — it is local to the
   * browser (utils/skillProgress), so this costs no request. Recomputed when
   * the subject or the chosen branch changes and not otherwise: the store only
   * moves on the skill tree page, which is a navigation away from here.
   */
  const lattice = useMemo(
    () =>
      subject
        ? latticeFor(
            subjectId,
            subject.group,
            prefs.analytics_subject_depth[subjectId],
            loadProgress(username),
          )
        : null,
    [prefs.analytics_subject_depth, subject, subjectId, username],
  );

  /**
   * How far into this subject's lattice the account's own work has got.
   *
   * The panel below says what the tree *contains*, which is authored and the
   * same for everybody. This is the half that is about the reader: XP filed
   * under every subject that opens this tree, against what the tree is worth.
   * See skills/standing, which is also what the Subjects tab and the Mastery
   * badges read, so the three cannot disagree about the same account.
   *
   * Counted over every finished task rather than over the window this page is
   * scoped to. Everything else here is a statement about the window and this
   * is not, deliberately: a lattice is a curriculum rather than a quarter.
   *
   * Sibling subjects count. Algebra and Geometry open the Mathematics tree, so
   * a reader on the Algebra page is told where *the tree* stands, not where
   * their algebra tasks alone stand — the tree is the thing being measured.
   */
  const standing = useMemo(() => {
    const xp = new Map<string, number>();
    for (const task of tasks.data?.tasks ?? []) {
      const key = task.subject ?? '';
      if (task.status !== 'done' || !key) continue;
      xp.set(key, (xp.get(key) ?? 0) + (Number(task.xp_value) || 0));
    }
    const rows = treeStanding([...xp].map(([key, total]) => ({ key, xp: total })));
    return rows.find((tree) => tree.subjects.includes(subjectId))
      ?? rows.find((tree) => tree.title === lattice?.title)
      ?? null;
  }, [lattice?.title, subjectId, tasks.data]);

  /**
   * The checkpoints set against this subject, and the goal drafted from them.
   *
   * Checkpoints first, goal second, which is the order people actually work
   * in: everybody knows roughly what the stages of a subject are long before
   * they have settled on a target, a date and a number. The draft turns the
   * stages into the goal, and the goal is what orders the recommendations at
   * the top of this page — so the loop closes here.
   */
  const ambition = prefs.analytics_ambitions[subjectId];
  const [milestones, setMilestones] = useState<SubjectMilestone[]>([]);
  const [adding, setAdding] = useState('');
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (!username || !subjectId) return;
    let live = true;
    void subjectMilestones().then((result) => {
      if (live && result.success) setMilestones(result.milestones[subjectId] ?? []);
    });
    return () => {
      live = false;
    };
  }, [subjectId, username]);

  /* Applied here and stored in the background, the way the rail's collapse is:
     a checkbox that waited for a round trip before ticking feels broken, and
     there is nothing to roll back to — the list on screen is what was sent. */
  const putMilestones = useCallback(
    (next: SubjectMilestone[]) => {
      setMilestones(next);
      void saveSubjectMilestones(subjectId, next);
    },
    [subjectId],
  );

  const askForGoal = useCallback(async () => {
    if (!subject) return;
    setDrafting(true);
    setDraftError('');
    setCreated(false);
    const result = await suggestSubjectGoal({
      subject: subject.name,
      finished: model.finished,
      days: model.span.days,
      active_days: new Set(
        model.done.map((task) => String(task.completed_at ?? '').slice(0, 10)).filter(Boolean),
      ).size,
      hours: Math.round((model.invested / 3600) * 10) / 10,
      milestones: milestones.map((entry) => entry.title),
    });
    setDrafting(false);
    if (result.success) setDraft(result.draft);
    else setDraftError(result.message || 'Could not draft a goal.');
  }, [milestones, model, subject]);

  /**
   * Keeping a draft writes it here, not to the goals page.
   *
   * It drafted a goal through `/api/add_goal` for one commit, and that was the
   * wrong store. A goal on the goals page is a commitment with a number, a
   * date and progress read off the record; "get to Mathcounts Nationals" is
   * none of those, and putting it there would have given it a progress bar
   * nobody can honestly fill in. What it actually is is the sentence that says
   * what this subject is *for* — so it lands in `analytics_ambitions`, beside
   * the aim the setup questions ask for, where the read-out above can read it.
   *
   * The stages become this subject's checkpoints, which is the same store the
   * list above already edits.
   */
  const keepDraft = useCallback(async () => {
    if (!draft) return;
    const saved = await update({
      analytics_ambitions: {
        ...prefs.analytics_ambitions,
        [subjectId]: {
          aim: `${draft.title} — ${draft.target} ${draft.unit} over ${draft.weeks} weeks`,
          level: prefs.analytics_ambitions[subjectId]?.level ?? '',
        },
      },
    });
    if (!saved) {
      setDraftError('Could not keep that. Try again.');
      return;
    }
    if (draft.milestones.length > 0) {
      putMilestones(
        draft.milestones.map((title, at) => ({ id: `d${at}-${Date.now()}`, title, done: false })),
      );
    }
    setCreated(true);
    setDraft(null);
  }, [draft, prefs.analytics_ambitions, putMilestones, subjectId, update]);

  /**
   * The route to one goal, written by a model, kept per goal.
   *
   * ## Why this is a second model call and not part of the write-up
   *
   * The write-up below is about the *subject*: how it is going, and what to
   * practise. This is about one goal, and a reader with two goals on a subject
   * gets two different plans — which is the whole point, and is not something
   * one panel about the subject can do.
   *
   * What the model adds is the thing the arithmetic cannot. `leversFor` in
   * components/Subject/model can work out that a goal needs 1.6 points a week
   * and is getting 1.2. It cannot know what a point on the AMC 8 is made of,
   * and so it cannot turn that into an order to do the work in. That requires
   * knowing what the goal names, which is knowledge about the world rather
   * than a claim about the reader — the argument backend/tracking/goal_plan.py
   * makes at length, and the same one backend/tracking/subject_brief.py makes
   * for the write-up.
   *
   * ## Pressed, per goal, and never on load
   *
   * It costs the account's owner money. A panel that spent that on every page
   * load would be spending it on every reader who came to look at a number,
   * and keyed by goal so that pressing it on the second goal does not throw
   * away the first one's answer.
   */
  const [plans, setPlans] = useState<Record<string, GoalPlan>>({});
  const [planning, setPlanning] = useState('');
  const [planError, setPlanError] = useState<Record<string, string>>({});

  /* Cleared with the window, for the reason the write-up is: a route argued
     from ninety days of record, sitting under a page now showing seven, is
     prose about figures that are no longer on screen. */
  useEffect(() => {
    setPlans({});
    setPlanError({});
  }, [span, subjectId]);

  const planFor = useCallback(
    async (goal: SubjectGoal) => {
      if (!subject) return;
      setPlanning(goal.id);
      setPlanError((was) => ({ ...was, [goal.id]: '' }));
      /* Exactly what the panel above it is showing. The server forbids the
         model any figure that is not among these, so a number in the plan
         that the page did not draw would be a number the reader cannot
         check — the rule the whole subject page is built on. */
      const result = await writeGoalPlan({
        goal: goal.title,
        subject: subject.name,
        standing: goal.numeric && goal.target > 0
          ? `${goal.current} of ${goal.target} ${goal.unit}`
          : `${Math.round(goal.progress)}% done`,
        deadline: goal.deadline,
        days_left: goal.daysLeft,
        need_weekly: goal.need === null ? '' : `${(goal.need * 7).toFixed(1)} ${goal.unit}`,
        have_weekly: goal.have === null ? '' : `${(goal.have * 7).toFixed(1)} ${goal.unit}`,
        lands: goal.lands ?? '',
        expected: goal.expected === null ? null : Math.round(goal.expected),
        stages: milestones.filter((entry) => !entry.done).map((entry) => entry.title),
        // The app's own conclusions, in the words it wrote them in. Handing
        // over the sentences rather than the raw counts is what stops the
        // model re-deriving them and getting a different answer.
        levers: goal.levers.map((lever) => `${lever.title} — ${lever.fact}`),
        aim: ambition?.aim ?? '',
        level: ambition?.level ?? '',
        span: WINDOWS.find((option) => option.key === span)?.label ?? '',
        score: model.score,
        grade: model.grade,
        finished: model.finished,
        aimed: goal.aimed,
        recent_days: goal.recentDays,
        bands: model.bands
          .filter((band) => band.done > 0)
          .map((band) => ({
            label: band.label,
            done: band.done,
            holding: band.holding === null ? null : Math.round(band.holding),
          })),
        struggles: model.struggles.map((driver) => ({
          label: driver.label,
          share: driver.share,
          count: driver.count,
        })),
      });
      setPlanning('');
      if (result.success) setPlans((was) => ({ ...was, [goal.id]: result.plan }));
      else {
        setPlanError((was) => ({
          ...was,
          [goal.id]: result.message || 'Could not plan a route.',
        }));
      }
    },
    [ambition, milestones, model, span, subject],
  );

  /* The volume chart's own ceiling. A floor of 1 keeps a window with a single
     quiet period from producing a "0" top tick over a line that is not flat. */
  const seriesPeak = Math.max(...model.series.done, 1);

  useDocumentTitle(subject ? subject.name : 'Subject');

  /* The catalogue is cached module-wide and read by a dozen components, so on
     every navigation after the first it is already here. On the first it is
     empty for a tick — and an empty catalogue is indistinguishable from one
     that does not hold this id, so the "no such subject" message has to wait
     for it or it would flash on a perfectly good link. */
  const naming = catalogue.size === 0;

  return (
    /* `sb-page` alongside `ax-page`: this page is a guest in the analytics
       palette and reads its tokens, but its own spacing scale has to hang off
       a class this stylesheet owns. A bare `.ax-page` rule in subject.css is
       two sheets writing one class, and whichever Vite loads second wins —
       scripts/check_css.mjs fails the build for exactly that. */
    <div className="ax-page sb-page">
      <Ambient />
      <div className="ax-shell page-shell">
        <header className="ax-head">
          <div>
            <h1>{subject ? subject.name : 'Subject'}</h1>
            <p className="ax-muted ax-head-purpose">
              {subject
                ? 'How this one is going, and what to do about it.'
                : 'This page is about one subject at a time.'}
            </p>
          </div>
          <div className="ax-head-actions">
            {/* On every state including the error. A reader who followed a dead
                link should land somewhere useful in one click. */}
            <Link className="ax-btn" to="/analytics">
              Overall analytics
            </Link>
          </div>
        </header>

        {naming || tasks.loading ? (
          <Loading label="Reading your record" />
        ) : !subject ? (
          <p className="ax-opening is-flat">
            No subject with that id is in your catalogue. It may have been deleted since you
            picked it — you can choose the subjects you follow again from{' '}
            <Link className="ax-link" to="/analytics?setup">the analytics setup questions</Link>.
          </p>
        ) : !tasks.data ? (
          <ErrorState message={tasks.error ?? 'Could not read your tasks.'} onRetry={tasks.reload} />
        ) : !model.any ? (
          <p className="ax-opening is-flat">
            Nothing is filed under {subject.name} yet. This page fills in from your own tasks —
            file a few here and it will have something to measure.
          </p>
        ) : (
          <>
            <div className="ax-controls">
              <div className="ax-chips" role="group" aria-label="Time window">
                {WINDOWS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`ax-chip${option.key === span ? ' is-on' : ''}`}
                    aria-pressed={option.key === span}
                    onClick={() => setSpan(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Overview ------------------------------------------- */}
            {/* ---- The verdict, then what to do about it ----------- */}
            {/* The page used to open with four tiles and leave the reader to
                assemble the verdict from them. This states it, then says what
                to do, and only then shows the working. The order is the whole
                point: somebody who reads two blocks and leaves has read the
                two that were worth reading. */}
            <section
              className="sb-topline"
              aria-label="How this subject is going"
              /* The band, for the stylesheet. The letter is coloured by what it
                 means rather than by house accent — a C that looks like an A is
                 a page telling the reader one thing in words and another in
                 colour. Attribute rather than a class so the CSS reads as the
                 table of bands it is. */
              data-band={
                model.headline.grade === null
                  ? 'none'
                  : ['S', 'A+', 'A'].includes(model.headline.grade)
                    ? 'high'
                    : model.headline.grade === 'B'
                      ? 'good'
                      : model.headline.grade === 'C'
                        ? 'fair'
                        : 'low'
              }
            >
              <p className="sb-topline-grade">
                <strong>{model.headline.grade ?? '—'}</strong>
                {model.headline.score !== null && (
                  <span className="sb-topline-score">{model.headline.score}/100</span>
                )}
              </p>
              <p className="sb-topline-line">{model.headline.verdict}</p>
              {/* What the reader said this is all for. Under the verdict
                  because it is the thing the verdict is a verdict *against* —
                  and quieter than it, because it is their sentence rather than
                  a reading of their record. */}
              {ambition?.aim && (
                <p className="sb-topline-aim">
                  <span>Chasing</span> {ambition.aim}
                  {ambition.level && <em> · at {ambition.level} now</em>}
                </p>
              )}
            </section>

            {/* ---- The path, under the verdict --------------------- */}
            {/* On top, because "how am I doing" and "at what" are one question
                and the page was answering only the first for two screens. It
                is a strip rather than a panel: the reader is oriented by it on
                the way past, and the tree itself is one click away. */}
            {lattice && (
              <div className="sb-path">
                <nav className="sb-path-crumbs" aria-label="Where this subject sits">
                  {lattice.path.map((step, at) => (
                    <span key={step.id}>
                      {at > 0 && <i aria-hidden="true">›</i>}
                      <b className={at === lattice.path.length - 1 ? 'is-here' : undefined}>
                        {step.title}
                      </b>
                    </span>
                  ))}
                </nav>
                {/* One figure, and it is the reader's. The strip used to
                    carry four — skills, core, branches, practised — three of
                    which are the curriculum's size and belong in the tree
                    panel at the foot of the page, where they now are. A strip
                    read on the way past has room for the answer, not for the
                    working. */}
                {standing && (
                  <p className="sb-path-facts">
                    <span className="is-yours">
                      <strong>{standing.percent}%</strong> of this tree
                    </span>
                  </p>
                )}
                <Link className="sb-path-open" to="/skill-trees">
                  Open the tree →
                </Link>
              </div>
            )}

            {/* ---- What to do ------------------------------------- */}
            {model.advice.length > 0 && (
              <Panel
                title="Do this next"
                note="Ranked by what it would be worth, each with the figure behind it."
              >
                <ol className="sb-advice">
                  {model.advice.map((item, at) => (
                    <li key={item.id} className={`sb-advice-item is-${item.weight}`}>
                      <span className="sb-advice-rank" aria-hidden="true">
                        {at + 1}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <p className="sb-advice-why">
                          <span>Why:</span> {item.why}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            {/* ---- The shape of it ---------------------------------- */}
            {/* Two charts, not two lines on one axis. Tasks finished runs 0 to
                about ten and quality runs 0 to 100 — sharing a scale squashed
                the volume line flat along the floor and left the y-axis
                labelled with the volume's peak while the axis was really the
                quality's. A chart whose ticks do not describe its own line is
                worse than no chart. */}
            {model.series.any && (
              <Panel
                title="Over this window"
                note="Tasks finished, and the quality you rated them at."
              >
                {/* Side by side rather than stacked. They are the same
                    periods on the same dates, so the interesting reading is
                    across them — did the month the volume climbed cost
                    anything in quality — and that reading was two screens
                    apart when one sat under the other. Stacking also spent
                    three hundred vertical pixels on two charts that are mostly
                    air. They wrap to one column under `sb-charts`. */}
                <div className="sb-charts">
                  <div>
                    <h3 className="sb-sub">Tasks finished</h3>
                    <AreaChart
                      id={`sb-done-${subjectId}`}
                      label={`Tasks finished in ${subject.name} over ${
                        WINDOWS.find((option) => option.key === span)?.label ?? 'the window'
                      }`}
                      height={150}
                      series={[{ values: model.series.done, tone: 'violet' }]}
                      ticks={[String(seriesPeak), String(Math.round(seriesPeak / 2)), '0']}
                      marks={model.series.marks}
                      readout={{
                        labels: model.series.labels,
                        names: ['Finished'],
                        format: (value) => `${Math.round(value)} tasks`,
                      }}
                    />
                  </div>

                  {model.series.quality.some((value) => value !== null) && (
                    <div>
                      <h3 className="sb-sub">Quality</h3>
                      <AreaChart
                        id={`sb-quality-${subjectId}`}
                        label={`Quality rated in ${subject.name} over the same periods`}
                        height={150}
                        /* Nulls are real and stay null: a period with nothing
                           rated has no quality, and the chart breaks its line
                           there rather than drawing a zero nobody recorded. */
                        series={[{ values: model.series.quality, tone: 'blue' }]}
                        /* The real ceiling, so a run that never passes 60% is
                           not stretched to fill the box and read as excellent. */
                        max={100}
                        ticks={['100', '50', '0']}
                        marks={model.series.marks}
                        readout={{
                          labels: model.series.labels,
                          names: ['Quality'],
                          format: (value) => `${Math.round(value)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {/* ---- Everything else: the working -------------------- */}
            <h2 className="sb-detail-head">The detail</h2>

            {/* The grade is not a tile. It was, and it was the third place on
                one screen the same letter appeared — the verdict states it at
                the top, and the panel below breaks it into the four rates the
                tile was listing in prose. A tile that repeats what is already
                on screen is a tile that costs a column and says nothing. */}
            <div className="sb-tiles">
              <div className="sb-tile">
                <span className="sb-tile-label">Finished</span>
                <strong className="sb-tile-value">{model.finished}</strong>
                <span className="sb-tile-note">
                  against {model.finishedBefore} the window before
                </span>
              </div>
              <div className="sb-tile">
                <span className="sb-tile-label">Time on it</span>
                <strong className="sb-tile-value">
                  {model.invested > 0 ? format.duration(model.invested) : '—'}
                </strong>
                <span className="sb-tile-note">
                  {model.invested > 0
                    ? 'logged against the tasks you finished'
                    : 'no time logged against these tasks'}
                </span>
              </div>
              <div className="sb-tile">
                <span className="sb-tile-label">Streak</span>
                <strong className="sb-tile-value">{model.streak}</strong>
                <span className="sb-tile-note">
                  {model.streak === 1 ? 'day running' : 'days running'} in this subject
                </span>
              </div>
            </div>

            {model.insight && <p className="ax-opening is-down sb-insight">{model.insight}</p>}


            {/* ---- What this subject is for ------------------------- */}
            {/* The goal, and the record read against it.
                
                This panel used to be a list of bars. A bar answers "how far
                along", which is the one question about a goal that cannot be
                acted on — 40% is fine with 60% of the time left and a disaster
                with a week to go, and either way it does not say what to do on
                Tuesday. So each goal now carries three things a bar cannot: the
                calendar's own position on the same track, the figures this
                subject has actually put into it, and the levers — what would
                have to change, hardest constraint first, each with the count
                behind it. The arithmetic is `goalsFor` and `leversFor` in
                components/Subject/model. */}
            {model.goals.length > 0 && (
              <Panel
                title="What this subject is for"
                note="Each goal that names this subject, and what your record here says about reaching it."
              >
                <ul className="sb-goals">
                  {model.goals.map((goal) => (
                    <li key={goal.id} className="sb-goal">
                      <div className="sb-goal-head">
                        <strong>{goal.title}</strong>
                        <span
                          className={`sb-goal-state ${
                            goal.drift === null ? 'is-flat' : goal.drift > 0 ? 'is-late' : 'is-early'
                          }`}
                        >
                          {goal.drift === null
                            ? 'no projection yet'
                            : goal.drift > 0
                              ? `${goal.drift} ${goal.drift === 1 ? 'day' : 'days'} late`
                              : goal.drift < 0
                                ? `${Math.abs(goal.drift)} ${Math.abs(goal.drift) === 1 ? 'day' : 'days'} early`
                                : 'on the day'}
                        </span>
                      </div>

                      {/* The bar, with where the calendar has got to marked on
                          it. One track rather than two bars: the whole reading
                          is the distance between the fill and the mark, and
                          that reading does not survive being split across two
                          rows the eye has to measure between. */}
                      <span
                        className="sb-goal-track"
                        role="img"
                        aria-label={
                          goal.expected === null
                            ? `${Math.round(goal.progress)}% done`
                            : `${Math.round(goal.progress)}% done, ${Math.round(goal.expected)}% `
                              + 'of its time gone'
                        }
                      >
                        <span
                          className="sb-goal-track-fill"
                          style={{ width: `${clampPct(goal.progress)}%` }}
                        />
                        {goal.expected !== null && (
                          <span
                            className="sb-goal-track-mark"
                            style={{ left: `${clampPct(goal.expected)}%` }}
                          />
                        )}
                      </span>

                      <p className="sb-goal-meta">
                        {Math.round(goal.progress)}% done
                        {goal.expected !== null && (
                          <> · the calendar is at {Math.round(goal.expected)}%</>
                        )}
                        {goal.deadline && <> · due {goal.deadline}</>}
                      </p>

                      {/* The counted figures, and only the ones that exist.
                          A row of dashes is how a reader learns to stop
                          reading a panel. */}
                      <dl className="sb-plan">
                        {planFacts(goal).map((fact) => (
                          <div key={fact.label} className="sb-plan-fact">
                            <dt>{fact.label}</dt>
                            <dd>{fact.value}</dd>
                          </div>
                        ))}
                      </dl>

                      <ul className="sb-levers">
                        {goal.levers.map((lever) => (
                          <li key={lever.id} className={`sb-lever is-${lever.weight}`}>
                            <strong>{lever.title}</strong>
                            <p>{lever.fact}</p>
                          </li>
                        ))}
                      </ul>

                      {/* ---- The route, written by a model --------------- */}
                      {/* Everything above this line is counted. This is not,
                          and the divider and the note say so before the
                          button is pressed rather than after — a reader has
                          to know which half of a panel is arithmetic and
                          which half is prose before they decide what to act
                          on. Same bargain as the write-up at the foot of the
                          page. */}
                      {canWrite && (
                        <div className="sb-route">
                          <div className="sb-route-head">
                            <div>
                              <strong>Plan the route to this</strong>
                              <p>
                                A model reads the figures above and lays out the stages between
                                here and the date — what a goal like this is actually made of,
                                which is the part your record cannot say. It is given these
                                numbers and forbidden any others.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="ax-btn"
                              onClick={() => void planFor(goal)}
                              disabled={planning === goal.id}
                            >
                              {planning === goal.id
                                ? 'Planning…'
                                : plans[goal.id]
                                  ? 'Plan it again'
                                  : 'Plan the route'}
                            </button>
                          </div>

                          {planError[goal.id] && (
                            <p className="sb-brief-error" role="alert">
                              {planError[goal.id]}
                            </p>
                          )}

                          {plans[goal.id] && (
                            <div className="sb-route-body">
                              {plans[goal.id]!.route && (
                                <p className="sb-route-read">{plans[goal.id]!.route}</p>
                              )}

                              {plans[goal.id]!.phases.length > 0 && (
                                <ol className="sb-phases">
                                  {plans[goal.id]!.phases.map((phase) => (
                                    <li key={phase.title} className="sb-phase">
                                      <div className="sb-phase-head">
                                        <strong>{phase.title}</strong>
                                        {/* Labelled as the model's, because it
                                            is the one number here it supplied
                                            rather than one the app counted. */}
                                        <span className="sb-phase-weeks">
                                          ~{phase.weeks} {phase.weeks === 1 ? 'week' : 'weeks'}
                                        </span>
                                      </div>
                                      {phase.outcome && (
                                        <p className="sb-phase-out">{phase.outcome}</p>
                                      )}
                                      {phase.focus.length > 0 && (
                                        <ul className="sb-phase-focus">
                                          {phase.focus.map((item) => (
                                            <li key={item}>{item}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              )}

                              {plans[goal.id]!.week.length > 0 && (
                                <div className="sb-route-week">
                                  <h4>This week</h4>
                                  <ul>
                                    {plans[goal.id]!.week.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="ax-panel-note ax-panel-note-foot">
                  {/* The line said "every figure here is counted" before the
                      route was added, and stopped being true the moment it
                      was. The join is what the reader needs, and it is the
                      whole reason the route sits behind a dashed rule. */}
                  The figures are counted from your own tasks in this subject. Anything under a
                  "Plan the route" heading was written by a model from those same figures.{' '}
                  <Link className="ax-link" to="/goals">Your goals</Link>
                </p>
              </Panel>
            )}

            <div className="sb-grid">
              {/* ---- Progress ----------------------------------------- */}
              <Panel
                title="Your progress"
                note="Against the window immediately before, same length."
              >
                <ul className="sb-rows">
                  {model.growth.map((entry) => (
                    <li key={entry.key} className="sb-row">
                      <span className="sb-row-name">{entry.label}</span>
                      <Delta value={entry.change} />
                      <span className="sb-row-note">{entry.note}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              {/* ---- The four rates ----------------------------------- */}
              <Panel
                title="What the score is made of"
                note="Four rates. The letter above is their mean."
              >
                <ul className="sb-rows">
                  {model.rates.map((entry) => (
                    <li key={entry.key} className="sb-row sb-row-rate">
                      <span className="sb-row-name">{entry.label}</span>
                      {entry.known ? (
                        <>
                          <strong className="sb-row-value">{Math.round(entry.now)}%</strong>
                          <Bar percent={entry.now} />
                          <Delta value={entry.delta} unit="pts" />
                        </>
                      ) : (
                        <span className="sb-row-value is-none">not measurable yet</span>
                      )}
                      <span className="sb-row-note">{entry.note}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            {/* ---- The difficulty bands ------------------------------- */}
            {model.bands.some((band) => band.done > 0) && (
              <Panel
                title="How you do at each difficulty"
                note="Bands, not sub-topics: a difficulty star is the finest thing recorded."
              >
                <div className="sb-table-wrap">
                  <table className="sb-table">
                    <thead>
                      <tr>
                        <th scope="col">Difficulty</th>
                        <th scope="col">Finished</th>
                        <th scope="col">How it went</th>
                        <th scope="col">vs before</th>
                        <th scope="col">Typical time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.bands
                        .filter((band) => band.done > 0)
                        .map((band) => (
                          <tr
                            key={band.level}
                            className={band.level === model.weakest?.level ? 'is-weak' : undefined}
                          >
                            <th scope="row">{band.label}</th>
                            <td>{band.done}</td>
                            <td>
                              {band.holding === null ? (
                                <span className="is-none">not rated</span>
                              ) : (
                                <span className="sb-cell-bar">
                                  <strong>{Math.round(band.holding)}%</strong>
                                  <Bar percent={band.holding} />
                                </span>
                              )}
                            </td>
                            <td>
                              <Delta value={band.delta} unit="pts" />
                            </td>
                            <td>
                              {band.seconds === null ? (
                                <span className="is-none">—</span>
                              ) : (
                                <>
                                  {format.duration(Math.round(band.seconds))}
                                  {band.secondsDelta !== null && band.secondsDelta !== 0 && (
                                    <em className="sb-cell-aside">
                                      {band.secondsDelta < 0 ? '↓' : '↑'}{' '}
                                      {format.duration(Math.abs(band.secondsDelta))}
                                    </em>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {model.weakest && model.strongest && model.weakest.level !== model.strongest.level && (
                  <p className="ax-panel-note ax-panel-note-foot">
                    <strong>Weakest:</strong> {model.weakest.label.toLowerCase()} at{' '}
                    {Math.round(model.weakest.holding!)}%. <strong>Strongest:</strong>{' '}
                    {model.strongest.label.toLowerCase()} at {Math.round(model.strongest.holding!)}%.
                  </p>
                )}
              </Panel>
            )}

            <div className="sb-grid">
              {/* ---- What drives it --------------------------------- */}
              {(model.struggles.length > 0 || model.wentWell.length > 0) && (
                <Panel
                  title="What makes it go badly, and well"
                  note="From the reason you gave when you rated each task."
                >
                  {model.struggles.length > 0 && (
                    <>
                      <h3 className="sb-sub">When it went badly</h3>
                      <ul className="sb-rows">
                        {model.struggles.map((driver) => (
                          <li key={driver.key} className="sb-row sb-row-rate">
                            <span className="sb-row-name">{driver.label}</span>
                            <strong className="sb-row-value">{driver.share}%</strong>
                            <Bar percent={driver.share} />
                            <span className="sb-row-note">
                              {driver.count} {driver.count === 1 ? 'task' : 'tasks'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {model.wentWell.length > 0 && (
                    <>
                      <h3 className="sb-sub">When it went well</h3>
                      <ul className="sb-rows">
                        {model.wentWell.map((driver) => (
                          <li key={driver.key} className="sb-row sb-row-rate">
                            <span className="sb-row-name">{driver.label}</span>
                            <strong className="sb-row-value">{driver.share}%</strong>
                            <Bar percent={driver.share} />
                            <span className="sb-row-note">
                              {driver.count} {driver.count === 1 ? 'task' : 'tasks'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Panel>
              )}

              {/* ---- The run --------------------------------------- */}
              {model.run.readings.length > 0 && (
                <Panel
                  title="Your last few sessions"
                  note="Difficulty × execution on each rated task, oldest first."
                >
                  <ol className="sb-run">
                    {model.run.readings.map((reading) => (
                      <li key={reading.id}>
                        <span
                          className={`sb-run-dot ${
                            reading.percent >= 80
                              ? 'is-good'
                              : reading.percent >= 60
                                ? 'is-mid'
                                : 'is-poor'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="sb-run-value">{reading.percent}%</span>
                        <span className="sb-run-day">{reading.on.slice(5)}</span>
                      </li>
                    ))}
                  </ol>
                  {model.run.trend !== null && (
                    <p className="ax-panel-note ax-panel-note-foot">
                      <strong>Trend:</strong>{' '}
                      {model.run.trend > 0
                        ? `improving — the later half of this run averages ${model.run.trend} points above the earlier half.`
                        : model.run.trend < 0
                          ? `slipping — the later half averages ${Math.abs(model.run.trend)} points below the earlier half.`
                          : 'flat — both halves of this run average the same.'}
                    </p>
                  )}
                </Panel>
              )}
            </div>

            {/* ---- Checkpoints, and the goal they become ----------- */}
            <Panel
              title="Checkpoints for this subject"
              note="The stages, in the order you mean to reach them. No target or date needed."
            >
              <ul className="sb-miles">
                {milestones.map((entry, at) => (
                  <li key={entry.id} className={entry.done ? 'is-done' : undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={entry.done}
                        onChange={() =>
                          putMilestones(
                            milestones.map((row, index) =>
                              index === at ? { ...row, done: !row.done } : row,
                            ),
                          )
                        }
                      />
                      <span>{entry.title}</span>
                    </label>
                    <button
                      type="button"
                      className="sb-miles-drop"
                      aria-label={`Remove ${entry.title}`}
                      onClick={() => putMilestones(milestones.filter((_, i) => i !== at))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <form
                className="sb-miles-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  const title = adding.trim();
                  if (!title) return;
                  putMilestones([
                    ...milestones,
                    { id: `m${Date.now()}`, title, done: false },
                  ]);
                  setAdding('');
                }}
              >
                <input
                  value={adding}
                  onChange={(event) => setAdding(event.target.value)}
                  placeholder="A stage you mean to reach"
                  aria-label="New checkpoint"
                  maxLength={120}
                />
                <button type="submit" className="ax-btn" disabled={!adding.trim()}>
                  Add
                </button>
              </form>

              {canWrite && (
                <div className="sb-draft">
                  <div className="sb-draft-head">
                    <div>
                      <strong>Turn these into a goal</strong>
                      <p>
                        A model reads your checkpoints and what you have been doing here, and
                        drafts the goal over them — a title, a target and a horizon. Nothing is
                        created until you say so.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ax-btn"
                      onClick={() => void askForGoal()}
                      disabled={drafting}
                    >
                      {drafting ? 'Drafting…' : draft ? 'Draft another' : 'Draft a goal'}
                    </button>
                  </div>

                  {draftError && (
                    <p className="sb-brief-error" role="alert">
                      {draftError}
                    </p>
                  )}

                  {created && (
                    <p className="sb-draft-made" role="status">
                      Kept. It is what this subject is aimed at now, and its stages are in the
                      list above. It stays here — nothing was added to your goals page.
                    </p>
                  )}

                  {draft && (
                    <div className="sb-draft-body">
                      <strong className="sb-draft-title">{draft.title}</strong>
                      <p className="sb-draft-why">{draft.why}</p>
                      <p className="sb-draft-terms">
                        <span>
                          <b>{draft.target}</b> {draft.unit}
                        </span>
                        <span>
                          over <b>{draft.weeks}</b> {draft.weeks === 1 ? 'week' : 'weeks'}
                        </span>
                      </p>
                      {draft.milestones.length > 0 && (
                        <ol className="sb-draft-miles">
                          {draft.milestones.map((title) => (
                            <li key={title}>{title}</li>
                          ))}
                        </ol>
                      )}
                      <div className="sb-tree-actions">
                        <button type="button" className="ax-btn ax-btn-primary" onClick={() => void keepDraft()}>
                          Keep this as what I am chasing
                        </button>
                        <button type="button" className="ax-btn ax-btn-quiet" onClick={() => setDraft(null)}>
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>

            {/* ---- The write-up ------------------------------------ */}
            {canWrite && (
              <section className="ax-panel sb-panel sb-brief">
                <div className="ax-panel-head">
                  <div className="ax-panel-title">
                    <h2>Read this back to me</h2>
                  </div>
                  <button
                    type="button"
                    className="ax-btn"
                    onClick={() => void write()}
                    disabled={writing}
                  >
                    {writing ? 'Writing…' : brief ? 'Write it again' : 'Write it up'}
                  </button>
                </div>
                <p className="ax-panel-note">
                  {/* Said before the button is pressed, not after. A reader
                      has to know which half of this page is counted and which
                      half is written before they decide what to trust. */}
                  Everything above is counted from your own tasks. This one panel is written by
                  a model, from those same figures — it is given them and forbidden from
                  producing any others, so it can tell you what they mean but cannot tell you
                  anything they do not say. It costs an API call and is not saved.
                </p>

                {briefError && (
                  <p className="sb-brief-error" role="alert">
                    {briefError}
                  </p>
                )}

                {brief && (
                  <div className="sb-brief-body">
                    {brief.reading && <p className="sb-brief-reading">{brief.reading}</p>}
                    {brief.practice.length > 0 && (
                      <ol className="sb-brief-practice">
                        {brief.practice.map((item) => (
                          <li key={item.title}>
                            <div className="sb-brief-practice-head">
                              <strong>{item.title}</strong>
                              <span className="sb-brief-minutes">{item.minutes} min</span>
                            </div>
                            {item.focus.length > 0 && (
                              <ul className="sb-brief-focus">
                                {item.focus.map((point) => (
                                  <li key={point}>{point}</li>
                                ))}
                              </ul>
                            )}
                            {item.why && (
                              <p className="sb-brief-why">
                                <span>Why:</span> {item.why}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ---- Recent work ------------------------------------- */}
            {model.recent.length > 0 && (
              <Panel
                title="Recent work"
                note="Newest first."
              >
                <ul className="sb-recent">
                  {model.recent.map((entry) => (
                    <li key={entry.id}>
                      <div className="sb-recent-head">
                        <strong>{entry.title}</strong>
                        <span className={`sb-verdict is-${entry.verdict.replace(/\s+/g, '-')}`}>
                          {entry.verdict}
                        </span>
                      </div>
                      <p className="sb-recent-meta">
                        {entry.on}
                        {entry.quality !== null && <> · scored {entry.quality}/25</>}
                        {entry.seconds !== null && <> · {format.duration(entry.seconds)}</>}
                      </p>
                    </li>
                  ))}
                </ul>
                {model.goalAimed !== null && (
                  <p className="ax-panel-note ax-panel-note-foot">
                    <strong>{model.goalAimed}%</strong> of what you finished here in this window
                    was aimed at a goal.
                  </p>
                )}
              </Panel>
            )}

            {/* ---- The lattice ------------------------------------- */}
            {lattice && (
              <Panel
                title="The skill tree"
                note="Where you stand in it, and what it holds."
              >
                {/* The reader's half, first and largest. Everything under it
                    is the curriculum — authored, and the same on every
                    account. Keeping the two apart is the whole design of this
                    panel: "6 practised" printed beside "42 skills" reads as a
                    claim about the reader that the authored states cannot
                    support, which is what the old footnote was apologising
                    for at length. A measured bar says it instead. */}
                {standing && (
                  <div className="sb-standing">
                    <span className="sb-standing-pct">{standing.percent}%</span>
                    <div className="sb-standing-main">
                      <span className="sb-standing-bar" aria-hidden="true">
                        <span style={{ width: `${standing.percent}%` }} />
                      </span>
                      <span className="sb-standing-sub">
                        {standing.xp.toLocaleString()} of {standing.worth.toLocaleString()} XP
                        {' '}across everything that opens {standing.title}
                      </span>
                    </div>
                  </div>
                )}

                <div className="sb-tree">
                  <div>
                    <strong>{lattice.title}</strong>
                    <p>{lattice.blurb}</p>
                    <p className="sb-tree-choice">
                      {lattice.nodes} skills, {lattice.core} core
                      {lattice.practised > 0 && <> · {lattice.practised} marked practised</>}
                      {lattice.chosen && <> · your chosen branch</>}
                    </p>
                  </div>
                  <div className="sb-tree-actions">
                    <Link className="ax-btn ax-btn-primary" to="/skill-trees">
                      Open the tree
                    </Link>
                    <Link className="ax-btn ax-btn-quiet" to="/analytics?setup">
                      Change the branch
                    </Link>
                  </div>
                </div>

                {/* Where it forks. Named rather than counted, because the
                    branch names are the useful part: they say what the subject
                    turns into once its foundations are behind you, and one of
                    them is the answer to the setup question. */}
                {lattice.branches.length > 0 && (
                  <ul className="sb-branches">
                    {lattice.branches.map((branch) => (
                      <li key={branch.id}>
                        <span>{branch.title}</span>
                        <em>{branch.nodes} skills</em>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
