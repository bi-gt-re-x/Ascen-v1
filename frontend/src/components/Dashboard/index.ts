/**
 * The dashboard's parts.
 *
 * Four stat cards across the top, the Tasks panel and the Focus panel beneath
 * them, three summary cards along the bottom, and the three overlays — the Add
 * Task dialog, the level-up celebration and the one for reaching a daily goal.
 * What every one of them is counted from lives in `summary.ts`, which is
 * imported from its own path because it exports functions rather than
 * components.
 */
export { FocusCard, StreakCard, TodayCard, XpCard } from './StatCards';
export { DailyQuote } from './DailyQuote';
export { FocusPanel } from './FocusPanel';
export type { FocusPanelProps } from './FocusPanel';
export { RecentActivity, TopPriorities, WeeklyOverview } from './InsightCards';
export { GoalReached, useCrossing } from './GoalReached';
export type { GoalKind, GoalNews, GoalReachedProps } from './GoalReached';
export { LevelUp } from './LevelUp';
export type { LevelUpProps } from './LevelUp';
export { TaskModal } from './TaskModal';
export type { TaskModalProps } from './TaskModal';
export { TaskPanel } from './TaskPanel';
export type { TaskPanelProps, TaskTab } from './TaskPanel';
export { TaskRow } from './TaskRow';
export type { TaskRowProps } from './TaskRow';
