/**
 * WHY AM I THERE — the model's reading, with its working shown.
 *
 * Two shapes, and the difference between them is not cosmetic.
 *
 * **Diagnosis** is a claim about the reader, so it carries a confidence and
 * the figures it rests on. A reading off forty rated tasks is not the same
 * kind of statement as one off five, and a panel that presented them
 * identically would be flattening the only thing that separates a finding
 * from a guess. The confidence is the model's own estimate and is labelled as
 * that; the evidence is not — every line of it is a figure the app counted.
 *
 * **Insight** is an observation plus what to do differently about it. The
 * `implication` is required, and that requirement is the whole design: an
 * observation with no implication is a statistic the reader can already see
 * on the cards above, and a page of those is the "here are 47 charts" failure
 * this system exists to avoid.
 */
import type { Diagnosis, Insight, Priority } from '@/services/analytics';

/** Confidence, in words. A bare 0.72 is a number nobody can act on. */
function sureness(value: number): string {
  if (value >= 0.85) return 'high confidence';
  if (value >= 0.6) return 'fair confidence';
  if (value >= 0.4) return 'low confidence';
  return 'a guess';
}

export function Reading({
  diagnosis,
  priorities,
  insights,
}: {
  diagnosis: Diagnosis[];
  priorities: Priority[];
  insights: Insight[];
}) {
  return (
    <div className="sx-reading">
      {diagnosis.length > 0 && (
        <ul className="sx-findings">
          {diagnosis.map((entry) => (
            <li key={entry.finding} className="sx-finding">
              <div className="sx-finding-head">
                <strong>{entry.finding}</strong>
                <span
                  className="sx-sure"
                  data-band={
                    entry.confidence >= 0.85
                      ? 'high'
                      : entry.confidence >= 0.6
                        ? 'fair'
                        : 'low'
                  }
                >
                  {sureness(entry.confidence)}
                </span>
              </div>
              {entry.evidence.length > 0 && (
                <ul className="sx-finding-evidence">
                  {entry.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {priorities.length > 0 && (
        <div className="sx-priorities">
          <h4>In this order</h4>
          <ol>
            {priorities.map((entry) => (
              <li key={entry.focus}>
                <div className="sx-priority-head">
                  <strong>{entry.focus}</strong>
                  {/* The weight as a bar rather than a decimal: it is a
                      ranking the model produced, and 0.91 printed beside
                      0.88 invites a precision that is not there. */}
                  <span className="sx-priority-bar" aria-hidden="true">
                    <span style={{ width: `${Math.round(entry.weight * 100)}%` }} />
                  </span>
                </div>
                <p>{entry.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {insights.length > 0 && (
        <ul className="sx-insights">
          {insights.map((entry) => (
            <li key={entry.observation} className="sx-insight">
              <p className="sx-insight-obs">{entry.observation}</p>
              {entry.evidence && (
                <p className="sx-insight-ev">
                  <span>From:</span> {entry.evidence}
                </p>
              )}
              {entry.implication && (
                <p className="sx-insight-imp">
                  <span>So:</span> {entry.implication}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
