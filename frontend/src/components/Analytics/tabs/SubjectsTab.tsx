/**
 * Subjects — mastery, and which of it anybody decided to aim at.
 *
 * The growth page's Skills chapter, which arrived whole and kept its own layout
 * inside `.gr-scope`. The line above it is this tab's only addition: which
 * subjects are being worked is the chapter's job, and which have a goal on them
 * is one sentence of context that earns its place only when the two lists
 * differ.
 */
import { Link } from 'react-router-dom';
import { SkillsChapter } from '@/components/Growth';
import type { AnalyticsModel } from '../useAnalyticsModel';
import type { SubjectIndex } from '@/hooks/useSubjects';

export function SubjectsTab({ model, subjects }: { model: AnalyticsModel } & { subjects: SubjectIndex }) {
  const { all, namedSubjects, tasks } = model;

  return (
    <>
      {/* The two chapters that arrived whole. Each was a tab of the growth
          page and neither had a counterpart here — mastery and achievement
          are questions the five original tabs never asked. They keep their own
          layout inside `.gr-scope`; see the stylesheet note at the top. */}
      {/* One line above the chapter. Which subjects are being worked is
          this tab's whole job; which of them anybody decided to aim at is
          one sentence of context on top of that, and it earns its place
          only when the two lists differ. */}
      {namedSubjects.total > 0 && (
        <section className="ax-section">
          <p className="ax-goal-line">
            {namedSubjects.named === 0 ? (
              <>
                None of the <strong>{namedSubjects.total}</strong> subjects you worked in
                this window has a goal aimed at it.
              </>
            ) : (
              <>
                <strong>{namedSubjects.named}</strong> of the {namedSubjects.total} subjects
                you worked in this window {namedSubjects.named === 1 ? 'has' : 'have'} a goal
                aimed at {namedSubjects.named === 1 ? 'it' : 'them'}.
              </>
            )}{' '}
            <Link to="/analytics/goals" className="ax-link">
              See what is missing
            </Link>
          </p>
        </section>
      )}

      <div className="ax-section gr-scope">
        <SkillsChapter all={all} tasks={tasks} subjects={subjects} />
      </div>
    </>
  );
}
