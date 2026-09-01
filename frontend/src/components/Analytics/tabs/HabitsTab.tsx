/**
 * Habits — what the reader repeats, counted.
 *
 * The one tab gated on two things rather than one: enough record *and* a habit
 * actually found in it. Both arms lead to the same `Locked`, which says which
 * of the two it is waiting on.
 *
 * It never says *why*. The moment it does, the Insights tab has no reason to
 * exist.
 */
import { Link } from 'react-router-dom';
import {
  HabitCalendarPanel,
  HabitCards,
  ConsistencyPanel as HabitConsistencyPanel,
  HabitOpening,
  HabitTiles,
  PatternsPanel,
  TimelinePanel,
} from '../Habits';
import { Locked } from '../Locked';
import { FocusChapter } from '@/components/Growth';
import { NEED_DAYS } from '../useAnalyticsModel';
import type { AnalyticsModel } from '../useAnalyticsModel';
import type { SubjectIndex } from '@/hooks/useSubjects';

export function HabitsTab({ model, subjects }: { model: AnalyticsModel } & { subjects: SubjectIndex }) {
  const {
    all, habits, historyDays, patterns, shifts, spanText, streak, summary, tasks, toIso, byDate, waitFor,
    /* What the account asked this page to be — see utils/analyticsPrefs. Two
       reads on this tab: which of the two habits the opening names first, and
       how many patterns are put in front of somebody at once. Neither moves a
       figure; `habitSummary` counts the same days at every setting. */
    toneRules,
  } = model;

  return (
    <>
      {(waitFor('habits') > 0 || habits.length === 0) && (
        <Locked
          title="Habits"
          remaining={waitFor('habits')}
          need={NEED_DAYS.habits}
          have={historyDays}
          promise="A habit needs weeks of repetition before there is one to find."
          brings={['Routines, counted', 'Every day you worked', 'Holding or slipping', 'When each began']}
          emptyMessage="Nothing repeats often enough yet to count as a habit."
          action={
            <Link to="/tasks" className="ax-btn">
              Open Tasks
            </Link>
          }
        />
      )}

      {waitFor('habits') === 0 && habits.length > 0 && (
        <>
          <section className="ax-section">
            <HabitTiles summary={summary} span={spanText} />
          </section>
          <section className="ax-section ax-grid ax-grid-halves-even">
            <HabitOpening
              summary={summary}
              span={spanText}
              leadWithStrength={toneRules.leadWithStrength}
            />
            <PatternsPanel patterns={patterns} limit={toneRules.diagnoses} />
          </section>
          <section className="ax-section">
            <h2 className="ax-band">Your habits</h2>
            <HabitCards habits={habits} todayIso={toIso} />
          </section>
          <section className="ax-section ax-hero">
            <HabitCalendarPanel byDate={byDate} lastIso={toIso} accountDays={all.length} />
          </section>
          <section className="ax-section ax-grid ax-grid-halves-even">
            <HabitConsistencyPanel habits={habits} />
            <TimelinePanel habits={habits} shifts={shifts} />
          </section>
          {/* The growth page's Focus chapter. Habits counts what you repeat;
              this is whether you can execute it reliably — the planned-against-
              finished grid, the focus scores, the recovery after a miss. Same
              question one layer down, which is why it belongs on this tab
              rather than on a page nobody navigated to. */}
          <section className="ax-section gr-scope">
            <h2 className="ax-band">Can you execute it reliably</h2>
            <FocusChapter all={all} tasks={tasks} subjects={subjects} streak={streak} />
          </section>
        </>
      )}
    </>
  );
}
