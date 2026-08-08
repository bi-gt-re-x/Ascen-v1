/**
 * The growth page's parts.
 *
 * GrowthChart is the canvas; the drawing it does lives in
 * utils/growthChart.ts, which knows nothing about React. Everything around it
 * — the range picker, the summary tiles, the category donut, the heatmap, the
 * milestones, the activity list and the insights — is in GrowthPanels, and
 * reads figures worked out by utils/growthSummary.
 *
 * The graded report card is not here. It is /analytics — the other half of the
 * original growth.js — and its parts are in components/Analytics.
 */
export { GrowthChart } from './GrowthChart';
export type { GrowthChartProps } from './GrowthChart';
export {
  CategoryDonut,
  GrowthSummary,
  Insights,
  Milestones,
  RangePicker,
  RecentXpActivity,
  XpHeatmap,
} from './GrowthPanels';
export type {
  ActivityEntry,
  CategoryDonutProps,
  GrowthSummaryProps,
  InsightsProps,
  MilestonesProps,
  RangePickerProps,
  RecentXpActivityProps,
  XpHeatmapProps,
} from './GrowthPanels';
