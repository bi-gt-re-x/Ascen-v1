/**
 * Overview — the long view of the account.
 *
 * Productivity, consistency and quality; their trajectory; the score; and where
 * the account stands. The three rates lead every panel here and the totals they
 * came from sit behind them — see `Tiles` for why.
 *
 * This tab used to run four rows longer: a subject radar, a milestone list, a
 * year-on-year chart, the compounding projection and four insights, all before
 * the reader reached the bottom. Every one of them exists in full on a tab
 * built for it, and the Overview was answering "how am I doing" by restating
 * the other tabs at lower resolution. What is left is the shortest honest
 * answer, and three links out to whichever question the reader actually has.
 *
 * The score, its letter and what moved used to open here in a banner of their
 * own. They still open the tab — as `Summary`, in the shared opening slot the
 * page owns, alongside the two things this tab could never say: what to change,
 * and why.
 *
 * It builds its own quality and baseline blocks rather than being handed them.
 * They were props back when this was a function at the bottom of the page and
 * the page held the figures; the model holds them now, so the only thing left
 * to pass is the one callback that opens a screen the page owns.
 */
import { Link } from 'react-router-dom';
import {
  BaselinePanel,
  ConsistencyPanel,
  DepthPicker,
  QualityGridPanel,
  QualityPanel,
  ScorePanel,
  StandingPanel,
  StreaksPanel,
  Tiles,
  Trajectory,
} from '../index';
import type { AnalyticsData } from '../useAnalyticsData';
import type { AnalyticsModel } from '../useAnalyticsModel';

export function OverviewTab({
  model,
  data,
  onEditBaseline,
}: {
  model: AnalyticsModel;
  data: AnalyticsData;
  /** Opens the baseline screen. The flag it sets belongs to the page. */
  onEditBaseline: () => void;
}) {
  const {
    card,
    compareLabel,
    figures,
    grain,
    heatRows,
    sparks,
    metric,
    previousSpanText,
    qualitySummary,
    ratingBands,
    ratingDepth,
    ratingGrid,
    ratingRows,
    rhythm,
    rhythmRate,
    score,
    scoreLine,
    scoreMarks,
    setDepth,
    setGrain,
    setMetric,
    slice,
    spanText,
  } = model;
  const { account, baseline, standing } = data;
  const aim = baseline.data?.baseline ?? null;

  return (
    <>
      {/* The score, its letter and what moved used to open here, in a banner
          of their own. They open the tab still — but as `Summary`, in the
          shared opening slot a few lines up in this file, alongside the two
          things this tab could never say: what to change, and why. */}
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
          spanLabel={spanText}
          previousSpanLabel={previousSpanText}
        />
        <ScorePanel
          score={score}
          factors={card.factors}
          series={scoreLine}
          marks={scoreMarks}
          // The counted placement, so the badge here and the Growth Score row
          // on "Where You Stand" are one figure rather than two that disagree.
          percentile={standing.data?.rows.find((row) => row.key === 'score')?.percentile ?? null}
        />
      </section>

      {/* The reader's own target, before the panels that measure against
          nothing. A total is not good or bad on its own — four days a week is
          excellent against a three-day aim and a miss against a six-day one —
          so the thing that makes the rest of this tab legible goes above it. */}
      <section className="ax-section">
        {aim ? (
          <BaselinePanel
            aim={aim}
            setOn={aim.set_on}
            activeRate={rhythm.activeRate}
            typicalSession={rhythm.typicalSession}
            span={spanText}
            onEdit={onEditBaseline}
          />
        ) : (
          /* No baseline and enough record that the setup screen did not take
             the page — the offer belongs beside the totals it would give a
             meaning to, not in front of them. */
          <section className="ax-baseline-offer">
            <strong>No target behind these numbers.</strong>
            <button type="button" className="ax-btn ax-btn-primary" onClick={onEditBaseline}>
              Set a baseline
            </button>
          </section>
        )}
      </section>

      {/* Quality, in full, directly under the tile that states it in one
          number. It sits here rather than on a tab of its own because it is one
          of the three measures this tab now leads with, and because it is the
          only one whose figure the app did not measure — the reader did. Two
          panels: what they said, and where the tasks they said it about
          actually landed. Both are self-effacing when nothing has been rated;
          see components/Analytics/Quality. */}
      <section className="ax-section ax-grid ax-grid-halves-even">
        <QualityPanel
          summary={qualitySummary}
          findings={ratingRows}
          bands={ratingBands}
          span={spanText}
          depth={ratingDepth}
          aside={<DepthPicker value={ratingDepth} onPick={setDepth} />}
        />
        <QualityGridPanel cells={ratingGrid} summary={qualitySummary} depth={ratingDepth} />
      </section>

      <section id="standing" className="ax-section ax-grid ax-grid-three">
        <ConsistencyPanel
          rate={rhythmRate.rate}
          previousRate={rhythmRate.previousRate}
          rows={heatRows}
          compareLabel={compareLabel}
        />
        <StreaksPanel
          current={account.data?.stats?.current_streak ?? 0}
          best={account.data?.stats?.best_streak ?? 0}
          bestMonth={rhythmRate.bestMonth}
        />
        <StandingPanel standing={standing.data ?? null} />
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
          <Link to="/analytics/goals">
            <strong>Goals</strong>
            <span>Whether what you aimed at is going to happen</span>
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
