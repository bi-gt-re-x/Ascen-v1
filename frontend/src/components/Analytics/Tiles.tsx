/**
 * The five figures across the top, each with its own days drawn under it.
 *
 * They are the page's thesis in one row, and the order is the argument: how
 * much work a day, how often at all, how much each piece was worth — then the
 * volume behind those three, and the grade that comes out of all of it.
 *
 * It used to open on totals: XP banked, hours logged, tasks finished. Totals
 * are the one thing on this page that cannot go down, so a row of them reads as
 * progress on every window a reader picks, including the bad ones — an account
 * that halved its output still shows a larger lifetime figure than last month.
 * Productivity, consistency and quality are rates, and a rate can fall. That is
 * the whole reason they lead: they are the three figures that can tell the
 * reader something they did not want to hear.
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
  /** The small trailing unit — "XP/day", "/10". Not every tile carries one. */
  unit?: string;
  delta: number | null;
  series: number[];
  tone: Tone;
  glyph: GlyphName;
  hint: string;
}

export function Tiles({ figures, sparks, score, scoreSeries, compareLabel }: TilesProps) {
  const tiles: TileSpec[] = [
    {
      key: 'productivity',
      glyph: 'trend',
      label: 'Productivity',
      value: Math.round(figures.xpPerDay.value).toLocaleString(),
      unit: 'XP/day',
      delta: figures.xpPerDay.delta,
      series: sparks.xp,
      tone: 'violet',
      hint: 'XP per day of the window, not per day worked. Time off pulls it down.',
    },
    {
      key: 'consistency',
      glyph: 'flame',
      label: 'Consistency',
      value: `${Math.round(figures.consistency.value)}%`,
      delta: figures.consistency.delta,
      series: sparks.consistency,
      tone: 'amber',
      hint: 'Share of days with any work on them. This measures showing up.',
    },
    {
      key: 'quality',
      glyph: 'target',
      // The one tile whose figure the app cannot measure — it is what the
      // reader said, and it reads "—" rather than 0 when they said nothing.
      // Rating is optional and a zero here would be the page inventing a bad
      // review out of a skipped dialog. See utils/ratings.
      label: 'Quality',
      value: figures.ratedTasks === 0 ? '—' : figures.quality.value.toFixed(1),
      unit: figures.ratedTasks === 0 ? undefined : '/ 25',
      delta: figures.ratedTasks === 0 ? null : figures.quality.delta,
      series: figures.ratedTasks === 0 ? [] : sparks.quality,
      tone: 'pink',
      hint:
        figures.ratedTasks === 0
          ? 'Difficulty × execution, from the star rows after a task. Optional.'
          : `Difficulty × execution out of 25, over the ${figures.ratedTasks} of ${figures.finishedTasks} tasks you rated.`,
    },
    {
      key: 'tasks',
      glyph: 'check',
      label: 'Tasks Completed',
      value: figures.tasks.value.toLocaleString(),
      delta: figures.tasks.delta,
      series: sparks.tasks,
      tone: 'green',
      hint: 'The volume behind the three rates beside it, counted on the day each task was finished.',
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
      tone: 'blue',
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
            {tile.unit && <em className="ax-tile-unit">{tile.unit}</em>}
          </strong>
          <Delta value={tile.delta} suffix={compareLabel} />
          <Sparkline values={tile.series} tone={tile.tone} />
        </article>
      ))}
    </div>
  );
}
