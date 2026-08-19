/**
 * The goals page's parts.
 *
 * Split by what each one owns rather than by size: the card, the milestones
 * panel, the header and summary row, the dialogs, and the arithmetic all of
 * them read the same answers from.
 */
export { GoalCard, isSelfTracking } from './GoalCard';
export type { GoalCardProps } from './GoalCard';
export { ConfirmModal, GoalModal } from './GoalModal';
export type { ConfirmModalProps, GoalModalProps } from './GoalModal';
export { GoalsHeader, GoalsSummaryRow } from './GoalsSummary';
export type { GoalsSummaryProps } from './GoalsSummary';
export { GoalLadder, RUNGS } from './GoalLadder';
export type { GoalLadderProps } from './GoalLadder';
export { GoalsSidebar, RAIL_GOALS } from './GoalsSidebar';
export type { GoalsSidebarProps } from './GoalsSidebar';
export { MilestoneCalendar, milestoneDays } from './MilestoneCalendar';
export type { MilestoneCalendarProps, MilestoneDay } from './MilestoneCalendar';
export { GoalNotes, noteFor } from './GoalNotes';
export type { GoalNotesProps } from './GoalNotes';
export {
  GoalsGreeting,
  GrowthAreas,
  MOMENTUM_DAYS,
  MOVES,
  Momentum,
  NextMoves,
  goalOf,
  growthAreas,
  momentum,
  nextMoves,
} from './NextMoves';
export type { Area, MomentumReading, Move } from './NextMoves';
export { Trajectory, reading } from './Trajectory';
export { GoalTable, GoalTabs, HealthBreakdown, TABS } from './GoalTable';
export type { GoalTableProps, TabId } from './GoalTable';
export { GoalStats } from './GoalStats';
export type { GoalStatsProps } from './GoalStats';
export { MilestonesPanel } from './MilestonesPanel';
export type { MilestonesPanelProps } from './MilestonesPanel';
export {
  Band,
  CATEGORIES,
  GoalInsights,
  GoalTile,
  GoalTimeline,
  GoalsCta,
  HealthChip,
  HealthRing,
  MilestoneTrack,
  NextMilestones,
  OutcomeCard,
  OverviewStrip,
  ProgressBar,
  RecentlyCompleted,
  Ring,
  VisionLine,
  categoryOf,
} from './Outcome';
export { GoalDetail } from './GoalDetail';
export type { GoalDetailProps } from './GoalDetail';
export { NewGoalWizard } from './NewGoalWizard';
export type { NewGoalWizardProps } from './NewGoalWizard';
export {
  DEFAULT_GOAL_WEIGHT,
  MAX_TIMEOUT,
  fmtGoalNumber,
  fmtGoalValue,
  formatGoalDate,
  goalNumbers,
  goalProgressPct,
  goalWeight,
  isOverdue,
  measureOf,
  msUntilNextDeadline,
  overallProgress,
} from './numbers';
export type { GoalNumbers } from './numbers';
