/**
 * The controls above the list, and the figures above those.
 *
 * Every control writes one field of the `TaskQuery` the page holds. None of
 * them holds state of its own, so there is exactly one description of what the
 * reader is looking at and the page can put it in a URL, keep it across a
 * refresh, or reset it in one assignment when that day comes.
 *
 * The counts are counted off the whole list, never the filtered one — see
 * `taskCounts`. A summary that moved when a filter was typed into would be
 * measuring the filter rather than the account.
 */
import { useCountUp } from '@/hooks';
import { PRIORITIES, SORTS, isFiltered, type TaskCounts, type TaskQuery } from './board';
import type { Subject } from '@/services/subjects';

export interface SummaryProps {
  counts: TaskCounts;
}

export function TaskSummary({ counts }: SummaryProps) {
  // Counted to rather than replaced, the same way every other figure in the
  // app moves — see hooks/useCountUp.
  const open = Math.round(useCountUp(counts.open));
  const overdue = Math.round(useCountUp(counts.overdue));
  const today = Math.round(useCountUp(counts.today));
  const openXp = Math.round(useCountUp(counts.openXp));

  const tiles = [
    { key: 'open', value: open, label: 'Open', foot: `${counts.done} finished so far` },
    {
      key: 'today',
      value: today,
      label: 'Due today',
      foot: counts.todayXp > 0 ? `${counts.todayXp} XP earned today` : 'nothing banked yet today',
    },
    {
      key: 'overdue',
      value: overdue,
      label: 'Overdue',
      foot: overdue === 0 ? 'nothing is late' : 'oldest first below',
    },
    { key: 'xp', value: openXp, label: 'XP on the table', foot: 'if you finished all of it' },
  ];

  return (
    <div className="tk-summary">
      {tiles.map((tile) => (
        <article className={`tk-stat is-${tile.key}`} key={tile.key}>
          <strong>{tile.value.toLocaleString()}</strong>
          <span className="tk-stat-label">{tile.label}</span>
          <span className="tk-quiet">{tile.foot}</span>
        </article>
      ))}
    </div>
  );
}

export interface ToolbarProps {
  query: TaskQuery;
  onQuery: (next: TaskQuery) => void;
  /** The subjects actually used by this account's tasks, for the facet. */
  subjects: Subject[];
  /** How many rows survive the current query, for the "showing N" line. */
  showing: number;
  total: number;
}

export function Toolbar({ query, onQuery, subjects, showing, total }: ToolbarProps) {
  const set = <K extends keyof TaskQuery>(key: K, value: TaskQuery[K]) =>
    onQuery({ ...query, [key]: value });

  /** Facets toggle: in the list means "keep only these", out means "all". */
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  return (
    <div className="tk-tools">
      <div className="tk-tools-row">
        <label className="tk-search">
          <span className="tk-sr">Search tasks</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search by name"
            value={query.search}
            onChange={(event) => set('search', event.target.value)}
          />
        </label>

        <div className="tk-segment" role="group" aria-label="Which tasks">
          {(['open', 'done', 'all'] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`tk-seg${query.status === status ? ' is-on' : ''}`}
              aria-pressed={query.status === status}
              onClick={() => set('status', status)}
            >
              {status === 'open' ? 'Open' : status === 'done' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>

        <label className="tk-select-wrap">
          <span className="tk-sr">Sort by</span>
          <select
            className="tk-select"
            value={query.sort}
            onChange={(event) => set('sort', event.target.value as TaskQuery['sort'])}
          >
            {SORTS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                Sort: {entry.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="tk-btn tk-dir"
          aria-label={query.descending ? 'Sort ascending' : 'Sort descending'}
          title={query.descending ? 'Descending' : 'Ascending'}
          onClick={() => set('descending', !query.descending)}
        >
          {query.descending ? '↓' : '↑'}
        </button>
      </div>

      <div className="tk-tools-row tk-facets">
        {PRIORITIES.map((priority) => (
          <button
            key={priority}
            type="button"
            className={`tk-chip pri-${priority}${query.priorities.includes(priority) ? ' is-on' : ''}`}
            aria-pressed={query.priorities.includes(priority)}
            onClick={() => set('priorities', toggle(query.priorities, priority))}
          >
            {priority}
          </button>
        ))}

        {subjects.length > 0 && <span className="tk-facet-rule" aria-hidden="true" />}

        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            className={`tk-chip${query.subjects.includes(subject.id) ? ' is-on' : ''}`}
            aria-pressed={query.subjects.includes(subject.id)}
            onClick={() => set('subjects', toggle(query.subjects, subject.id))}
          >
            {subject.label || subject.name}
          </button>
        ))}

        <span className="tk-showing tk-quiet">
          {showing === total ? `${total} tasks` : `${showing} of ${total}`}
        </span>

        {isFiltered(query) && (
          <button type="button" className="tk-btn is-quiet" onClick={() => onQuery({ ...query, status: 'open', search: '', subjects: [], priorities: [] })}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

export interface BulkBarProps {
  count: number;
  busy: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * What is possible once rows are selected.
 *
 * Only appears when something is picked. A bar of disabled buttons sitting over
 * every list is a permanent reminder of what the reader is not doing.
 */
export function BulkBar({ count, busy, onComplete, onDelete, onClear }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="tk-bulk" role="status">
      <strong>
        {count} selected
      </strong>
      <button type="button" className="tk-btn is-primary" disabled={busy} onClick={onComplete}>
        Complete
      </button>
      <button type="button" className="tk-btn is-danger" disabled={busy} onClick={onDelete}>
        Delete
      </button>
      <button type="button" className="tk-btn is-quiet" disabled={busy} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
