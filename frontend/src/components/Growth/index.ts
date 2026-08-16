/**
 * The four chapters that were the growth page.
 *
 * There is no growth page any more. It carried five tabs: an Overview built
 * from the panels in GrowthPanels, and four chapters. The Overview answered
 * "how am I doing" with a chart, a donut, a heatmap and a milestone list —
 * every one of which the analytics page already answered at higher resolution
 * on a tab built for it — so it went, and its panels went with it. The four
 * chapters are the part that was doing real work, and they are tabs of
 * /analytics now: Long Term under Trends, Focus under Habits, and Subjects and
 * Records as tabs of their own.
 *
 * They kept their shape on the way across. Each is handed the day series, the
 * tasks, the subject index and the streak — all of which the analytics page has
 * for its own panels — and none of them fetches. Their arithmetic is in
 * utils/growthFocus, growthSkills, growthBench and growthChapters, and they
 * share their furniture through ChapterParts so the four read as one system.
 *
 * `GrowthChart` is the canvas the Overview's chart panel drew into, and its
 * drawing lives in utils/growthChart.ts, which knows nothing about React. It is
 * still exported and nothing mounts it — kept because it is the only renderer
 * for the five XP and focus series, and the analytics page's own trajectory
 * chart is a different chart rather than a replacement for it.
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
/** What the chapters share — see the note at the top of GrowthPanels. */
export { CountValue, Glyph, Hint } from './GrowthPanels';
