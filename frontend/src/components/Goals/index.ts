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
export { MilestonesPanel } from './MilestonesPanel';
export type { MilestonesPanelProps } from './MilestonesPanel';
export {
  Band,
  CATEGORIES,
  GoalInsights,
  GoalTimeline,
  HealthChip,
  MilestoneTrack,
  OutcomeCard,
  OverviewStrip,
  ProgressBar,
  RecentlyCompleted,
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
