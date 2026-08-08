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
 * Six panels answer those, and every one of them is arithmetic over the same
 * two things: the day series the backend already builds, and the account's
 * tasks. Nothing on this page fetches for itself.
 *
 * **One range governs the page.** The picker in the header — 7 days, 30, 90,
 * or the whole account — slices the series once, and the chart, the summary
 * tiles, the category donut, the heatmap, the activity list and the insights
 * are all drawn from that slice. Two controls that scope different panels to
 * different windows is how a page ends up quietly comparing a fortnight
 * against a quarter, so there is one. The tabs choose which series; the range
 * chooses how much of it.
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
import { ErrorState, Loading, RefreshButton } from '@/components';
import {
  CategoryDonut,
  GrowthChart,
  GrowthSummary,
  Insights,
  Milestones,
  RangePicker,
  RecentXpActivity,
  XpHeatmap,
  type ActivityEntry,
} from '@/components/Growth';
import { useApi, useDocumentTitle, useSubjectIndex, useUserData } from '@/hooks';
import { growth as growthService } from '@/services';
import { subjectOf } from '@/hooks/useSubjects';
import {
  emptyChartData,
  processData,
  TAB_TO_TYPE,
  type ChartData,
} from '@/utils/growthChart';
import {
  growthInsights,
  heatmapWeeks,
  milestones,
  rangeLabel,
  sliceRange,
  summaryFigures,
  type RangeKey,
} from '@/utils/growthSummary';
import { subjectXp } from '@/utils/subjectXp';
import '@/styles/growth.css';

/** The tabs, in the order the original laid them out. */
const TABS = [
  {
    name: 'cumulative',
    label: 'Cumulative Growth',
    title: 'Cumulative XP Progress Over Time',
    canvasId: 'growthChart',
  },
  {
    name: 'daily',
    label: 'Daily XP',
    title: 'Daily XP Earned',
    canvasId: 'dailyXpChart',
  },
  {
    name: 'average',
    label: 'Average Task XP Daily',
    title: 'Average Task XP Per Day',
    canvasId: 'averageXpChart',
  },
  {
    name: 'cumulativeFocus',
    label: 'Cumulative Focus',
    title: 'Cumulative Focus Time (minutes)',
    canvasId: 'cumulativeFocusChart',
  },
  {
    name: 'dailyFocus',
    label: 'Daily Focus',
    title: 'Daily Focus Time (minutes)',
    canvasId: 'dailyFocusChart',
  },
] as const;

type TabName = (typeof TABS)[number]['name'];

/** How many finished tasks the activity panel lists. Four, as the design has. */
const ACTIVITY_SHOWN = 4;

/** "Today, 7:35 AM" — near days by name, the rest by date. */
function whenLabel(stamp: string, now: Date): string {
  const at = new Date(stamp);
  if (Number.isNaN(at.getTime())) return '';
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const midnight = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((midnight(now) - midnight(at)) / 86_400_000);

  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  return `${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function Growth() {
  useDocumentTitle('Growth');

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

  const [tab, setTab] = useState<TabName>('cumulative');
  const [range, setRange] = useState<RangeKey>('30');

  /**
   * Bumped to replay the chart's entrance when a tab is chosen or the range
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
  const weeks = useMemo(() => heatmapWeeks(slice.current), [slice]);
  const tiers = useMemo(() => milestones(all), [all]);
  const insights = useMemo(() => growthInsights(slice), [slice]);
  const span = useMemo(() => rangeLabel(slice.current), [slice]);

  /** The first and last day on screen, for the panels counted off tasks. */
  const fromIso = slice.current[0]?.date ?? '';
  const toIso = slice.current[slice.current.length - 1]?.date ?? '';

  const tasks = useMemo(() => account.data?.tasks ?? [], [account.data]);

  // XP by subject, over the same days the rest of the page is about. The same
  // function the week calendar's breakdown uses, so the two cannot disagree
  // about what a subject is worth.
  const breakdown = useMemo(
    () => subjectXp(tasks, subjects, fromIso, toIso),
    [fromIso, subjects, tasks, toIso],
  );

  const activity = useMemo<ActivityEntry[]>(() => {
    const now = new Date();
    return tasks
      .filter((task) => {
        if (task.status !== 'done') return false;
        const day = (task.completed_at || '').slice(0, 10);
        return Boolean(day) && day >= fromIso && day <= toIso;
      })
      .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
      .slice(0, ACTIVITY_SHOWN)
      .map((task) => ({
        id: String(task.id),
        title: task.title || 'Untitled',
        subject: subjectOf(subjects, task.subject),
        xp: Number(task.xp_value) || 0,
        when: whenLabel(task.completed_at as string, now),
      }));
  }, [fromIso, subjects, tasks, toIso]);

  const choose = useCallback((name: TabName) => {
    setTab(name);
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

  const active = TABS.find((t) => t.name === tab) ?? TABS[0];

  return (
    <div className="growth-container">
      <div className="growth-card page-shell" id="growthCard">
        <header className="gr-header">
          <div>
            <h1 className="gr-title">Growth Analytics</h1>
            <p className="gr-sub">
              Track your progress, build momentum, and level up every day.
            </p>
          </div>
          <div className="gr-header-tools">
            <RangePicker value={range} span={span} onChange={chooseRange} />
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
          {TABS.map((t) => (
            <button
              key={t.name}
              type="button"
              className={`tab-btn${t.name === tab ? ' active' : ''}`}
              id={`${t.name}-tab`}
              onClick={() => choose(t.name)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="gr-grid">
          {/* --- The chart, and what the range amounts to beside it --------- */}
          <div className="gr-panel gr-chart-panel">
            {/* `fade-in` is keyed on the tab and the range so choosing either
                restarts the animation — the original forced a reflow to the
                same end. */}
            <div
              className="chart-container fade-in"
              key={`${active.name}:${range}`}
            >
              <h2 className="chart-title">{active.title}</h2>
              <GrowthChart
                id={active.canvasId}
                type={TAB_TO_TYPE[active.name] ?? 'cumulative'}
                data={chartData}
                placeholder={placeholder}
                playToken={playToken}
              />
            </div>
          </div>

          <GrowthSummary figures={figures} />

          {/* --- Three across: what it was for, when it happened, how far --- */}
          <CategoryDonut breakdown={breakdown} />
          <XpHeatmap weeks={weeks} />
          <Milestones rows={tiers} />

          {/* --- What just happened, and what to make of it ----------------- */}
          <RecentXpActivity
            entries={activity}
            onViewAll={() => choose('daily')}
          />
          <Insights insights={insights} />
        </div>
      </div>
    </div>
  );
}
