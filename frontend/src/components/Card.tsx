/**
 * The panel almost every page is built out of.
 *
 * A heading is rendered as a real `<h2>` inside a `<section>` when `title` is
 * given, so the page has an outline a screen reader can navigate rather than a
 * wall of divs that merely look like headings.
 */
import type { ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  /** Sits opposite the title — a button, a count, a filter. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = '' }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <header className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
