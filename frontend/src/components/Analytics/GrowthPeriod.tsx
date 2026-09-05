/**
 * The Growth tab's furniture: the period row, the verdict, and the readings.
 *
 * ## The question this tab asks
 *
 * The dashboard answers "how am I doing"; this answers "how have I changed".
 * That distinction is the whole reason the tab is built around *two* windows
 * rather than one — every figure here is a period set against the equivalent
 * period before it, and a panel that could only state the current value has no
 * business on it.
 *
 * The arithmetic is all server-side and arrives whole: see the endpoint in
 * backend/api/analytics.py, and ./useGrowthPeriods for why this one tab makes a
 * request when the other six do not. Nothing in this file computes a score. It
 * computes differences between scores it was given, formats figures into the
 * units they were measured in, and decides which of them is worth saying
 * loudest.
 *
 * ## Growth is a movement in the score, not in the raw quantity
 *
 * Worth being explicit about, because the two come apart. "Focus +163%" here
 * means the *focus score* went from 30 to 79, not that the reader logged 163%
 * more hours — the score is hours against the goal they set, so it also moves
 * when the goal does. Every percentage on this tab is a movement in a 0-100
 * graded measure, and `MetricRow` prints the measured quantity underneath in
 * its own units so the two can be read against each other.
 */
import type { ReactNode } from 'react';
import { Panel, type Tone } from './charts';
import { GLYPHS, type GlyphName } from './glyphs';
import { gradeFor } from '@/utils/analyticalScore';
import { number as fmtNumber } from '@/utils/format';
import type {
  GrowthPeriods,
  PeriodCard,
  PeriodKey,
  PeriodMetric,
  PeriodSide,
} from '@/services/analytics';

// --------------------------------------------------------------------------
// The five, as the tab presents them
// --------------------------------------------------------------------------
/**
 * What each metric is called, coloured and drawn as, and what it measures.
 *
 * `asks` is the one-line gloss under the label. It exists because the metric
 * names are ordinary English words used in a specific way — "efficiency" here
 * is deadlines met and nothing else, and a reader who assumes it means speed
 * will read the number backwards. The backend's own comment makes the same
 * point about the same metric; this is that comment on the screen.
 */
export const METRIC_META: Record<
  PeriodMetric,
  { label: string; tone: Tone; glyph: GlyphName; asks: string }
> = {
  productivity: {
    label: 'Productivity',
    tone: 'violet',
    glyph: 'sparkle',
    asks: 'XP a working day, against your daily goal',
  },
  quality: {
    label: 'Quality',
    tone: 'green',
    glyph: 'target',
    asks: 'how hard the work was, times how well it went',
  },
  consistency: {
    label: 'Consistency',
    tone: 'blue',
    glyph: 'check',
    asks: 'the share of days you showed up at all',
  },
  efficiency: {
    label: 'Efficiency',
    tone: 'amber',
    glyph: 'clock',
    asks: 'the share of tasks finished by their deadline',
  },
  focus: {
    label: 'Focus',
    tone: 'pink',
    glyph: 'sparkle',
    asks: 'tracked focus time against your focus goal',
  },
};

export const METRIC_ORDER: PeriodMetric[] = [
  'productivity',
  'quality',
  'consistency',
  'efficiency',
  'focus',
];

/**
 * How much of a move counts as a move, in points of the 0-100 scale.
 *
 * Three. Below that the tab reports "held" rather than a direction, and the
 * reason is the same one the year-on-year ratings use `MOVE` for: these are
 * scores over a window of days, and a window sliding by one day changes them a
 * little for reasons that have nothing to do with the reader. A tab that
 * announced "+1%" as an improvement would be announcing the calendar.
 */
export const HELD = 3;

/** A signed percentage, or a dash where there was nothing to move from. */
export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}%`;
}

/**
 * The movement as the tab states it: a percentage where one exists, and the
 * points moved where one does not.
 *
 * There is no percentage of nothing. A score that went 0 → 44 has grown by an
 * undefined share of zero, and the backend returns null rather than the +100%
 * its older week-over-week helper would have invented. That null is correct and
 * it must not reach the reader as a dash in 52px type: "0 → 44" is one of the
 * most dramatic things this tab can be looking at, and a dash is the one
 * reading of it that says nothing.
 *
 * So the fallback is the same movement in the units the scores are already in.
 * A dash survives only where there is genuinely no comparison to make — a
 * period with nothing before it, which is a different statement and one the
 * block beside it spells out.
 */
export function growthLabel(
  change: number | null | undefined,
  from: number | null | undefined,
  to: number,
): string {
  if (change !== null && change !== undefined) return pct(change);
  if (from === null || from === undefined) return '—';
  const moved = Math.round(to - from);
  return `${moved > 0 ? '+' : moved < 0 ? '−' : ''}${Math.abs(moved)} pts`;
}

/** Which way a movement runs, once it is big enough to be one. */
export function direction(from: number, to: number): 'up' | 'down' | 'held' {
  if (to - from >= HELD) return 'up';
  if (from - to >= HELD) return 'down';
  return 'held';
}

/**
 * The measured quantity behind a score, in the units it was measured in.
 *
 * The reason every row prints one. A score of 79 is a position on a scale the
 * reader did not design and cannot check; "14.2 hrs of a 18 hr goal" is the
 * thing that actually happened, and it is what tells them whether the score
 * moved because they worked more or because the goal moved.
 */
export function measuredAs(metric: PeriodMetric, side: PeriodSide | null): string {
  if (!side) return '—';
  const figures = (side.figures?.[metric] ?? {}) as Record<string, number | string | boolean>;
  switch (metric) {
    case 'productivity':
      return `${fmtNumber(Number(figures.avg_daily_xp) || 0)} XP a working day`;
    case 'quality':
      // The basis is printed, never assumed — an account that has rated
      // nothing is graded on an XP proxy and has to be told so.
      return figures.basis === 'ratings'
        ? `${Number(figures.avg_quality).toFixed(1)} of ${figures.max_quality}, `
          + `over ${fmtNumber(Number(figures.rated_tasks) || 0)} rated`
        : 'no ratings yet — scored on task XP';
    case 'consistency':
      return `${fmtNumber(Number(figures.active_days) || 0)} of `
        + `${fmtNumber(Number(figures.total_days) || 0)} days worked`;
    case 'efficiency':
      return figures.has_timing || Number(figures.on_time_pct) > 0
        ? `${Math.round(Number(figures.on_time_pct) || 0)}% finished on time`
        : 'no tasks with deadlines yet';
    case 'focus':
      return `${(Number(figures.focused_minutes) / 60 || 0).toFixed(1)} hrs of a `
        + `${(Number(figures.goal_minutes) / 60 || 0).toFixed(1)} hr goal`;
    default:
      return '—';
  }
}

// --------------------------------------------------------------------------
// The period row — the tab's one control, and its summary at the same time
// --------------------------------------------------------------------------
/**
 * Six periods, each showing what it grew by, and pressing one opens it.
 *
 * The control and the overview are the same object on purpose. The tab needs a
 * period selector and it needs a row of "this week / this month / all time"
 * cards, and building both would have put two rows of the same six words at the
 * top of the page — one of them answering a question the other had already
 * asked. A card that states its own growth *is* the reason to press it.
 *
 * A period with no equivalent stretch before it prints a dash rather than a
 * number. "Since you started" always does, by definition: there is nothing
 * before the beginning to have grown from.
 */
export function PeriodRow({
  cards,
  active,
  onPick,
  busy,
}: {
  cards: PeriodCard[];
  active: PeriodKey;
  onPick: (key: PeriodKey) => void;
  busy: boolean;
}) {
  return (
    <nav className="ax-gp-row" aria-label="Growth period">
      {cards.map((card) => {
        const way = card.previous === null ? 'held' : direction(card.previous, card.overall);
        return (
          <button
            key={card.key}
            type="button"
            className={`ax-gp-card${card.key === active ? ' is-on' : ''} is-${way}`}
            aria-pressed={card.key === active}
            onClick={() => onPick(card.key)}
            disabled={busy}
          >
            <span className="ax-gp-card-label">{card.label}</span>
            <strong className="ax-gp-card-value">
              {growthLabel(card.change, card.previous, card.overall)}
            </strong>
            <span className="ax-gp-card-note">
              {card.previous === null
                ? 'nothing before it'
                : `${card.previous} → ${card.overall}`}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// --------------------------------------------------------------------------
// The verdict
// --------------------------------------------------------------------------
/**
 * Overall growth, in the biggest type on the page, with the grades either side.
 *
 * One figure and two letters. The figure is the movement in the mean of the
 * five; the letters are what that mean was graded before and after, which is
 * the part a reader repeats to somebody else. Everything below this block
 * exists to say where the figure came from.
 */
export function OverallVerdict({ data }: { data: GrowthPeriods }) {
  const now = data.current;
  const then = data.previous;
  const way = then === null ? 'held' : direction(then.overall, now.overall);
  const tone = way === 'up' ? 'green' : way === 'down' ? 'amber' : 'blue';

  return (
    <section className={`ax-gp-verdict ax-tone-${tone}`}>
      <p className="ax-gp-eyebrow">Overall growth · {data.label.toLowerCase()}</p>

      <div className="ax-gp-verdict-main">
        <strong className="ax-gp-big">
          {growthLabel(data.change.overall, then?.overall ?? null, now.overall)}
        </strong>
        <div className="ax-gp-grades">
          {then ? (
            <p className="ax-gp-grade-move">
              <span className="ax-gp-grade is-was">{then.grade}</span>
              <span className="ax-gp-arrow" aria-hidden="true">→</span>
              <span className="ax-gp-grade is-now">{now.grade}</span>
            </p>
          ) : (
            <p className="ax-gp-grade-move">
              <span className="ax-gp-grade is-now">{now.grade}</span>
            </p>
          )}
          <p className="ax-gp-grade-note">
            {then
              ? `${now.overall} out of 100 now, against ${then.overall} over the `
                + `${data.days} days before this one.`
              : `${now.overall} out of 100. This period reaches back to the day you `
                + 'started, so there is nothing before it to compare against.'}
          </p>
        </div>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// The two movers
// --------------------------------------------------------------------------
export interface Mover {
  metric: PeriodMetric;
  from: number;
  to: number;
  change: number | null;
}

/**
 * The metric that moved furthest each way, or null when nothing did.
 *
 * Ranked on the *points* moved rather than on the percentage, and that is the
 * one piece of judgement in this file worth arguing about. A percentage change
 * is a share of where the metric started, so a score going 4 → 12 is "+200%"
 * and one going 62 → 84 is "+35%" — and the first is a rounding error on a
 * measure that was barely registering while the second is the reader's month.
 * Ranking on percentages puts the noise at the top of the page every time.
 *
 * The percentage is still printed. It is a fair thing to state about a metric
 * once that metric has been chosen for a reason that is not itself.
 */
export function movers(data: GrowthPeriods): { best: Mover | null; worst: Mover | null } {
  if (!data.previous) return { best: null, worst: null };
  const then = data.previous;

  const moves: Mover[] = METRIC_ORDER.map((metric) => ({
    metric,
    from: then.parts[metric],
    to: data.current.parts[metric],
    change: data.change[metric],
  }));

  const risen = moves.filter((move) => move.to - move.from >= HELD);
  const fallen = moves.filter((move) => move.from - move.to >= HELD);

  const by = (a: Mover, b: Mover) => (b.to - b.from) - (a.to - a.from);
  return {
    best: risen.length ? [...risen].sort(by)[0]! : null,
    worst: fallen.length ? [...fallen].sort(by).reverse()[0]! : null,
  };
}

/** One of the two mover panels. `kind` decides only the wording and the tone. */
export function MoverPanel({
  kind,
  mover,
  now,
  then,
}: {
  kind: 'best' | 'worst';
  mover: Mover | null;
  now: PeriodSide;
  then: PeriodSide | null;
}) {
  const heading = kind === 'best' ? 'Biggest improvement' : 'Needs attention';

  if (!mover) {
    return (
      <Panel
        title={heading}
        note={kind === 'best' ? 'Where you gained the most ground' : 'Where you lost ground'}
      >
        <p className="ax-empty">
          {kind === 'best'
            ? 'Nothing moved up by more than a few points this period. That is a steady '
              + 'stretch rather than a flat one.'
            : 'Nothing fell by more than a few points this period.'}
        </p>
      </Panel>
    );
  }

  const meta = METRIC_META[mover.metric];

  return (
    <Panel
      title={heading}
      note={kind === 'best' ? 'Where you gained the most ground' : 'Where you lost ground'}
    >
      <div className={`ax-gp-mover ax-tone-${kind === 'best' ? 'green' : 'amber'}`}>
        <span
          className={`ax-gp-mover-icon ax-tone-${meta.tone}`}
          style={{ '--ico': GLYPHS[meta.glyph] } as Record<string, string>}
          aria-hidden="true"
        />
        <div>
          <p className="ax-gp-mover-name">{meta.label}</p>
          <p className="ax-gp-mover-move">
            <span className="ax-gp-was">{mover.from}</span>
            <span className="ax-gp-arrow" aria-hidden="true">→</span>
            <strong>{mover.to}</strong>
            <em>{pct(mover.change)}</em>
          </p>
        </div>
      </div>

      {/* What the metric actually measures, and what that quantity did. The
          panel is naming a winner, and a winner nobody can check is a boast. */}
      <p className="ax-gp-mover-asks">{meta.asks}</p>
      <ul className="ax-gp-why">
        <li>
          <span>Before</span>
          <strong>{measuredAs(mover.metric, then)}</strong>
        </li>
        <li>
          <span>After</span>
          <strong>{measuredAs(mover.metric, now)}</strong>
        </li>
      </ul>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Then and now
// --------------------------------------------------------------------------
/** Every metric, before and after, with what it was measured from. */
export function ThenNow({ data }: { data: GrowthPeriods }) {
  const then = data.previous;

  return (
    <ul className="ax-gp-rows">
      {METRIC_ORDER.map((metric) => {
        const to = data.current.parts[metric];
        const from = then ? then.parts[metric] : null;
        const way = from === null ? 'held' : direction(from, to);
        const meta = METRIC_META[metric];

        return (
          <li key={metric} className={`ax-gp-metric is-${way}`}>
            <div className="ax-gp-metric-head">
              <span className={`ax-gp-dot ax-tone-${meta.tone}`} aria-hidden="true" />
              <span className="ax-gp-metric-name">{meta.label}</span>
              <span className="ax-gp-metric-asks">{meta.asks}</span>
            </div>

            <p className="ax-gp-metric-scores">
              {from !== null && (
                <>
                  <span className="ax-gp-was">{from}</span>
                  <span className="ax-gp-arrow" aria-hidden="true">→</span>
                </>
              )}
              <strong>{to}</strong>
              {/* The letter, beside the number it is a band of rather than
                  instead of it. A grade alone hides a metric that climbed
                  eight points inside one band, which is most of what a month
                  looks like; a number alone hides that 79 and 80 are a
                  boundary. Both, and the reader can see which happened. */}
              <span className="ax-gp-letter">
                {then && then.grades[metric] !== data.current.grades[metric] && (
                  <>
                    <span className="ax-gp-was">{then.grades[metric]}</span>
                    <span className="ax-gp-arrow" aria-hidden="true">→</span>
                  </>
                )}
                {data.current.grades[metric]}
              </span>
              <em className={`ax-gp-change is-${way}`}>
                {growthLabel(data.change[metric], from, to)}
              </em>
            </p>

            {/* The bar is the score, not the change: it is there so five rows
                can be compared down the page at a glance, which a column of
                percentages cannot be. */}
            <span className="ax-gp-bar" aria-hidden="true">
              {from !== null && (
                <span className="ax-gp-bar-was" style={{ width: `${from}%` }} />
              )}
              <span
                className={`ax-gp-bar-now ax-tone-${meta.tone}`}
                style={{ width: `${to}%` }}
              />
            </span>

            <p className="ax-gp-metric-raw">
              {then ? (
                <>
                  {measuredAs(metric, then)} <span aria-hidden="true">→</span>{' '}
                  <strong>{measuredAs(metric, data.current)}</strong>
                </>
              ) : (
                measuredAs(metric, data.current)
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// --------------------------------------------------------------------------
// Milestones
// --------------------------------------------------------------------------
export interface Milestone {
  date: string;
  kind: 'grade' | 'best';
  headline: string;
  detail: string;
}

/**
 * The moments in the period worth naming, found rather than stored.
 *
 * Two kinds, and both are read off the line the tab already draws: the days the
 * overall score crossed into a new letter, and the day it reached its highest
 * point of the period. Nothing is written to the database for this — the same
 * rule the goals table follows, and the one the adopted-advice endpoint states
 * at length: a milestone recomputed from the record can never drift out of step
 * with it, and one written down once can.
 *
 * Only *upward* crossings are kept. A letter lost is a real event and the tab
 * says so elsewhere — it is the whole of "needs attention" — but a chronological
 * feed of them under the heading "your journey" would be a different and much
 * worse page.
 */
export function milestones(data: GrowthPeriods, limit = 6): Milestone[] {
  const found: Milestone[] = [];
  const points = data.series;
  if (points.length < 2) return found;

  let peak = points[0]!.overall;
  let letter = gradeFor(points[0]!.overall);

  points.slice(1).forEach((point) => {
    const nextLetter = gradeFor(point.overall);
    if (nextLetter !== letter) {
      // Compared on the score rather than on the letter, because the letters
      // are not orderable as strings: 'S' sorts after 'A', 'A+' after 'A'.
      const rose = point.overall > peak;
      if (rose) {
        found.push({
          date: point.date,
          kind: 'grade',
          headline: `Reached ${nextLetter}`,
          detail: `Your overall score crossed into ${nextLetter} at ${point.overall} out of 100.`,
        });
      }
      letter = nextLetter;
    }
    if (point.overall > peak) {
      peak = point.overall;
    }
  });

  const best = points.reduce((top, point) => (point.overall > top.overall ? point : top));
  if (!found.some((entry) => entry.date === best.date)) {
    found.push({
      date: best.date,
      kind: 'best',
      headline: 'Best of the period',
      detail: `Your overall score peaked at ${best.overall} out of 100.`,
    });
  }

  return found
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

/** The feed, newest first. */
export function MilestoneFeed({ entries, format }: {
  entries: Milestone[];
  format: (iso: string) => string;
}) {
  if (entries.length === 0) {
    return (
      <p className="ax-empty">
        Nothing crossed a grade boundary in this period. A longer one usually has something
        in it.
      </p>
    );
  }
  return (
    <ol className="ax-gp-feed">
      {entries.map((entry) => (
        <li key={`${entry.date}-${entry.kind}`} className={`is-${entry.kind}`}>
          <span className="ax-gp-feed-mark" aria-hidden="true" />
          <div>
            <p className="ax-gp-feed-head">
              <strong>{entry.headline}</strong>
              <time dateTime={entry.date}>{format(entry.date)}</time>
            </p>
            <p className="ax-gp-feed-detail">{entry.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// --------------------------------------------------------------------------
// What changed
// --------------------------------------------------------------------------
/**
 * The period in sentences, assembled from the figures rather than written.
 *
 * The same rule `growthArc` follows in utils/growthYears and `currentState`
 * follows in utils/insight: every claim on this page is built out of the
 * numbers beside it, so it cannot drift from them. There is no wording here
 * that would still render if the figures said the opposite.
 *
 * Each line names a *quantity*, not a score. "Productivity rose" is the score
 * moving and the reader already has it in three other places; "you earned 340
 * XP a working day against 210" is the thing that moved it.
 */
export function whatChanged(data: GrowthPeriods): ReactNode[] {
  const then = data.previous;
  if (!then) return [];
  const lines: ReactNode[] = [];

  const num = (side: PeriodSide, metric: PeriodMetric, field: string) =>
    Number((side.figures?.[metric] as Record<string, unknown>)?.[field]) || 0;

  const xpNow = num(data.current, 'productivity', 'avg_daily_xp');
  const xpThen = num(then, 'productivity', 'avg_daily_xp');
  if (Math.abs(xpNow - xpThen) >= 1) {
    lines.push(
      <>
        You earned <strong>{fmtNumber(Math.round(xpNow))} XP a working day</strong>, against{' '}
        {fmtNumber(Math.round(xpThen))} over the period before.
      </>,
    );
  }

  const daysNow = num(data.current, 'consistency', 'active_days');
  const totalNow = num(data.current, 'consistency', 'total_days');
  const daysThen = num(then, 'consistency', 'active_days');
  const totalThen = num(then, 'consistency', 'total_days');
  if (totalNow > 0 && totalThen > 0 && daysNow !== daysThen) {
    lines.push(
      <>
        You worked on <strong>{daysNow} of {totalNow} days</strong>, against {daysThen} of{' '}
        {totalThen}.
      </>,
    );
  }

  const hoursNow = num(data.current, 'focus', 'focused_minutes') / 60;
  const hoursThen = num(then, 'focus', 'focused_minutes') / 60;
  if (Math.abs(hoursNow - hoursThen) >= 0.5) {
    lines.push(
      <>
        You logged <strong>{hoursNow.toFixed(1)} hours of focus</strong>, against{' '}
        {hoursThen.toFixed(1)}.
      </>,
    );
  }

  const onTimeNow = num(data.current, 'efficiency', 'on_time_pct');
  const onTimeThen = num(then, 'efficiency', 'on_time_pct');
  if (Math.abs(onTimeNow - onTimeThen) >= 1) {
    lines.push(
      <>
        You finished <strong>{Math.round(onTimeNow)}% of tasks by their deadline</strong>,
        against {Math.round(onTimeThen)}%.
      </>,
    );
  }

  const ratedNow = num(data.current, 'quality', 'rated_tasks');
  const ratedThen = num(then, 'quality', 'rated_tasks');
  const qNow = num(data.current, 'quality', 'avg_quality');
  const qThen = num(then, 'quality', 'avg_quality');
  if (ratedNow > 0 && ratedThen > 0 && Math.abs(qNow - qThen) >= 0.2) {
    lines.push(
      <>
        You rated your work <strong>{qNow.toFixed(1)} out of 25</strong> across{' '}
        {fmtNumber(ratedNow)} tasks, against {qThen.toFixed(1)} across {fmtNumber(ratedThen)}.
      </>,
    );
  }

  return lines;
}
