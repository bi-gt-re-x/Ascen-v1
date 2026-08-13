/**
 * The five figures across the top, each with its own days drawn under it.
 *
 * They are the page's thesis in one row: how much was earned, how long was
 * spent, how much got finished, the daily rate, and the grade that comes out of
 * all four. Everything below is one of these five taken apart.
 *
 * The deltas are the window against the equal-length window before it, which is
 * `summaryFigures`' own rule — so a tile and the comparison panel further down
 * cannot disagree. A window with no period before it says so rather than
 * printing a rise from nothing as an infinite one.
 */
import type { CSSProperties } from 'react';
import { Delta, Sparkline, type Tone } from './charts';
import { GLYPHS, type GlyphName } from './glyphs';
import type { GrowthSummaryFigures, TileSeries } from '@/utils/growthSummary';

export interface TilesProps {
  figures: GrowthSummaryFigures;
  sparks: TileSeries;
  /** Out of 10, or null while the report card has not answered. */
  score: number | null;
  scoreSeries: number[];
  /** "vs previous 2 years" — the window's own words for its baseline. */
  compareLabel: string;
}

interface TileSpec {
  key: string;
  label: string;
  value: string;
  delta: number | null;
  series: number[];
  tone: Tone;
  glyph: GlyphName;
  hint: string;
}

export function Tiles({ figures, sparks, score, scoreSeries, compareLabel }: TilesProps) {
  const tiles: TileSpec[] = [
    {
      key: 'xp',
      glyph: 'sparkle',
      label: 'Total XP Earned',
      value: figures.xp.value.toLocaleString(),
      delta: figures.xp.delta,
      series: sparks.xp,
      tone: 'violet',
      hint: 'Every point banked inside the window.',
    },
    {
      key: 'focus',
      glyph: 'clock',
      label: 'Total Focus Time',
      value: `${Math.round(figures.focusHours.value).toLocaleString()}h`,
      delta: figures.focusHours.delta,
      series: sparks.focusHours,
      tone: 'blue',
      hint: 'Time logged in focus sessions.',
    },
    {
      key: 'tasks',
      glyph: 'check',
      label: 'Tasks Completed',
      value: figures.tasks.value.toLocaleString(),
      delta: figures.tasks.delta,
      series: sparks.tasks,
      tone: 'green',
      hint: 'Tasks finished, counted on the day they were finished.',
    },
    {
      key: 'perday',
      glyph: 'calendar',
      label: 'Average Daily XP',
      value: Math.round(figures.xpPerDay.value).toLocaleString(),
      delta: figures.xpPerDay.delta,
      series: sparks.xp,
      tone: 'amber',
      hint: 'Per day of the window, not per day something happened.',
    },
    {
      key: 'score',
      glyph: 'sparkle',
      label: 'Growth Score',
      value: score === null ? '—' : score.toFixed(1),
      // The score has no recorded history to compare against — see SAMPLE in
      // ./data. A tile with no baseline says so rather than inventing one.
      delta: null,
      series: scoreSeries,
      tone: 'violet',
      hint: 'The mean of productivity, quality, consistency, efficiency and focus.',
    },
  ];

  return (
    <div className="ax-tiles">
      {tiles.map((tile) => (
        <article className="ax-tile" key={tile.key}>
          <header>
            <span
              className={`ax-tile-icon ax-tone-${tile.tone}`}
              style={{ '--ico': GLYPHS[tile.glyph] } as CSSProperties}
              aria-hidden="true"
            />
            <span className="ax-tile-label">{tile.label}</span>
            <span className="ax-info" title={tile.hint} aria-label={tile.hint}>
              ?
            </span>
          </header>
          <strong className="ax-tile-value">
            {tile.value}
            {tile.key === 'score' && score !== null && <em className="ax-tile-unit">/10</em>}
          </strong>
          <Delta value={tile.delta} suffix={compareLabel} />
          <Sparkline values={tile.series} tone={tile.tone} />
        </article>
      ))}
    </div>
  );
}
