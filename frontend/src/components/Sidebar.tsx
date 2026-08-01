/**
 * The side navigation.
 *
 * Nothing in the app uses this yet — the five built pages navigate entirely
 * from the top bar. It exists because the structure calls for it and because
 * the pages that are coming (Notes, Library, History, Achievements) are the
 * kind that outgrow a single row of tabs.
 *
 * It is written rather than stubbed so that when a page does want it, it works.
 */
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface SidebarItem {
  to: string;
  label: string;
  icon?: ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  /** Shown above the list. */
  heading?: ReactNode;
  className?: string;
}

export function Sidebar({ items, heading, className = '' }: SidebarProps) {
  return (
    <aside className={`sidebar ${className}`.trim()}>
      {heading && <h2 className="sidebar-heading">{heading}</h2>}
      <nav className="sidebar-nav" aria-label="Section">
        <ul className="sidebar-list">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                {item.icon && <span className="sidebar-icon">{item.icon}</span>}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
