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
  DEFAULT_GOAL_WEIGHT,
  MAX_TIMEOUT,
  fmtGoalValue,
  formatGoalDate,
  goalNumbers,
  goalProgressPct,
  goalWeight,
  isOverdue,
  msUntilNextDeadline,
  overallProgress,
} from './numbers';
export type { GoalNumbers } from './numbers';
