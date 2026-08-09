/**
 * The growth page's parts.
 *
 * GrowthChart is the canvas; the drawing it does lives in
 * utils/growthChart.ts, which knows nothing about React. The three small
 * static shapes — the tile sparklines, the trend curve, the long-term lines —
 * are SVG instead, and live in MiniChart; see the note there for why the page
 * uses both. Everything else is in GrowthPanels, and reads figures worked out
 * by utils/growthSummary.
 *
 * The graded report card is not here. It is /analytics — the other half of the
 * original growth.js — and its parts are in components/Analytics.
 */
export { GrowthChart } from './GrowthChart';
export type { GrowthChartProps } from './GrowthChart';
export { LongTermChart, Sparkline, TrendChart } from './MiniChart';
export type {
  LongTermChartProps,
  SparklineProps,
  TrendChartProps,
} from './MiniChart';
export {
  CategoryDonut,
  ChartHead,
  ChartStrip,
  ExportReport,
  GrowthSummary,
  Insights,
  LongTerm,
  Milestones,
  RangePicker,
  SkillsProgress,
  XpHeatmap,
} from './GrowthPanels';
export type {
  CategoryDonutProps,
  ChartHeadProps,
  ChartStripProps,
  ExportReportProps,
  GrowthSummaryProps,
  InsightsProps,
  LongTermProps,
  MilestonesProps,
  RangePickerProps,
  SkillsProgressProps,
  XpHeatmapProps,
} from './GrowthPanels';
