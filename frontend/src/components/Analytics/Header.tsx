/**
 * The page's own chrome: its title row, its chapters, and its controls.
 *
 * **The chapters scroll rather than swap.** They look like tabs and behave like
 * a table of contents, because the page is one continuous argument — the tiles
 * state the figures, the trajectory shows the path, the breakdown says what it
 * was made of — and hiding four fifths of that behind a tab would make a reader
 * click through five screens to read one. Pressing one moves the page to that
 * section and the section under the reader lights up as they scroll past it,
 * so the control is honest in both directions.
 */
import { useEffect, useRef, useState } from 'react';
import { WINDOWS, type WindowKey } from './data';
import type { GrowthDay } from '@/types';

export interface Section {
  id: string;
  label: string;
}

/**
 * The page's blocks, **in the order they are laid out**.
 *
 * `useActiveSection` picks the first id in this list that has anything on
 * screen, so document order here is what makes the highlight land on the
 * section the reader is actually in front of. Reorder the page and this has to
 * move with it. It is deliberately separate from `TABS` below, which is in the
 * order the design draws the tab bar — the two are not the same order, and
 * conflating them is what put the highlight on the wrong tab before.
 */
export const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'trajectory', label: 'Trajectory' },
  { id: 'breakdown', label: 'Milestones' },
  { id: 'longterm', label: 'Long Term' },
  { id: 'standing', label: 'Benchmarks' },
];

/**
 * The tab bar, matching the design's labels and their order.
 *
 * A tab is a label and the block it scrolls to, and the two are separate
 * because the design's tab order is not the page's block order — it was drawn
 * as a set of view switchers, and this page is one scroll.
 *
 * **Goals Progress has no block of its own.** There is no goals panel on this
 * page, so it lands on Long Term, which is the closest thing to it — progress
 * against the period before. It is in the list because the design has it;
 * point it at a real panel the day one exists.
 */
export const TABS: Array<{ label: string; target: string }> = [
  { label: 'Overview', target: 'overview' },
  { label: 'Long Term', target: 'longterm' },
  { label: 'Milestones', target: 'breakdown' },
  { label: 'Goals Progress', target: 'longterm' },
  { label: 'Trajectory', target: 'trajectory' },
  { label: 'Benchmarks', target: 'standing' },
];

export interface HeaderProps {
  span: string;
  /** The days the window covers — what Export writes out. */
  rows: GrowthDay[];
}

/**
 * The title row, and the window as a file.
 *
 * Export is the same CSV the growth page offers (components/Growth's
 * `ExportReport`): exactly the rows the page is drawn from, built here rather
 * than asked of the server, because an export that re-fetched could hand back a
 * different window than the one on screen. The columns are the series' own
 * fields, unrounded — the panels round for display and a spreadsheet should not
 * inherit that.
 */
export function Header({ span, rows }: HeaderProps) {
  const save = () => {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]!) as Array<keyof GrowthDay>;
    const escape = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [
      columns.join(','),
      ...rows.map((row) => columns.map((column) => escape(row[column] ?? '')).join(',')),
    ].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ascen-analytics ${span.replace(/[^\w\s–-]/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="ax-head">
      <div>
        <h1>
          <span className="ax-head-icon" aria-hidden="true" />
          Advanced Analytics
        </h1>
        <p className="ax-muted">Track your long-term progress. Build compounding growth.</p>
      </div>
      <div className="ax-head-actions">
        <span className="ax-pill">
          <span className="ax-pill-icon" aria-hidden="true" />
          {span}
        </span>
        <button
          type="button"
          className="ax-btn"
          onClick={save}
          disabled={rows.length === 0}
          title="Download these days as a CSV"
        >
          <span className="ax-btn-icon" aria-hidden="true" />
          Export Report
        </button>
      </div>
    </header>
  );
}

// --------------------------------------------------------------------------
// Chapters
// --------------------------------------------------------------------------
export interface TabsProps {
  active: string;
  onJump: (id: string) => void;
}

export function Tabs({ active, onJump }: TabsProps) {
  // Two tabs can point at one block (see TABS), so the highlight goes to the
  // first tab that names the visible block rather than to every tab that does.
  const lit = TABS.findIndex((tab) => tab.target === active);

  return (
    <nav className="ax-tabs" aria-label="Sections">
      {TABS.map((tab, index) => (
        <button
          key={tab.label}
          type="button"
          className={`ax-tab${index === lit ? ' is-on' : ''}`}
          aria-current={index === lit ? 'true' : undefined}
          onClick={() => onJump(tab.target)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Which section the reader is currently in front of.
 *
 * An IntersectionObserver against the top third of the viewport rather than a
 * scroll handler doing arithmetic on every frame: the browser already knows
 * where these six elements are, and asking it is both cheaper and correct when
 * a panel changes height because a chart re-bucketed.
 */
export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '');
  // The list is a module constant, but taking it through a ref means the effect
  // does not re-subscribe if a caller ever passes a fresh array each render.
  const list = useRef(ids);
  list.current = ids;

  useEffect(() => {
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => seen.set(entry.target.id, entry.intersectionRatio));
        // The topmost section with anything on screen wins, so a tall panel
        // scrolling past does not hand the highlight to the one below it.
        const next = list.current.find((id) => (seen.get(id) ?? 0) > 0);
        if (next) setActive(next);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.01] },
    );

    list.current.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return active;
}

// --------------------------------------------------------------------------
// Controls
// --------------------------------------------------------------------------
export interface ControlsProps {
  /** Not called `window`: shadowing the global inside a component that may one
   *  day want it is a debugging session nobody needs. */
  chosen: WindowKey;
  onWindow: (key: WindowKey) => void;
  subject: string;
  onSubject: (id: string) => void;
  subjects: Array<{ id: string; label: string }>;
  compareLabel: string;
}

export function Controls({
  chosen,
  onWindow,
  subject,
  onSubject,
  subjects,
  compareLabel,
}: ControlsProps) {
  return (
    <div className="ax-controls">
      <div className="ax-chips" role="group" aria-label="Time window">
        {WINDOWS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`ax-chip${option.key === chosen ? ' is-on' : ''}`}
            aria-pressed={option.key === chosen}
            onClick={() => onWindow(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="ax-select-wrap">
        <span className="ax-sr">Subject</span>
        <select className="ax-select" value={subject} onChange={(event) => onSubject(event.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <div className="ax-compare">
        <span className="ax-muted">Compare with:</span>
        {/* One window means one baseline — the period immediately before it.
            A picker here would let a reader put two years beside three months
            and read the difference in length as a difference in effort. */}
        <span className="ax-compare-value">{compareLabel}</span>
      </div>
    </div>
  );
}
