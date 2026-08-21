/**
 * Badges earned for milestones.
 *
 * Backend: backend/api/achievements.py, over the tables in
 * data/sql/achievements.sql.
 *
 * One call. Every badge comes back on every read, earned or not — a wall with
 * the locked ones missing would not be a wall, and the whole point of the
 * locked ones is that they say what is next.
 *
 * `value` arrives already capped at `threshold`, so a progress bar is
 * `value / threshold` and never overflows on an account that is far past it.
 */
import { get } from './api';
import type { ApiResult } from '@/types';

export type Metric = 'tasks' | 'xp' | 'streak' | 'level' | 'focus' | 'goals';

export interface Badge {
  id: string;
  name: string;
  description: string;
  metric: Metric;
  /** What `value` counts — "tasks", "XP", "days". */
  unit: string;
  threshold: number;
  /** Progress toward the threshold, capped at it. */
  value: number;
  earned: boolean;
  /** ISO timestamp of the first read that saw it earned, or null. */
  earned_at: string | null;
  /** 1 to 4, roughly a week of use to a year of it. The wall's rows. */
  tier: number;
}

export interface AchievementsResult {
  achievements: Badge[];
  earned: number;
  total: number;
  /** The account's current value for each metric, uncapped. */
  figures: Record<Metric, number>;
}

export function getAchievements(username: string): Promise<ApiResult<AchievementsResult>> {
  return get<AchievementsResult>('/api/achievements', { username });
}
