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
    tone: 'blue',
    glyph: 'sparkle',
    asks: 'XP a working day, against your daily goal',
  },
  quality: {
    label: 'Quality',
    tone: 'amber',
    glyph: 'target',
    asks: 'how hard the work was, times how well it went',
  },
  consistency: {
    label: 'Consistency',
    tone: 'green',
    glyph: 'check',
    asks: 'the share of days you showed up at all',
  },
  efficiency: {
    label: 'Efficiency',
    tone: 'violet',
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
/** The short forms, for the segmented control. The cards keep the long ones. */
const SHORT: Record<PeriodKey, string> = {
  '7d': 'Week',
  '30d': 'Month',
  '90d': '3 Months',
  '180d': '6 Months',
  '365d': 'Year',
  all: 'All time',
};

/**
 * The period, as a segmented control in the chart's own header.
 *
 * It lives there because the period is a property of the *chart* before it is a
 * property of anything else on the tab: a reader changing it is asking the line
 * to cover a different span, and a control that does that from the top of the
 * page makes them look somewhere other than the thing that moves.
 *
 * The row of cards at the foot of the tab is not a second copy of this. It
 * states what every period grew by — six answers at once, which a segmented
 * control cannot show — and pressing one is a way of asking for the detail
 * behind a figure the reader has just read. Same destination, different
 * question.
 */
export function PeriodTabs({
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
    <div className="ax-gp-tabs" role="group" aria-label="Growth period">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          className={`ax-gp-tab${card.key === active ? ' is-on' : ''}`}
          aria-pressed={card.key === active}
          onClick={() => onPick(card.key)}
          disabled={busy}
        >
          {SHORT[card.key]}
        </button>
      ))}
    </div>
  );
}

/**
 * Every period, with what it grew by and the shape it grew in.
 *
 * A period with no equivalent stretch before it prints a dash rather than a
 * number. "Since you started" always does, by definition: there is nothing
 * before the beginning to have grown from.
 */
export function PeriodCards({
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
    <nav className="ax-gp-row" aria-label="Growth by period">
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
            <span className="ax-gp-card-head">
              <span className="ax-gp-card-label">{card.label}</span>
              <span className="ax-gp-card-go" aria-hidden="true">›</span>
            </span>
            <strong className="ax-gp-card-value">
              {growthLabel(card.change, card.previous, card.overall)}
            </strong>
            <span className="ax-gp-card-note">
              {card.previous === null
                ? 'nothing before it to compare against'
                : `against the ${card.days} days before · ${card.previous} → ${card.overall}`}
            </span>
            <Spark values={card.spark} way={way} />
          </button>
        );
      })}
    </nav>
  );
}

/**
 * A card's own shape, unlabelled and unscaled to anything but itself.
 *
 * Deliberately without an axis: it is answering "did this climb or sag", not
 * "what was it on the 14th", and a sparkline that invites a reading off its
 * y-axis has stopped being one. Scored the same way as the big chart, so the
 * card and the line it opens cannot disagree about the shape.
 */
function Spark({ values, way }: { values: number[]; way: 'up' | 'down' | 'held' }) {
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const d = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 26 - ((value - low) / span) * 22;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg className={`ax-gp-spark is-${way}`} viewBox="0 0 100 30" preserveAspectRatio="none"
         aria-hidden="true">
      <path d={`${d} L100,30 L0,30 Z`} className="ax-gp-spark-fill" />
      <path d={d} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// --------------------------------------------------------------------------
// The verdict
// --------------------------------------------------------------------------
/**
 * The whole verdict as one strip: overall growth, then each measure beside it.
 *
 * ## Why the five sit level with the total
 *
 * The overall figure is the mean of the five and nothing else, so a layout that
 * gave it a block of its own and buried the parts further down would be asking
 * the reader to take the headline on trust and then go looking for the
 * arithmetic. Here the sum and its terms are on one line and the reader can
 * check one against the other without moving.
 *
 * The overall card is wider and carries the sentence, because it is the one
 * figure somebody repeats out loud; the five are the same shape as each other
 * so they can be compared down the row rather than read one at a time.
 *
 * Each card states a *movement* and a *grade transition*, which are two
 * different readings of the same pair of numbers and both worth having: the
 * percentage says how far it went, and "B → A" says whether going that far
 * crossed a line anybody names.
 */
export function MetricStrip({ data }: { data: GrowthPeriods }) {
  const now = data.current;
  const then = data.previous;
  const way = then === null ? 'held' : direction(then.overall, now.overall);

  return (
    <div className="ax-gp-strip">
      <section className={`ax-gp-overall is-${way}`}>
        <p className="ax-gp-eyebrow">Overall growth</p>
        <strong className="ax-gp-big">
          {growthLabel(data.change.overall, then?.overall ?? null, now.overall)}
        </strong>
        <p className="ax-gp-overall-note">
          {then ? (
            <>
              You moved from <strong>{then.grade}</strong>{' '}
              <span aria-hidden="true">→</span> <strong>{now.grade}</strong> over{' '}
              {data.label.toLowerCase()}
            </>
          ) : (
            <>
              Graded <strong>{now.grade}</strong> at {now.overall} out of 100. This period
              reaches back to your first day, so there is nothing before it.
            </>
          )}
        </p>
      </section>

      {METRIC_ORDER.map((metric) => {
        const to = now.parts[metric];
        const from = then ? then.parts[metric] : null;
        const moved = from === null ? 'held' : direction(from, to);
        const meta = METRIC_META[metric];

        return (
          <section
            key={metric}
            className={`ax-gp-metric-card ax-tone-${meta.tone} is-${moved}`}
          >
            <p className="ax-gp-metric-card-head">
              <span className="ax-gp-trend" aria-hidden="true" />
              {meta.label}
            </p>
            <strong className="ax-gp-metric-card-value">
              {growthLabel(data.change[metric], from, to)}
            </strong>
            <p className="ax-gp-metric-card-grade">
              {then && (
                <>
                  <span className="ax-gp-was">{then.grades[metric]}</span>
                  <span className="ax-gp-arrow" aria-hidden="true">→</span>
                </>
              )}
              <span>{now.grades[metric]}</span>
            </p>
          </section>
        );
      })}
    </div>
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

/** One measured quantity behind a metric, before and after. */
interface Part {
  label: string;
  from: number;
  to: number;
  /** What a full bar means. The scale the quantity is actually on. */
  max: number;
  /** The figure as the reader should see it — "82%", "14.2 hrs", "340". */
  show: (value: number) => string;
}

const asIs = (value: number) => String(Math.round(value));
const asPct = (value: number) => `${Math.round(value)}%`;
const asRating = (value: number) => value.toFixed(1);

/**
 * What a metric is actually made of, before and after.
 *
 * The panel names a winner, and a winner nobody can check is a boast. These are
 * the quantities the backend measured on the way to the score — not a second
 * derivation of anything — so a reader who disbelieves "efficiency +31%" can
 * see that it is 70% of tasks on time becoming 85%, and decide for themselves.
 *
 * The bar is scaled to the quantity's *own* ceiling rather than to the pair,
 * which is the difference between "this went up a bit" and "this went from
 * two-thirds to nearly all of it". A rating is out of five, a share is out of a
 * hundred, and a count has no ceiling — so that one is scaled to the larger of
 * the two readings with room above it.
 */
function partsOf(metric: PeriodMetric, now: PeriodSide, then: PeriodSide): Part[] {
  const num = (side: PeriodSide, field: string) =>
    Number((side.figures?.[metric] as Record<string, unknown>)?.[field]) || 0;
  const pair = (field: string) => [num(then, field), num(now, field)] as const;
  const headroom = (a: number, b: number) => Math.max(a, b, 1) * 1.15;

  switch (metric) {
    case 'productivity': {
      const [from, to] = pair('avg_daily_xp');
      return [{ label: 'XP a working day', from, to, max: headroom(from, to), show: asIs }];
    }
    case 'quality': {
      const [wasD, isD] = pair('avg_difficulty');
      const [wasE, isE] = pair('avg_execution');
      const [wasN, isN] = pair('rated_tasks');
      return [
        { label: 'Difficulty you took on', from: wasD, to: isD, max: 5, show: asRating },
        { label: 'How well it went', from: wasE, to: isE, max: 5, show: asRating },
        { label: 'Tasks you rated', from: wasN, to: isN, max: headroom(wasN, isN), show: asIs },
      ];
    }
    case 'consistency': {
      const [from, to] = pair('active_days');
      const [, days] = pair('total_days');
      return [{ label: 'Days worked', from, to, max: Math.max(days, to, 1), show: asIs }];
    }
    case 'efficiency': {
      const [from, to] = pair('on_time_pct');
      return [{ label: 'Finished by the deadline', from, to, max: 100, show: asPct }];
    }
    case 'focus': {
      const [wasH, isH] = pair('focused_minutes');
      const [wasG, isG] = pair('pct_of_goal');
      return [
        {
          label: 'Hours logged',
          from: wasH / 60,
          to: isH / 60,
          max: headroom(wasH / 60, isH / 60),
          show: (value) => `${value.toFixed(1)} hrs`,
        },
        { label: 'Share of your focus goal', from: wasG, to: isG, max: 100, show: asPct },
      ];
    }
    default:
      return [];
  }
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
      <div className={`ax-gp-mover ax-tone-${meta.tone}`}>
        <span
          className="ax-gp-mover-icon"
          style={{ '--ico': GLYPHS[meta.glyph] } as Record<string, string>}
          aria-hidden="true"
        />
        <p className="ax-gp-mover-name">{meta.label}</p>
        <span className={`ax-gp-mover-pill is-${kind}`}>
          {growthLabel(mover.change, mover.from, mover.to)}
        </span>
      </div>

      <p className="ax-gp-mover-asks">
        {kind === 'best' ? 'Up' : 'Down'} from {mover.from} to {mover.to} out of 100 — {meta.asks}.
      </p>

      {/* The quantities the score was computed from, so the claim can be
          checked rather than taken. See `partsOf`. */}
      <ul className="ax-gp-parts">
        {then &&
          partsOf(mover.metric, now, then).map((part) => {
            const way = part.to > part.from ? 'up' : part.to < part.from ? 'down' : 'held';
            return (
              <li key={part.label} className={`is-${way}`}>
                <span className="ax-gp-part-label">{part.label}</span>
                <span className="ax-gp-part-bar" aria-hidden="true">
                  <span
                    className="ax-gp-part-fill"
                    style={{ width: `${Math.min(100, (part.to / part.max) * 100)}%` }}
                  />
                  <span
                    className="ax-gp-part-was"
                    style={{ left: `${Math.min(100, (part.from / part.max) * 100)}%` }}
                  />
                </span>
                <span className="ax-gp-part-value">
                  {part.show(part.from)} <span aria-hidden="true">→</span>{' '}
                  <strong>{part.show(part.to)}</strong>
                </span>
              </li>
            );
          })}
      </ul>

      {/* Why it matters, assembled from the same figures. */}
      <p className="ax-gp-mover-why">
        <span className="ax-gp-mover-why-mark" aria-hidden="true">✦</span>
        <span>
          <strong>What this is:</strong> {meta.asks}. It is{' '}
          {kind === 'best'
            ? 'the measure that gained the most ground this period'
            : 'the measure that lost the most ground this period'}
          , ranked on points moved rather than on percentage — a score climbing from 4 to 12
          is a bigger percentage and a much smaller change.
        </span>
      </p>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Then and now
// --------------------------------------------------------------------------
/** "6 Aug — 4 Sep", the span a column of figures belongs to. */
function span(from: string, to: string): string {
  const at = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${at(from)} – ${at(to)}`;
}

/**
 * Every metric, before and after, under two dated headings.
 *
 * The headings are not decoration. Without them the panel states fifteen
 * numbers and never says which stretch of days any of them belongs to, and
 * "then" is a word that means whatever the reader assumes — a month, a term,
 * the beginning. Naming both windows is what makes every row below a claim
 * about a period rather than a vibe.
 */
export function ThenNow({ data }: { data: GrowthPeriods }) {
  const then = data.previous;

  return (
    <>
      <p className="ax-gp-when">
        <span className="is-then">
          <b>{then ? 'Before' : 'No earlier period'}</b>
          <em>{then && then.start && then.end ? span(then.start, then.end) : '—'}</em>
        </span>
        <span className="is-now">
          <b>Now</b>
          <em>{span(data.start, data.end)}</em>
        </span>
      </p>

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

      {/* What the five rows add up to. The same figure the strip states at the
          top of the tab, repeated here because this is the panel that shows
          the working and a total belongs at the foot of one. */}
      {then && (
        <p className="ax-gp-total">
          Overall growth:{' '}
          <strong>
            {growthLabel(data.change.overall, then.overall, data.current.overall)}
          </strong>
        </p>
      )}
    </>
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
