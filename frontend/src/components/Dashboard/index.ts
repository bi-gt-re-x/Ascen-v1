/**
 * The dashboard's parts.
 *
 * Four stat cards across the top, the Tasks panel and the Focus panel beneath
 * them, three summary cards along the bottom, and the two overlays — the Add
 * Task dialog and the level-up celebration. What every one of them is counted
 * from lives in `summary.ts`, which is imported from its own path because it
 * exports functions rather than components.
 */
export { FocusCard, StreakCard, TodayCard, XpCard } from './StatCards';
export { DailyQuote } from './DailyQuote';
export { FocusPanel } from './FocusPanel';
export type { FocusPanelProps } from './FocusPanel';
export { RecentActivity, TopPriorities, WeeklyOverview } from './InsightCards';
export { LevelUp } from './LevelUp';
export type { LevelUpProps } from './LevelUp';
export { TaskModal } from './TaskModal';
export type { TaskModalProps } from './TaskModal';
export { TaskPanel } from './TaskPanel';
export type { TaskPanelProps, TaskTab } from './TaskPanel';
export { TaskRow } from './TaskRow';
export type { TaskRowProps } from './TaskRow';
