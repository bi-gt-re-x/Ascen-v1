/**
 * The page's own chrome: its title row, its major tabs, and its controls.
 *
 * Overview used to carry a second bar under this one — Overview / Long Term /
 * Milestones / Goals Progress / Trajectory / Benchmarks — that scrolled to a
 * block rather than opening one. It is gone. Two tab bars stacked on one screen
 * read as one broken control: the top row swapped the page and the row directly
 * under it did not, and nothing about the two told a reader which was which.
 * The bar was also lying in two places — Goals Progress pointed at Long Term
 * because this page has no goals panel, and its labels were in a different
 * order than the sections they named. Overview is one continuous argument and
 * scrolls like one.
 */
import { type ReactNode } from 'react';
import { WINDOWS, type WindowKey } from './data';
import type { GrowthDay } from '@/types';

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
 * The five major tabs — the page's only tab bar.
 *
 * Pressing one changes what is on the page, because the five answer different
 * questions and nobody reading "what should I change" wants to scroll past two
 * years of totals to reach it. The purpose line under the bar is not
 * decoration: it is what keeps a reader from treating Habits, Insights and
 * Recommendations as three interchangeable piles of cards.
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


// --------------------------------------------------------------------------
// What changed since last time
// --------------------------------------------------------------------------
export interface SinceLastProps {
  /** Recorded readings of the overall score, out of 100, oldest first. */
  points: Array<{ date: string; score: number }>;
}

/** How far back a reading can be and still count as "last time". */
const STALE_DAYS = 45;

/**
 * The one line on this page a returning reader is actually here for.
 *
 * Everything else states where the account *is*. This states what **moved**,
 * which is the only thing that rewards coming back: a score of 6.5 is a status
 * and reads the same on every visit, but "6.5, up from 6.1 on Tuesday" is news,
 * and news is what a weekly habit is made of.
 *
 * It needed an endpoint. The grades have been filed daily since the report card
 * existed and nothing ever read them back — see `/api/metric_history`.
 *
 * **The comparison is against the last *different* reading, not yesterday's.**
 * A score that has sat at 65 for a fortnight against yesterday's 65 produces
 * "no change" every single day, which is both true and useless; against the
 * last time it actually moved it produces "steady for twelve days", which is a
 * real statement about the account. Beyond `STALE_DAYS` there is nothing
 * honest to compare to and the strip says so rather than reaching further.
 */
export function SinceLast({ points }: SinceLastProps) {
  if (points.length < 2) return null;

  const last = points[points.length - 1]!;
  const now = last.score / 10;

  // Back to the most recent reading that differs, and how long ago that was.
  let earlier: { date: string; score: number } | null = null;
  for (let index = points.length - 2; index >= 0; index--) {
    if (points[index]!.score !== last.score) {
      earlier = points[index]!;
      break;
    }
  }

  const days = (from: string) =>
    Math.round(
      (new Date(`${last.date}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
        86_400_000,
    );

  if (!earlier) {
    const held = days(points[0]!.date);
    if (held < 2) return null;
    return (
      <p className="ax-since is-flat">
        Your growth score has held at <strong>{now.toFixed(1)}</strong> for {held} days.
      </p>
    );
  }

  const gap = days(earlier.date);
  if (gap > STALE_DAYS) return null;
  const move = now - earlier.score / 10;
  const up = move > 0;

  return (
    <p className={`ax-since is-${up ? 'up' : 'down'}`}>
      Your growth score is <strong>{now.toFixed(1)}</strong>, {up ? 'up' : 'down'} from{' '}
      {(earlier.score / 10).toFixed(1)} {gap === 1 ? 'yesterday' : `${gap} days ago`}.
    </p>
  );
}
