/**
 * The goals page's parts.
 *
 * Split by what each one owns rather than by size: the card, the milestones
 * panel, the header and summary row, the dialogs, and the arithmetic all of
 * them read the same answers from.
 */
export { ConfirmModal, GoalModal } from './GoalModal';
export type { ConfirmModalProps, GoalModalProps } from './GoalModal';
export { MilestoneCalendar, milestoneDays } from './MilestoneCalendar';
export type { MilestoneCalendarProps, MilestoneDay } from './MilestoneCalendar';
export { Trajectory, reading } from './Trajectory';
export { GoalTable, GoalTabs, HealthBreakdown, TABS } from './GoalTable';
export type { GoalTableProps, TabId } from './GoalTable';
export { GoalStats } from './GoalStats';
export type { GoalStatsProps } from './GoalStats';
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
  OverviewStrip,
  ProgressBar,
  RecentlyCompleted,
  Ring,
  VisionLine,
  categoryOf,
} from './Outcome';
export { GoalDetail } from './GoalDetail';
export type { GoalDetailProps } from './GoalDetail';
export { MilestoneChecklist } from './MilestoneChecklist';
export type { MilestoneChecklistProps } from './MilestoneChecklist';
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
} from './numbers';
export type { GoalNumbers } from './numbers';
export { ActiveGoalCard } from './ActiveGoalCard';
export type { ActiveGoalCardProps } from './ActiveGoalCard';
export { SystemGoals } from './SystemGoals';
export type { SystemGoalsProps } from './SystemGoals';
export { GoalVisual } from './GoalVisual';
export type { GoalVisualProps } from './GoalVisual';
export {
  GoalsGreeting,
  GrowthAreas,
  MOMENTUM_DAYS,
  Momentum,
  goalOf,
  growthAreas,
  momentum,
} from './NextMoves';
export type { Area, MomentumReading, Move } from './NextMoves';
