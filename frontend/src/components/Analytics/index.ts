/**
 * The analytics page's parts — the graded report card.
 *
 * Split along what each piece owns: the card and its table on the left, the
 * scoring prose on the right, and the reading of the backend's numbers in
 * metrics.ts, which both the row and the card go through.
 *
 * This is the half of the old growth page that did not move to /growth; the
 * charts and their drawing are in components/Growth and utils/growthChart.ts.
 */
export { GradeCard } from './GradeCard';
export type { GradeCardProps } from './GradeCard';
export { MetricRow } from './MetricRow';
export type { MetricRowProps } from './MetricRow';
export { ScoringDetails } from './ScoringDetails';
export { gradeClass, metricLines } from './metrics';
export type { MetricLine } from './metrics';
