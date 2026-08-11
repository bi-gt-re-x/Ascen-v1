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
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
 * The sub-navigation inside Overview, matching the design's labels and order.
 *
 * These are anchors rather than views: Overview is one continuous argument —
 * the tiles state the figures, the trajectory shows the path, the breakdown
 * says what it was made of — and hiding four fifths of that behind a tab would
 * make a reader click through five screens to read one. Pressing one moves the
 * page to that block and the block under the reader lights up as they scroll
 * past it, so the control is honest in both directions.
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

// --------------------------------------------------------------------------
// The major tabs
// --------------------------------------------------------------------------
export type ViewKey = 'overview' | 'trends' | 'habits' | 'insights' | 'recommendations';

export interface View {
  key: ViewKey;
  label: string;
  /** Its own URL, so a tab can be linked to and the back button works. */
  path: string;
  /** The one-line statement of what this tab is for and what it is not. */
  purpose: string;
  title: string;
  blurb: string;
}

/**
 * The five views, in the order they are meant to be read.
 *
 * The middle three are the whole point of the page and their boundaries are
 * deliberately sharp, because three tabs that all show cards of numbers are one
 * tab with a broken picker:
 *
 * - **Habits — what I do.** Counts of recurring behaviour. Visual, historical.
 *   Never says why.
 * - **Insights — why and how I do it.** Two counts put together and what the
 *   connection looks like, with the evidence graded. Never says what to do.
 * - **Recommendations — how I improve.** Instructions with a number and the
 *   arithmetic behind it attached. Never re-states a finding as news.
 *
 * Overview keeps the long view of the account that this page has always been,
 * and Trends sits between it and Habits: the derivative rather than the level.
 *
 * Each is a route rather than local state so that the rail, the browser's back
 * button and a pasted link all agree about which tab is open.
 */
export const VIEWS: View[] = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/analytics',
    purpose: 'The long view — totals, trajectory and where the account stands.',
    title: 'Advanced Analytics',
    blurb: 'Track your long-term progress. Build compounding growth.',
  },
  {
    key: 'trends',
    label: 'Trends',
    path: '/trends',
    purpose: 'Which way each measure is heading, and whether the movement is real.',
    title: 'Trends',
    blurb: 'The direction rather than the level — what is moving, and how fast.',
  },
  {
    key: 'habits',
    label: 'Habits',
    path: '/habits',
    purpose: 'What you do — the routines, streaks and rhythms in your own record.',
    title: 'Habits',
    blurb: 'What you repeatedly do, counted. The behaviour, not the explanation.',
  },
  {
    key: 'insights',
    label: 'Insights',
    path: '/insights',
    purpose: 'Why and how you work — what conditions your better work shows up under.',
    title: 'Insights',
    blurb: 'Why your record looks the way it does, with the evidence behind each reading.',
  },
  {
    key: 'recommendations',
    label: 'Recommendations',
    path: '/recommendations',
    purpose: 'What to change, ranked by what it would actually be worth.',
    title: 'Recommendations',
    blurb: 'What to do differently, drawn from your own record, with the arithmetic attached.',
  },
];

export function viewFor(pathname: string): View {
  return VIEWS.find((view) => view.path === pathname) ?? VIEWS[0]!;
}

export interface ViewTabsProps {
  active: ViewKey;
  onView: (view: View) => void;
}

/**
 * The five major tabs — a switcher, not a table of contents.
 *
 * Unlike `Tabs` below, pressing one of these changes what is on the page rather
 * than scrolling to it, because the five answer different questions and nobody
 * reading "what should I change" wants to scroll past two years of totals to
 * reach it. The purpose line under the bar is not decoration: it is what keeps
 * a reader from treating Habits, Insights and Recommendations as three
 * interchangeable piles of cards.
 */
export function ViewTabs({ active, onView }: ViewTabsProps) {
  const current = VIEWS.find((view) => view.key === active) ?? VIEWS[0]!;

  return (
    <div className="ax-views">
      <nav className="ax-tabs ax-tabs-major" aria-label="Analytics sections">
        {VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            className={`ax-tab${view.key === active ? ' is-on' : ''}`}
            aria-current={view.key === active ? 'page' : undefined}
            onClick={() => onView(view)}
          >
            {view.label}
          </button>
        ))}
      </nav>
      <p className="ax-views-purpose">{current.purpose}</p>
    </div>
  );
}

export interface HeaderProps {
  span: string;
  /** The days the window covers — what Export writes out. */
  rows: GrowthDay[];
  /** Which tab is open. Its title and blurb are the header's. */
  view?: View;
  /**
   * True when this tab is drawing placeholder figures.
   *
   * The chip goes in the top-right container beside the date pill, which is
   * where the same mark sits on every panel (see `Panel` in ./charts). One
   * position for one meaning, so "is any of this mine?" is answered in the same
   * place whether the reader is looking at a panel or at the page.
   */
  sample?: boolean;
  /** Pushed in beside Export — a refresh control, usually. */
  actions?: ReactNode;
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
export function Header({ span, rows, view, sample, actions }: HeaderProps) {
  const shown = view ?? VIEWS[0]!;
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
    link.download = `ascen-${shown.key} ${span.replace(/[^\w\s–-]/g, '')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="ax-head">
      <div>
        <h1>
          <span className={`ax-head-icon ax-head-icon-${shown.key}`} aria-hidden="true" />
          {shown.title}
        </h1>
        <p className="ax-muted">{shown.blurb}</p>
      </div>
      <div className="ax-head-actions">
        {sample && (
          <span
            className="ax-sample ax-sample-page"
            title="This tab is showing placeholder figures — your own record cannot fill it yet"
          >
            Sample data
          </span>
        )}
        <span className="ax-pill">
          <span className="ax-pill-icon" aria-hidden="true" />
          {span}
        </span>
        {actions}
        <button
          type="button"
          className="ax-btn"
          onClick={save}
          disabled={rows.length === 0}
          title="Download these days as a CSV"
        >
          <span className="ax-btn-icon" aria-hidden="true" />
          Export
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
