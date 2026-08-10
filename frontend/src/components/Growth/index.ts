/**
 * The growth page's parts.
 *
 * GrowthChart is the canvas; the drawing it does lives in
 * utils/growthChart.ts, which knows nothing about React. The three small
 * static shapes — the tile sparklines, the trend curve, the long-term lines —
 * are SVG instead, and live in MiniChart; see the note there for why the page
 * uses both. The Overview's panels are in GrowthPanels, and read figures worked
 * out by utils/growthSummary.
 *
 * The four chapters that are not Overview have a file each — they are pages
 * rather than panels — and share their furniture through ChapterParts: one hero
 * row, one tile grid, one bar row, one insight list, so the five tabs read as
 * one system. Their arithmetic is in utils/growthFocus, growthSkills,
 * growthBench and growthChapters.
 *
 * The graded report card is not here. It is /analytics — the other half of the
 * original growth.js — and its parts are in components/Analytics.
 */
export { GrowthChart } from './GrowthChart';
export type { GrowthChartProps } from './GrowthChart';
export { LongTermChapter } from './Chapters';
export type { LongTermChapterProps } from './Chapters';
export { FocusChapter } from './FocusChapter';
export type { FocusChapterProps } from './FocusChapter';
export { SkillsChapter } from './SkillsChapter';
export type { SkillsChapterProps } from './SkillsChapter';
export { BenchmarksChapter } from './BenchmarksChapter';
export type { BenchmarksChapterProps } from './BenchmarksChapter';
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
