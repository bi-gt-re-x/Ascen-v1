/**
 * Growth — the five series, and what the range they cover amounts to.
 *
 * The charts are the port of growth.js and are unchanged: five views of one
 * canvas renderer (utils/growthChart), one mounted at a time, keeping their
 * ids because styles/growth.css sizes them by id.
 *
 * What is new is everything around them. The page used to be one card holding
 * one chart, which is a picture of a line and not an answer to anything — a
 * reader could see that XP went up and had no way to ask what it went up *on*,
 * which days it happened, or whether this stretch was better than the last.
 * The panels answer those, and every one of them is arithmetic over the same
 * two things: the day series the backend already builds, and the account's
 * tasks. Nothing on this page fetches for itself.
 *
 * **The tabs are sections, not series.** They were the five chart views, which
 * made the top of the page a control for one panel in the middle of it. They
 * are the page's own chapters now — Overview is this screen, and the other
 * five are routed and say so — and the five series moved into the chart
 * panel's own picker, beside the chart they redraw. Only Overview is built;
 * see `SECTIONS` for what each of the others is waiting on.
 *
 * **One range governs the page.** The picker in the header — 7 days, 30, 90,
 * or the whole account — slices the series once, and the chart, the summary
 * tiles, the category donut and the insights are all drawn from that slice.
 * Two controls that scope different panels to different windows is how a page
 * ends up quietly comparing a fortnight against a quarter, so there is one.
 * The chart panel shows it a second time because the design has it there, and
 * it is the same state — a second surface, not a second range.
 *
 * Two panels are deliberately outside it, and each has a control of its own.
 * The heatmap: the range's ends are the wrong ones for a map — 7 days is seven
 * squares and nothing worth looking at, All time is a decade of them. Long
 * Term Progress: a panel by that name showing the last week would be a joke.
 * See `heatmapGrid` and `longTermProgress` in utils/growthSummary.
 *
 * The whole history is fetched once rather than a window per range: the tiles
 * compare against the period *before* the one on screen, the milestones are
 * read out of the running total since the account was created, and a request
 * per range would be several round trips to answer questions one already can.
 *
 * It used to re-read every 30 seconds and on every tab focus. It does not now:
 * a page that redraws itself under the reader is the thing the Refresh button
 * exists to replace — see components/RefreshButton.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState, Loading, RefreshButton } from '@/components';
import {
  CategoryDonut,
  ChartHead,
  ChartStrip,
  ExportReport,
  GrowthChart,
  GrowthSummary,
  Insights,
  LongTerm,
  Milestones,
  RangePicker,
  SkillsProgress,
  XpHeatmap,
} from '@/components/Growth';
import { useApi, useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import { growth as growthService } from '@/services';
import {
  emptyChartData,
  processData,
  TAB_TO_TYPE,
  type ChartData,
} from '@/utils/growthChart';
import {
  chartStats,
  growthInsights,
  growthTrend,
  heatmapGrid,
  longTermProgress,
  milestones,
  rangeLabel,
  sliceRange,
  summaryFigures,
  tileSeries,
  type HeatWindowKey,
  type LongTermKey,
  type RangeKey,
} from '@/utils/growthSummary';
import { subjectXp } from '@/utils/subjectXp';
import '@/styles/growth.css';

/**
 * The page's chapters.
 *
 * Overview is this screen. The rest are the questions this page's data could
 * answer at length and does not yet, each named after the answer rather than
 * after the panel — and each says what it is waiting on, the same bargain
 * pages/Unbuilt strikes for a whole route. A tab that resolves to nothing
 * reads as a bug; a tab that says what it will be does not.
 */
const SECTIONS = [
  { name: 'overview', label: 'Overview', blurb: '', waiting: [] as string[] },
  {
    name: 'longterm',
    label: 'Long Term',
    blurb:
      'The whole account at year width — levels gained, seasons of activity, and what a year of this actually adds up to.',
    waiting: [
      'The Long Term Progress panel on Overview is the first slice of it',
      'utils/growthSummary — longTermProgress already buckets the series by month',
    ],
  },
  {
    name: 'xp',
    label: 'XP & Productivity',
    blurb:
      'Where XP comes from: task size against task count, the hours of day it lands in, and which priorities actually get finished.',
    waiting: [
      'backend/api/growth.py — the day series carries totals, not per-task rows',
      'utils/subjectXp — the per-task split the donut already uses',
    ],
  },
  {
    name: 'focus',
    label: 'Focus & Consistency',
    blurb:
      'Focus sessions in their own right: length, time of day, how often one is abandoned, and what a streak is really made of.',
    waiting: [
      'backend/api/focus.py — sync and history already exist',
      'frontend/js/timer.js — the timer to port',
    ],
  },
  {
    name: 'skills',
    label: 'Skills & Subjects',
    blurb:
      'Every subject over time rather than one range’s share of it, and the skill levels the growth tree will unlock.',
    waiting: [
      'backend/tracking/tree.py — a stub',
      'backend/api/growthtree.py — a stub',
    ],
  },
  {
    name: 'benchmarks',
    label: 'Benchmarks',
    blurb:
      'This account against its own best months, and against the goals it set — the graded version of it is already at /analytics.',
    waiting: [
      'pages/Analytics — the report card to build on',
      'backend/api/goals.py — targets to measure against',
    ],
  },
] as const;

type SectionName = (typeof SECTIONS)[number]['name'];

/**
 * The five chart series, in the order the original laid them out.
 *
 * These were the page's tabs. They are the chart panel's own picker now — a
 * control for one panel, sat on that panel — and they keep their canvas ids
 * because styles/growth.css sizes them by id.
 */
const METRICS = [
  {
    key: 'cumulative',
    label: 'Cumulative XP',
    title: 'Cumulative XP Progress Over Time',
    canvasId: 'growthChart',
  },
  {
    key: 'daily',
    label: 'Daily XP',
    title: 'Daily XP Earned',
    canvasId: 'dailyXpChart',
  },
  {
    key: 'average',
    label: 'Average Task XP',
    title: 'Average Task XP Per Day',
    canvasId: 'averageXpChart',
  },
  {
    key: 'cumulativeFocus',
    label: 'Cumulative Focus',
    title: 'Cumulative Focus Time (minutes)',
    canvasId: 'cumulativeFocusChart',
  },
  {
    key: 'dailyFocus',
    label: 'Daily Focus',
    title: 'Daily Focus Time (minutes)',
    canvasId: 'dailyFocusChart',
  },
] as const;

export default function Growth() {
  useDocumentTitle('Growth');
  const navigate = useNavigate();

  const account = useUserData();
  const { username } = account;
  const subjects = useSubjectIndex(username);

  // `days: 0` is the whole history — see services/growth.ts for why the page
  // takes all of it and slices here.
  const call = useCallback(
    () =>
      username
        ? growthService.series(username, 0)
        : Promise.resolve({
            success: false as const,
            message: 'Sign in to see your growth.',
          }),
    [username],
  );
  const series = useApi(call, [username]);

  const [section, setSection] = useState<SectionName>('overview');
  const [metric, setMetric] = useState<string>('cumulative');
  const [range, setRange] = useState<RangeKey>('30');
  /** The two windows the page's range does not scope. See the note above. */
  const [heatWindow, setHeatWindow] = useState<HeatWindowKey>('30');
  const [longWindow, setLongWindow] = useState<LongTermKey>('6m');

  /**
   * Bumped to replay the chart's entrance when a series is chosen or the range
   * changes — both are a different chart appearing. The first arrival needs no
   * token: the page shows a spinner until the series is here, so the chart
   * mounts fresh and its entrance effect runs on mount. Nothing bumps it on a
   * refresh, which is the same chart re-read and would be a tic, not an
   * entrance.
   */
  const [playToken, setPlayToken] = useState(0);

  const all = useMemo(() => series.data?.growth_data ?? [], [series.data]);
  const slice = useMemo(() => sliceRange(all, range), [all, range]);

  /** An account under three days old has nothing worth plotting yet. */
  const placeholder =
    typeof series.data?.days_since_creation === 'number' &&
    series.data.days_since_creation < 3;

  const chartData: ChartData = useMemo(
    () => (all.length ? processData(slice.current) : emptyChartData()),
    [all.length, slice],
  );

  const figures = useMemo(() => summaryFigures(slice), [slice]);
  const sparks = useMemo(() => tileSeries(slice), [slice]);
  const trend = useMemo(() => growthTrend(slice), [slice]);
  const strip = useMemo(() => chartStats(slice), [slice]);
  const insights = useMemo(() => growthInsights(slice), [slice]);
  const span = useMemo(() => rangeLabel(slice.current), [slice]);

  const streak = account.data?.stats?.current_streak ?? 0;
  const tiers = useMemo(() => milestones(all, streak), [all, streak]);

  /** The first and last day on screen, for the panels counted off tasks. */
  const fromIso = slice.current[0]?.date ?? '';
  const toIso = slice.current[slice.current.length - 1]?.date ?? '';

  // The two panels the range does not scope — each has its own control.
  const heatRows = useMemo(() => heatmapGrid(all, heatWindow), [all, heatWindow]);
  const longTerm = useMemo(() => longTermProgress(all, longWindow), [all, longWindow]);

  const tasks = useMemo(() => account.data?.tasks ?? [], [account.data]);

  // XP by subject, over the same days the rest of the page is about. The same
  // function the week calendar's breakdown uses, so the two cannot disagree
  // about what a subject is worth.
  const breakdown = useMemo(
    () => subjectXp(tasks, subjects, fromIso, toIso),
    [fromIso, subjects, tasks, toIso],
  );

  const chooseMetric = useCallback((next: string) => {
    setMetric(next);
    setPlayToken((n) => n + 1);
  }, []);

  const chooseRange = useCallback((next: RangeKey) => {
    setRange(next);
    setPlayToken((n) => n + 1);
  }, []);

  const refresh = useCallback(() => {
    series.reload();
    account.reload();
  }, [account, series]);

  if (series.loading) return <Loading label="Loading your growth" />;
  if (!series.data) {
    return (
      <ErrorState
        message={series.error ?? 'No data came back.'}
        onRetry={refresh}
      />
    );
  }

  const active = METRICS.find((entry) => entry.key === metric) ?? METRICS[0];
  const chapter = SECTIONS.find((entry) => entry.name === section) ?? SECTIONS[0];
  const comparedTo =
    figures.comparedDays > 0
      ? `vs. Last ${figures.comparedDays} Days`
      : 'no earlier period';

  return (
    <div className="growth-container">
      <div className="growth-card page-shell" id="growthCard">
        <header className="gr-header">
          <div className="gr-headline">
            <span className="gr-headline-ico" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
              </svg>
            </span>
            <div>
              <h1 className="gr-title">Growth Analytics</h1>
              <p className="gr-sub">
                Track your progress, build momentum, and level up every day.
              </p>
            </div>
          </div>
          <div className="gr-header-tools">
            <RangePicker value={range} span={span} onChange={chooseRange} />
            <ExportReport rows={slice.current} span={span} />
            {/* The only thing on this page that asks the server again. */}
            <RefreshButton
              busy={series.refreshing || account.refreshing}
              onRefresh={refresh}
            />
          </div>
        </header>

        {/* A refresh that failed, over the page it failed to change. */}
        {series.error && <ErrorState message={series.error} onRetry={refresh} />}

        <div className="tab-navigation">
          {SECTIONS.map((entry) => (
            <button
              key={entry.name}
              type="button"
              className={`tab-btn${entry.name === section ? ' active' : ''}`}
              id={`${entry.name}-tab`}
              onClick={() => setSection(entry.name)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {section !== 'overview' ? (
          <section className="gr-panel gr-chapter">
            <h2 className="gr-panel-title">{chapter.label}</h2>
            <p className="gr-chapter-blurb">{chapter.blurb}</p>
            <p className="gr-chapter-note">This section isn’t built yet.</p>
            <ul className="gr-chapter-files">
              {chapter.waiting.map((file) => (
                <li key={file}>
                  <code>{file}</code>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="gr-grid">
            {/* --- The chart, and what the range amounts to beside it ------- */}
            <div className="gr-panel gr-chart-panel">
              <ChartHead
                title={active.title}
                hint="Every point is one day of the range in the header."
                metric={metric}
                metrics={METRICS.map((entry) => ({
                  key: entry.key,
                  label: entry.label,
                }))}
                onMetric={chooseMetric}
                range={range}
                onRange={chooseRange}
              />
              {/* `fade-in` is keyed on the series and the range so choosing
                  either restarts the animation — the original forced a reflow
                  to the same end. */}
              <div
                className="chart-container fade-in"
                key={`${active.key}:${range}`}
              >
                <GrowthChart
                  id={active.canvasId}
                  type={TAB_TO_TYPE[active.key] ?? 'cumulative'}
                  data={chartData}
                  placeholder={placeholder}
                  playToken={playToken}
                />
              </div>
              <ChartStrip stats={strip} />
            </div>

            <GrowthSummary
              figures={figures}
              series={sparks}
              trend={trend}
              against={comparedTo}
            />

            {/* --- Three across: what it was for, when it happened, how far - */}
            <CategoryDonut breakdown={breakdown} />
            <XpHeatmap
              rows={heatRows}
              windowKey={heatWindow}
              onWindowChange={setHeatWindow}
            />
            <Milestones rows={tiers} onViewAll={() => navigate('/achievements')} />

            {/* --- The account at its own scale, and what to make of it ----- */}
            <LongTerm
              data={longTerm}
              windowKey={longWindow}
              onWindowChange={setLongWindow}
            />
            <SkillsProgress onViewAll={() => navigate('/growth-tree')} />
            <Insights insights={insights} onViewPlan={() => navigate('/goals')} />
          </div>
        )}
      </div>
    </div>
  );
}
