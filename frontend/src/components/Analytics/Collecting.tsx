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
import { StatRow, type Stat } from './StatRow';
import { STAGE_LABEL, type Maturity } from '@/utils/dataMaturity';

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
          </div>
        )}
      </header>

      <StatRow stats={stats} />
    </section>
  );
}
