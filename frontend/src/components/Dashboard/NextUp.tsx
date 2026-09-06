/**
 * The one line on the dashboard that answers "what now?".
 *
 * Every other panel here reports: what is on the plate, what was finished, how
 * the week went. The page had no sense of *when* today's work happens — the
 * task list is flat and a due time is a string on the end of a row — so at
 * nine in the morning it could tell you that four things were due and not
 * which one you were meant to be doing.
 *
 * The arithmetic is `dayShape` (utils/dayShape), the same function the Day
 * view's sidebar uses, so the two pages cannot disagree about what is next.
 * The dashboard has no calendar blocks, so `dayPlan` in ./summary turns
 * today's timed tasks into the spans it takes.
 *
 * ## It always says something
 *
 * A day with times on it gets the next thing and a countdown. A day with none
 * — which is most days, for an account that keeps a list rather than a
 * schedule — gets what is left and what finishing it is worth, which is true
 * of every day and is the more useful half anyway. A day with nothing left
 * says so, once, and that is the only state where it is a congratulation.
 */
import { dayShape, hourLabel, spanLabel } from '@/utils/dayShape';
import type { DayPlan } from './summary';

export interface NextUpProps {
  plan: DayPlan;
  /** The reader's clock as a grid hour, or null when the day is not today. */
  now: number | null;
}

export function NextUp({ plan, now }: NextUpProps) {
  const shape = dayShape(plan.spans, now);
  const next = shape.next;

  /* Nothing left is nothing left, whatever the times said. This is checked
     before `next` because a day can hold a finished block that has not ended
     yet — "up next: the thing you already did" is the one sentence here that
     would be worse than silence. */
  const clear = plan.left === 0;

  return (
    <section className={`dash-next${clear ? ' is-clear' : ''}`} aria-label="What is next">
      <span className="dash-next-ico" aria-hidden="true">
        {clear ? (
          <svg viewBox="0 0 24 24">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 1.8" />
          </svg>
        )}
      </span>

      <div className="dash-next-main">
        {clear ? (
          <>
            <span className="dash-next-label">Today is clear</span>
            <strong className="dash-next-name">Nothing left on your plate</strong>
          </>
        ) : next ? (
          <>
            <span className="dash-next-label">
              {next.running ? 'On now' : 'Up next'}
              {!next.running && next.away > 0 && (
                <> · in {spanLabel(next.away)}</>
              )}
            </span>
            <strong className="dash-next-name">{next.title}</strong>
          </>
        ) : (
          <>
            <span className="dash-next-label">Still to do</span>
            <strong className="dash-next-name">
              {plan.left === 1 ? '1 task left today' : `${plan.left} tasks left today`}
            </strong>
          </>
        )}
      </div>

      {/* The right-hand facts. Two of them, and only the ones that are true:
          a day with no times has no span to report and says nothing rather
          than "0h booked". */}
      <div className="dash-next-facts">
        {next && (
          <span className="dash-next-fact">
            <em>{hourLabel(next.start)} – {hourLabel(next.end)}</em>
            <small>when</small>
          </span>
        )}
        {shape.booked > 0 && (
          <span className="dash-next-fact">
            <em>{spanLabel(shape.booked)}</em>
            <small>booked</small>
          </span>
        )}
        {!clear && (
          <span className="dash-next-fact">
            <em>{plan.xp.toLocaleString()} XP</em>
            <small>still to earn</small>
          </span>
        )}
      </div>
    </section>
  );
}
