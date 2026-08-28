/**
 * The three cards along the bottom: the week, what to do next, what was done.
 *
 * Each one is a summary with a way out of it — the card answers the question at
 * a glance and the link at its foot goes to the page that answers it properly.
 *
 * Two of the three now arrive somewhere finished: /analytics and /tasks. This
 * note used to name /tasks as unbuilt and it has been pages/Tasks.tsx for a
 * while — the link needed no rewiring when that happened, which is the whole
 * argument for pointing at the real path from the start.
 *
 * /history is still routed-but-unbuilt and the link points at it anyway, for
 * the same reason. That is not the dead end components/Analytics/charts.tsx
 * argues against: those eleven footers had no handler and no href and went
 * nowhere at all, whereas this one lands on pages/Unbuilt, which says what the
 * page will be and which files it will be built from.
 */
import { Link } from 'react-router-dom';
import { priorityMeta } from './summary';
import { useCountUp } from '@/hooks';
import { format } from '@/utils';
import type { Activity, WeekSummary } from './summary';
import type { Task } from '@/types';

// --------------------------------------------------------------------------
// Weekly Overview
// --------------------------------------------------------------------------
/**
 * The week's four numbers, in a two-by-two block.
 *
 * These are the figures the mock-up this page was built from showed under
 * *Today's Progress* as well — they are the week's, and they are shown once,
 * here.
 *
 * Completed and XP Earned are what was finished between Monday and Sunday,
 * whatever week the task was scheduled for; see `weekSummary` for why that is
 * the only reading of those two labels that is true.
 */
export function WeeklyOverview({ week }: { week: WeekSummary }) {
  // Counted up on arrival and travelled between values after, like the stat row
  // above — completing one task moves all four of these at once, and four
  // figures that jump together are four figures nobody watches. One hook call
  // per cell rather than a loop, because hooks cannot be called from one.
  const total = useCountUp(week.total);
  const done = useCountUp(week.done);
  const rate = useCountUp(week.rate);
  const xp = useCountUp(week.xp);

  const figures = [
    { value: format.number(total), label: 'Total Tasks' },
    { value: format.number(done), label: 'Completed' },
    { value: `${Math.round(rate)}%`, label: 'Completion Rate' },
    { value: format.number(xp), label: 'XP Earned' },
  ];

  return (
    <section className="card dash-panel dash-insight">
      <h2 className="dash-panel-title dash-insight-title">
        <span className="dash-stat-ico dash-ico-week" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </span>
        Weekly Overview
      </h2>

      <dl className="dash-week-grid">
        {figures.map(({ value, label }) => (
          <div className="dash-week-cell" key={label}>
            <dd>{value}</dd>
            <dt>{label}</dt>
          </div>
        ))}
      </dl>

      <Link className="dash-panel-link" to="/analytics">
        View full analytics<span aria-hidden="true"> →</span>
      </Link>
    </section>
  );
}

// --------------------------------------------------------------------------
// Top Priorities
// --------------------------------------------------------------------------
export function TopPriorities({ tasks }: { tasks: Task[] }) {
  return (
    <section className="card dash-panel dash-insight">
      <h2 className="dash-panel-title dash-insight-title">
        <span className="dash-stat-ico dash-ico-flag" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21V4h9l1 2h6v9h-7l-1-2H4" />
          </svg>
        </span>
        Top Priorities
      </h2>

      {tasks.length === 0 ? (
        <p className="dash-task-empty">Nothing outstanding today.</p>
      ) : (
        <ol className="dash-priority-list">
          {tasks.map((task, index) => {
            const priority = priorityMeta(task.priority);
            return (
              <li key={task.id}>
                <span className="dash-priority-rank">{index + 1}.</span>
                <span className="dash-priority-name">{task.title || 'Untitled'}</span>
                <span className={`dash-badge tone-${priority.tone}`}>{priority.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <Link className="dash-panel-link" to="/tasks">
        Edit priorities<span aria-hidden="true"> →</span>
      </Link>
    </section>
  );
}

// --------------------------------------------------------------------------
// Recent Activity
// --------------------------------------------------------------------------
export function RecentActivity({ entries }: { entries: Activity[] }) {
  return (
    <section className="card dash-panel dash-insight">
      <h2 className="dash-panel-title dash-insight-title">
        <span className="dash-stat-ico dash-ico-pulse" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h4l3 8 4-16 3 8h6" />
          </svg>
        </span>
        Recent Activity
      </h2>

      {entries.length === 0 ? (
        <p className="dash-task-empty">Nothing completed yet.</p>
      ) : (
        <ul className="dash-activity-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <svg className="dash-activity-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
              </svg>
              <span className="dash-activity-name">
                Completed <strong>&ldquo;{entry.title}&rdquo;</strong>
              </span>
              <span className="dash-activity-xp">+{format.number(entry.xp)} XP</span>
              <span className="dash-activity-at">
                {entry.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link className="dash-panel-link" to="/history">
        View all activity<span aria-hidden="true"> →</span>
      </Link>
    </section>
  );
}
