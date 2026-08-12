/**
 * Analytics — one page, five tabs, and three of them are the point.
 *
 * This page was the graded report card, then it was the long view of an
 * account, and it is now the place the app does its thinking. The reason for
 * the last change is the reason for the shape of the file: analysis split
 * across three separate pages in the rail was three pages nobody moved between,
 * and the whole value of the analysis is in the movement — what I do, then why
 * I do it, then what to change. Putting them in one bar makes the sequence a
 * click instead of a navigation.
 *
 * ## The five tabs and the lines between them
 *
 * - **Overview** — the long view. Totals, trajectory, milestones, where the
 *   account stands. This is what the page was and it is unchanged.
 * - **Trends** — the derivative rather than the level. Which way each measure
 *   is heading and whether the slope survives its own noise.
 * - **Habits — what I do.** Recurring behaviour, counted. Cards, a calendar, a
 *   timeline. It never says *why*: the moment it does, the next tab has no
 *   reason to exist.
 * - **Insights — why and how.** Two counts put together, with the evidence for
 *   the connection graded and printed. It never says what to do.
 * - **Recommendations — how I improve.** Instructions, ranked by what each is
 *   worth, with the arithmetic attached. It never re-states a finding as news.
 *
 * Keeping those boundaries sharp is the single design decision this page is
 * built around, which is why each tab has a different personality rather than
 * three grids of the same card, and why the bar carries a line of prose saying
 * what the open tab is for.
 *
 * ## How it holds together
 *
 * **Three calls, one window, five tabs.** The whole day series (`days: 0`), the
 * account's stats and tasks, and the report card. Every panel on every tab is
 * arithmetic over those three — nothing here fetches per tab — and every tab is
 * scoped by the one window picker, so two tabs can never quietly be describing
 * different periods. The exceptions are deliberate and marked: the Overview
 * heatmap always draws a year, and the Habits calendar carries its own zoom,
 * because a map of 91 squares and a map of 730 are not the same picture.
 *
 * **A tab is a route.** `/analytics`, `/trends`, `/habits`, `/insights`,
 * `/recommendations` all render this component and differ only in which view
 * opens. That is what makes the rail, the back button and a pasted link agree
 * about which tab is showing — local state would have broken all three.
 *
 * **All five compute on every render, and that is on purpose.** Everything is
 * memoised against the slice, so switching tabs recomputes nothing; the cost of
 * running the arithmetic for a hidden tab is a few hundred array passes once
 * per window change, and the alternative — five children each holding their own
 * memos — would mean the page could not tell the header which tabs are drawing
 * placeholder figures.
 *
 * **What is real and what is not.** Every figure is this account's own except
 * where a panel wears the Sample chip in its top-right corner, and the header
 * wears one too when the whole tab is a placeholder. Three tabs fall back to
 * sample data on an account too young to fill them — the alternative is an
 * empty page that never explains what it would have shown. The sample blocks
 * live at the bottom of utils/habits, utils/insight, utils/trends and
 * utils/advice, one per file, so they can be deleted in four edits.
 */
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import {
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
  MilestonePanel,
  PatternsPanel,
  SCORE_SCALE,
  ScorePanel,
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
  Opening,
  OutlookPanel,
} from '@/components/Recommendations';
import {
  SAMPLE,
  comparisonBars,
  compounding,
  consistency,
  scoreHistory,
  sliceWindow,
  spanLabel,
  windowOption,
  type Grain,
  type MetricKey,
  type WindowKey,
} from '@/components/Analytics/data';
import { useApi, useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import { growth as growthService } from '@/services';
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
  SAMPLE_HABITS,
  SAMPLE_PATTERNS,
  buildHabits,
  habitDays,
  habitPatterns,
  habitShifts,
  habitSummary,
  sampleCalendar,
} from '@/utils/habits';
import {
  SAMPLE_FINDINGS,
  SAMPLE_HOW,
  SAMPLE_RELATIONSHIPS,
  SAMPLE_WINS,
  currentState,
  howFindings,
  relationships,
  unlock,
  whatsWorking,
  whyFindings,
} from '@/utils/insight';
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_TREND_ROWS,
  TREND_METRICS,
  comparisonSlices,
  directions,
  trendRows,
  trendVerdict,
  weeklyPoints,
  type ComparisonKey,
} from '@/utils/trends';
import { SAMPLE_ADVICE, outlook, recommendations } from '@/utils/advice';
import type { Ratings } from '@/types';
import '@/styles/analytics.css';

/** How many named subjects get a spoke before Other takes the rest. */
const RADAR_SUBJECTS = 6;

/** How many recommendations get a card of their own before the rest go in a list. */
const HEADLINE_ADVICE = 3;

/** The window the momentum panel compares, in days. See `momentum`. */
const MOMENTUM_DAYS = 90;

/**
 * How much history a tab needs before it stops using placeholder figures.
 *
 * Not one number, because the tabs ask different things of the record: a habit
 * needs weeks of repetition to be a habit at all, an explanation needs two
 * comparable periods, and a recommendation needs an average worth projecting
 * from. Stated here rather than buried in each branch so the three can be read
 * against each other and raised together.
 */
const NEED_DAYS = { habits: 21, insights: 28, trends: 21 };

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

  const score = ratings.data ? ratings.data.overall.score / SCORE_SCALE : null;
  const scoreLine = useMemo(() => scoreHistory(score ?? 0), [score]);
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
  const realHabits = useMemo(
    () => buildHabits(bySubject, nameOf, fromIso, toIso),
    [bySubject, fromIso, nameOf, toIso],
  );
  const habitsAreSample = realHabits.length === 0;
  const habits = habitsAreSample ? SAMPLE_HABITS : realHabits;

  /** The calendar carries its own zoom, so it is fed the whole account rather
   *  than the page's window — a year of squares scoped to a 7-day window would
   *  be 358 blanks and one live week. */
  const realDates = useMemo(
    () => habitDays(bySubject, all[0]?.date ?? '', toIso),
    [all, bySubject, toIso],
  );
  const byDate = realDates.size > 0 ? realDates : sampleCalendar(toIso);
  const realPatterns = useMemo(
    () => habitPatterns(bySubject, realHabits, fromIso, toIso),
    [bySubject, fromIso, realHabits, toIso],
  );
  const patterns = habitsAreSample || realPatterns.length === 0 ? SAMPLE_PATTERNS : realPatterns;
  const shifts = useMemo(() => habitShifts(habits, toIso), [habits, toIso]);
  const summary = useMemo(() => habitSummary(habits, slice.current), [habits, slice]);

  // ---- Insights -----------------------------------------------------------
  const realWhy = useMemo(() => whyFindings(slice.current), [slice]);
  const realHow = useMemo(
    () => howFindings(slice.current, finished, clock, rhythm),
    [clock, finished, rhythm, slice],
  );
  const realWins = useMemo(() => whatsWorking(slice.current, realHabits), [realHabits, slice]);
  const realLinks = useMemo(
    () => relationships(slice.current, bySubject, week),
    [bySubject, slice, week],
  );
  const state = useMemo(
    () => currentState(slice.current, rhythm, week, balance),
    [balance, rhythm, slice, week],
  );

  const insightsAreSample = realWhy.length === 0 && realHow.length === 0 && realLinks.length === 0;
  const why = insightsAreSample ? SAMPLE_FINDINGS : realWhy;
  const how = insightsAreSample ? SAMPLE_HOW : realHow;
  const wins = insightsAreSample ? SAMPLE_WINS : realWins;
  const links = insightsAreSample ? SAMPLE_RELATIONSHIPS : realLinks;

  // ---- Trends -------------------------------------------------------------
  const realRows = useMemo(() => trendRows(slice.current, comparison), [comparison, slice]);
  const realDirections = useMemo(() => directions(slice.current), [slice]);
  const weeks = useMemo(() => weeklyPoints(slice.current), [slice]);
  const partial = useMemo(
    () => comparisonSlices(slice.current, comparison).partial,
    [comparison, slice],
  );

  const trendsAreSample = realDirections.length === 0;
  const rows = trendsAreSample ? SAMPLE_TREND_ROWS : realRows;
  const heading = trendsAreSample ? SAMPLE_DIRECTIONS : realDirections;
  const verdict = trendVerdict(realDirections);

  // ---- Recommendations ----------------------------------------------------
  const realAdvice = useMemo(
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
  const adviceIsSample = realAdvice.length === 0;
  const advice = adviceIsSample ? SAMPLE_ADVICE : realAdvice;

  const banked = Number(all[all.length - 1]?.cumulative_xp) || 0;
  const projection = useMemo(() => outlook(slice.current, advice, banked), [advice, banked, slice]);

  const shown = useMemo(
    () => (category ? advice.filter((item) => item.category === category) : advice),
    [advice, category],
  );

  // ---- The shell ----------------------------------------------------------
  const refresh = useCallback(() => {
    series.reload();
    account.reload();
    ratings.reload();
  }, [account, ratings, series]);

  const openView = useCallback((next: View) => navigate(next.path), [navigate]);

  const sampleForView: Record<string, boolean> = {
    overview: false,
    trends: trendsAreSample,
    habits: habitsAreSample,
    insights: insightsAreSample,
    recommendations: adviceIsSample,
  };

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
          sample={sampleForView[view.key]}
          actions={<RefreshButton onRefresh={refresh} busy={series.loading} />}
        />
        <ViewTabs active={view.key} onView={openView} />
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
            scoreLine={scoreLine}
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
          />
        )}

        {view.key === 'trends' && (
          <>
            <section className="ax-section">
              <TrendTiles rows={rows} label={comparisonWord} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <ComparePanel
                rows={rows}
                chosen={comparison}
                onChoose={setComparison}
                partial={trendsAreSample ? null : partial}
                sample={trendsAreSample}
              />
              <DirectionPanel directions={heading} verdict={verdict} sample={trendsAreSample} />
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
            <section className="ax-foot">
              <p>A slope you can see through the noise is worth more than a good fortnight. 📈</p>
            </section>
          </>
        )}

        {view.key === 'habits' && (
          <>
            <section className="ax-section">
              <HabitTiles summary={summary} span={spanText} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <HabitOpening summary={summary} span={spanText} />
              <PatternsPanel patterns={patterns} sample={habitsAreSample || realPatterns.length === 0} />
            </section>
            <section className="ax-section">
              <h2 className="ax-band">Your habits</h2>
              <HabitCards habits={habits} todayIso={toIso} />
            </section>
            <section className="ax-section">
              <HabitCalendarPanel
                byDate={byDate}
                lastIso={toIso}
                accountDays={all.length}
                sample={realDates.size === 0}
              />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <HabitConsistencyPanel habits={habits} sample={habitsAreSample} />
              <TimelinePanel habits={habits} shifts={shifts} sample={habitsAreSample} />
            </section>
            <section className="ax-foot">
              <p>This is what you do. Open Insights to find out why. 🔁</p>
            </section>
          </>
        )}

        {view.key === 'insights' && (
          <>
            <section className="ax-section">
              <HeadlineTiles week={week} clock={clock} rhythm={rhythm} balance={balance} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <CurrentStatePanel state={state} span={spanText} />
              <WorkingPanel wins={wins} sample={insightsAreSample} />
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <WhyPanel
                findings={why}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'the “why” behind your last stretch')}
                sample={insightsAreSample}
              />
              <HowPanel
                findings={how}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'how you tend to work')}
                sample={insightsAreSample}
              />
            </section>
            <section className="ax-section">
              <RelationshipsPanel
                relationships={links}
                notice={unlock(slice.current.length, NEED_DAYS.insights, 'behavioural relationships')}
                sample={insightsAreSample}
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
            <section className="ax-section ax-grid ax-grid-halves-even">
              <BalancePanel balance={balance} />
              <InsightsPanel insights={insights} />
            </section>
            <section className="ax-foot">
              <p>Patterns are easier to change than totals. Read these, then open Recommendations. 🔎</p>
            </section>
          </>
        )}

        {view.key === 'recommendations' && (
          <>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <Opening advice={advice} outlook={projection} sample={adviceIsSample} />
              <OutlookPanel outlook={projection} sample={adviceIsSample} />
            </section>
            <section className="ax-section">
              <CategoryFilter items={advice} chosen={category} onChoose={setCategory} />
              {shown.length > 0 && (
                <div className="ax-grid ax-grid-three">
                  {shown.slice(0, HEADLINE_ADVICE).map((item, index) => (
                    <AdviceCard key={item.id} item={item} rank={index + 1} />
                  ))}
                </div>
              )}
            </section>
            <section className="ax-section ax-grid ax-grid-halves-even">
              <AlsoPanel items={shown.slice(HEADLINE_ADVICE)} sample={adviceIsSample} />
              <Caveat />
            </section>
            <section className="ax-foot">
              <p>Pick one. A change you actually make beats three you agree with. 🎯</p>
            </section>
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
  scoreLine: number[];
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
          series={props.scoreLine}
          marks={['Start', '', '', 'Now']}
          percentile={SAMPLE.overallPercentile}
        />
      </section>

      <section id="breakdown" className="ax-section ax-grid ax-grid-three">
        <SubjectPanel rows={props.breakdown.rows} previous={props.previousBySubject} />
        <ConsistencyPanel
          rate={props.rhythmRate.rate}
          previousRate={props.rhythmRate.previousRate}
          rows={props.heatRows}
          compareLabel={props.compareLabel}
        />
        <MilestonePanel reached={props.reached} />
      </section>

      <section id="longterm" className="ax-section ax-grid ax-grid-halves">
        <ComparisonPanel bars={props.bars} />
        <CompoundingPanel data={props.curve} />
      </section>

      <section id="standing" className="ax-section ax-grid ax-grid-three">
        <StreaksPanel
          current={props.currentStreak}
          best={props.bestStreak}
          bestMonth={props.rhythmRate.bestMonth}
        />
        <InsightsPanel insights={props.insights} />
        <StandingPanel rows={[...SAMPLE.standing]} />
      </section>

      <section className="ax-foot">
        <p>Long-term growth is the result of consistent daily actions. Keep compounding. 🚀</p>
      </section>
    </>
  );
}
