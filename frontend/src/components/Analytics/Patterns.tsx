/**
 * Discovered patterns — the conditions your better work happens under.
 *
 * "Your execution is 14% higher on tasks you finish before 5pm" is a different
 * kind of statement from anything else on this page. Every other panel reports
 * a measure over time; this one reports a *difference between two groups of
 * your own tasks*, which is the only shape of finding that can answer "why am
 * I improving?" rather than "am I?".
 *
 * ## The strength chip is the most important thing here
 *
 * A pattern-finder run over enough splits will always find something, and a
 * page that prints a finding drawn from eight tasks in the same voice as one
 * drawn from sixty is lying by typography. So every card carries how much
 * weight it can take, and the basis line underneath prints the actual counts on
 * both sides of the split.
 *
 * A reader should be able to dismiss a weak finding in one glance. That is not
 * a weakness of the panel — it is the panel working.
 *
 * ## Association, never cause
 *
 * The sentences are written to stop at the association. "Higher before 5pm"
 * does not mean finishing earlier makes you better; you may simply schedule
 * your easy revision for the evening. Where a finding suggests something worth
 * trying it goes in the "worth trying" line, phrased as a test rather than a
 * conclusion.
 */
import { Panel, PanelNote } from './charts';
import { STRENGTH_TEXT, type Strength } from '@/utils/insight';
import type { Pattern, PatternKind } from '@/utils/patterns';

const KIND_LABEL: Record<PatternKind, string> = {
  timing: 'When',
  subject: 'Subject',
  streak: 'Over time',
  context: 'Conditions',
  quality: 'Quality',
};

const STRENGTH_CLASS: Record<Strength, string> = {
  strong: 'is-strong',
  likely: 'is-likely',
  weak: 'is-weak',
};

export interface PatternsProps {
  items: Pattern[];
  /** How many days the search ran over, for the note. */
  window: number;
}

export function Patterns({ items, window: days }: PatternsProps) {
  return (
    <Panel
      title="What your record has noticed"
      note={
        items.length > 0
          ? `Differences between two groups of your own tasks over the last ${days} days, stated only where both groups were big enough to mean something.`
          : undefined
      }
      className="ax-pat"
      footer={
        <PanelNote label="Why so few, and why the strength labels">
          <p>
            Each of these splits your finished tasks in two by some condition — before or after
            5pm, weekday or weekend, this subject or the rest — and compares one measure across
            the split. A difference is only stated when both sides carry at least six tasks and
            the gap is at least 10%.
          </p>
          <p>
            Those floors are why this panel is often nearly empty. Run enough comparisons at a
            loose threshold and you will always find something: twenty splits produce one
            convincing-looking finding from noise alone. A page that printed it would be
            confidently wrong about your own life, which is the one mistake an app built on your
            record cannot afford.
          </p>
          <p>
            None of these is a cause. Rating your work better before 5pm does not mean the hour is
            doing it — you may put the easy revision in the evening. Treat the "worth trying" line
            as an experiment, not an instruction.
          </p>
        </PanelNote>
      }
    >
      {items.length === 0 ? (
        <p className="ax-empty">
          Nothing yet that clears the bar. A pattern needs at least six tasks on both sides of a
          split and a gap of 10% or more, and until then the honest answer is that your work looks
          the same whenever you do it.
        </p>
      ) : (
        <ul className="ax-pat-list">
          {items.map((item) => (
            <li key={item.id} className={`ax-pat-row ${STRENGTH_CLASS[item.strength]}`}>
              <div className="ax-pat-top">
                <span className="ax-pat-kind">{KIND_LABEL[item.kind]}</span>
                <span className="ax-pat-strength" title={STRENGTH_TEXT[item.strength]}>
                  {item.strength}
                </span>
                <span className="ax-pat-lift">
                  {item.lift >= 0 ? '+' : '−'}
                  {Math.round(Math.abs(item.lift))}%
                </span>
              </div>
              <p className="ax-pat-text">{item.text}</p>
              <p className="ax-pat-basis">{item.basis}</p>
              {item.soWhat && (
                <p className="ax-pat-so">
                  <strong>Worth trying:</strong> {item.soWhat}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
