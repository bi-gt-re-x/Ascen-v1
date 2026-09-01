/**
 * Goals — whether what the reader aimed at is going to happen.
 *
 * No `Locked` gate, unlike the tab it replaced. Trends needed three weeks
 * before a slope meant anything; this needs a goal, and an account with none is
 * exactly who the empty state here is written for — telling them to come back
 * in three weeks would be answering a question they did not ask.
 *
 * Every figure is arithmetic the model already did over the goals fetched for
 * the Records tab, so this tab costs no request of its own.
 */
import {
  CheckpointsPanel as GoalCheckpointsPanel,
  EffortPanel as GoalEffortPanel,
  GoalTiles,
  NotesPanel as GoalNotesPanel,
  PaceMapPanel as GoalPaceMapPanel,
  PacePanel as GoalPacePanel,
  PortfolioPanel as GoalPortfolioPanel,
  SuggestPanel as GoalSuggestPanel,
} from '../GoalsView';
import type { AnalyticsModel } from '../useAnalyticsModel';

export function GoalsTab({ model }: { model: AnalyticsModel }) {
  const {
    goalLead, goalSet, goalPace, goalCheckpoints, goalEffort, liveGoals, tasks, goalRows, goalIdeas,
    /* What the account asked this page to be — see utils/analyticsPrefs. Two
       reads on this tab: which half of the count `goalLead` opens on, and how
       many suggestions are put in front of somebody at once. Neither moves a
       figure; `goalsOverview` counts the same goals at every setting. */
    toneRules,
  } = model;

  return (
    <>
      {/* ---- Goals ---------------------------------------------------
          No `Locked` gate, unlike the tab it replaced. Trends needed three
          weeks before a slope meant anything; this needs a goal, and an
          account with none is exactly who the empty state here is written
          for — telling them to come back in three weeks would be answering
          a question they did not ask. */}
      {/* A dozen words, above everything. A reader who opens this tab
          and reads one thing should read this one — see `goalHeadline`
          for why it is assembled rather than written. */}
      <p className="ax-goal-lead">{goalLead}</p>

      {/* Five figures, above everything that explains them — the slot the
          Overview gives `Tiles` and every other tab gives a `StatRow`. This
          tab opened on the sentence alone and made the reader find the answer
          inside a panel. */}
      <section className="ax-section">
        <GoalTiles overview={goalSet} />
      </section>

      {/* The set, then the one chart the tab is really for. */}
      <section className="ax-section ax-grid ax-grid-halves-even">
        <GoalPortfolioPanel overview={goalSet} />
        <GoalPaceMapPanel points={goalPace.points} undated={goalPace.undated} />
      </section>

      {/* What has actually been reached, and where the work went. The
          two questions the pace map raises and cannot answer. */}
      <section className="ax-section ax-grid ax-grid-halves-even">
        <GoalCheckpointsPanel months={goalCheckpoints} />
        <GoalEffortPanel rows={goalEffort} />
      </section>

      <section className="ax-section ax-grid ax-grid-halves-even">
        <GoalPacePanel goals={liveGoals} tasks={tasks} />
        <GoalNotesPanel notes={goalRows} />
      </section>

      <section className="ax-section">
        <GoalSuggestPanel suggestions={goalIdeas} limit={toneRules.headlines} />
      </section>
    </>
  );
}
