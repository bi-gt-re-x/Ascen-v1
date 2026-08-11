/**
 * The middle row: what the work was about, when it happened, and what it passed.
 *
 * Three panels, three units — XP by subject, days on a calendar, tiers on a
 * ladder — and all three read the same window as everything above them, so a
 * reader moving between them is looking at one period from three angles rather
 * than at three different periods.
 */
import type { CSSProperties } from 'react';
import { Panel, Radar, TONES, toneVar, type RadarAxis } from './charts';
import { GLYPHS, type GlyphName } from './glyphs';
import { HEAT_WEEKDAYS, type HeatRow, type ReachedMilestone } from '@/utils/growthSummary';
import type { SubjectXpRow } from '@/utils/subjectXp';

// --------------------------------------------------------------------------
// Subject growth
// --------------------------------------------------------------------------
export interface SubjectPanelProps {
  rows: SubjectXpRow[];
  /** The same subjects over the period before, for the per-row change. */
  previous: Map<string, number>;
}

/**
 * XP by subject, as a web and a legend.
 *
 * The legend carries the numbers because a radar cannot: a polygon says which
 * subjects dominate at a glance and refuses to say by how much, which is
 * exactly the division of labour wanted here. The percentage beside each row is
 * that subject against its own showing in the previous period — a subject can
 * be growing while the account as a whole is flat, and that is worth seeing.
 */
export function SubjectPanel({ rows, previous }: SubjectPanelProps) {
  const peak = Math.max(...rows.map((row) => row.xp), 1);
  const axes: RadarAxis[] = rows.map((row) => ({
    label: row.label,
    value: row.xp / peak,
  }));

  return (
    <Panel title="Subject Growth (XP Earned)" footer={<span className="ax-link">View subject breakdown →</span>}>
      {rows.length === 0 ? (
        <p className="ax-empty">No finished tasks carry a subject in this window yet.</p>
      ) : (
        <div className="ax-subject">
          <Radar axes={axes} />
          <ul className="ax-subject-legend">
            {rows.map((row, index) => {
              const was = previous.get(row.key) ?? 0;
              const delta = was > 0 ? Math.round(((row.xp - was) / was) * 100) : null;
              return (
                <li key={row.key}>
                  <i
                    className="ax-dot"
                    style={{ background: toneVar(TONES[index % TONES.length]!) }}
                  />
                  <span className="ax-subject-name" title={row.name ?? row.label}>
                    {row.label}
                  </span>
                  <span className="ax-subject-xp">{Math.round(row.xp).toLocaleString()} XP</span>
                  {delta === null ? (
                    <span className="ax-delta ax-delta-none">new</span>
                  ) : (
                    <span className={`ax-delta ax-delta-${delta >= 0 ? 'up' : 'down'}`}>
                      {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Consistency
// --------------------------------------------------------------------------
export interface ConsistencyPanelProps {
  rate: number;
  previousRate: number | null;
  rows: HeatRow[];
  compareLabel: string;
}

/**
 * A year of days, a week to a column.
 *
 * The grid comes from `heatmapGrid`, which fixes the column count at the worst
 * case for the window and blanks any square outside it — so the rectangle is
 * the same rectangle whatever weekday the window opens on. That constancy is
 * why the panel can sit in a fixed-height row without the layout moving.
 */
export function ConsistencyPanel({ rate, previousRate, rows, compareLabel }: ConsistencyPanelProps) {
  const delta =
    previousRate === null || previousRate === 0 ? null : Math.round(rate - previousRate);

  return (
    <Panel
      title="Consistency Over Time"
      footer={<span className="ax-link">What affects consistency? →</span>}
    >
      <div className="ax-consistency-head">
        <strong className="ax-big">{rate}%</strong>
        <span className="ax-muted">Average consistency</span>
      </div>
      {delta === null ? (
        <span className="ax-delta ax-delta-none">No earlier period</span>
      ) : (
        <span className={`ax-delta ax-delta-${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} points {compareLabel}
        </span>
      )}

      <div className="ax-heat">
        <div className="ax-heat-days" aria-hidden="true">
          {HEAT_WEEKDAYS.map((day, index) => (
            <span key={index}>{index % 2 === 1 ? day : ''}</span>
          ))}
        </div>
        <div className="ax-heat-main">
          {/* `heatmapGrid` puts the month name on the week it opens in and an
              empty string on every other week, so the labels line up with the
              columns by construction. The initial only: a column is a few
              pixels wide across a year, and "September" over one of them is a
              word floating above nothing in particular. */}
          <div className="ax-heat-months" aria-hidden="true">
            {rows.map((row, index) => (
              <span key={index}>{row.label.slice(0, 1)}</span>
            ))}
          </div>
          <div className="ax-heat-grid" role="img" aria-label={`${rate}% of days worked`}>
            {rows.map((row, index) => (
              <div className="ax-heat-week" key={index}>
                {row.days.map((cell, cellIndex) => (
                  <span
                    key={cellIndex}
                    className={`ax-heat-cell${cell.date ? '' : ' is-blank'}`}
                    data-level={cell.level}
                    title={cell.date ? `${cell.date} · ${Math.round(cell.xp)} XP` : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ax-heat-key">
        <span>Less consistent</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} className="ax-heat-cell" data-level={level} />
        ))}
        <span>More consistent</span>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Milestones
// --------------------------------------------------------------------------
/** A colour and a drawing per ladder, so a row is recognisable before it is read. */
const MILESTONE_LOOK: Record<string, { tone: string; glyph: GlyphName }> = {
  xp: { tone: 'violet', glyph: 'sparkle' },
  focus: { tone: 'blue', glyph: 'clock' },
  streak: { tone: 'amber', glyph: 'flame' },
};

export function MilestonePanel({ reached }: { reached: ReachedMilestone[] }) {
  // Newest first, and only as many as the panel has room for beside two charts.
  const shown = [...reached].reverse().slice(0, 5);

  return (
    <Panel title="Milestone Timeline" footer={<span className="ax-link">View all milestones →</span>}>
      {shown.length === 0 ? (
        <p className="ax-empty">No milestones cleared yet — the first is 1,000 XP.</p>
      ) : (
        <ol className="ax-timeline">
          {shown.map((entry) => {
            const look = MILESTONE_LOOK[entry.kind] ?? MILESTONE_LOOK.xp!;
            return (
            <li key={`${entry.kind}-${entry.name}`}>
              <span
                className="ax-timeline-dot"
                style={
                  { color: toneVar(look.tone), '--ico': GLYPHS[look.glyph] } as CSSProperties
                }
                aria-hidden="true"
              />
              <div className="ax-timeline-body">
                <strong>{entry.name}</strong>
                <span className="ax-muted">
                  {new Date(`${entry.on}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <span className="ax-timeline-reward">+{entry.reward.toLocaleString()} XP</span>
            </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
