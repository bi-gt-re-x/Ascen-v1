/**
 * The growth page's parts.
 *
 * GrowthChart is the canvas; the drawing it does lives in
 * utils/growthChart.ts, which knows nothing about React. MetricCard belongs to
 * the graded report card, which is /analytics — the two halves of the original
 * growth.js, split the way the pages were.
 */
export { GrowthChart } from './GrowthChart';
export type { GrowthChartProps } from './GrowthChart';
export { MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';
