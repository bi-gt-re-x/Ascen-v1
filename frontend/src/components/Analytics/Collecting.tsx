/**
 * What the page says before it has enough to analyse.
 *
 * ## Not a lock
 *
 * `Locked` is the right shape for one tab that needs three weeks of record: it
 * is a door with a condition on it, and the reader came to that tab knowing
 * what they wanted. This is the whole page on somebody's second day, and a
 * door is the wrong metaphor for it — nothing is being withheld, there is
 * simply nothing yet. A page that opens with a padlock on day two teaches a
 * reader that the product is mostly unavailable to them.
 *
 * So this states the position and then gets out of the way: one line on what
 * Ascen is doing, a meter showing the account moving toward the next thing
 * that opens, and then the figures that are *already* true — which on day two
 * is most of what anybody wants anyway. The tab under it is the same tab it
 * always was, minus the panels that would be drawing a slope through two
 * points.
 *
 * ## What it does not do
 *
 * No trend, no comparison, no insight, no projection, no sample data. Every
 * figure it prints is a count of something that happened. This is the same
 * rule `Locked` was written for — see the note there about what invented
 * figures cost — applied a stage earlier.
 */
import { Link } from 'react-router-dom';
import { StatRow, type Stat } from './StatRow';
import { ACTIVE_DAY_MEANS } from '@/utils/activeDay';
import { STAGE_LABEL, type Maturity } from '@/utils/dataMaturity';

/**
 * What a day has to have on it to be counted.
 *
 * Every countdown on this page is in days *worked*, never days on the
 * calendar, and a reader watching a number go up is owed the rule behind it —
 * otherwise "4 more days" reads as a wait of four days, and somebody who
 * skips two of them thinks the page has stalled. It appears wherever a
 * countdown does, which is here, in the strip below, and in `Locked`.
 *
 * The words come from utils/activeDay, beside the predicate that enforces
 * them, so the sentence on screen cannot drift from the rule behind it.
 */
export function ActiveDayNote() {
  return (
    <p className="ax-active-note">
      A day counts as soon as you {ACTIVE_DAY_MEANS} — any one of the three, however small. Days
      you do none of them are not counted against you; they are simply not counted.
    </p>
  );
}

export interface CollectingProps {
  maturity: Maturity;
  /** Already formatted, and already true. See the note above. */
  stats: Stat[];
  /** One line naming what the next stage brings. The caller knows; this does not. */
  nextBrings: string;
}

/**
 * The same thing said in one line, for the stages that no longer need a block.
 *
 * From day seven the tab is the real tab — trends, comparisons, the lot — and
 * a card explaining that Ascen is still learning would be sitting on top of a
 * page that plainly is not waiting for anything. What is still true is that
 * the readings are thinner than they will be, and that something specific
 * opens next. That is a line, not a card.
 *
 * It is the same component family and the same tokens as `Collecting`, so
 * crossing from one to the other reads as the same voice getting quieter
 * rather than as a different notice appearing.
 */
export function StageNote({ maturity, brings }: { maturity: Maturity; brings: string }) {
  const { activeDays, next, toNext } = maturity;
  if (!next || toNext === null) return null;

  return (
    <p className="ax-stage-note">
      <span className="ax-stage-chip">{STAGE_LABEL[maturity.stage]}</span>
      <span>
        Read from <strong>{activeDays} days</strong> of your work.{' '}
        <strong>
          {toNext} more {toNext === 1 ? 'day' : 'days'}
        </strong>{' '}
        and {brings}
      </span>
    </p>
  );
}

export interface LearningItem {
  label: string;
  /** Active days recorded against this one's requirement. */
  have: number;
  need: number;
  href: string;
}

/**
 * What Ascen has not worked out yet, and how close it is.
 *
 * The brief for this whole feature says not to make analytics feel locked, and
 * the instinct that follows from that is to say nothing at all about the parts
 * that have not opened. That instinct is wrong: a reader who does not know
 * Habits exists cannot look forward to it, and finds it by accident three
 * weeks later. Silence is not the opposite of a paywall.
 *
 * What makes it not a paywall is that nothing is being withheld — the tab is
 * empty because the answer does not exist yet, and there is no version of this
 * product where paying, or clicking, produces it sooner. So the strip states
 * the position in the present tense and points at the thing that closes the
 * gap, which is doing the work. No padlocks, no counts of what is "left", and
 * every row links to the tab it names so a reader can go and look at what it
 * says while it is still filling.
 *
 * Rows that are already open are dropped rather than ticked. A checklist of
 * things you have finished is a different page from this one.
 */
export function LearningStrip({ items }: { items: LearningItem[] }) {
  const waiting = items.filter((item) => item.have < item.need);
  if (waiting.length === 0) return null;

  return (
    <section className="ax-learning">
      <p className="ax-learning-head">Still filling in</p>
      <ul>
        {waiting.map((item) => {
          const left = item.need - item.have;
          return (
            <li key={item.label}>
              <Link to={item.href}>
                <span className="ax-learning-name">{item.label}</span>
                <span
                  className="ax-learning-meter"
                  role="img"
                  aria-label={`${item.have} of ${item.need} days`}
                >
                  <i style={{ width: `${Math.round((item.have / item.need) * 100)}%` }} />
                </span>
                <span className="ax-learning-left">
                  {left} {left === 1 ? 'day' : 'days'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <ActiveDayNote />
    </section>
  );
}

export function Collecting({ maturity, stats, nextBrings }: CollectingProps) {
  const { activeDays, spanDays, toNext, next, progress } = maturity;

  return (
    <section className="ax-collect">
      <header className="ax-collect-head">
        <p className="ax-collect-eyebrow">{STAGE_LABEL[maturity.stage]}</p>
        <h2>
          {activeDays === 0
            ? 'Ascen has nothing to go on yet.'
            : 'Ascen is still learning your habits.'}
        </h2>
        <p className="ax-collect-lead">
          {activeDays === 0 ? (
            <>
              Finish a task or run a focus session and this page starts filling in. Everything
              here is measured from what you actually do — there is no sample data to look at
              in the meantime.
            </>
          ) : (
            <>
              {activeDays === 1 ? 'One day' : `${activeDays} days`} of your work{' '}
              {activeDays === 1 ? 'is' : 'are'} on record
              {spanDays > activeDays + 1 ? `, across ${spanDays} days` : ''}. The figures below
              are counts and they are exact. Trends, patterns and ratings need more to be worth
              printing, and they arrive on their own as you go.
            </>
          )}
        </p>

        {next && toNext !== null && (
          <div className="ax-collect-next">
            <div
              className="ax-collect-meter"
              role="img"
              aria-label={`${activeDays} days recorded, ${toNext} more until ${STAGE_LABEL[next].toLowerCase()}`}
            >
              <span className="ax-collect-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="ax-collect-count">
              <strong>
                {toNext} more {toNext === 1 ? 'day' : 'days'} with work on{' '}
                {toNext === 1 ? 'it' : 'them'}
              </strong>{' '}
              and {nextBrings}
            </p>
            <ActiveDayNote />
          </div>
        )}
      </header>

      <StatRow stats={stats} />
    </section>
  );
}
