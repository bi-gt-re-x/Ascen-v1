/**
 * The Recommendations page's panels — what to do differently, and what it is worth.
 *
 * The Insights page describes; this one prescribes, from the same numbers. Each
 * card is an instruction, the finding that produced it, the concrete first
 * step, and the arithmetic behind the figure attached to it — that last part
 * matters most: a page that tells someone their habit is worth 12,000 XP a year
 * and will not say how it got there is asking to be believed rather than read.
 *
 * Same `Panel`, same grid, same tiles as the analytics page, so the three pages
 * are one place.
 */
import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Panel, toneVar } from '@/components/Analytics';
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  difficultyLabel,
  kindLabel,
  type Advice,
  type Outlook,
} from '@/utils/advice';
import { compact } from '@/utils/growthSummary';

const KIND_TONE: Record<Advice['kind'], string> = {
  frequency: 'violet',
  timing: 'blue',
  depth: 'green',
  balance: 'amber',
  quality: 'pink',
};

/**
 * Which suggestions the reader has said they will try.
 *
 * Local to the browser, and that is the honest scope of it: nothing on the
 * backend models an accepted recommendation, so a button that claimed to
 * schedule anything would be lying about what it did. What it can honestly do
 * is remember the decision and mark the card, which is most of the value — the
 * page's job is to get one change picked, and a page that forgets which one was
 * picked the moment it reloads is not helping with that.
 *
 * Keyed by advice id, which is stable across renders because the rules generate
 * fixed ids rather than indices.
 */
const TRYING_KEY = 'ascen:advice-trying';

function useTrying(): [Set<string>, (id: string) => void] {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRYING_KEY);
      if (raw) setIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      // A corrupt or unavailable store is not worth a broken page — the cards
      // simply open unmarked, which is the state a first visit is in anyway.
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(TRYING_KEY, JSON.stringify([...next]));
      } catch {
        // Same again: remembering is a convenience, not a requirement.
      }
      return next;
    });
  }, []);

  return [ids, toggle];
}

// --------------------------------------------------------------------------
// The opening
// --------------------------------------------------------------------------
export function Opening({ advice, outlook }: { advice: Advice[]; outlook: Outlook }) {
  const scored = advice.filter((item) => item.impact > 0);
  const gain = outlook.improved - outlook.current;

  return (
    <Panel title="Where the room actually is">
      {advice.length === 0 ? (
        <p className="ax-prose ax-prose-lead">
          There is not enough history here yet to say anything useful about how to change it. Come
          back after a few weeks of work — this page is generated from your own record, and it would
          rather say nothing than hand you advice that could have been written before you signed up.
        </p>
      ) : (
        <>
          <p className="ax-prose ax-prose-lead">
            {scored.length > 0 ? (
              <>
                Taking the {scored.length === 1 ? 'one scored suggestion' : `${scored.length} scored suggestions`} below
                would be worth roughly <strong>{compact(gain)} XP a year</strong> — about{' '}
                {outlook.current > 0 ? Math.round((gain / outlook.current) * 100) : 0}% on top of the
                pace you are already keeping.
              </>
            ) : (
              'Nothing in your record points at a change that would move the totals. What is left below is about the shape of the work rather than the amount of it.'
            )}
          </p>
          <p className="ax-prose">
            Every figure here is your own averages multiplied out, not a model — the workings are
            printed on each card so you can disagree with them. Nothing assumes the change compounds
            or gets easier, and the ones with no number attached have none because they would not
            change your totals at all, only what those totals are made of.
          </p>
        </>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// A recommendation
// --------------------------------------------------------------------------
/**
 * One suggestion, with everything needed to decide on it and nothing else.
 *
 * The card answers six questions in the order a reader asks them: what, how
 * much is it worth, why does Ascen think so, what do I actually do, how hard is
 * it, and what is the evidence. The last of those is the one most pages like
 * this omit, and it is the reason this one can be argued with — a card that
 * claims a habit is worth twelve thousand XP a year and will not show its
 * arithmetic is asking to be believed rather than read.
 *
 * The priority chip ranks; the XP figure quantifies. They are both here because
 * they answer different questions — "which of these first" and "is this worth
 * anything at all" — and an account with five low-impact suggestions should be
 * able to see that at a glance without doing five divisions.
 */
export function AdviceCard({ item, rank }: { item: Advice; rank: number }) {
  const tone = KIND_TONE[item.kind];
  const [trying, toggle] = useTrying();
  const chosen = trying.has(item.id);

  return (
    <article className={`ax-panel ax-advice${chosen ? ' is-trying' : ''}`}>
      <header className="ax-advice-head">
        <span className="ax-advice-rank" style={{ background: toneVar(tone) }}>
          {rank}
        </span>
        <div>
          <span className="ax-advice-kind" style={{ color: toneVar(tone) }}>
            {item.category} · {kindLabel(item.kind)}
          </span>
          <h2>{item.title}</h2>
        </div>
        {item.impact > 0 && (
          <span className="ax-advice-impact">
            <strong>+{compact(item.impact)}</strong>
            <span className="ax-muted ax-small">XP / year</span>
          </span>
        )}
      </header>

      <div className="ax-advice-chips">
        <span
          className="ax-advice-priority"
          style={{ color: toneVar(PRIORITY_TONE[item.priority]), borderColor: toneVar(PRIORITY_TONE[item.priority]) }}
        >
          {PRIORITY_LABEL[item.priority]}
        </span>
        <span className="ax-advice-chip">{difficultyLabel(item.effort)}</span>
        <span className="ax-effort" title={`Effort: ${item.effort} of 5`} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((step) => (
            <i key={step} className={step <= item.effort ? 'is-on' : ''} />
          ))}
        </span>
      </div>

      <p className="ax-prose">
        <span className="ax-advice-tag">Why</span>
        {item.because}
      </p>
      <p className="ax-prose">
        <span className="ax-advice-tag">Try</span>
        {item.action}
      </p>
      <p className="ax-prose ax-advice-benefit">
        <span className="ax-advice-tag">Expect</span>
        {item.benefit}
      </p>

      <footer className="ax-advice-foot">
        <div className="ax-advice-evidence">
          <span className="ax-muted ax-small">
            <b>Evidence:</b> {item.evidence}
          </span>
          <span className="ax-muted ax-small">{item.workings}</span>
        </div>
        <button
          type="button"
          className={`ax-try${chosen ? ' is-on' : ''}`}
          aria-pressed={chosen}
          onClick={() => toggle(item.id)}
        >
          {chosen ? '✓ Trying this' : 'Try this'}
        </button>
      </footer>
    </article>
  );
}

// --------------------------------------------------------------------------
// Filtering
// --------------------------------------------------------------------------
/**
 * The category row, built from what is actually on the page.
 *
 * Not from the full list of categories: an account with three suggestions in
 * two categories should see two chips, because six greyed-out ones say nothing
 * except that the page has a taxonomy.
 */
export function CategoryFilter({
  items,
  chosen,
  onChoose,
}: {
  items: Advice[];
  chosen: string;
  onChoose: (category: string) => void;
}) {
  const present = [...new Set(items.map((item) => item.category))];
  if (present.length < 2) return null;

  return (
    <div className="ax-chips ax-chips-inline" role="group" aria-label="Category">
      <button
        type="button"
        className={`ax-chip${chosen === '' ? ' is-on' : ''}`}
        aria-pressed={chosen === ''}
        onClick={() => onChoose('')}
      >
        Everything ({items.length})
      </button>
      {present.map((category) => (
        <button
          key={category}
          type="button"
          className={`ax-chip${chosen === category ? ' is-on' : ''}`}
          aria-pressed={chosen === category}
          onClick={() => onChoose(category)}
        >
          {category} ({items.filter((item) => item.category === category).length})
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// The projection
// --------------------------------------------------------------------------
export function OutlookPanel({ outlook }: { outlook: Outlook }) {
  const peak = Math.max(...outlook.improvedLine, 1);
  const ticks: string[] = [];
  for (let step = 4; step >= 0; step--) ticks.push(compact((peak / 4) * step));

  return (
    <Panel
      title="The same five years, both ways"
      note="Your current pace against the pace with every scored suggestion taken"
    >
      <div className="ax-figures">
        <div className="ax-figure">
          <span className="ax-muted">At today&rsquo;s pace</span>
          <strong>{compact(outlook.current)}</strong>
          <span className="ax-muted ax-small">XP a year</span>
        </div>
        <div className="ax-figure">
          <span className="ax-muted">With the changes</span>
          <strong>{compact(outlook.improved)}</strong>
          <span className="ax-muted ax-small">XP a year</span>
        </div>
        <div className="ax-figure">
          <span className="ax-muted">Difference</span>
          <strong>+{compact(outlook.improved - outlook.current)}</strong>
          <span className="ax-muted ax-small">XP a year</span>
        </div>
      </div>

      <AreaChart
        id="ax-outlook"
        height={180}
        series={[
          { values: outlook.improvedLine, tone: 'green' },
          { values: outlook.currentLine, tone: 'violet', dashed: true },
        ]}
        ticks={ticks}
        marks={['Now', '1 yr', '2 yr', '3 yr', '4 yr', '5 yr']}
      />

      <div className="ax-legend">
        <span className="ax-legend-item">
          <i className="ax-legend-line" style={{ background: toneVar('green') }} />
          With the changes
        </span>
        <span className="ax-legend-item">
          <i className="ax-legend-line ax-legend-dashed" />
          Current pace
        </span>
      </div>

      <p className="ax-prose">
        Both lines start from what you have actually banked, so the gap between them is the entire
        claim this page is making. It widens slowly and then obviously, which is the honest shape of
        a habit change: nothing you do this month will separate them, and everything you do this
        month decides which one you are on.
      </p>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// The rest
// --------------------------------------------------------------------------
export function AlsoPanel({ items }: { items: Advice[] }) {
  return (
    <Panel title="Also worth doing" note="Smaller, or about shape rather than size">
      {items.length === 0 ? (
        <p className="ax-prose">
          Nothing else in your record crosses the threshold for a suggestion. That is a real result,
          not an empty state — the thresholds are your own numbers, and not tripping them means the
          habit is in reasonable order on every count this page knows how to check.
        </p>
      ) : (
        <ul className="ax-also">
          {items.map((item) => (
            <li key={item.id}>
              <span className="ax-dot" style={{ background: toneVar(KIND_TONE[item.kind]) }} />
              <div>
                <strong>{item.title}</strong>
                <span className="ax-muted">{item.because}</span>
              </div>
              {item.impact > 0 && <span className="ax-also-impact">+{compact(item.impact)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** The closing note, which is a caveat and belongs at the end. */
export function Caveat() {
  return (
    <Panel title="How to read all this">
      <p className="ax-prose">
        These are generated from thresholds in your own history, not from a list somebody wrote in
        advance. That is their strength and their limit: they can see that you take three-day breaks
        and cannot see that two of them were holidays, or that the subject you dropped was dropped
        because the course ended.
      </p>
      <p className="ax-prose">
        Take the ones that describe a problem you recognise. Ignore the ones that describe a
        deliberate choice — an account that spends 60% of its effort on one subject because that is
        the thing it is trying to be good at is not making a mistake, and this page has no way to
        know the difference. The numbers are real; whether they matter is yours to say.
      </p>
    </Panel>
  );
}
