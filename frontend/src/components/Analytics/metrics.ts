/**
 * The report card's five metrics, as rows.
 *
 * Every number here is the backend's. `backend/tracking/analytics.py` scores
 * each metric 0-100 and turns that into a letter; this file only decides how
 * the measured value behind the score reads in the table's "Raw Data" column.
 * A second copy of the grade boundaries would drift from the first.
 *
 * The order is METRIC_NAMES', which is the order the backend, the snapshot
 * table and the original markup all use.
 */
import type { Grade, MetricName, Ratings } from '@/types';
import { format } from '@/utils';

/**
 * The grade's colour class.
 *
 * `.grade-S` … `.grade-F` each set `--grade-color`, which is what paints the
 * hero letter, the badges and the card's top rule; `.grade-none` is the grey
 * the original used before any data had arrived. See styles/growth.css.
 */
export function gradeClass(grade: Grade | null | undefined): string {
  return grade ? `grade-${grade}` : 'grade-none';
}

export interface MetricLine {
  name: MetricName;
  label: string;
  emoji: string;
  /** The measured value the score came from: "42 XP/day", "17/30 days". */
  raw: string;
  score: number;
  grade: Grade;
}

/** The five rows, in table order. */
export function metricLines(ratings: Ratings): MetricLine[] {
  const m = ratings.metrics;

  return [
    {
      name: 'productivity',
      label: 'Productivity',
      emoji: '🚀',
      raw: `${format.number(m.productivity.avg_daily_xp)} XP/day`,
      score: m.productivity.score,
      grade: m.productivity.grade,
    },
    {
      name: 'quality',
      label: 'Quality',
      emoji: '🎯',
      raw: `${format.number(m.quality.avg_task_xp)} XP/task`,
      score: m.quality.score,
      grade: m.quality.grade,
    },
    {
      name: 'consistency',
      label: 'Consistency',
      emoji: '🔥',
      raw: `${m.consistency.active_days}/${m.consistency.total_days} days`,
      score: m.consistency.score,
      grade: m.consistency.grade,
    },
    {
      name: 'efficiency',
      label: 'Efficiency',
      emoji: '⚡',
      raw: `${m.efficiency.on_time_pct}% on-time`,
      score: m.efficiency.score,
      grade: m.efficiency.grade,
    },
    {
      name: 'focus',
      label: 'Focus',
      emoji: '⏱️',
      raw: `${format.minutes(m.focus.focused_minutes)} / ${format.minutes(
        m.focus.goal_minutes,
      )} focused`,
      score: m.focus.score,
      grade: m.focus.grade,
    },
  ];
}
