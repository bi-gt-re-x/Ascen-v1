/**
 * Analytics — the long view of an account.
 *
 * This page was the graded report card: five metrics, a letter each, and a
 * panel explaining how they were scored. That is a snapshot, and a snapshot is
 * the one thing a page called Analytics should not be — it answered "how am I
 * doing today" while the account had two years of history sitting unread in the
 * same series the growth page slices a fortnight out of. The report card's
 * score survives as one tile up top; everything else here is about the shape of
 * a long stretch of time rather than the state of one day.
 *
 * **Three calls, one window.** The whole day series (`days: 0`), the account's
 * stats and tasks, and the report card. Every panel below is arithmetic over
 * those three — nothing here fetches for itself — and every panel is scoped by
 * the one window picker in the controls, so two panels can never quietly be
 * describing different periods. The exception is deliberate and marked: the
 * heatmap always draws a year, because a map of 91 squares and a map of 730 are
 * not the same picture and the panel is about rhythm rather than range.
 *
 * **The page scrolls.** It used to be pinned to the viewport height — it was
 * one card and a sidebar and fit any screen. Fourteen panels do not fit any
 * screen, and a pinned page that overflows does not shorten, it loses the
 * bottom. Its route came off `PINNED` in App.tsx for the same reason Growth's
 * did. The chapter tabs move the reader through that scroll rather than hiding
 * parts of it — see components/Analytics/Header.
 *
 * **What is real and what is not.** Every figure is computed from this
 * account's own days except the two panels wearing a Sample chip: the
 * percentile bands, which need other people's accounts, and the growth score's
 * *history*, which is being recorded but has no endpoint to read it back. The
 * score stated beside that line is the real one. See SAMPLE in
 * components/Analytics/data.
 */
import { useCallback, useMemo, useState } from 'react';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import {
  ComparisonPanel,
  CompoundingPanel,
  ConsistencyPanel,
  Controls,
  Header,
  InsightsPanel,
  MilestonePanel,
  SCORE_SCALE,
  ScorePanel,
  SECTIONS,
  StandingPanel,
  StreaksPanel,
  SubjectPanel,
  Tabs,
  Tiles,
  Trajectory,
  useActiveSection,
} from '@/components/Analytics';
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
import type { Ratings } from '@/types';
import '@/styles/analytics.css';

/** How many named subjects get a spoke before Other takes the rest. */
const RADAR_SUBJECTS = 6;

const SECTION_IDS = SECTIONS.map((section) => section.id);

export default function Analytics() {
  useDocumentTitle('Advanced Analytics');

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

  // The report card, for the Growth Score tile alone. Reading it files a dated
  // snapshot per metric (backend/tracking/analytics.py), which is why it is
  // called once on open and not on a timer.
  const ratingsCall = useCallback(
    () =>
      username
        ? growthService.ratings(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your score.' }),
    [username],
  );
  const ratings = useApi<Ratings>(ratingsCall, [username]);

  const [span, setSpan] = useState<WindowKey>('2y');
  const [metric, setMetric] = useState<MetricKey>('xp');
  const [grain, setGrain] = useState<Grain>('daily');
  const [subject, setSubject] = useState('');

  const active = useActiveSection(SECTION_IDS);

  const all = useMemo(() => series.data?.growth_data ?? [], [series.data]);
  const slice = useMemo(() => sliceWindow(all, span), [all, span]);
  const option = windowOption(span);

  const figures = useMemo(() => summaryFigures(slice), [slice]);
  const sparks = useMemo(() => tileSeries(slice), [slice]);
  const insights = useMemo(() => growthInsights(slice), [slice]);
  const rhythm = useMemo(() => consistency(slice), [slice]);
  const curve = useMemo(() => compounding(slice, all), [all, slice]);
  const reached = useMemo(() => milestoneHistory(all), [all]);

  // Always a year, whatever the window says — see the note at the top.
  const heatRows = useMemo(() => heatmapGrid(all, '365'), [all]);

  const score = ratings.data ? ratings.data.overall.score / SCORE_SCALE : null;
  const scoreLine = useMemo(() => scoreHistory(score ?? 0), [score]);

  const tasks = useMemo(() => account.data?.tasks ?? [], [account.data]);
  const fromIso = slice.current[0]?.date ?? '';
  const toIso = slice.current[slice.current.length - 1]?.date ?? '';
  const wasFrom = slice.previous[0]?.date ?? '';
  const wasTo = slice.previous[slice.previous.length - 1]?.date ?? '';

  /** The subject filter narrows the tasks the breakdown counts, nothing else —
   *  XP and focus minutes are recorded per day, not per subject, so the tiles
   *  and the charts above cannot honour it and do not pretend to. */
  const filtered = useMemo(
    () => (subject ? tasks.filter((task) => task.subject === subject) : tasks),
    [subject, tasks],
  );

  const breakdown = useMemo(
    () => subjectXp(filtered, subjects, fromIso, toIso, RADAR_SUBJECTS),
    [filtered, fromIso, subjects, toIso],
  );

  /** The same subjects over the period before, keyed for the per-row change. */
  const previousBySubject = useMemo(() => {
    const map = new Map<string, number>();
    if (!wasFrom) return map;
    subjectXp(filtered, subjects, wasFrom, wasTo, RADAR_SUBJECTS).rows.forEach((row) =>
      map.set(row.key, row.xp),
    );
    return map;
  }, [filtered, subjects, wasFrom, wasTo]);

  const subjectOptions = useMemo(
    () =>
      [...subjects.values()]
        .filter((entry) => entry.used > 0)
        .map((entry) => ({ id: entry.id, label: entry.name })),
    [subjects],
  );

  const bars = useMemo(() => comparisonBars(slice, score), [score, slice]);

  const jump = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const refresh = useCallback(() => {
    series.reload();
    account.reload();
    ratings.reload();
  }, [account, ratings, series]);

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

  return (
    <div className="ax-page">
      <Ambient />
      <div className="ax-shell page-shell">
        <Header span={spanLabel(slice.current)} rows={slice.current} />
        <Tabs active={active} onJump={jump} />
        <Controls
          chosen={span}
          onWindow={setSpan}
          subject={subject}
          onSubject={setSubject}
          subjects={subjectOptions}
          compareLabel={option.compare}
        />

        <section id="overview" className="ax-section">
          <Tiles
            figures={figures}
            sparks={sparks}
            score={score}
            scoreSeries={scoreLine}
            compareLabel={compareLabel}
          />
        </section>

        <section id="trajectory" className="ax-section ax-grid ax-grid-trajectory">
          <Trajectory
            current={slice.current}
            previous={slice.previous}
            metric={metric}
            onMetric={setMetric}
            grain={grain}
            onGrain={setGrain}
            spanLabel={spanLabel(slice.current)}
            previousSpanLabel={spanLabel(slice.previous)}
          />
          <ScorePanel
            score={score}
            series={scoreLine}
            marks={['Start', '', '', 'Now']}
            percentile={SAMPLE.overallPercentile}
          />
        </section>

        <section id="breakdown" className="ax-section ax-grid ax-grid-three">
          <SubjectPanel rows={breakdown.rows} previous={previousBySubject} />
          <ConsistencyPanel
            rate={rhythm.rate}
            previousRate={rhythm.previousRate}
            rows={heatRows}
            compareLabel={compareLabel}
          />
          <MilestonePanel reached={reached} />
        </section>

        <section id="longterm" className="ax-section ax-grid ax-grid-halves">
          <ComparisonPanel bars={bars} />
          <CompoundingPanel data={curve} />
        </section>

        <section id="standing" className="ax-section ax-grid ax-grid-three">
          <StreaksPanel
            current={account.data?.stats?.current_streak ?? 0}
            best={account.data?.stats?.best_streak ?? 0}
            bestMonth={rhythm.bestMonth}
          />
          <InsightsPanel insights={insights} />
          <StandingPanel rows={[...SAMPLE.standing]} />
        </section>

        <section className="ax-foot">
          <p>Long-term growth is the result of consistent daily actions. Keep compounding. 🚀</p>
          <RefreshButton onRefresh={refresh} busy={series.loading} />
        </section>
      </div>
    </div>
  );
}
