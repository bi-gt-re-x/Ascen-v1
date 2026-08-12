/**
 * The analytics page's parts — the long view of an account.
 *
 * Split along what each piece owns: `data.ts` is every figure the page states
 * and nothing that draws, `charts.tsx` is every mark the page makes and nothing
 * that knows what a subject is, and the four panel files sit between them. A
 * panel file holds the panels that share a row, because that is the unit that
 * changes together when the layout does.
 *
 * The graded report card that used to be this page — `GradeCard`,
 * `ScoringDetails`, `metrics.ts` — is still here and still exported. Nothing
 * renders it since the redesign; its five scores survive as the Growth Score
 * tile, which reads the same endpoint. Kept rather than deleted because it is
 * the only thing that explains how a score is arrived at, and the new page
 * links to that explanation in more than one place without owning it yet.
 */
export { Header, ViewTabs, Controls, VIEWS, viewFor } from './Header';
export type { HeaderProps, ViewTabsProps, ControlsProps, View, ViewKey } from './Header';

export {
  HabitTiles,
  HabitCard,
  HabitCards,
  HabitCalendarPanel,
  PatternsPanel,
  ConsistencyPanel as HabitConsistencyPanel,
  TimelinePanel,
  HabitOpening,
} from './Habits';

export { ComparePanel, DirectionPanel, TrendChart, TrendTiles } from './Trends';

export { Tiles } from './Tiles';
export type { TilesProps } from './Tiles';

export { Trajectory, ScorePanel } from './Trajectory';
export type { TrajectoryProps, ScorePanelProps } from './Trajectory';

export { SubjectPanel, ConsistencyPanel, MilestonePanel } from './Breakdown';
export type { SubjectPanelProps, ConsistencyPanelProps } from './Breakdown';

export {
  ComparisonPanel,
  CompoundingPanel,
  StreaksPanel,
  InsightsPanel,
  StandingPanel,
} from './Longterm';
export type { StreaksPanelProps, StandingPanelProps } from './Longterm';

export {
  AreaChart,
  Columns,
  GroupedBars,
  Panel,
  Radar,
  Scatter,
  Sparkline,
  Delta,
  TONES,
  asTone,
  toneVar,
} from './charts';
export type { Tone, PanelProps, AreaSeries, BarPair, Column, RadarAxis, ScatterProps } from './charts';

/**
 * The report card is scored out of 100 and this page states it out of ten.
 *
 * Here rather than in data.ts because it is a fact about the *backend's* units
 * (`grade_for_score` in backend/tracking/analytics.py maps 0-100), and the one
 * place a reader will look for it is next to where the score is used.
 */
export const SCORE_SCALE = 10;

// The report card, no longer rendered. See the note at the top.
export { GradeCard } from './GradeCard';
export type { GradeCardProps } from './GradeCard';
export { MetricRow } from './MetricRow';
export type { MetricRowProps } from './MetricRow';
export { ScoringDetails } from './ScoringDetails';
export { gradeClass, metricLines } from './metrics';
export type { MetricLine } from './metrics';
