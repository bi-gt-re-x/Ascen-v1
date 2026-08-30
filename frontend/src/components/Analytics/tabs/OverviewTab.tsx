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
  Collecting,
  ConsistencyPanel,
  StageNote,
  FinishPanel,
  WhenPanel,
  DepthPicker,
  QualityGridPanel,
  QualityPanel,
  ScorePanel,
  StandingPanel,
  StreaksPanel,
  SubjectPanel,
  Tiles,
  Trajectory,
} from '../index';
import type { Stat } from '../StatRow';
import { number as fmtNumber } from '@/utils/format';
import { partsOfDay } from '@/utils/habits';

/** No earlier period to compare a subject against. Shared, so it is one object. */
const EMPTY_PREVIOUS = new Map<string, number>();
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
    breakdown,
    card,
    compareLabel,
    figures,
    fromIso,
    maturity,
    waitFor,
    streak,
    tasks,
    toIso,
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

  /*
   * Day 0-7, in one path that gains panels rather than two that replace each
   * other.
   *
   * The stages differ by what is added, never by what is rearranged: the
   * heading block, the counts, the subject split and the hand-off are in the
   * same order and the same components at every stage, and `early` puts two
   * more panels between the counts and the split. A reader crossing from one
   * stage to the next sees a page they recognise with something new on it,
   * which is the point — five layouts would be five products.
   *
   * Day 0-3: the tab, minus every panel that would be drawing a slope through
   * two points.
   *
   * What is dropped is exactly the set that needs a *second* period to mean
   * anything — `Tiles` prints a delta against the window before, `Trajectory`
   * is a line, `ScorePanel` needs two readings, the quality panels need rated
   * tasks, and `ConsistencyPanel` compares against a previous rate. What stays
   * is what is already true: the counts, and where the work went.
   *
   * The tab is not replaced. It is the same file, the same sections and the
   * same components underneath — see the note at the top of Collecting for why
   * this is not a second dashboard.
   */
  if (maturity.stage === 'new' || maturity.stage === 'early') {
    const finished = tasks.filter((task) => task.status === 'done').length;
    /* Against every task on the books, not against the ones that went well.
       Expired tasks count in the denominator — a rate that quietly drops the
       ones you missed is not a completion rate. */
    const completion = tasks.length > 0 ? Math.round((finished / tasks.length) * 100) : null;

    const basics: Stat[] = [
      {
        key: 'tasks',
        label: 'Tasks finished',
        value: fmtNumber(figures.tasks.value),
        tone: 'green',
        glyph: 'check',
      },
      {
        key: 'focus',
        label: 'Focus time',
        value: figures.focusHours.value.toFixed(1),
        unit: 'h',
        tone: 'blue',
        glyph: 'clock',
      },
      {
        key: 'xp',
        label: 'XP earned',
        value: fmtNumber(figures.xp.value),
        tone: 'violet',
        glyph: 'sparkle',
      },
      {
        key: 'streak',
        label: 'Current streak',
        value: String(streak),
        unit: streak === 1 ? 'day' : 'days',
        tone: 'amber',
        glyph: 'flame',
      },
      /* Only with tasks to divide by. "0%" over an empty list is not a rate,
         it is a division nobody did. */
      ...(completion === null
        ? []
        : [
            {
              key: 'completion',
              label: 'Completion rate',
              value: `${completion}%`,
              tone: 'pink' as const,
              glyph: 'target' as const,
              note: `${finished} of ${tasks.length} finished`,
            },
          ]),
    ];

    return (
      <>
        <section id="overview" className="ax-section">
          <Collecting
            maturity={maturity}
            stats={basics}
            nextBrings={
              maturity.stage === 'new'
                ? 'your first patterns open here'
                : 'weekly trends and a comparison against last week open here'
            }
          />
        </section>

        {/* Day 4-7. Two tallies and nothing inferred from them — see the note
            at the top of Early for the line these sit on the safe side of.
            They arrive here rather than on Habits because Habits is about what
            repeats, and four days cannot say what repeats. */}
        {maturity.stage === 'early' && (
          <section className="ax-section ax-grid ax-grid-halves-even">
            <WhenPanel parts={partsOfDay(tasks, fromIso, toIso)} days={maturity.activeDays} />
            <FinishPanel tasks={tasks} days={maturity.activeDays} />
          </section>
        )}

        {/* Where the work went. A share of a total is true on day one — it is
            a description of what is on record, not a claim about a trend — so
            this is the one panel from the mature tab that survives intact. */}
        <section className="ax-section">
          {/* No `previous`: there is no earlier period to compare against, and
              an empty map is how this component is told so. */}
          <SubjectPanel rows={breakdown.rows} previous={EMPTY_PREVIOUS} />
        </section>

        <WhereNext />
      </>
    );
  }

  /*
   * Day 7 and up: the real tab.
   *
   * Everything from here is the analytics page as it always was, and the one
   * stage flag below decides only *when* part of it starts rather than what
   * any of it looks like. That is the line this whole feature is built on —
   * five stages of one page, not five pages.
   *
   * Reaching this point already means a week of recorded work, so the panels
   * that are *about the record* — what happened, how often, where it went, and
   * how that compares with the period before — all draw from here. A week is
   * where those stop being noise, and the components already refuse the
   * comparison when the two windows are different lengths; see
   * `summaryFigures`.
   *
   * `judgement` holds back the ones that grade the *person*: the score, its
   * letter, the percentile against everybody else, the quality readings. A
   * fortnight is the floor for those, because being told you are a C-minus on
   * your ninth day is a claim about somebody the app has barely met.
   */
  const judgement = maturity.stage === 'developing' || maturity.stage === 'full';

  return (
    <>
      {maturity.stage !== 'full' && (
        <section className="ax-section">
          <StageNote
            maturity={maturity}
            brings={
              maturity.stage === 'weekly'
                ? 'your Growth Rating and how you compare open here'
                : 'the last of the long-range readings open here'
            }
          />
        </section>
      )}

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

      {/* The line on its own until the score has something to say. `ax-grid-
          trajectory` is 1.85fr to 1fr, so dropping the second child would
          leave the chart in two thirds of the row with a third of it empty —
          the class comes off with the panel. */}
      <section
        id="trajectory"
        className={`ax-section${judgement ? ' ax-grid ax-grid-trajectory' : ''}`}
      >
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
        {judgement && (
        <ScorePanel
          score={score}
          factors={card.factors}
          series={scoreLine}
          marks={scoreMarks}
          // The counted placement, so the badge here and the Growth Score row
          // on "Where You Stand" are one figure rather than two that disagree.
          percentile={standing.data?.rows.find((row) => row.key === 'score')?.percentile ?? null}
        />
        )}
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
      {judgement && (
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
      )}

      {/* Consistency and streaks are counts of this account's own days and
          belong to `trends`. Standing is a placement against everybody else,
          which is the most confident claim on the page — it waits. Three
          columns with the third missing would leave a gap, so the grid narrows
          with it. */}
      <section
        id="standing"
        className={`ax-section ax-grid ${judgement ? 'ax-grid-three' : 'ax-grid-halves-even'}`}
      >
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
        {judgement && <StandingPanel standing={standing.data ?? null} />}
      </section>

      {/* The two tallies stay until Habits can do the stronger version of the
          same question. Tied to that tab's own gate rather than to a stage, so
          there is never a stretch where the page has stopped answering "when
          do you work" and nothing else has started. */}
      {waitFor('habits') > 0 && (
        <section className="ax-section ax-grid ax-grid-halves-even">
          <WhenPanel parts={partsOfDay(tasks, fromIso, toIso)} days={maturity.activeDays} />
          <FinishPanel tasks={tasks} days={maturity.activeDays} />
        </section>
      )}

      <WhereNext />
    </>
  );
}

/**
 * Where the tab hands over.

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
          questions you actually have.
 *
 * A component rather than a block inside the tab, because both arms of the
 * stage branch above end with it and two copies would drift. It is the same
 * three links on day two as on day two hundred: the tabs it points at are
 * where a reader goes with a question, and having little data is not a reason
 * to stop telling them where the questions are answered.
 */
function WhereNext() {
  return (
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
  );
}
