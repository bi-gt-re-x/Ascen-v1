/**
 * The analytics page's parts — the long view of an account.
 *
 * Split along what each piece owns: `data.ts` is every figure the page states
 * and nothing that draws, `charts.tsx` is every mark the page makes and nothing
 * that knows what a subject is, and the four panel files sit between them. A
 * panel file holds the panels that share a row, because that is the unit that
 * changes together when the layout does.
 *
 * The graded report card that used to be this page is gone. `GradeCard` and
 * `MetricRow` were kept for a while on the argument that they were the only
 * thing explaining how a score is arrived at — but nothing rendered them, and
 * that explanation had already moved to `ScoringDetails`, which the Trajectory
 * panel opens in place. Two files nobody could reach, justified by a job
 * something else was doing. `metrics.ts` stays for `gradeClass`, which
 * `ScoreBanner` colours the letter with.
 */
export { ScoreBanner } from './ScoreBanner';
export type { ScoreBannerProps } from './ScoreBanner';
export { NextActions } from './NextActions';
export type { NextActionsProps } from './NextActions';
export { DiagnosisCards, DiagnosisEmpty } from './Diagnosis';
export { Patterns as DiscoveredPatterns } from './Patterns';
export type { PatternsProps as DiscoveredPatternsProps } from './Patterns';

export { SinceLast } from './Header';
export type { SinceLastProps } from './Header';
export { Header, ViewTabs, Controls, TabOpening, VIEWS, viewFor } from './Header';
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
  habitLead,
} from './Habits';

export { ComparePanel, DirectionPanel, TrendChart, TrendTiles } from './Trends';

/** What a tab shows instead of inventing figures it does not have. */
export { Locked } from './Locked';
export type { LockedProps } from './Locked';

/** The one thing on this page an account can do on its first day. */
export { BaselinePanel, BaselineSetup } from './Baseline';
export type { BaselinePanelProps, BaselineSetupProps, BaselineValues } from './Baseline';

export { StatRow } from './StatRow';
export type { Stat, StatRowProps } from './StatRow';
export { Tiles } from './Tiles';
export type { TilesProps } from './Tiles';

/** The panels drawn from the one optional thing in the app. See ./Quality. */
export { DepthPicker, QualityPanel, QualityGridPanel, RatedTasksPanel, ReasonsPanel } from './Quality';
export type {
  DepthPickerProps,
  QualityPanelProps,
  QualityGridPanelProps,
  ReasonsPanelProps,
  RatedTasksPanelProps,
} from './Quality';

export { Trajectory, ScorePanel } from './Trajectory';
export type { TrajectoryProps, ScorePanelProps } from './Trajectory';

export { SubjectPanel, ConsistencyPanel, MilestonePanel } from './Breakdown';
export type { SubjectPanelProps, ConsistencyPanelProps } from './Breakdown';

export {
  CompoundingPanel,
  StreaksPanel,
  InsightsPanel,
  StandingPanel,
} from './Longterm';
export type { StreaksPanelProps, StandingPanelProps } from './Longterm';

export {
  AreaChart,
  Columns,
  Panel,
  PanelGroup,
  Radar,
  Scatter,
  Sparkline,
  Delta,
  TONES,
  asTone,
  toneVar,
} from './charts';
export type { Tone, PanelProps, AreaSeries, Column, RadarAxis, ScatterProps } from './charts';

/**
 * The Growth Score — its five factors, and where a score places.
 *
 * `SCORE_SCALE` used to be declared here on its own, back when the score was
 * one division of the backend's `overall`. It moved into ./score with the
 * arithmetic that uses it: the score is now assembled from the five metrics it
 * is the mean of, so the scale, the weighting and the parts belong together.
 */
export {
  SCORE_SCALE,
  WEIGHT as SCORE_WEIGHT,
  agreesWithOverall,
  formatPercentile,
  growthScore,
  percentileFor,
  percentileLabel,
} from './score';
export type { GrowthScore, ScoreFactor } from './score';

// The report card, no longer rendered. See the note at the top.
export { ScoringDetails } from './ScoringDetails';
export { gradeClass } from './metrics';
