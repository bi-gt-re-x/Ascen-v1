/**
 * The Insights page's panels — what the record says about how this person works.
 *
 * Every panel here is a finding and the sentence that explains it. That is the
 * whole difference between this page and the analytics one: analytics draws the
 * number and trusts the reader to interpret it, and a page called Insights that
 * did the same would be a second dashboard. So each panel states the finding in
 * words first, shows the chart it came from, and says what it means — and when
 * the record cannot support a finding, it says that instead of hedging one.
 *
 * The layout is the analytics page's, deliberately: same `Panel`, same grid,
 * same tiles, so moving between the two pages is not a change of scenery.
 */
import { Columns, Panel, Sparkline, toneVar, type Column } from '@/components/Analytics';
import { hourLabel, WEEKDAYS_SHORT } from '@/utils/behaviour';
import type {
  BalanceRow,
  BalanceShape,
  ClockShape,
  Momentum,
  RhythmShape,
  WeekShape,
} from '@/utils/behaviour';

/** Minutes as "1h 20m", or "45m". */
function hm(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** "Mon 14 Mar" from an ISO date. */
function pretty(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --------------------------------------------------------------------------
// The headline
// --------------------------------------------------------------------------
export interface SummaryProps {
  week: WeekShape;
  clock: ClockShape;
  rhythm: RhythmShape;
  span: string;
}

/**
 * One paragraph naming the reader's own pattern back to them.
 *
 * Assembled from the findings rather than written, so it cannot drift from the
 * panels below it, and each clause is dropped when the number behind it is not
 * there — a summary that says "you work best on null" is worse than a shorter
 * summary.
 */
export function Summary({ week, clock, rhythm, span }: SummaryProps) {
  const parts: string[] = [];

  if (week.best) {
    parts.push(
      `Your strongest day is ${week.best.label}, which carries about ${Math.round(
        week.best.avgXp,
      ).toLocaleString()} XP every time it comes round`,
    );
  }
  if (clock.coreWindow) {
    parts.push(
      `half of everything you finish lands between ${hourLabel(clock.coreWindow.from)} and ${hourLabel(
        clock.coreWindow.to,
      )}`,
    );
  }
  if (rhythm.typicalSession > 0) {
    parts.push(`and a typical sitting runs ${hm(rhythm.typicalSession)}`);
  }

  const sentence = parts.length ? `${parts.join(', ')}.` : 'There is not enough here to read a pattern yet.';

  return (
    <Panel title="What your record says" note={span}>
      <p className="ax-prose ax-prose-lead">{sentence}</p>
      <p className="ax-prose">
        {rhythm.activeRate >= 80
          ? `You showed up on ${Math.round(rhythm.activeRate)}% of the days in this range, which is a
             genuinely high rate — the kind that makes totals climb on their own without any single
             day having to be heroic.`
          : rhythm.activeRate >= 55
            ? `You showed up on ${Math.round(rhythm.activeRate)}% of the days in this range. That is a
               working habit with real holes in it: the days you do turn up are productive, and the
               totals are being held back by the ones you skip rather than by how much you do.`
            : `You showed up on ${Math.round(rhythm.activeRate)}% of the days in this range. Most of
               the calendar is empty, so what happens on the days you do work matters far less right
               now than how often those days come round.`}
      </p>
      {rhythm.longestGap && (
        <p className="ax-prose">
          The longest quiet stretch ran {rhythm.longestGap.days} days, ending {pretty(rhythm.longestGap.to)}
          {rhythm.gapCount > 1
            ? `, and there have been ${rhythm.gapCount} breaks of three days or more in this range altogether.`
            : '.'}
        </p>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Tiles
// --------------------------------------------------------------------------
export interface HeadlineTilesProps {
  week: WeekShape;
  clock: ClockShape;
  rhythm: RhythmShape;
  balance: BalanceShape;
}

export function HeadlineTiles({ week, clock, rhythm, balance }: HeadlineTilesProps) {
  const tiles = [
    {
      key: 'day',
      label: 'Strongest day',
      value: week.best ? week.best.label : '—',
      note: week.best ? `${Math.round(week.best.avgXp).toLocaleString()} XP on an average one` : 'No pattern yet',
      tone: 'violet' as const,
      series: week.stats.map((stat) => stat.avgXp),
    },
    {
      key: 'hour',
      label: 'Peak hour',
      value: clock.peak ? clock.peak.label : '—',
      note: clock.peak ? `${clock.peak.tasks.toLocaleString()} tasks finished then` : 'No timings recorded',
      tone: 'blue' as const,
      series: clock.hours.map((hour) => hour.tasks),
    },
    {
      key: 'session',
      label: 'Typical sitting',
      value: hm(rhythm.typicalSession),
      note: rhythm.longestSession
        ? `Best was ${hm(rhythm.longestSession.minutes)}`
        : 'No focus time logged',
      tone: 'green' as const,
      series: [],
    },
    {
      key: 'balance',
      label: 'Widest subject',
      value: balance.leader ?? '—',
      note: balance.leader
        ? `${balance.concentration}% of your XP, across ${balance.carrying} live subjects`
        : 'No subjects on your tasks',
      tone: 'amber' as const,
      series: [],
    },
  ];

  return (
    <div className="ax-tiles ax-tiles-four">
      {tiles.map((tile) => (
        <article className="ax-tile" key={tile.key}>
          <header>
            <span className={`ax-tile-dot ax-tone-${tile.tone}`} aria-hidden="true" />
            <span className="ax-tile-label">{tile.label}</span>
          </header>
          <strong className="ax-tile-value ax-tile-value-sm">{tile.value}</strong>
          <span className="ax-muted ax-small">{tile.note}</span>
          {tile.series.length > 1 && <Sparkline values={tile.series} tone={tile.tone} />}
        </article>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// The week
// --------------------------------------------------------------------------
export function WeekPanel({ week }: { week: WeekShape }) {
  const columns: Column[] = week.stats.map((stat) => ({
    label: WEEKDAYS_SHORT[stat.index]!,
    value: stat.avgXp,
    text: Math.round(stat.avgXp).toLocaleString(),
    peak: week.best?.index === stat.index,
  }));

  return (
    <Panel title="When you do your best work" note="Average XP per occurrence of each weekday">
      <Columns columns={columns} />
      <p className="ax-prose">
        {week.best && week.worst && week.best.index !== week.worst.index ? (
          <>
            {week.best.label} outproduces {week.worst.label} by{' '}
            <strong>
              {week.worst.avgXp > 0
                ? `${Math.round((week.best.avgXp / week.worst.avgXp - 1) * 100)}%`
                : 'a wide margin'}
            </strong>
            . {week.spread > 1.6
              ? 'That is a lopsided week — one day is doing a disproportionate share of the work, which makes the whole week fragile: lose that day to something else and the week is lost with it.'
              : 'That is a reasonably even week. No single day is load-bearing, so one bad day does not take the week down with it.'}
          </>
        ) : (
          'Not enough of the week has been worked to compare its days yet.'
        )}
      </p>
      {week.weekendGap !== null && (
        <p className="ax-prose">
          {week.weekendGap <= -20
            ? `Your weekends run ${Math.abs(week.weekendGap)}% lighter than your weekdays. That is
               normal and not automatically a problem — but it does mean two of every seven days are
               close to unavailable, and any plan that assumes a flat week will not survive contact
               with yours.`
            : week.weekendGap >= 20
              ? `Your weekends run ${week.weekendGap}% heavier than your weekdays — you are catching
                 up at the end of the week rather than keeping pace through it. That works until a
                 weekend is taken by something else.`
              : `Weekends and weekdays are within ${Math.abs(week.weekendGap)}% of each other, so you
                 are keeping a genuinely flat week. That is rarer than it sounds and it is the thing
                 that makes long streaks possible.`}
        </p>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// The clock
// --------------------------------------------------------------------------
export function ClockPanel({ clock }: { clock: ClockShape }) {
  // Nine at night to eight in the morning is dead space on most accounts and
  // eleven of the twenty-four columns; the panel draws the working day and says
  // what it left out rather than drawing a row of empty bars.
  const shown = clock.hours.filter((hour) => hour.hour >= 6 && hour.hour <= 23);
  const columns: Column[] = shown.map((hour) => ({
    label: hour.hour % 3 === 0 ? hourLabel(hour.hour).replace(' ', '') : '',
    value: hour.tasks,
    text: hour.tasks ? String(hour.tasks) : '',
    peak: clock.peak?.hour === hour.hour,
  }));

  return (
    <Panel title="The clock you keep" note="Tasks finished, by the hour they were finished">
      <Columns columns={columns} tone="blue" />
      <p className="ax-prose">
        {clock.coreWindow ? (
          <>
            Half of everything you finish happens between{' '}
            <strong>
              {hourLabel(clock.coreWindow.from)} and {hourLabel(clock.coreWindow.to)}
            </strong>
            . {clock.coreWindow.share >= 60
              ? 'That is a tight, well-established working window — the most valuable thing you can do with it is defend it, because everything else you try to schedule will be competing with your best hours.'
              : 'That is a fairly loose window. Your work is spread across the day rather than anchored to a particular part of it, which is flexible but makes it easy for a day to slip away without a session in it.'}
          </>
        ) : (
          'None of your finished tasks carry a completion time, so there is no clock to read here yet.'
        )}
      </p>
      {clock.lateShare > 0 && (
        <p className="ax-prose">
          {clock.lateShare >= 25
            ? `${clock.lateShare}% of your work is finished after 10 PM or before 5 AM. That is a
               substantial share of a habit running on late nights, and late work is the first thing
               to disappear when you are tired or busy — it is the least durable part of your week.`
            : `${clock.lateShare}% of your work lands late at night. That is a small enough share to
               be occasional rather than structural.`}
        </p>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Rhythm
// --------------------------------------------------------------------------
export function RhythmPanel({ rhythm }: { rhythm: RhythmShape }) {
  return (
    <Panel title="How steady you are" note={`Across ${rhythm.span.toLocaleString()} days`}>
      <div className="ax-figures">
        <div className="ax-figure">
          <span className="ax-muted">Days worked</span>
          <strong>{Math.round(rhythm.activeRate)}%</strong>
          <span className="ax-muted ax-small">of the range</span>
        </div>
        <div className="ax-figure">
          <span className="ax-muted">Typical sitting</span>
          <strong>{hm(rhythm.typicalSession)}</strong>
          <span className="ax-muted ax-small">on a day you focus</span>
        </div>
        <div className="ax-figure">
          <span className="ax-muted">Breaks of 3+ days</span>
          <strong>{rhythm.gapCount}</strong>
          <span className="ax-muted ax-small">in this range</span>
        </div>
      </div>
      <p className="ax-prose">
        {rhythm.gapCount === 0
          ? 'You have not gone three days without working once in this range. That is the single hardest thing to do in a productivity habit, and it is worth knowing that you are already doing it.'
          : `Those ${rhythm.gapCount} breaks are where your totals actually leak. A three-day gap costs
             you roughly what three of your average days would have earned — and unlike a slow day,
             a gap also resets the streak and the momentum that comes with it.`}
      </p>
      {rhythm.longestSession && (
        <p className="ax-prose">
          Your longest single day of focus was {hm(rhythm.longestSession.minutes)} on{' '}
          {pretty(rhythm.longestSession.date)}. Compared with your typical{' '}
          {hm(rhythm.typicalSession)}, that is{' '}
          {rhythm.typicalSession > 0
            ? `${(rhythm.longestSession.minutes / rhythm.typicalSession).toFixed(1)}× a normal day`
            : 'well beyond a normal day'}{' '}
          — useful as proof of what you can do, and a poor model for what to plan around.
        </p>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Momentum
// --------------------------------------------------------------------------
export function MomentumPanel({ rows, window }: { rows: Momentum[]; window: number }) {
  return (
    <Panel
      title="Which way you are heading"
      note={`The last ${window} days against the ${window} before them`}
    >
      <ul className="ax-momentum">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="ax-momentum-label">{row.label}</span>
            <span className="ax-momentum-now">{row.format(row.now)}</span>
            {row.delta === null ? (
              <span className="ax-delta ax-delta-none">no earlier window</span>
            ) : (
              <span className={`ax-delta ax-delta-${row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'flat'}`}>
                {row.delta > 0 ? '↑' : row.delta < 0 ? '↓' : '→'} {Math.abs(row.delta)}%
              </span>
            )}
            <span className="ax-momentum-was">
              {row.delta === null ? '—' : `was ${row.format(row.before)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="ax-prose">
        {(() => {
          const rising = rows.filter((row) => (row.delta ?? 0) > 5).length;
          const falling = rows.filter((row) => (row.delta ?? 0) < -5).length;
          if (rows.every((row) => row.delta === null)) {
            return 'There is no earlier window of the same length to compare against yet, so nothing here is a trend — come back once the account is twice this old.';
          }
          if (rising >= 3) {
            return 'Three or more of these are up together, which is the signal worth trusting — a single measure rising can be noise, but XP, tasks and focus moving in the same direction is a real change in how much you are doing.';
          }
          if (falling >= 3) {
            return 'Most of these are down together. That is worth taking at face value rather than explaining away: something about the last stretch has been harder than the one before it, and the fix is usually about frequency rather than intensity.';
          }
          return 'These are pulling in different directions, which usually means the shape of the work changed rather than the amount — fewer, larger sessions, or more, smaller ones.';
        })()}
      </p>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Balance
// --------------------------------------------------------------------------
/** How many subjects get a row before the rest are summed into one. */
const BALANCE_ROWS = 6;

const DIRECTION_WORD: Record<BalanceRow['direction'], string> = {
  up: 'rising',
  down: 'easing off',
  steady: 'steady',
  stopped: 'stopped',
};

const DIRECTION_MARK: Record<BalanceRow['direction'], string> = {
  up: '↑',
  down: '↓',
  steady: '→',
  stopped: '·',
};

/**
 * Where the XP goes, subject by subject.
 *
 * The panel was one ring and a paragraph, which left two thirds of a tall card
 * empty and — worse — asserted a spread without showing it: "your effort is
 * spread across 7 subjects" is a claim the reader cannot check, and the seven
 * subjects were already counted to make it. The breakdown is that arithmetic,
 * printed. Every row is a real subject with real finished tasks behind it.
 *
 * Each row carries where it is going as well as how big it is, from the two
 * halves of the window (see `balanceShape`). That is the part a total can never
 * show: a subject can be second-largest on the year and have had nothing in it
 * for a month, and the size alone would read as health.
 */
export function BalancePanel({ balance }: { balance: BalanceShape }) {
  const shown = balance.rows.slice(0, BALANCE_ROWS);
  const rest = balance.rows.slice(BALANCE_ROWS);
  const restXp = rest.reduce((sum, row) => sum + row.xp, 0);

  return (
    <Panel title="What you spend yourself on" note="Where the XP actually goes">
      <div className="ax-balance">
        <div className="ax-balance-ring" style={{ '--share': `${balance.concentration}%` } as React.CSSProperties}>
          <strong>{balance.concentration}%</strong>
          <span className="ax-muted ax-small">on {balance.leader ?? '—'}</span>
        </div>
        <div>
          <p className="ax-prose">
            {balance.leader === null
              ? 'None of your finished tasks carry a subject, so there is nothing to break down. Filing tasks under a subject is what turns this panel on.'
              : balance.concentration >= 45
                ? `Nearly half your effort goes to ${balance.leader}. Depth like that is how anything
                   is actually mastered, and it is also a single point of failure — if that one
                   subject stalls, most of your week stalls with it.`
                : `${balance.leader} leads at ${balance.concentration}%, but nothing dominates. Your
                   effort is spread across ${balance.carrying} subjects with real weight behind them,
                   which is a balanced week and a slower route to depth in any one of them.`}
          </p>
          {balance.fading.length > 0 && (
            <p className="ax-prose">
              <strong>{balance.fading.join(', ')}</strong>{' '}
              {balance.fading.length === 1 ? 'had' : 'had'} real work behind{' '}
              {balance.fading.length === 1 ? 'it' : 'them'} earlier in this range and{' '}
              {balance.fading.length === 1 ? 'has' : 'have'} had none in the second half. That is the
              kind of thing a total will never show you, because the total still remembers it.
            </p>
          )}
        </div>
      </div>

      {shown.length > 0 && (
        <ul className="ax-split">
          {shown.map((row) => (
            <li className={`ax-split-row is-${row.direction}`} key={row.name}>
              <span className="ax-split-name" title={row.name}>
                {row.name}
              </span>
              <span className="ax-split-track">
                {/* A floor of 1.5%, so a subject with a sliver of the window is
                    still a mark on the page rather than an empty row. */}
                <i style={{ width: `${Math.max(1.5, row.share)}%` }} />
              </span>
              <span className="ax-split-share">{Math.round(row.share)}%</span>
              <span className="ax-split-xp">{Math.round(row.xp).toLocaleString()} XP</span>
              <span
                className="ax-split-move"
                title={`${Math.round(row.early).toLocaleString()} XP in the first half of this range, ${Math.round(row.late).toLocaleString()} in the second`}
              >
                {DIRECTION_MARK[row.direction]} {DIRECTION_WORD[row.direction]}
              </span>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="ax-split-row is-rest">
              <span className="ax-split-name">
                {rest.length} more subject{rest.length === 1 ? '' : 's'}
              </span>
              <span className="ax-split-track">
                <i style={{ width: `${(restXp / (balance.total || 1)) * 100}%` }} />
              </span>
              <span className="ax-split-share">
                {Math.round((restXp / (balance.total || 1)) * 100)}%
              </span>
              <span className="ax-split-xp">{Math.round(restXp).toLocaleString()} XP</span>
              <span className="ax-split-move" />
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

/** The tone bar under the tiles, so the page opens with a colour key. */
export function ToneKey() {
  return (
    <div className="ax-legend ax-legend-tight">
      {(['violet', 'blue', 'green', 'amber'] as const).map((tone) => (
        <span className="ax-legend-item" key={tone}>
          <i className="ax-swatch" style={{ background: toneVar(tone) }} />
          {{ violet: 'Effort', blue: 'Timing', green: 'Depth', amber: 'Spread' }[tone]}
        </span>
      ))}
    </div>
  );
}
