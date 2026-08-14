/**
 * The controls: a search, three menus, and two rows of chips.
 *
 * The split between the menus and the chips is the split between *rare* and
 * *constant*. Priority and subject are the two cuts a reader makes over and
 * over while working through a list, so they are chips — always visible, one
 * click, and the current state readable without opening anything. Status,
 * grouping and ordering are set once and left, so they are menus, where they
 * cost a click to reach and nothing to ignore.
 *
 * Every menu closes on Escape and on a click outside it, which is the whole of
 * `useDismiss`. Only one may be open at a time — they sit side by side and two
 * open panels would overlap each other.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Subject } from '@/services/subjects';
import type { SortKey, StatusFilter, TaskQuery } from './board';
import { PRIORITIES, SORTS, isFiltered } from './board';

/** Subject chips shown before the rest go behind "+ More". */
const CHIPS = 7;

const STATUSES: Array<{ key: StatusFilter; label: string }> = [
  { key: 'open', label: 'Open tasks' },
  { key: 'done', label: 'Completed' },
  { key: 'all', label: 'Everything' },
];

function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return ref;
}

function Menu({
  name,
  label,
  icon,
  open,
  onOpen,
  children,
  on,
}: {
  name: string;
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onOpen: (name: string | null) => void;
  children: React.ReactNode;
  /** Whether this menu is holding a non-default setting. */
  on?: boolean;
}) {
  const close = useCallback(() => onOpen(null), [onOpen]);
  const ref = useDismiss(close);

  return (
    <div className="tk-menu" ref={ref}>
      <button
        type="button"
        className={`tk-tool${open ? ' is-open' : ''}${on ? ' is-on' : ''}`}
        aria-expanded={open}
        onClick={() => onOpen(open ? null : name)}
      >
        {icon}
        {label}
      </button>
      {open && <div className="tk-menu-panel">{children}</div>}
    </div>
  );
}

const ICON = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M7 12h10M10 18h4" />
    </svg>
  ),
  group: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="2.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  sort: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
      <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
    </svg>
  ),
};

const PRIORITY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 4l9 16H3z" />
  </svg>
);

export interface ToolbarProps {
  query: TaskQuery;
  onQuery: (next: TaskQuery) => void;
  /** Only the subjects this account actually files things under. */
  subjects: Subject[];
  showing: number;
  total: number;
  /** Whether the reader has asked for headings by due date. */
  grouped: boolean;
  onGrouped: (on: boolean) => void;
}

export function Toolbar({
  query,
  onQuery,
  subjects,
  showing,
  total,
  grouped,
  onGrouped,
}: ToolbarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K puts the cursor in the search, which is the shortcut the
  // placeholder advertises. Advertising one and not binding it is worse than
  // not advertising it.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        box.current?.focus();
        box.current?.select();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  const set = useCallback(
    (patch: Partial<TaskQuery>) => onQuery({ ...query, ...patch }),
    [onQuery, query],
  );

  const togglePriority = (priority: (typeof PRIORITIES)[number] | null) => {
    if (priority === null) return set({ priorities: [] });
    return set({ priorities: query.priorities.includes(priority) ? [] : [priority] });
  };

  const toggleSubject = (id: string) => {
    const on = query.subjects.includes(id);
    set({ subjects: on ? query.subjects.filter((entry) => entry !== id) : [...query.subjects, id] });
  };

  const shown = more ? subjects : subjects.slice(0, CHIPS);
  const sort = SORTS.find((entry) => entry.key === query.sort);

  return (
    <div className="tk-toolbar">
      <div className="tk-toolbar-top">
        <label className="tk-search">
          <span className="tk-search-ico" aria-hidden="true">
            {ICON.search}
          </span>
          <input
            ref={box}
            type="search"
            value={query.search}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            onChange={(event) => set({ search: event.target.value })}
          />
          <kbd aria-hidden="true">⌘K</kbd>
        </label>

        <div className="tk-tools">
          <Menu
            name="filter"
            label="Filter"
            icon={ICON.filter}
            open={open === 'filter'}
            onOpen={setOpen}
            on={isFiltered(query)}
          >
            <p className="tk-menu-head">Reach</p>
            <button
              type="button"
              className={`tk-menu-item${query.horizon === 'week' ? ' is-on' : ''}`}
              onClick={() => set({ horizon: 'week' })}
            >
              The next 7 days
            </button>
            <button
              type="button"
              className={`tk-menu-item${query.horizon === 'all' ? ' is-on' : ''}`}
              onClick={() => set({ horizon: 'all' })}
            >
              Everything dated
            </button>
            <p className="tk-menu-head">Show</p>
            {STATUSES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`tk-menu-item${query.status === entry.key ? ' is-on' : ''}`}
                onClick={() => set({ status: entry.key })}
              >
                {entry.label}
              </button>
            ))}
            {isFiltered(query) && (
              <button
                type="button"
                className="tk-menu-clear"
                onClick={() =>
                  set({ status: 'open', search: '', subjects: [], priorities: [], horizon: 'week' })
                }
              >
                Clear every filter
              </button>
            )}
          </Menu>

          <Menu
            name="group"
            label="Group"
            icon={ICON.group}
            open={open === 'group'}
            onOpen={setOpen}
            on={!grouped}
          >
            <p className="tk-menu-head">Headings</p>
            <button
              type="button"
              className={`tk-menu-item${grouped ? ' is-on' : ''}`}
              onClick={() => onGrouped(true)}
            >
              By due date
            </button>
            <button
              type="button"
              className={`tk-menu-item${grouped ? '' : ' is-on'}`}
              onClick={() => onGrouped(false)}
            >
              One flat list
            </button>
          </Menu>

          <Menu
            name="sort"
            label="Sort"
            icon={ICON.sort}
            open={open === 'sort'}
            onOpen={setOpen}
            on={query.sort !== 'due' || query.descending}
          >
            <p className="tk-menu-head">Order by</p>
            {SORTS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`tk-menu-item${query.sort === entry.key ? ' is-on' : ''}`}
                onClick={() => set({ sort: entry.key as SortKey })}
              >
                {entry.label}
              </button>
            ))}
            {sort && (
              <button
                type="button"
                className="tk-menu-clear"
                onClick={() => set({ descending: !query.descending })}
              >
                {query.descending ? sort.desc : sort.asc}
              </button>
            )}
          </Menu>
        </div>
      </div>

      <div className="tk-chips">
        <div className="tk-chip-set">
          <button
            type="button"
            className={`tk-chip${query.priorities.length === 0 ? ' is-on' : ''}`}
            onClick={() => togglePriority(null)}
          >
            <span className="tk-chip-ico is-all" aria-hidden="true">
              {PRIORITY_ICON}
            </span>
            All
          </button>
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              className={`tk-chip${query.priorities.includes(priority) ? ' is-on' : ''}`}
              onClick={() => togglePriority(priority)}
            >
              <span className={`tk-chip-ico is-${priority}`} aria-hidden="true">
                {PRIORITY_ICON}
              </span>
              {priority[0]!.toUpperCase() + priority.slice(1)}
            </button>
          ))}
        </div>

        {subjects.length > 0 && (
          <div className="tk-chip-set tk-chip-subjects">
            {shown.map((subject) => (
              <button
                key={subject.id}
                type="button"
                className={`tk-chip${query.subjects.includes(subject.id) ? ' is-on' : ''}`}
                onClick={() => toggleSubject(subject.id)}
              >
                {subject.label}
              </button>
            ))}
            {subjects.length > CHIPS && (
              <button type="button" className="tk-chip is-more" onClick={() => setMore(!more)}>
                {more ? 'Less' : `+ ${subjects.length - CHIPS} More`}
              </button>
            )}
          </div>
        )}
      </div>

      {showing !== total && (
        <p className="tk-showing">
          Showing {showing.toLocaleString()} of {total.toLocaleString()}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// The bar that appears when rows are selected
// --------------------------------------------------------------------------
export interface BulkBarProps {
  count: number;
  busy: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkBar({ count, busy, onComplete, onDelete, onClear }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="tk-bulk" role="status">
      <strong>
        {count} selected
      </strong>
      <button type="button" className="tk-bulk-do" disabled={busy} onClick={onComplete}>
        Complete
      </button>
      <button type="button" className="tk-bulk-do is-bad" disabled={busy} onClick={onDelete}>
        Delete
      </button>
      <button type="button" className="tk-bulk-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
