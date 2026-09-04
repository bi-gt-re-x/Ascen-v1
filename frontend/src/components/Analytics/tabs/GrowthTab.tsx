/**
 * Growth — how the account has actually changed, a year at a time.
 *
 * This tab replaced Records, and the question changed with it. Records asked
 * where the last thirty days *stand*: a percentile against every other thirty,
 * a ladder of round numbers, a pace on each goal. Two of those three are
 * answered better elsewhere — the goal pacing is the Goals tab's whole job, and
 * the round numbers are what the /records page is for — so what came across is
 * the percentile, which is the one figure there that was already a statement
 * about the account over time rather than about this month.
 *
 * ## Totals are not improvement
 *
 * The trap this page is built to avoid. An account that did exactly the same
 * work at exactly the same standard every week for five years has a rising XP
 * line, a rising task count and a rising hours-logged figure, and has improved
 * at nothing: those all grow because time passes. So the figures that carry the
 * claim here are the two the reader supplies themselves — how hard the work was
 * and how well it went — and the totals sit beside them as context.
 *
 * The headline is `growthArc`, and the reason it names difficulty and execution
 * in the same breath is that either alone is misleading. Execution rising on
 * its own is what happens both when somebody gets better and when they start
 * picking easier things, and a page that showed the rise without the other half
 * would be flattering the reader with a number they could have got by lowering
 * their standards. See utils/growthYears, which will say so out loud when that
 * is what the record shows.
 *
 * ## Partial years are marked rather than dropped
 *
 * The first year begins when the account did and the last one is still running,
 * so both are short. The table prints their totals with the rest — they are
 * real — and every comparison the page makes is per active day, because a year
 * with four months in it has a smaller total than the year before it and that
 * is not a decline.
 */
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { AreaChart, Panel, PanelNote } from '../charts';
import { StatRow, type Stat } from '../StatRow';
import { Locked } from '../Locked';
import { growthArc, growthYears } from '@/utils/growthYears';
import { benchHero } from '@/utils/growthBench';
import { longDate } from '@/utils/growthChapters';
import { number as fmtNumber } from '@/utils/format';
import type { AnalyticsModel } from '../useAnalyticsModel';
import type { GrowthYear } from '@/utils/growthYears';

/**
 * Calendar years the account has been present for before the tab will draw.
 *
 * Two, and it is a count of years rather than of days on purpose: a page whose
 * every row is a year cannot say anything with one row, and no number of days
 * inside a single calendar year produces a second one. An account that joined
 * in November is three months from a comparison and one that joined in January
 * is fourteen, which is the honest shape of the thing rather than a fault in
 * the gate.
 */
const NEED_YEARS = 2;

/**
 * The standing panel's one-line claim.
 *
 * A percentile of 100 is not a sentence anybody says. It means the last thirty
 * days are the best thirty the account has had, and "ranks above 100% of your
 * 1,819 stretches" is a roundabout and slightly wrong way of putting that —
 * the current window is one of the 1,819 and does not rank above itself.
 */
function standingClaim(hero: { percentile: number | null; windows: number }): string | undefined {
  if (hero.percentile === null) return undefined;
  if (hero.percentile >= 100) {
    return 'The last 30 days are the best 30 you have had.';
  }
  return `Your last 30 days rank above ${hero.percentile}% of the ${fmtNumber(hero.windows)} `
    + '30-day stretches on your record.';
}

/** A dash, not a zero: nothing recorded is not a reading of nothing. */
const orDash = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '—' : String(value);

export function GrowthTab({ model }: { model: AnalyticsModel }) {
  const { all, tasks } = model;

  const years = useMemo(() => growthYears(all, tasks), [all, tasks]);
  const arc = useMemo(() => growthArc(years), [years]);
  const hero = useMemo(() => benchHero(all), [all]);

  /* Years with something on them. A year the account existed through and did
     nothing in is kept in the table — a gap in the middle is a fact — but it
     cannot be one of the two the gate is counting. */
  const worked = years.filter((year) => year.activeDays > 0);

  if (worked.length < NEED_YEARS) {
    return (
      <Locked
        title="Growth"
        remaining={NEED_YEARS - worked.length}
        need={NEED_YEARS}
        have={worked.length}
        promise="A year-on-year reading needs two years to hold against each other."
        brings={[
          'Every year, side by side',
          'Whether the work got harder',
          'Whether you got better at it',
          'Where this month sits in all of it',
        ]}
        action={
          <Link to="/analytics" className="ax-btn">
            See totals
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* The reading, before the picture of it and the table it was read off.
          A reader who takes one thing from this tab should take this one. */}
      {arc.sentence && <p className="ax-gy-lead">{arc.sentence}</p>}

      {/* The claim, drawn. Two lines is the whole argument: one climbs and one
          does not, and that is visible before a single figure is read. */}
      <section className="ax-section">
        <RatingLines years={worked} />
      </section>

      <section className="ax-section">
        <ThenAndNow years={worked} />
      </section>

      <section className="ax-section">
        <YearTable years={years} />
      </section>

      <section className="ax-section">
        <Panel
          title="Where this month sits in all of it"
          note="The last 30 days against every other 30 you have had"
          claim={standingClaim(hero)}
        >
          {hero.percentile === null ? (
            <p className="ax-empty">
              A ranking needs more than one 30-day stretch to rank against. This fills in on its
              own.
            </p>
          ) : (
            <ul className="ax-gy-notes">
              <li>
                <span>These 30 days</span>
                <strong>{fmtNumber(hero.currentXp)} XP</strong>
              </li>
              <li>
                <span>Your best 30</span>
                <strong>
                  {fmtNumber(hero.bestXp)} XP
                  {hero.bestEndedOn ? <em> to {longDate(hero.bestEndedOn)}</em> : null}
                </strong>
              </li>
              {hero.fromBaseline !== null && (
                <li>
                  <span>Against your first 30</span>
                  {/* As a multiple past a couple of doublings. "+1228%" is a
                      figure a reader has to do arithmetic on before it means
                      anything, and the arithmetic is "about thirteen times". */}
                  <strong>
                    {hero.fromBaseline >= 200
                      ? `${((hero.fromBaseline + 100) / 100).toFixed(1)}× as much`
                      : `${hero.fromBaseline >= 0 ? '+' : ''}${hero.fromBaseline}%`}
                  </strong>
                </li>
              )}
            </ul>
          )}
        </Panel>
      </section>
    </>
  );
}

/**
 * Execution and difficulty across the years, on one five-point axis.
 *
 * The page's argument as a picture. Execution is the headline line and
 * difficulty the muted one, and what the reader is meant to take from it is the
 * *shape* of each — one rising, one level — because that pair is what separates
 * getting better from picking easier work.
 *
 * **What the two lines are not.** They are not a race. Both rows are scored out
 * of five, which is what lets them share an axis, but they answer different
 * questions — how hard was it, how well did it go — so the point at which one
 * crosses the other means nothing at all. Only the slopes are comparable, and
 * the note under the chart says so rather than leaving a reader to work out
 * which readings are real.
 *
 * The axis is pinned to five rather than to the tallest reading. Left to scale
 * itself the chart would run 0 to 3.7 on this account, and a five-point scale
 * drawn as a 3.7-point one exaggerates every wobble in the flat line — which is
 * the one line whose flatness is the point.
 */
const RATING_SCALE = 5;

function RatingLines({ years }: { years: GrowthYear[] }) {
  const rated = years.filter((year) => year.execution !== null && year.difficulty !== null);

  // Two points is a line; one is a dot with a caption. Below that the panel
  // says so, because an empty chart box reads as a chart that failed.
  if (rated.length < 2) {
    return (
      <Panel title="Execution against difficulty" note="Both out of five, as you rated them">
        <p className="ax-empty">
          Two years with ratings on them draws this. Rating a task after finishing it is what
          fills it in.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Execution against difficulty" note="Both out of five, as you rated them">
      <AreaChart
        id="ax-gy-ratings"
        /* Shorter than the trajectory panel's 200. Ratings live in a narrow
           band near the top of a five-point axis — nothing on this account
           goes below 2.8 — so most of a tall box would be empty, and the
           honest fix for that is less box rather than a cropped axis. */
        height={155}
        max={RATING_SCALE}
        ticks={['5', '4', '3', '2', '1', '0']}
        marks={rated.map((year) => year.label)}
        series={[
          { values: rated.map((year) => year.execution), tone: 'green' },
          {
            values: rated.map((year) => year.difficulty),
            tone: 'violet',
            muted: true,
            // Unfilled: two washes on one box leave a middle band belonging to
            // neither, and this line is a reference for the other rather than a
            // quantity in its own right.
            fill: false,
          },
        ]}
      />
      <PanelNote label="Reading this">
        The filled line is execution — how well the work went. The lighter one is difficulty —
        how hard it was. Both are your own ratings out of five, so they share an axis, but they
        answer different questions: which line sits higher means nothing, and only the shape of
        each is worth reading.
      </PanelNote>
    </Panel>
  );
}

/**
 * The first worked year against the latest, as four tiles.
 *
 * Rates rather than totals for the two volume figures, for the reason the file
 * header gives: both ends of this comparison are usually partial years, and
 * their totals are not comparable while their per-active-day figures are.
 *
 * `delta` is left off every tile. The row's deltas are percentages against a
 * previous period, and these are a first-to-latest comparison across several
 * years — the same word for a different thing. The note under each figure
 * carries the comparison in the units it is actually in.
 */
function ThenAndNow({ years }: { years: GrowthYear[] }) {
  const first = years[0]!;
  const last = years[years.length - 1]!;

  /* Each tile's own years under it. The tile states where the figure ended and
     the note says where it began, and neither can tell a climb from a jump in
     the last year — which on a tab about improvement is the difference that
     matters most. Ratings skip the years nobody answered for rather than
     plotting them as nothing. */
  const rated = years.filter((year) => year.execution !== null && year.difficulty !== null);

  const shift = (from: number | null, to: number | null, digits = 1) =>
    from === null || to === null
      ? 'not rated then'
      : `${from.toFixed(digits)} in ${first.label}`;

  const stats: Stat[] = [
    {
      key: 'execution',
      series: rated.map((year) => year.execution!),
      label: 'Execution',
      value: last.execution === null ? '—' : last.execution.toFixed(1),
      unit: last.execution === null ? undefined : '/ 5',
      note: shift(first.execution, last.execution),
      tone: 'green',
      glyph: 'sparkle',
      hint: 'How well the work went, as you rated it after finishing. Averaged over the tasks '
        + 'carrying both a difficulty and an execution.',
    },
    {
      key: 'difficulty',
      series: rated.map((year) => year.difficulty!),
      label: 'Difficulty',
      value: last.difficulty === null ? '—' : last.difficulty.toFixed(1),
      unit: last.difficulty === null ? undefined : '/ 5',
      note: shift(first.difficulty, last.difficulty),
      tone: 'violet',
      glyph: 'target',
      hint: 'How hard the work was, as you rated it. The figure that says whether a rising '
        + 'execution score is improvement or easier work.',
    },
    {
      key: 'pace',
      series: years.map((year) => year.tasksPerActiveDay),
      label: 'Tasks a working day',
      value: last.tasksPerActiveDay.toFixed(1),
      note: `${first.tasksPerActiveDay.toFixed(1)} in ${first.label}`,
      tone: 'blue',
      glyph: 'check',
      hint: 'Per day you actually worked, not per day on the calendar — so a part-year is '
        + 'comparable with a whole one.',
    },
    {
      key: 'hours',
      series: years.map((year) => year.focusHours),
      label: 'Hours logged',
      value: fmtNumber(Math.round(last.focusHours)),
      unit: last.partial ? 'so far' : undefined,
      note: `${fmtNumber(Math.round(first.focusHours))} in ${first.label}`,
      tone: 'amber',
      glyph: 'clock',
    },
  ];

  return <StatRow stats={stats} />;
}

/**
 * Every year the account has been present for, oldest first.
 *
 * A table rather than a chart, and deliberately. Six rows of eight figures is
 * not a shape — it is a set of readings a person wants to compare across two
 * axes at once, which is the one job a table does better than any picture, and
 * the page already states its argument in a sentence above. A stack of six bar
 * charts would take four times the room to say less.
 */
function YearTable({ years }: { years: GrowthYear[] }) {
  return (
    /* No XP column. It is tasks multiplied by their average value, and on a
       page about improvement it moves for the same reason the task count does
       — so it was a second copy of a column already there, in bigger numbers.
       The XP that is worth stating is the 30-day comparison below, which is
       about standing rather than about volume. */
    <Panel
      title="Year by year"
      note="Volume from your XP ledger; the two ratings from the tasks that carry both"
    >
      <div className="ax-gy-scroll">
        <table className="ax-gy">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Days worked</th>
              <th scope="col">Tasks</th>
              <th scope="col">A working day</th>
              <th scope="col">Hours</th>
              <th scope="col">Rated</th>
              <th scope="col">Difficulty</th>
              <th scope="col">Execution</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year.year} className={year.activeDays === 0 ? 'is-quiet' : undefined}>
                <th scope="row">
                  {year.label}
                  {/* Marked, not hidden. Its totals are real and lower than a
                      full year's, and the reader has to know which is which. */}
                  {year.partial && <span className="ax-gy-part">part year</span>}
                </th>
                <td>{fmtNumber(year.activeDays)}</td>
                <td>{fmtNumber(year.tasks)}</td>
                <td>{year.tasksPerActiveDay.toFixed(1)}</td>
                <td>{fmtNumber(Math.round(year.focusHours))}</td>
                {/* The evidence base for the two columns after it, set back
                    because it qualifies them rather than being a reading of
                    its own. */}
                <td className="is-aside">{fmtNumber(year.rated)}</td>
                <td>{orDash(year.difficulty?.toFixed(1))}</td>
                <td className="is-lead">{orDash(year.execution?.toFixed(1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
