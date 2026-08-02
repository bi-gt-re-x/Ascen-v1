/**
 * The card all three views sit in, and the Week / Day / Month selector pinned
 * to its corner.
 *
 * The three views were panes of one page, shown and hidden by a script; they
 * are three routes now, so the selector is links and the browser's back button
 * means what it should. What has not changed is the frame around them — the
 * stylesheets size the card and place the selector, and both views' headers
 * are laid out relative to it.
 *
 * `view-pane active` on the pane is kept for the same reason: a pane without
 * it is `display: none`, and only one pane is ever mounted now.
 */
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

const VIEWS = [
  { to: '/calendar/week', label: 'Week' },
  { to: '/calendar/day', label: 'Day' },
  { to: '/calendar/month', label: 'Month' },
];

export function ViewSwitcher() {
  return (
    <div className="view-toggle" role="tablist" aria-label="Calendar view">
      {VIEWS.map((view) => (
        <NavLink
          key={view.to}
          to={view.to}
          role="tab"
          className={({ isActive }) => `view-toggle-btn${isActive ? ' active' : ''}`}
        >
          {view.label}
        </NavLink>
      ))}
    </div>
  );
}

export interface CalendarShellProps {
  /** The pane's id — `weekView`, `dayView`, `monthView`. The CSS reads it. */
  paneId: string;
  children: ReactNode;
}

export function CalendarShell({ paneId, children }: CalendarShellProps) {
  return (
    <div className="calendar-container">
      <div className="calendar-card page-shell">
        <div className="calendar-topbar">
          <ViewSwitcher />
        </div>
        <div id={paneId} className="view-pane active">
          {children}
        </div>
      </div>
    </div>
  );
}
