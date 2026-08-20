/**
 * Search, category, difficulty and status — one row, and it stays one row.
 *
 * The brief's own condition on this control is "do not let filters dominate the
 * UI", so the four live at the weight of a form field rather than a panel: no
 * headings, no card, no counts beside every option in the row itself. The
 * status filter is the only one drawn as chips, because it is the one somebody
 * flicks between while looking at the canvas rather than sets once.
 *
 * Everything offered is read off the graph that was passed in — categories are
 * whatever the nodes carry — so a feed with three categories draws three and a
 * feed with forty draws forty, and neither needs this file to know about it.
 */
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  STATUS_LABEL,
  filterActive,
  graphCategories,
  type Difficulty,
  type GraphFilter,
  type NodeStatus,
  type SkillGraph,
} from '@/utils/skillGraph';

const STATUSES: NodeStatus[] = ['available', 'progress', 'complete', 'locked'];

export interface SkillTreeToolbarProps {
  /** The unfiltered graph — what the options are built from. */
  graph: SkillGraph;
  filter: GraphFilter;
  onChange: (next: GraphFilter) => void;
  /** How many nodes survive, for the line beside the clear button. */
  shown: number;
}

export function SkillTreeToolbar({ graph, filter, onChange, shown }: SkillTreeToolbarProps) {
  const categories = graphCategories(graph);
  const set = (patch: Partial<GraphFilter>) => onChange({ ...filter, ...patch });

  const toggleStatus = (status: NodeStatus) =>
    set({
      statuses: filter.statuses.includes(status)
        ? filter.statuses.filter((entry) => entry !== status)
        : [...filter.statuses, status],
    });

  return (
    <div className="stx-toolbar">
      <label className="stx-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <span className="stx-sr">Search skills</span>
        <input
          type="search"
          placeholder="Search skills"
          value={filter.query}
          onChange={(event) => set({ query: event.target.value })}
        />
      </label>

      {categories.length > 1 && (
        <label className="stx-field">
          <span className="stx-sr">Category</span>
          <select value={filter.category} onChange={(event) => set({ category: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name} ({entry.count})
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="stx-field">
        <span className="stx-sr">Difficulty</span>
        <select
          value={filter.difficulty ?? ''}
          onChange={(event) =>
            set({ difficulty: (event.target.value || null) as Difficulty | null })
          }
        >
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((tier) => (
            <option key={tier} value={tier}>
              {DIFFICULTY_LABEL[tier]}
            </option>
          ))}
        </select>
      </label>

      <div className="stx-chips" role="group" aria-label="Status">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`stx-chip is-${status}${filter.statuses.includes(status) ? ' is-on' : ''}`}
            aria-pressed={filter.statuses.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {filterActive(filter) && (
        <span className="stx-cleared">
          <b>{shown}</b> of {graph.nodes.length}
          <button type="button" className="stx-clear" onClick={() => onChange({ query: '', category: '', difficulty: null, statuses: [] })}>
            Clear
          </button>
        </span>
      )}
    </div>
  );
}
