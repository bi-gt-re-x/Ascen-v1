/**
 * Records — achievement, against the reader's own best and their goals.
 *
 * The growth page's Benchmarks chapter, unchanged. It waits on the goals call
 * rather than claiming there are none, which is why `goalsLoading` is passed
 * through rather than collapsed into an empty array.
 */
import { BenchmarksChapter } from '@/components/Growth';
import type { AnalyticsData } from '../useAnalyticsData';
import type { AnalyticsModel } from '../useAnalyticsModel';

export function RecordsTab({ model, data }: { model: AnalyticsModel } & { data: AnalyticsData }) {
  const { all, streak, tasks } = model;
  const { goals } = data;

  return (
    <>
      <div className="ax-section gr-scope">
        <BenchmarksChapter
          all={all}
          tasks={tasks}
          goals={goals.data?.goals ?? []}
          goalsLoading={goals.loading}
          streak={streak}
        />
      </div>
    </>
  );
}
