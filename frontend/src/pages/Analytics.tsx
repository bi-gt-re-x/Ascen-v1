/**
 * Analytics — one page, seven tabs, and the first one is the point.
 *
 * This page was the graded report card, then the long view of an account, and
 * it is now the place the app does its thinking. Analysis split across separate
 * pages in the rail was pages nobody moved between, and the value of the
 * analysis is in the movement — what I do, then why, then what to change. One
 * bar makes that sequence a click instead of a navigation.
 *
 * ## The seven tabs
 *
 * - **Recommendations — how I improve.** Instructions, ranked by what each is
 *   worth, with the arithmetic attached. It never re-states a finding as news.
 *   It leads the bar and owns the rail entry, because it is the only tab that
 *   ends in a button and it used to sit five clicks behind four screens of
 *   description.
 * - **Overview** — totals, trajectory, the score, where the account stands.
 * - **Trends** — the derivative rather than the level, plus the long-term
 *   projection that was the growth page's Long Term chapter.
 * - **Habits — what I do.** Recurring behaviour, counted, plus the growth
 *   page's Focus chapter: whether it can be executed reliably. It never says
 *   *why*: the moment it does, the next tab has no reason to exist.
 * - **Insights — why and how.** Two counts put together, with the evidence for
 *   the connection graded and printed. It never says what to do.
 * - **Subjects** — mastery. The growth page's Subject chapter.
 * - **Records** — achievement, against the reader's own best and their goals.
 *
 * Keeping the middle boundaries sharp is the design decision this page is built
 * around: three tabs that all show cards of numbers are one tab with a broken
 * picker.
 *
 * ## How it holds together
 *
 * **Five calls, one window, seven tabs.** The whole day series (`days: 0`), the
 * account's stats and tasks, the report card, where this account stands against
 * the others, and the baseline. Every panel is arithmetic over the first three
 * — nothing here fetches per tab — and every tab is scoped by the one window
 * picker, so two tabs can never quietly be describing different periods. The
 * exceptions are deliberate: the Overview heatmap always draws a year and the
 * Habits calendar carries its own zoom, because a map of 91 squares and a map
 * of 730 are not the same picture.
 *
 * Standing is the odd call and stays separate: it is the only thing here
 * computed from anybody else's record, so it cannot be arithmetic over the
 * series, and it is unscoped by the window because "where you stand" is a
 * question about the account rather than about a quarter of it.
 *
 * **A tab is a route.** Seven paths render this component and differ only in
 * which view opens. That is what makes the rail, the back button and a pasted
 * link agree about which tab is showing — local state would have broken all
 * three. `/growth` redirects here; see App.tsx.
 *
 * **Everything computes on every render, and that is on purpose.** All of it is
 * memoised against the slice, so switching tabs recomputes nothing; the cost of
 * running the arithmetic for a hidden tab is a few hundred array passes once
 * per window change, and the alternative — children each holding their own
 * memos — would put the arithmetic out of reach of the page that has to decide,
 * before rendering a tab, whether that tab has anything to say.
 *
 * **Every figure on this page is this account's own.** There is no sample data
 * and no placeholder mode. Four tabs used to fall back to invented figures
 * behind a small chip when the record was too short to fill them; that made a
 * new account's first impression of the analysis a page of numbers about
 * somebody who does not exist, and taught the reader to discount the real ones
 * that arrived later. A tab that cannot be filled now says what it is waiting
 * for and when it opens — see `Locked` — and a new account is offered the one
 * thing it can actually do here, which is `BaselineSetup`.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import {
  BaselinePanel,
  BaselineSetup,
  ComparePanel,
  ComparisonPanel,
  CompoundingPanel,
  ConsistencyPanel,
  Controls,
  DirectionPanel,
  HabitCalendarPanel,
  HabitCards,
  HabitConsistencyPanel,
  HabitOpening,
  HabitTiles,
  Header,
  InsightsPanel,
  Locked,
  MilestonePanel,
  PatternsPanel,
  ScorePanel,
  SinceLast,
  StandingPanel,
  StreaksPanel,
  SubjectPanel,
  Tiles,
  TimelinePanel,
  Trajectory,
  TrendChart,
  TrendTiles,
  ViewTabs,
  viewFor,
  type BaselineValues,
  type View,
} from '@/components/Analytics';
import {
  BalancePanel,
  ClockPanel,
  CurrentStatePanel,
  HeadlineTiles,
  HowPanel,
  MomentumPanel,
  RelationshipsPanel,
  RhythmPanel,
  Summary,
  WeekPanel,
  WhyPanel,
  WorkingPanel,
} from '@/components/Insights';
import {
  AdviceCard,
  AlsoPanel,
  CategoryFilter,
  Caveat,
  FollowupPanel,
  OutlookPanel,
} from '@/components/Recommendations';
/**
 * The four chapters that were the growth page.
 *
 * They arrive as they were written — self-contained components handed the day
 * series, the tasks, the subject index and the streak, which this page already
 * has for its own panels. Nothing about them needed rewriting to move; the
 * growth page was never doing anything with them that this one cannot, which is
 * most of the argument for the merge.
 */
import {
  BenchmarksChapter,
  FocusChapter,
  LongTermChapter,
  SkillsChapter,
} from '@/components/Growth';
import {
  comparisonBars,
  compounding,
  consistency,
  sliceWindow,
  spanLabel,
  windowOption,
  type Grain,
  type MetricKey,
  type WindowKey,
} from '@/components/Analytics/data';
import { growthScore, type ScoreFactor } from '@/components/Analytics/score';
import { useApi, useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import {
  analytics as analyticsService,
  goals as goalsService,
  growth as growthService,
  tasks as taskService,
} from '@/services';
import type {
  AdoptedResult,
  BaselineResult,
  MetricHistories,
  MetricHistory,
  Standing,
} from '@/services/analytics';
import {
  growthInsights,
  heatmapGrid,
  milestoneHistory,
  summaryFigures,
  tileSeries,
} from '@/utils/growthSummary';
import { subjectXp } from '@/utils/subjectXp';
import { balanceShape, clockShape, momentum, rhythmShape, weekShape } from '@/utils/behaviour';
import {
  buildHabits,
  habitDays,
  habitPatterns,
  habitShifts,
  habitSummary,
} from '@/utils/habits';
import {
  currentState,
  howFindings,
  relationships,
  unlock,
  whatsWorking,
  whyFindings,
} from '@/utils/insight';
import {
  TREND_METRICS,
  comparisonSlices,
  directions,
  trendRows,
  trendVerdict,
  weeklyPoints,
  type ComparisonKey,
} from '@/utils/trends';
import { outlook, recommendations, type Advice } from '@/utils/advice';
import { SETTLE, reviewAdopted, summarise } from '@/utils/followup';
import type { Ratings } from '@/types';
import '@/styles/analytics.css';
/**
 * The chapters' own stylesheet, which came with them.
 *
 * Their markup is `gr-*` classes and its rules read a block of tokens that used
 * to be scoped to `#growthCard` — the id on the growth page's outer card. That
 * card is gone, so the token block and the handful of rules that depended on
 * the ancestor now answer to `.gr-scope` as well, and the four chapter tabs
 * render inside one. See the note at `.gr-scope` in the stylesheet.
 */
import '@/styles/growth.css';

/** How many named subjects get a spoke before Other takes the rest. */
const RADAR_SUBJECTS = 6;

/** How many recommendations get a card of their own before the rest go in a list. */
const HEADLINE_ADVICE = 3;

/** What an adopted suggestion is worth as a task. Its own habit is the reward. */
const DEFAULT_ADVICE_XP = 25;

/** The window the momentum panel compares, in days. See `momentum`. */
const MOMENTUM_DAYS = 90;

/**
 * How much history a tab needs before it will say anything at all.
 *
 * Not one number, because the tabs ask different things of the record: a habit
 * needs weeks of repetition to be a habit at all, an explanation needs two
 * comparable periods, and a recommendation needs an average worth projecting
 * from. Stated here rather than buried in each branch so the four can be read
 * against each other and raised together.
 *
 * `recommendations` is 14 because that is the floor the rules themselves apply
 * — see the guard at the top of `recommendations` in utils/advice. The number
 * lives in both places on purpose: the rule enforces it, and this is what the
 * page counts down to, and a page counting to a different number than the one
 * that unlocks it would be worse than the duplication.
 */
const NEED_DAYS = { trends: 21, habits: 21, insights: 28, recommendations: 14 };

export default function Analytics() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = viewFor(location.pathname);

  useDocumentTitle(view.title);

  const account = useUserData();
  const { username } = account;
  const subjects = useSubjectIndex(username);

  // The whole history, sliced here. Same reason the growth page does it: the
  // comparisons need the period *before* the one on screen, and the milestone
  // dates are read out of the running total since the account was created.
  const seriesCall = useCallback(
    () =>
      username
        ? growthService.series(username, 0)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your analytics.' }),
    [username],
  );
  const series = useApi(seriesCall, [username]);

  // The report card, for the Growth Score tile and the weakest-metric
  // suggestion. Reading it files a dated snapshot per metric
  // (backend/tracking/analytics.py), which is why it is called once on open and
  // not on a timer.
  const ratingsCall = useCallback(
    () =>
      username
        ? growthService.ratings(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your score.' }),
    [username],
  );
  const ratings = useApi<Ratings>(ratingsCall, [username]);

  // The fourth call, and the only one that reads anything but this account:
  // "Where You Stand" ranks the reader against every other account with a
  // comparable record, which is arithmetic the client cannot do and should not
  // have the data for. Unscoped by the window picker on purpose — the panel
  // asks where this account stands, not where it stood over a quarter.
  const standingCall = useCallback(
    () =>
      username
        ? analyticsService.standing(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see where you stand.' }),
    [username],
  );
  const standing = useApi<Standing>(standingCall, [username]);

  // The goals, for the Records tab and nothing else. A goal is the only place
  // this account records a target somebody chose — every other benchmark on
  // that tab is the reader's own record — so it is worth a call of its own, and
  // the chapter waits on it rather than claiming there are none.
  const goalsCall = useCallback(
    () =>
      username
        ? goalsService.getGoals(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your goals.' }),
    [username],
  );
  const goals = useApi(goalsCall, [username]);

  // What the account said it was aiming at — the only thing on this page it
  // states rather than the page measuring, and the only thing a first-day
  // account can do here. `baseline: null` is a real answer and is what opens
  // the setup screen; see `BaselineSetup`.
  const baselineCall = useCallback(
    () =>
      username
        ? analyticsService.baseline(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to set a baseline.' }),
    [username],
  );
  const baseline = useApi<BaselineResult>(baselineCall, [username]);

  // What the reader has said they will act on, and when they said it. Two
  // fields and a date; everything the follow-up draws from it is recomputed
  // off the series here. See utils/followup.
  const adoptedCall = useCallback(
    () =>
      username
        ? analyticsService.adoptedAdvice(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your changes.' }),
    [username],
  );
  const adopted = useApi<AdoptedResult>(adoptedCall, [username]);

  // Every graded metric's dated readings, for the follow-up on a recommendation
  // about the report card. Which metric matters depends on what was adopted,
  // which is why this is all of them in one call rather than one per id.
  const gradedCall = useCallback(
    () =>
      username
        ? analyticsService.metricHistories(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your history.' }),
    [username],
  );
  const gradedLog = useApi<MetricHistories>(gradedCall, [username]);

  // The score's own recorded past. See the note on `SinceLast` for what it is
  // for, and services/analytics for why it took an endpoint to reach it.
  const historyCall = useCallback(
    () =>
      username
        ? analyticsService.metricHistory(username, 'overall')
        : Promise.resolve({ success: false as const, message: 'Sign in to see your history.' }),
    [username],
  );
  const scoreLog = useApi<MetricHistory>(historyCall, [username]);

  // ---- Accepting a recommendation ----------------------------------------
  /**
   * Turn a recommendation into a task, and start the clock on measuring it.
   *
   * Two writes, and the second is the one that makes this page worth coming
   * back to. The task is what a reader acts on; the dated adoption record is
   * what lets the tab answer, three weeks later, whether the thing it promised
   * would move actually moved. The button used to do only the first, which left
   * the page making a confident claim about four thousand XP a year and then
   * never mentioning it again.
   *
   * The task is due tomorrow rather than today because every recommendation
   * here is a change to how the *next* stretch of work goes — "claim one
   * weekend day", "move one session earlier" — and dropping it onto a day
   * already half spent makes it the thing you failed at tonight rather than the
   * thing you are trying next.
   *
   * **The task is the required half.** If the task write fails there is nothing
   * to adopt and the whole thing reports failure; if the task lands and the
   * record does not, the reader still gets what they pressed the button for and
   * loses only the follow-up. Failing the visible half because the bookkeeping
   * half failed would be the wrong way round.
   */
  const [adopting, setAdopting] = useState<string | null>(null);
  const [justAdopted, setJustAdopted] = useState<string | null>(null);

  const adopt = useCallback(
    async (item: Advice) => {
      if (!username) return false;
      setAdopting(item.id);
      setJustAdopted(null);
      try {
        const due = new Date();
        due.setDate(due.getDate() + 1);
        const result = await taskService.createTask(username, {
          name: item.title,
          priority: item.priority === 'high' ? 'high' : item.priority === 'medium' ? 'medium' : 'low',
          xp_reward: DEFAULT_ADVICE_XP,
          due_date: due.toISOString().slice(0, 10),
        });
        if (!result.success) return false;

        await analyticsService.adoptAdvice(username, item.id, item.title);
        adopted.reload();
        setJustAdopted(item.title);
        return true;
      } catch {
        return false;
      } finally {
        setAdopting(null);
      }
    },
    [adopted, username],
  );

  /**
   * Stop measuring a change.
   *
   * Removes the record of the decision and leaves any task it created alone —
   * see the endpoint. A reader who has decided a recommendation was not for
   * them wants it off this panel, not their task list rewritten under them.
   */
  const [dropping, setDropping] = useState<string | null>(null);

  const dropAdopted = useCallback(
    async (id: string) => {
      if (!username) return;
      setDropping(id);
      try {
        await analyticsService.dropAdvice(username, id);
        adopted.reload();
      } finally {
        setDropping(null);
      }
    },
    [adopted, username],
  );

  const [span, setSpan] = useState<WindowKey>('1y');
  const [metric, setMetric] = useState<MetricKey>('xp');
  const [grain, setGrain] = useState<Grain>('daily');
  const [subject, setSubject] = useState('');
  const [comparison, setComparison] = useState<ComparisonKey>('thirty');
  const [trendMetric, setTrendMetric] = useState('xp');
  const [category, setCategory] = useState('');

  const all = useMemo(() => series.data?.growth_data ?? [], [series.data]);
  const slice = useMemo(() => sliceWindow(all, span), [all, span]);
  const option = windowOption(span);
  const spanText = spanLabel(slice.current);

  const tasks = useMemo(() => account.data?.tasks ?? [], [account.data]);
  const fromIso = slice.current[0]?.date ?? '';
  const toIso = slice.current[slice.current.length - 1]?.date ?? '';
  const wasFrom = slice.previous[0]?.date ?? '';
  const wasTo = slice.previous[slice.previous.length - 1]?.date ?? '';

  const nameOf = useCallback((id: string) => subjects.get(id)?.name ?? id, [subjects]);

  const subjectOptions = useMemo(
    () =>
      [...subjects.values()]
        .filter((entry) => entry.used > 0)
        .map((entry) => ({ id: entry.id, label: entry.name })),
    [subjects],
  );

  /** The subject filter narrows the tasks a panel counts, nothing else — XP and
   *  focus minutes are recorded per day, not per subject, so the tiles and the
   *  day-series charts cannot honour it and do not pretend to. */
  const bySubject = useMemo(
    () => (subject ? tasks.filter((task) => task.subject === subject) : tasks),
    [subject, tasks],
  );

  /** The same, narrowed to tasks actually finished inside the window. */
  const finished = useMemo(
    () =>
      bySubject.filter((task) => {
        const day = String(task.completed_at || '').slice(0, 10);
        return Boolean(day) && day >= fromIso && day <= toIso;
      }),
    [bySubject, fromIso, toIso],
  );

  // ---- Overview -----------------------------------------------------------
  const figures = useMemo(() => summaryFigures(slice), [slice]);
  const sparks = useMemo(() => tileSeries(slice), [slice]);
  const insights = useMemo(() => growthInsights(slice), [slice]);
  const rhythmRate = useMemo(() => consistency(slice), [slice]);
  const curve = useMemo(() => compounding(slice, all), [all, slice]);
  const reached = useMemo(() => milestoneHistory(all), [all]);
  // Always a year, whatever the window says — see the note at the top.
  const heatRows = useMemo(() => heatmapGrid(all, '365'), [all]);

  // The score and the five metrics it is the mean of, assembled from the report
  // card rather than read off `overall` — see components/Analytics/score.
  const card = useMemo(() => growthScore(ratings.data ?? null), [ratings.data]);
  const score = card.value;
  /**
   * The score's line: its own recorded readings, and nothing else.
   *
   * This used to fall back to `scoreHistory` — a generated climb with the real
   * score pinned on the last point — on the grounds that a panel titled "over
   * time" with one point in it is worse than one with a shape. It is not. That
   * curve was the last invented figure on the page, and it sat on the one tab
   * that never wore a chip, which made it the least honest thing here rather
   * than the most forgivable. An account with fewer than two readings gets no
   * line and a sentence saying why; see `ScorePanel`.
   */
  const recorded = scoreLog.data?.points ?? [];
  const scoreLine = useMemo(() => recorded.map((point) => point.score / 10), [recorded]);
  const scoreMarks = useMemo(
    () => (recorded.length >= 2 ? ['First reading', '', '', 'Now'] : []),
    [recorded],
  );
  const bars = useMemo(() => comparisonBars(slice, score), [score, slice]);

  const breakdown = useMemo(
    () => subjectXp(bySubject, subjects, fromIso, toIso, RADAR_SUBJECTS),
    [bySubject, fromIso, subjects, toIso],
  );

  /** The same subjects over the period before, keyed for the per-row change. */
  const previousBySubject = useMemo(() => {
    const map = new Map<string, number>();
    if (!wasFrom) return map;
    subjectXp(bySubject, subjects, wasFrom, wasTo, RADAR_SUBJECTS).rows.forEach((row) =>
      map.set(row.key, row.xp),
    );
    return map;
  }, [bySubject, subjects, wasFrom, wasTo]);

  // ---- The behavioural shapes, shared by three tabs -----------------------
  const week = useMemo(() => weekShape(slice.current), [slice]);
  const clock = useMemo(() => clockShape(finished), [finished]);
  const rhythm = useMemo(() => rhythmShape(slice.current), [slice]);
  const pace = useMemo(() => momentum(slice.current, MOMENTUM_DAYS), [slice]);
  const balance = useMemo(
    () => balanceShape(tasks, nameOf, fromIso, toIso),
    [fromIso, nameOf, tasks, toIso],
  );

  // ---- Habits -------------------------------------------------------------
  const habits = useMemo(
    () => buildHabits(bySubject, nameOf, fromIso, toIso),
    [bySubject, fromIso, nameOf, toIso],
  );

  /** The calendar carries its own zoom, so it is fed the whole account rather
   *  than the page's window — a year of squares scoped to a 7-day window would
   *  be 358 blanks and one live week. */
  const byDate = useMemo(
    () => habitDays(bySubject, all[0]?.date ?? '', toIso),
    [all, bySubject, toIso],
  );
  const patterns = useMemo(
    () => habitPatterns(bySubject, habits, fromIso, toIso),
    [bySubject, fromIso, habits, toIso],
  );
  const shifts = useMemo(() => habitShifts(habits, toIso), [habits, toIso]);
  const summary = useMemo(() => habitSummary(habits, slice.current), [habits, slice]);

  // ---- Insights -----------------------------------------------------------
  const why = useMemo(() => whyFindings(slice.current), [slice]);
  const how = useMemo(
    () => howFindings(slice.current, finished, clock, rhythm),
    [clock, finished, rhythm, slice],
  );
  const wins = useMemo(() => whatsWorking(slice.current, habits), [habits, slice]);
  const links = useMemo(
    () => relationships(slice.current, bySubject, week),
    [bySubject, slice, week],
  );
  const state = useMemo(
    () => currentState(slice.current, rhythm, week, balance),
    [balance, rhythm, slice, week],
  );

  // ---- Trends -------------------------------------------------------------
  const rows = useMemo(() => trendRows(slice.current, comparison), [comparison, slice]);
  const heading = useMemo(() => directions(slice.current), [slice]);
  const weeks = useMemo(() => weeklyPoints(slice.current), [slice]);
  const partial = useMemo(
    () => comparisonSlices(slice.current, comparison).partial,
    [comparison, slice],
  );
  const verdict = trendVerdict(heading);

  // ---- Recommendations ----------------------------------------------------
  const advice = useMemo(
    () =>
      recommendations({
        days: slice.current,
        week,
        clock,
        rhythm,
        balance,
        ratings: ratings.data ?? null,
      }),
    [balance, clock, ratings.data, rhythm, slice, week],
  );

  const banked = Number(all[all.length - 1]?.cumulative_xp) || 0;
  const projection = useMemo(() => outlook(slice.current, advice, banked), [advice, banked, slice]);

  const shown = useMemo(
    () => (category ? advice.filter((item) => item.category === category) : advice),
    [advice, category],
  );

  /**
   * What happened after each adopted change.
   *
   * Fed the *whole* series rather than the window, and that is the one thing
   * about this call that matters: a follow-up is anchored to the day the change
   * was adopted and needs the days on both sides of it, which the page's window
   * picker knows nothing about. A reader looking at the last 30 days should
   * still see the verdict on a change they made in March.
   */
  const reviews = useMemo(
    () =>
      reviewAdopted({
        adopted: adopted.data?.adopted ?? [],
        days: all,
        tasks,
        graded: gradedLog.data?.series ?? {},
      }),
    [adopted.data, all, gradedLog.data, tasks],
  );
  const reviewSummary = useMemo(() => summarise(reviews), [reviews]);

  /** The ids already being tracked, so a card knows whether it is one of them. */
  const adoptedIds = useMemo(
    () => new Set((adopted.data?.adopted ?? []).map((row) => row.id)),
    [adopted.data],
  );

  // ---- The shell ----------------------------------------------------------
  const refresh = useCallback(() => {
    series.reload();
    account.reload();
    ratings.reload();
    goals.reload();
    adopted.reload();
  }, [account, adopted, goals, ratings, series]);

  /** The streak, which three of the chapters read and none of them fetch. */
  const streak = account.data?.stats?.current_streak ?? 0;

  const openView = useCallback((next: View) => navigate(next.path), [navigate]);

  // ---- The baseline -------------------------------------------------------
  /**
   * Whether the setup screen is showing.
   *
   * Three states rather than two, which is why this is not just
   * `baseline.data?.baseline === null`. A first-run account is shown the screen
   * because it has nothing else to do here; an account that skipped is shown
   * the page, because insisting would be a wall rather than an offer; and an
   * account with a baseline can open the screen again from the panel to change
   * it. `null` means "decide from the record", which is the first-run case.
   */
  const [editingBaseline, setEditingBaseline] = useState<boolean | null>(null);
  const aim = baseline.data?.baseline ?? null;

  const saveBaseline = useCallback(
    async (values: BaselineValues) => {
      if (!username) return false;
      const result = await analyticsService.setBaseline(username, values);
      if (!result.success) return false;
      baseline.reload();
      setEditingBaseline(false);
      return true;
    },
    [baseline, username],
  );

  /**
   * How much record this account has, for the four gated tabs.
   *
   * The whole history rather than the window on screen, because "how long have
   * you been using Ascen" is a question about the account. Counting the window
   * would mean the countdown moved when the reader touched the range picker —
   * telling somebody with four months of data that they need eleven more days
   * because they happened to be looking at a week.
   */
  const historyDays = all.length;

  /** Days still needed for a tab, or 0 once the record is long enough. */
  const waitFor = (key: keyof typeof NEED_DAYS) => Math.max(0, NEED_DAYS[key] - historyDays);

  /**
   * Whether the setup screen takes the page over.
   *
   * Only when there is no baseline *and* the record is too short for the
   * shortest tab to say anything — an established account that never set one
   * gets the offer inside the Overview rather than a screen in front of the
   * analysis it came for. Held until the call answers, so the page does not
   * flash the setup screen at somebody who has a baseline.
   */
  const firstRun =
    !baseline.loading &&
    baseline.data !== null &&
    aim === null &&
    historyDays < NEED_DAYS.recommendations;
  const showSetup = editingBaseline ?? firstRun;

  if (series.loading) return <Loading label="Reading your history" />;
  if (!series.data) {
    return (
      <ErrorState
        message={series.error ?? 'No analytics yet.'}
        onRetry={username ? refresh : undefined}
      />
    );
  }

  const compareLabel = `vs ${option.compare.toLowerCase()}`;
  const comparisonWord = comparison === 'week' ? 'last week' : comparison === 'month' ? 'last month' : 'previous 30';

  return (
    <div className="ax-page">
      <Ambient />
      <div className="ax-shell page-shell">
        <Header
          view={view}
          span={spanText}
          rows={slice.current}
          actions={<RefreshButton onRefresh={refresh} busy={series.loading} />}
        />
        <ViewTabs active={view.key} onView={openView} />

        {/* The setup screen replaces the controls as well as the tab, because
            a window picker over a page with nothing in it to scope is a control
            that does nothing — and the one thing this screen is for is being
            the only thing on it. */}
        {showSetup ? (
          <BaselineSetup
            subjects={subjectOptions}
            current={aim}
            setOn={aim?.set_on ?? ''}
            onSave={saveBaseline}
            onSkip={() => setEditingBaseline(false)}
          />
        ) : (
          <>
        <Controls
          chosen={span}
          onWindow={setSpan}
          subject={subject}
          onSubject={setSubject}
          subjects={subjectOptions}
          compareLabel={option.compare}
        />

        {view.key === 'overview' && (
          <OverviewView
            figures={figures}
            sparks={sparks}
            score={score}
            scoreFactors={card.factors}
            standing={standing.data ?? null}
            scoreLine={scoreLine}
            scoreMarks={scoreMarks}
            sinceLast={<SinceLast points={recorded} />}
            compareLabel={compareLabel}
            slice={slice}
            spanText={spanText}
            previousSpanText={spanLabel(slice.previous)}
            metric={metric}
            onMetric={setMetric}
            grain={grain}
            onGrain={setGrain}
            breakdown={breakdown}
            previousBySubject={previousBySubject}
            rhythmRate={rhythmRate}
            heatRows={heatRows}
            reached={reached}
            bars={bars}
            curve={curve}
            insights={insights}
            currentStreak={account.data?.stats?.current_streak ?? 0}
            bestStreak={account.data?.stats?.best_streak ?? 0}
            baseline={
              aim ? (
                <BaselinePanel
                  aim={aim}
                  setOn={aim.set_on}
                  activeRate={rhythm.activeRate}
                  typicalSession={rhythm.typicalSession}
                  span={spanText}
                  onEdit={() => setEditingBaseline(true)}
                />
              ) : (
                /* No baseline and enough record that the setup screen did not
                   take the page — the offer belongs beside the totals it would
                   give a meaning to, not in front of them. */
                <section className="ax-baseline-offer">
                  <strong>No target behind these numbers.</strong>
                  <button
                    type="button"
                    className="ax-btn ax-btn-primary"
                    onClick={() => setEditingBaseline(true)}
                  >
                    Set a baseline
                  </button>
                </section>
              )
            }
          />
        )}

        {view.key === 'trends' && (waitFor('trends') > 0 || heading.length === 0) && (
          <Locked
            title="Trends"
            remaining={waitFor('trends')}
            need={NEED_DAYS.trends}
            have={historyDays}
            promise="Three weeks is the shortest run that tells a slope from a good fortnight."
            brings={['Direction, per measure', 'This period vs last', 'Signal or noise', 'Where the pace projects']}
            emptyMessage="Nothing has moved far enough in one direction to call a trend."
            action={
              <Link to="/analytics" className="ax-btn">
                See totals
              </Link>
            }
          />
        )}

        {view.key === 'trends' && waitFor('trends') === 0 && heading.length > 0 && (
          <>
            <section className="ax-section">
              <TrendTiles rows={rows} label={comparisonWord} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <ComparePanel
                rows={rows}
                chosen={comparison}
                onChoose={setComparison}
                partial={partial}
              />
              <DirectionPanel directions={heading} verdict={verdict} />
            </section>
            <section className="ax-section">
              <TrendChart
                weeks={weeks}
                metricKey={trendMetric}
                metricLabel={
                  TREND_METRICS.find((entry) => entry.key === trendMetric)?.label ?? 'XP earned'
                }
                tone={TREND_METRICS.find((entry) => entry.key === trendMetric)?.tone ?? 'violet'}
                options={TREND_METRICS.map((entry) => ({ key: entry.key, label: entry.label }))}
                onMetric={setTrendMetric}
              />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <MomentumPanel rows={pace} window={MOMENTUM_DAYS} />
              <CompoundingPanel data={curve} />
            </section>
            {/* Both moved off the Overview, which was carrying them at lower
                resolution under a heading that had already been answered. A
                year against the last one and the dates things were reached are
                the same question this tab is for: what the pace has been. */}
            <section className="ax-section ax-grid ax-grid-halves-even">
              <ComparisonPanel bars={bars} />
              <MilestonePanel reached={reached} />
            </section>
            {/* The growth page's Long Term chapter, which was asking this tab's
                question at higher resolution on a page of its own: where the
                line goes if the pace holds, and when each round number lands.
                Below the panels above rather than replacing them — those are
                the movement, this is where the movement ends up. */}
            <section className="ax-section gr-scope">
              <h2 className="ax-band">Where this is heading</h2>
              <LongTermChapter all={all} streak={streak} />
            </section>
          </>
        )}

        {view.key === 'habits' && (waitFor('habits') > 0 || habits.length === 0) && (
          <Locked
            title="Habits"
            remaining={waitFor('habits')}
            need={NEED_DAYS.habits}
            have={historyDays}
            promise="A habit needs weeks of repetition before there is one to find."
            brings={['Routines, counted', 'Every day you worked', 'Holding or slipping', 'When each began']}
            emptyMessage="Nothing repeats often enough yet to count as a habit."
            action={
              <Link to="/tasks" className="ax-btn">
                Open Tasks
              </Link>
            }
          />
        )}

        {view.key === 'habits' && waitFor('habits') === 0 && habits.length > 0 && (
          <>
            <section className="ax-section">
              <HabitTiles summary={summary} span={spanText} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <HabitOpening summary={summary} span={spanText} />
              <PatternsPanel patterns={patterns} />
            </section>
            <section className="ax-section">
              <h2 className="ax-band">Your habits</h2>
              <HabitCards habits={habits} todayIso={toIso} />
            </section>
            <section className="ax-section">
              <HabitCalendarPanel byDate={byDate} lastIso={toIso} accountDays={all.length} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <HabitConsistencyPanel habits={habits} />
              <TimelinePanel habits={habits} shifts={shifts} />
            </section>
            {/* The growth page's Focus chapter. Habits counts what you repeat;
                this is whether you can execute it reliably — the planned-against-
                finished grid, the focus scores, the recovery after a miss. Same
                question one layer down, which is why it belongs on this tab
                rather than on a page nobody navigated to. */}
            <section className="ax-section gr-scope">
              <h2 className="ax-band">Can you execute it reliably</h2>
              <FocusChapter all={all} tasks={tasks} subjects={subjects} streak={streak} />
            </section>
          </>
        )}

        {view.key === 'insights' && waitFor('insights') > 0 && (
          <Locked
            title="Insights"
            remaining={waitFor('insights')}
            need={NEED_DAYS.insights}
            have={historyDays}
            promise="An explanation needs two comparable stretches to hold against each other."
            brings={['Why the last stretch went that way', 'Your hours, week and rhythm', 'What moves together, with r and n', 'What is working']}
            action={
              <Link to="/habits" className="ax-btn">
                See habits
              </Link>
            }
          />
        )}

        {view.key === 'insights' && waitFor('insights') === 0 && (
          <>
            <section className="ax-section">
              <HeadlineTiles week={week} clock={clock} rhythm={rhythm} balance={balance} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <CurrentStatePanel state={state} span={spanText} />
              <WorkingPanel wins={wins} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <WhyPanel
                findings={why}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'the “why” behind your last stretch')}
              />
              <HowPanel
                findings={how}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'how you tend to work')}
              />
            </section>
            <section className="ax-section">
              <RelationshipsPanel
                relationships={links}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'behavioural relationships')}
              />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <Summary week={week} clock={clock} rhythm={rhythm} span={spanText} />
              <ClockPanel clock={clock} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <WeekPanel week={week} />
              <RhythmPanel rhythm={rhythm} />
            </section>
            {/* The radar came off the Overview to sit beside the panel that
                explains it: one draws the shape of the week by subject, the
                other says whether that shape is drifting. */}
            <section className="ax-section ax-grid ax-grid-halves-even">
              <SubjectPanel rows={breakdown.rows} previous={previousBySubject} />
              <BalancePanel balance={balance} />
            </section>
            <section className="ax-section">
              <InsightsPanel insights={insights} />
            </section>
          </>
        )}

        {/* The follow-up sits above the branch, not inside it, and this is the
            only panel on the page that does.

            The two arms below are about whether there is anything to *suggest*
            — a fortnight of record, and a rule that fired. Whether there is
            anything to *report on* is a different question with a different
            answer: an account that adopted three changes and then went quiet
            for a month has nothing to recommend and three results waiting, and
            hiding those behind the same gate would mean the one thing this tab
            promised to come back and tell you disappears exactly when it
            finally has something to say. */}
        {view.key === 'recommendations' && (
          <section className="ax-section">
            <FollowupPanel
              reviews={reviews}
              summary={reviewSummary}
              onDrop={dropAdopted}
              dropping={dropping}
            />
          </section>
        )}

        {view.key === 'recommendations' && (waitFor('recommendations') > 0 || advice.length === 0) && (
          <Locked
            title="Recommendations"
            remaining={waitFor('recommendations')}
            need={NEED_DAYS.recommendations}
            have={historyDays}
            promise="Each one is priced off your own averages, and an average needs a fortnight."
            brings={['What to change, ranked by worth', 'The arithmetic behind each', 'How hard it is', 'One tap to your task list']}
            emptyMessage="No long gaps, no dead weekend, no late shift worth moving. Nothing to fix."
            action={
              <Link to="/analytics" className="ax-btn">
                See totals
              </Link>
            }
          />
        )}

        {view.key === 'recommendations' && waitFor('recommendations') === 0 && advice.length > 0 && (
          <>
            {/* The projection alone, across the width. It used to share the row
                with an opening panel restating the same figures in prose, which
                left the chart — the thing the tab opens on — squeezed into half
                a screen beside a column of text saying what it already showed. */}
            <section className="ax-section">
              <OutlookPanel outlook={projection} />
            </section>
            {justAdopted && (
              <p className="ax-adopted" role="status">
                <strong>{justAdopted}</strong> is on your task list for tomorrow, and this tab will
                tell you in {SETTLE} days whether it moved. <Link to="/tasks">Open Tasks</Link>
              </p>
            )}
            <section className="ax-section">
              <CategoryFilter items={advice} chosen={category} onChoose={setCategory} />
              {shown.length > 0 && (
                <div className="ax-grid ax-grid-three">
                  {shown.slice(0, HEADLINE_ADVICE).map((item, index) => (
                    <AdviceCard
                      key={item.id}
                      item={item}
                      rank={index + 1}
                      onAdopt={adopt}
                      adopting={adopting}
                      adopted={adoptedIds.has(item.id)}
                    />
                  ))}
                </div>
              )}
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <AlsoPanel items={shown.slice(HEADLINE_ADVICE)} />
              <Caveat />
            </section>
          </>
        )}

        {/* The two chapters that arrived whole. Each was a tab of the growth
            page and neither had a counterpart here — mastery and achievement
            are questions the five original tabs never asked. They keep their own
            layout inside `.gr-scope`; see the stylesheet note at the top. */}
        {view.key === 'subjects' && (
          <div className="ax-section gr-scope">
            <SkillsChapter all={all} tasks={tasks} subjects={subjects} />
          </div>
        )}

        {view.key === 'records' && (
          <div className="ax-section gr-scope">
            <BenchmarksChapter
              all={all}
              tasks={tasks}
              goals={goals.data?.goals ?? []}
              goalsLoading={goals.loading}
              streak={streak}
            />
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Overview
// --------------------------------------------------------------------------
interface OverviewProps {
  figures: ReturnType<typeof summaryFigures>;
  sparks: ReturnType<typeof tileSeries>;
  score: number | null;
  scoreFactors: ScoreFactor[];
  standing: Standing | null;
  /** The "what changed" strip. Null when there is not enough history. */
  sinceLast: React.ReactNode;
  scoreLine: number[];
  scoreMarks: string[];
  compareLabel: string;
  slice: ReturnType<typeof sliceWindow>;
  spanText: string;
  previousSpanText: string;
  metric: MetricKey;
  onMetric: (key: MetricKey) => void;
  grain: Grain;
  onGrain: (key: Grain) => void;
  breakdown: ReturnType<typeof subjectXp>;
  previousBySubject: Map<string, number>;
  rhythmRate: ReturnType<typeof consistency>;
  heatRows: ReturnType<typeof heatmapGrid>;
  reached: ReturnType<typeof milestoneHistory>;
  bars: ReturnType<typeof comparisonBars>;
  curve: ReturnType<typeof compounding>;
  insights: ReturnType<typeof growthInsights>;
  currentStreak: number;
  bestStreak: number;
  /** The baseline panel, or the offer to set one. See `BaselinePanel`. */
  baseline: React.ReactNode;
}

/**
 * The long view of the account — the page as it was, unchanged.
 *
 * A component of its own rather than another branch in the render above. It
 * once had a harder reason — an IntersectionObserver lighting up the
 * sub-navigation bar that used to sit at the top of this tab, which only worked
 * if the hook mounted alongside the sections it watched. The bar is gone (see
 * components/Analytics/Header) and the ids below are anchors now, kept because
 * they name the blocks and cost nothing.
 */
function OverviewView(props: OverviewProps) {
  return (
    <>
      {/* What moved, before anything that merely *is*. See `SinceLast`. */}
      {props.sinceLast}

      <section id="overview" className="ax-section">
        <Tiles
          figures={props.figures}
          sparks={props.sparks}
          score={props.score}
          scoreSeries={props.scoreLine}
          compareLabel={props.compareLabel}
        />
      </section>

      <section id="trajectory" className="ax-section ax-grid ax-grid-trajectory">
        <Trajectory
          current={props.slice.current}
          previous={props.slice.previous}
          metric={props.metric}
          onMetric={props.onMetric}
          grain={props.grain}
          onGrain={props.onGrain}
          spanLabel={props.spanText}
          previousSpanLabel={props.previousSpanText}
        />
        <ScorePanel
          score={props.score}
          factors={props.scoreFactors}
          series={props.scoreLine}
          marks={props.scoreMarks}
          // The counted placement, so the badge here and the Growth Score row
          // on "Where You Stand" are one figure rather than two that disagree.
          percentile={props.standing?.rows.find((row) => row.key === 'score')?.percentile ?? null}
        />
      </section>

      {/* The reader's own target, before the panels that measure against
          nothing. A total is not good or bad on its own — four days a week is
          excellent against a three-day aim and a miss against a six-day one —
          so the thing that makes the rest of this tab legible goes above it. */}
      <section className="ax-section">{props.baseline}</section>

      <section id="standing" className="ax-section ax-grid ax-grid-three">
        <ConsistencyPanel
          rate={props.rhythmRate.rate}
          previousRate={props.rhythmRate.previousRate}
          rows={props.heatRows}
          compareLabel={props.compareLabel}
        />
        <StreaksPanel
          current={props.currentStreak}
          best={props.bestStreak}
          bestMonth={props.rhythmRate.bestMonth}
        />
        <StandingPanel standing={props.standing} />
      </section>

      {/* Where the tab hands over.

          This used to run four rows longer: a subject radar, a milestone list,
          a year-on-year bar chart, the compounding projection and four
          insights, all before the reader reached the bottom. Every one of them
          exists in full on a tab built for it — the radar and the balance on
          Insights, the milestones and the pace on Trends, the projection on
          Trends, the findings on Insights — and the Overview was answering
          "how am I doing" by restating all four other tabs at lower
          resolution.

          What is left is the shortest honest answer to that question: what
          moved, the totals, the trajectory and the score, then whether you are
          showing up and how that compares. One screen, no scrolling past the
          part you came for, and three links out to whichever of the four
          questions you actually have. */}
      <section className="ax-section ax-next">
        <p>Where to go next</p>
        <div className="ax-next-row">
          <Link to="/trends">
            <strong>Trends</strong>
            <span>Which way each measure is heading, and the pace behind it</span>
          </Link>
          <Link to="/insights">
            <strong>Insights</strong>
            <span>Why your record looks like this, with the evidence</span>
          </Link>
          <Link to="/recommendations">
            <strong>Recommendations</strong>
            <span>What to change, ranked by what it is worth</span>
          </Link>
        </div>
      </section>
    </>
  );
}
