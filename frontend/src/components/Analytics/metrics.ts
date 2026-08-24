/**
 * A letter grade as a class name.
 *
 * What is left of the report card's metrics module. It also built the five
 * table rows for `GradeCard`, which nothing rendered and which is now deleted;
 * this is the half that survived, because `ScoreBanner` colours its letter with
 * it and `.grade-A` and its siblings only set `--grade-color`, which inherits.
 */
import type { Grade } from '@/types';

/**
 * The grade's colour class.
 *
 * `.grade-S` … `.grade-F` each set `--grade-color`, which is what paints the
 * hero letter, the badges and the card's top rule; `.grade-none` is the grey
 * the original used before any data had arrived. See styles/growth.css.
 */
export function gradeClass(grade: Grade | null | undefined): string {
  // `A+` cannot go into a class name as it stands — `.grade-A+` is not a
  // selector — so the one grade with a symbol in it spells the symbol out.
  if (!grade) return 'grade-none';
  return `grade-${grade === 'A+' ? 'Aplus' : grade}`;
}
