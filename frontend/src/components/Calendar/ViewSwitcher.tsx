/**
 * Day / Week / Month.
 *
 * The three views are three routes rather than three states of one component,
 * so the switcher is links and the browser's back button works the way a user
 * expects. Which is also why it renders `<NavLink>` and not buttons.
 */
import { NavLink } from 'react-router-dom';

const VIEWS = [
  { to: '/calendar/day', label: 'Day' },
  { to: '/calendar/week', label: 'Week' },
  { to: '/calendar/month', label: 'Month' },
];

export function ViewSwitcher() {
  return (
    <nav className="calendar-view-switcher" aria-label="Calendar view">
      {VIEWS.map((view) => (
        <NavLink
          key={view.to}
          to={view.to}
          className={({ isActive }) =>
            `calendar-view-tab${isActive ? ' active' : ''}`
          }
        >
          {view.label}
        </NavLink>
      ))}
    </nav>
  );
}
