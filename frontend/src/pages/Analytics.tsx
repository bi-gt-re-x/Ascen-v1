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
 * - **Overview** — productivity, consistency and quality, their trajectory, the
 *   score, and where the account stands. The three rates lead every panel on
 *   this tab; the totals they came from sit behind them. See `Tiles` for why.
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ambient, ErrorState, Loading } from '@/components';
import {
  BaselinePanel,
  BaselineSetup,
  ComparePanel,
  CompoundingPanel,
  ConsistencyPanel,
  Controls,
  DirectionPanel,
  HabitCalendarPanel,
  HabitCards,
  HabitConsistencyPanel,
  HabitOpening,
  HabitTiles,
  DepthPicker,
  DiagnosisCards,
  DiagnosisEmpty,
  DiscoveredPatterns,
  Header,
  InsightsPanel,
  Locked,
  MilestonePanel,
  NextActions,
  PatternsPanel,
  QualityGridPanel,
  QualityPanel,
  RatedTasksPanel,
  ReasonsPanel,
  ScoreBanner,
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
  ClockPanel,
  CurrentStatePanel,
  HeadlineTiles,
  HowPanel,
  RelationshipsPanel,
  WeekPanel,
  WhyPanel,
  WorkingPanel,
} from '@/components/Insights';
import {
  AdviceCard,
  CategoryFilter,
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
import { useApi, useDocumentTitle, useSettings, useSubjectIndex, useUserData } from '@/hooks';
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
import {
  balanceShape,
  clockShape,
  rhythmShape,
  subjectQuality,
  weekShape,
} from '@/utils/behaviour';
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
import {
  qualityBands,
  qualityGrid,
  ratedTasks,
  ratingFindings,
  reasonFindings,
  summariseRatings,
  summariseReasons,
} from '@/utils/ratings';
import { outlook, recommendations, type Advice } from '@/utils/advice';
import { PATTERN_DAYS, RECENT_DAYS, daysUntilNextWeek, recentWindow, weekStamp } from '@/utils/recent';
import { diagnose, vitals } from '@/utils/diagnosis';
import { analyticalScore } from '@/utils/analyticalScore';
import { buildReport, reportFilename } from '@/utils/report';
import { discoverPatterns } from '@/utils/patterns';
import { DEFAULT_BUDGET, buildPlan } from '@/utils/nextActions';
import type { Prefs } from '@/services/settings';
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

  /* Opens on the account's chosen period. Not kept in step with it after
     that: the control on this page is the reader changing their mind for one
     visit, and writing that back would make every glance a preference.

     `ready` is what makes "opens on" true. The preferences are read near the
     root and arrive a moment after this page mounts, so the initial state
     below is the built-in default rather than the account's answer as often as
     not — the page opened on a year for somebody who had chosen thirty days.
     Following the preference until the reader touches the control fixes that
     without going back on the paragraph above. */
  const { prefs, ready, update } = useSettings();
  const [span, setSpan] = useState<WindowKey>(prefs.analytics_window);
  const spanChosen = useRef(false);
  useEffect(() => {
    if (ready && !spanChosen.current) setSpan(prefs.analytics_window);
  }, [prefs.analytics_window, ready]);

  const chooseSpan = useCallback((next: WindowKey) => {
    spanChosen.current = true;
    setSpan(next);
  }, []);
  // Productivity rather than total XP, and weekly rather than daily. The pair
  // is one decision: the chart opens on a rate, and a rate at daily grain over
  // a year is scatter. See METRICS in components/Analytics/data.
  const [metric, setMetric] = useState<MetricKey>('productivity');
  const [grain, setGrain] = useState<Grain>('weekly');
  const [subject, setSubject] = useState('');
  const [comparison, setComparison] = useState<ComparisonKey>('thirty');
  const [trendMetric, setTrendMetric] = useState('productivity');
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
   * The same five metrics, out of a hundred, with a letter on them.
   *
   * Not a second score. `growthScore` above and this are one calculation shown
   * at two scales — the tile prints the mean over ten, this prints it over a
   * hundred — so they cannot disagree. See utils/analyticalScore.
   */
  const analytical = useMemo(() => analyticalScore(ratings.data ?? null), [ratings.data]);
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

  // ---- Ratings ------------------------------------------------------------
  /**
   * What the reader said about the work, over the window on screen.
   *
   * Scoped by the window like everything else, and by the subject filter,
   * because these are tasks and the filter narrows tasks. Every one of these is
   * safe on an account that has never rated anything — see utils/ratings, where
   * "nothing rated" is a first-class answer rather than a zero.
   */
  const qualitySummary = useMemo(
    () => summariseRatings(bySubject, fromIso, toIso),
    [bySubject, fromIso, toIso],
  );
  const rated = useMemo(() => ratedTasks(bySubject, fromIso, toIso), [bySubject, fromIso, toIso]);
  const ratingRows = useMemo(() => ratingFindings(qualitySummary, rated), [rated, qualitySummary]);
  const ratingBands = useMemo(() => qualityBands(rated), [rated]);
  const ratingGrid = useMemo(() => qualityGrid(rated), [rated]);

  /* The third question's answers, at rating_depth 'reasons'. Counted from the
     same tasks as everything above — an account on the other two levels has
     none, and the panel that reads these draws nothing rather than a row of
     zeroes. */
  const reasons = useMemo(
    () => summariseReasons(bySubject, fromIso, toIso),
    [bySubject, fromIso, toIso],
  );
  const reasonRows = useMemo(() => reasonFindings(reasons), [reasons]);

  /* How much the prompt asks, changeable from here. It is the same preference
     the settings page owns; this is the surface where the difference between
     the three levels is actually visible, so it is the second place that owns
     it — the arrangement the rail's collapse button already has. */
  const setDepth = useCallback(
    (next: Prefs['rating_depth']) => {
      void update({ rating_depth: next });
    },
    [update],
  );
  const depthPicker = (
    <DepthPicker value={prefs.rating_depth} onPick={setDepth} />
  );

  // ---- The behavioural shapes, shared by three tabs -----------------------
  const week = useMemo(() => weekShape(slice.current), [slice]);
  const clock = useMemo(() => clockShape(finished), [finished]);
  const rhythm = useMemo(() => rhythmShape(slice.current), [slice]);
  const balance = useMemo(
    () => balanceShape(tasks, nameOf, fromIso, toIso),
    [fromIso, nameOf, tasks, toIso],
  );

  // ---- The recent window, which advice reads instead of the picker --------
  /**
   * Everything below this line ignores the window picker on purpose.
   *
   * The picker answers "how far back do I want to look", and for a total or a
   * trajectory that is the reader's call. Advice is a different kind of claim:
   * a recommendation drawn from a year of record describes a person who may not
   * exist any more — the term ended, the instrument changed, the timetable
   * moved. What to do this week has to come from the weeks either side of it.
   *
   * So Next Actions, the diagnosis, the patterns and the recommendations all
   * read a fixed recent window from utils/recent — a fortnight for the things
   * that say what to do, a month for the things that claim a pattern, because
   * splitting a fortnight in two leaves a week on each side and a week is not
   * enough to tell a real difference from a good Tuesday.
   */
  const recent = useMemo(() => recentWindow(all, RECENT_DAYS), [all]);
  const patternWindow = useMemo(() => recentWindow(all, PATTERN_DAYS), [all]);

  /**
   * The week this advice belongs to, and the button that re-reads it.
   *
   * `stamp` is the ISO week. Anything keyed on it holds still for seven days
   * and then moves on its own — which is the point: advice that reshuffles on
   * every page load cannot be acted on, because the thing you decided to do
   * this morning is gone by lunchtime.
   *
   * `nudge` is what the plan's own refresh button bumps, and it exists for the
   * half of the problem a re-fetch does not solve. Re-fetching brings in tasks
   * finished since the page opened, and the memos below recompute on their own
   * when it lands. But the plan also reads the *clock* — what is overdue, what
   * is due today, whether anything is logged yet — and none of that changes
   * just because the data did. Bumping the nudge is what re-asks the clock.
   *
   * Neither is a re-roll. Within one week the same record gives the same
   * answer, because the answer is derived rather than shuffled.
   */
  const [nudge, setNudge] = useState(0);
  const stamp = useMemo(() => weekStamp(new Date()), []);
  const weekLeft = useMemo(() => daysUntilNextWeek(new Date()), []);

  /* Tasks finished inside the recent window, and inside the pattern window.
     Unfiltered by subject, unlike `finished` above: advice about which subject
     to change cannot be computed from one subject. */
  const recentFinished = useMemo(
    () =>
      tasks.filter((task) => {
        const at = String(task.completed_at || '').slice(0, 10);
        return Boolean(at) && at >= recent.fromIso && at <= recent.toIso;
      }),
    [recent, tasks],
  );
  const patternFinished = useMemo(
    () =>
      tasks.filter((task) => {
        const at = String(task.completed_at || '').slice(0, 10);
        return Boolean(at) && at >= patternWindow.fromIso && at <= patternWindow.toIso;
      }),
    [patternWindow, tasks],
  );

  /* The same behavioural shapes the picker-scoped tabs read, taken over the
     fortnight instead. Recommendations reads these; Habits and Insights keep
     the picker-scoped ones above, because those tabs report rather than
     advise. */
  const recentWeek = useMemo(() => weekShape(recent.current), [recent]);
  const recentClock = useMemo(() => clockShape(recentFinished), [recentFinished]);
  const recentRhythm = useMemo(() => rhythmShape(recent.current), [recent]);
  const recentBalance = useMemo(
    () => balanceShape(tasks, nameOf, recent.fromIso, recent.toIso),
    [nameOf, recent, tasks],
  );
  const recentSubjects = useMemo(
    () => subjectQuality(tasks, nameOf, recent.fromIso, recent.toIso),
    [nameOf, recent, tasks],
  );
  const recentQuality = useMemo(
    () => summariseRatings(tasks, recent.fromIso, recent.toIso),
    [recent, tasks],
  );
  const recentReasons = useMemo(
    () => summariseReasons(tasks, recent.fromIso, recent.toIso),
    [recent, tasks],
  );

  // ---- Growth diagnosis ---------------------------------------------------
  /**
   * The fortnight against the one before it, as tensions rather than scores.
   *
   * Both halves read the same task list so every comparison is like against
   * like, and both recompute on their own when a re-read brings new tasks in —
   * nothing here reads the clock, so unlike the plan below it needs no nudge.
   */
  const nowVitals = useMemo(() => vitals(recent.current, tasks), [recent, tasks]);
  const beforeVitals = useMemo(() => vitals(recent.previous, tasks), [recent, tasks]);
  const diagnoses = useMemo(
    () => diagnose(nowVitals, beforeVitals),
    [beforeVitals, nowVitals],
  );

  // ---- Discovered patterns ------------------------------------------------
  const discovered = useMemo(
    () =>
      discoverPatterns({
        days: patternWindow.current,
        finished: patternFinished,
        nameOf,
      }),
    [nameOf, patternFinished, patternWindow],
  );

  // ---- What to do next ----------------------------------------------------
  const [budget, setBudget] = useState<number>(DEFAULT_BUDGET);
  const plan = useMemo(
    () =>
      buildPlan({
        tasks,
        goals: goals.data?.goals ?? [],
        days: recent.current,
        nameOf,
        budget,
        stamp,
      }),
    // `nudge` re-reads the plan against the clock: a task finished since the
    // page opened should leave it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budget, goals.data, nameOf, recent, stamp, tasks, nudge],
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
        // The fortnight, not the picker — see "The recent window" above.
        days: recent.current,
        week: recentWeek,
        clock: recentClock,
        rhythm: recentRhythm,
        balance: recentBalance,
        subjects: recentSubjects,
        ratings: ratings.data ?? null,
        // The same summary the Overview's quality panels draw, so the Execution
        // and Quality cards cannot say something the picture beside them
        // contradicts. Safe on an account that has never rated anything: every
        // rule reading it checks `rated` first.
        quality: recentQuality,
        // Empty on the two shallower depths, because the question is never put
        // — the one rule that reads it produces nothing rather than guessing.
        reasons: recentReasons,
      }),
    [
      ratings.data,
      recent,
      recentBalance,
      recentClock,
      recentQuality,
      recentReasons,
      recentRhythm,
      recentSubjects,
      recentWeek,
    ],
  );

  const banked = Number(all[all.length - 1]?.cumulative_xp) || 0;
  /* The same fortnight the advice came from, not the picker's window. Both
     halves of this chart have to describe one stretch of time: the baseline is
     "XP a year at the pace you are going" and the gain is the impacts of the
     items below, each of which was already scaled to a year *from the
     fortnight*. Feeding a 90-day baseline into a fortnight's gains draws a gap
     between two different accounts. */
  const projection = useMemo(
    () => outlook(recent.current, advice, banked),
    [advice, banked, recent],
  );

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

  /**
   * The written report the Export button downloads.
   *
   * A callback rather than a value: building it costs a few milliseconds of
   * string work and there is no reason to pay that on every render of a page
   * whose export most visits never touch. Returns null when there is no report
   * card yet, which is what disables the button — a file full of dashes is
   * worse than no file.
   *
   * Everything below is already derived by the module that owns it. This only
   * gathers, so a figure in the export and the same figure on screen are the
   * same figure by construction rather than by two people remembering to keep
   * them in step.
   */
  const report = useCallback((): string | null => {
    if (!ratings.data) return null;
    return buildReport({
      username: username ?? 'account',
      generatedAt: new Date(),
      span: spanText,
      adviceDays: RECENT_DAYS,
      patternDays: PATTERN_DAYS,
      score: analytical,
      figures,
      insights,
      streak,
      bankedXp: banked,
      subjectRows: breakdown.rows,
      subjectQuality: recentSubjects.rows,
      patterns: discovered,
      diagnoses,
      advice,
      plan: plan.actions,
      planBudget: plan.budget,
    });
  }, [
    advice,
    analytical,
    banked,
    breakdown.rows,
    diagnoses,
    discovered,
    figures,
    insights,
    plan,
    ratings.data,
    recentSubjects.rows,
    spanText,
    streak,
    username,
  ]);

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
      {/* No `pg-enter` here, unlike every other page. This one has its own
          arrival and always did — `.ax-panel` and the tiles carry `ax-enter`,
          which is the same fade and the same ten pixels, and the charts inside
          them wipe on after it (styles/analytics.css, "Arriving"). Adding the
          shared cascade on top ran both at once: the panel would reach half
          opacity behind a section at half opacity and travel the distance
          twice. One entrance per page, and this page already had a richer one. */}
      {/* The view rides on the shell so a tab can tune its own rhythm without
          reaching for the other six. Recommendations is the one that needs it:
          it is the only tab whose panels are read rather than scanned, and at
          the shared 18px the plan, the diagnosis and the cards ran together as
          one wall. */}
      <div className={`ax-shell page-shell ax-view-${view.key}`}>
        <Header
          view={view}
          span={spanText}
          onExport={report}
          exportName={reportFilename(username ?? 'account', new Date())}
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
          onWindow={chooseSpan}
          subject={subject}
          onSubject={setSubject}
          subjects={subjectOptions}
          compareLabel={option.compare}
        />

        {view.key === 'overview' && (
          <OverviewView
            analytical={analytical}
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
            rhythmRate={rhythmRate}
            heatRows={heatRows}
            currentStreak={account.data?.stats?.current_streak ?? 0}
            bestStreak={account.data?.stats?.best_streak ?? 0}
            quality={
              <>
                <QualityPanel
                  summary={qualitySummary}
                  findings={ratingRows}
                  bands={ratingBands}
                  span={spanText}
                  depth={prefs.rating_depth}
                  aside={depthPicker}
                />
                <QualityGridPanel
                  cells={ratingGrid}
                  summary={qualitySummary}
                  depth={prefs.rating_depth}
                />
              </>
            }
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
            <section className="ax-section ax-hero">
              <TrendChart
                weeks={weeks}
                metricKey={trendMetric}
                metricLabel={
                  TREND_METRICS.find((entry) => entry.key === trendMetric)?.label ?? 'Productivity'
                }
                tone={TREND_METRICS.find((entry) => entry.key === trendMetric)?.tone ?? 'violet'}
                options={TREND_METRICS.map((entry) => ({ key: entry.key, label: entry.label }))}
                onMetric={setTrendMetric}
              />
            </section>
            {/* The projection alone, full width. It was sharing a row with
                "Which way you are heading", which asked the same question as
                "Which way each measure is heading" two rows above it — the
                same window, one as a delta and one as a fitted slope. The
                fitted one stayed. */}
            <section className="ax-section">
              <CompoundingPanel data={curve} />
            </section>
            {/* Both moved off the Overview, which was carrying them at lower
                resolution under a heading that had already been answered. A
                year against the last one and the dates things were reached are
                the same question this tab is for: what the pace has been. */}
            <section className="ax-section ax-compact">
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
            <section className="ax-section ax-hero">
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
            {/* Above the relationship panel rather than below it: this is the
                one panel on the tab that answers "why am I improving" with a
                condition rather than a correlation, and it is what a reader
                opening Insights is actually looking for. It reads its own
                month-long window rather than the picker — see "The recent
                window" in the data section. */}
            <section className="ax-section">
              <DiscoveredPatterns items={discovered} window={PATTERN_DAYS} />
            </section>
            <section className="ax-section ax-hero">
              <RelationshipsPanel
                relationships={links}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'behavioural relationships')}
              />
            </section>
            {/* When the work happens. `Summary` used to lead this row with a
                paragraph assembled from these same figures — which is what
                `CurrentStatePanel` does at the top of the tab, from the same
                figures again. One opening paragraph per tab is enough. */}
            <section className="ax-section ax-grid ax-grid-halves-even">
              <ClockPanel clock={clock} />
              <WeekPanel week={week} />
            </section>
            {/* The radar came off the Overview to sit beside the panel that
                explains it: one draws the shape of the week by subject, the
                other says whether that shape is drifting. */}
            {/* The web, its legend and the concentration reading, in one
                panel across the full width. They were two panels side by side,
                both enumerating the same subjects in the same order from the
                same figures — see `SubjectPanel`, which absorbed the half of
                the other that was not already here. */}
            <section className="ax-section ax-hero">
              <SubjectPanel
                rows={breakdown.rows}
                previous={previousBySubject}
                balance={balance}
              />
            </section>
            {/* The one panel on this tab that names individual tasks. Every
                other finding here is an aggregate, and an aggregate cannot
                answer the question a reader has straight after reading one —
                which tasks were those. It sits on Insights rather than the
                Overview because "why did this window go like that" is exactly
                the question a list of your best and worst work answers. */}
            <section className="ax-section ax-grid ax-grid-halves-even ax-compact">
              <RatedTasksPanel rated={rated} summary={qualitySummary} />
              <InsightsPanel insights={insights} />
            </section>
            {/* The only panel on the page that answers *why*, and the only one
                that exists at one of the three depths and not the others. It
                sits on this tab rather than the Overview for the reason the
                rated-task list above it does: "why did this window go like
                that" is this tab's question, and a count of causes is the
                closest thing the app has to an answer. It draws nothing at all
                unless the account has asked to be asked — see ReasonsPanel. */}
            <ReasonsPanel
              reasons={reasons}
              findings={reasonRows}
              depth={prefs.rating_depth}
              span={spanText}
            />
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
        {/* The plan comes first, above even the follow-ups, and it is the only
            panel on this page about the next hour rather than the last
            fortnight. It is gated on nothing: an account three days old still
            has overdue work and a goal with a deadline, and those are exactly
            the days when being told what to do is worth most. */}
        {view.key === 'recommendations' && (
          <section className="ax-section">
            <NextActions
              plan={plan}
              onBudget={setBudget}
              weekLeft={weekLeft}
              /* Both halves: `refresh` re-reads the account so a task finished
                 elsewhere leaves the plan, and the nudge re-asks the clock so
                 what counts as overdue is worked out again. */
              onRefresh={() => {
                refresh();
                setNudge((at) => at + 1);
              }}
            />
          </section>
        )}

        {/* Then the diagnosis: what the fortnight means, before what to change
            about it. A reader who understands why the numbers are moving reads
            the recommendations below as reasons rather than as chores. */}
        {view.key === 'recommendations' && (
          <section className="ax-section">
            {diagnoses.length > 0 ? (
              <DiagnosisCards items={diagnoses} />
            ) : (
              <DiagnosisEmpty enoughRecord={recent.previous.length >= 7} />
            )}
          </section>
        )}

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
  /** The score, its letter and its five parts. See ScoreBanner. */
  analytical: ReturnType<typeof analyticalScore>;
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
  rhythmRate: ReturnType<typeof consistency>;
  heatRows: ReturnType<typeof heatmapGrid>;
  currentStreak: number;
  bestStreak: number;
  /** The baseline panel, or the offer to set one. See `BaselinePanel`. */
  baseline: React.ReactNode;
  /**
   * The two rating panels, passed in rather than built here.
   *
   * They read the task list and the subject filter, which this component is not
   * given — every other panel on the Overview is arithmetic over the day series
   * alone. Handing them down whole keeps that true.
   */
  quality: React.ReactNode;
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
      {/* The score and its letter, above everything — including what moved.
          A reader who opens this tab and reads one thing should read this one:
          it is the whole account in a number, and the sentence under it names
          the measure holding that number down. */}
      <ScoreBanner score={props.analytical} />

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

      {/* Quality, in full, directly under the tile that states it in one
          number. It sits here rather than on a tab of its own because it is one
          of the three measures this tab now leads with, and because it is the
          only one whose figure the app did not measure — the reader did. Two
          panels: what they said, and where the tasks they said it about
          actually landed. Both are self-effacing when nothing has been rated;
          see components/Analytics/Quality. */}
      <section className="ax-section ax-grid ax-grid-halves-even">{props.quality}</section>

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
          moved, then productivity, consistency and quality — how much a day,
          how often, and how much each piece was worth — then their trajectory
          and the score they roll up into. One screen, no scrolling past the
          part you came for, and three links out to whichever of the four
          questions you actually have. */}
      <section className="ax-section ax-next">
        <p>Where to go next</p>
        <div className="ax-next-row">
          <Link to="/trends">
            <strong>Trends</strong>
            <span>Whether productivity, consistency and quality are actually moving</span>
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
