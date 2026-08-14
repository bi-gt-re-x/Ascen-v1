/**
 * The tasks page's parts.
 *
 * `board.ts` is every decision the page makes about what to show and in what
 * order, and nothing that draws. The components draw it and hold no arithmetic
 * — which is why the ordering rules, the buckets, the reconstructed trends and
 * the streak arithmetic can all be read in one file rather than found across
 * five render functions.
 */
export { Composer } from './Composer';
export type { ComposerProps } from './Composer';
export { TaskRow } from './TaskRow';
export type { TaskRowProps } from './TaskRow';
export { StatCards } from './Stats';
export type { StatCardsProps } from './Stats';
export { Sidebar } from './Sidebar';
export type { SidebarProps } from './Sidebar';
export { BulkBar, Toolbar } from './Toolbar';
export type { BulkBarProps, ToolbarProps } from './Toolbar';
export {
  BUCKETS,
  HORIZON_DAYS,
  EMPTY_QUERY,
  PRIORITIES,
  SORTS,
  TREND_DAYS,
  beyondHorizon,
  bucketOf,
  plannedSeconds,
  dueLabel,
  dueLine,
  filterTasks,
  groupTasks,
  isFiltered,
  sortTasks,
  spellDuration,
  statSeries,
  streaks,
  taskCounts,
  timeLabel,
  trendPct,
  upcoming,
} from './board';
export type {
  Bucket,
  SortKey,
  StatSeries,
  StatusFilter,
  Streak,
  TaskCounts,
  TaskGroup,
  TaskQuery,
} from './board';
