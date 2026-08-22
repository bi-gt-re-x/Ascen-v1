/**
 * The Analytical Score, at the top of the Overview.
 *
 * The first thing on the page, and deliberately the only thing on its row: one
 * number, its letter, and a sentence saying where the number came from. A
 * reader who opens Analytics and reads nothing else should still leave knowing
 * how the account is doing and which of the five measures is holding it back.
 *
 * ## Why the explanation is on the page rather than behind a link
 *
 * A grade with no stated derivation is a verdict, and a verdict from software
 * about somebody's own study habits is worth very little. The sentence under
 * the letter is not a caption — it is what makes the letter arguable. It names
 * the five inputs, says they are averaged flat, and names the specific measure
 * dragging this account's score down, so the reader's next question ("which one
 * do I work on?") is answered before they ask it.
 *
 * The five bars underneath are the same five the Growth Score panel further
 * down draws. That is a repetition on purpose: this one is the summary a reader
 * sees first, that one sits with the chart of the score over time. Both read
 * `utils/analyticalScore`, so there is no arithmetic here to drift.
 *
 * ## S is not decoration
 *
 * The grade bands are the school scale in tens, with A+ for 96–99 and S for a
 * flat 100 — and a hundred is the mean of five scores, so S needs all five at
 * full marks. It cannot be bought with four strong measures and a weak fifth.
 * The banner says the band it is in either way, so the letter is never the only
 * thing on screen a reader has to take on trust.
 */
import { gradeClass } from './metrics';
import { GRADE_MEANING, bandLabel, howItIsCalculated, type AnalyticalScore } from '@/utils/analyticalScore';

export interface ScoreBannerProps {
  score: AnalyticalScore;
}

export function ScoreBanner({ score }: ScoreBannerProps) {
  const { value, grade, parts } = score;

  if (value === null || grade === null) {
    return (
      <section className="ax-panel ax-scoreband is-empty">
        <p className="ax-empty">
          No score yet. It is the average of five measures and each one needs a few days of
          record behind it before it means anything.
        </p>
      </section>
    );
  }

  return (
    <section className={`ax-panel ax-scoreband ${gradeClass(grade)}`}>
      <div className="ax-scoreband-main">
        <div className="ax-scoreband-figure">
          <span className="ax-scoreband-label">Analytical Score</span>
          <strong className="ax-scoreband-value">
            {value}
            <em>/100</em>
          </strong>
        </div>

        <div className="ax-scoreband-grade" title={`${bandLabel(grade)} out of 100`}>
          <span aria-hidden="true">{grade}</span>
          <span className="ax-sr-only">Grade {grade}</span>
        </div>

        <div className="ax-scoreband-said">
          <p className="ax-scoreband-meaning">
            {grade} — {GRADE_MEANING[grade]}. That band is {bandLabel(grade)} out of 100.
          </p>
          {/* The derivation, in the reader's own figures. See the note above for
              why this is on the page rather than behind "how is this worked out". */}
          <p className="ax-scoreband-how">{howItIsCalculated(score)}</p>
        </div>
      </div>

      {parts.length > 0 && (
        <ul className="ax-scoreband-parts">
          {parts.map((part) => (
            <li key={part.name}>
              <span className="ax-scoreband-part-label">{part.label}</span>
              <span className="ax-scoreband-track">
                <i style={{ width: `${Math.max(0, Math.min(100, part.score))}%` }} />
              </span>
              <span className="ax-scoreband-part-score">{Math.round(part.score)}</span>
              <span className="ax-scoreband-part-raw">{part.raw}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
