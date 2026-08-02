/**
 * The right-hand column: what each metric measures and how it is scored.
 *
 * Static, and it takes no props — nothing here depends on the account, only on
 * the rules in backend/tracking/analytics.py. The numbers quoted in the prose
 * are those rules: `avg daily XP ÷ 3`, `avg task XP × 1.75`, the ≤30-minute
 * speed ceiling. When a rule changes, this is the text that has to change with
 * it, which is why the figures are written out rather than hidden in a table.
 *
 * The icons are inline SVG for the same reason the rest of the app's are: five
 * more requests for five small line drawings, each of which has to be coloured
 * by the theme through `currentColor`, is a worse trade than the markup.
 */
import type { ReactNode } from 'react';

interface Detail {
  title: string;
  icon: ReactNode;
  body: ReactNode;
}

/** Shared by all five, so the stroke never has to be repeated. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const DETAILS: Detail[] = [
  {
    title: 'Productivity Tracking',
    icon: (
      <Icon>
        <polyline points="3 17 9 11 13 15 21 7" />
        <polyline points="16 7 21 7 21 12" />
        <path d="M6 4l.6 1.9L8.5 6.5l-1.9.6L6 9l-.6-1.9L3.5 6.5l1.9-.6z" />
      </Icon>
    ),
    body: (
      <>
        Measures how much XP you earn on a typical day from completed tasks and
        active work sessions. Your score is your{' '}
        <strong>average daily XP ÷ 3</strong> (capped at 100), so averaging 300
        XP per day earns a perfect 100. The more consistent daily output you put
        in, the higher this climbs.
      </>
    ),
  },
  {
    title: 'Quality Tracking',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.6" />
        <path d="M12 12l7-7" />
        <path d="M15 5h4v4" />
      </Icon>
    ),
    body: (
      <>
        Reflects how challenging the tasks you complete are, measured by their
        average XP value. Your score is your{' '}
        <strong>average XP per task × 1.75</strong> (capped at 100), so roughly
        57 XP per task earns a perfect 100. Taking on harder, higher-value work
        raises this over easy busywork.
      </>
    ),
  },
  {
    title: 'Consistency Tracking',
    icon: (
      <Icon>
        <polygon points="12 3 14.5 9 21 9.3 16 13.6 17.8 20 12 16.3 6.2 20 8 13.6 3 9.3 9.5 9" />
      </Icon>
    ),
    body: (
      <>
        Tracks how reliably you show up over time. Your score is your{' '}
        <strong>active days ÷ total days since signup × 100</strong>, so being
        active on 18 of your first 24 days scores 75. Logging in and completing
        something on more days keeps this high.
      </>
    ),
  },
  {
    title: 'Efficiency Tracking',
    icon: (
      <Icon>
        <rect x="3" y="4" width="7" height="5" rx="1.5" />
        <path d="M10 6.5h5a3 3 0 0 1 3 3V13" />
        <circle cx="18" cy="17" r="4" />
        <path d="M16.4 17l1.2 1.2 2.1-2.3" />
      </Icon>
    ),
    body: (
      <>
        Rewards finishing on time and quickly. Your score is{' '}
        <strong>50% deadlines met + 50% speed</strong>, where speed comes from
        your average completion time (≤30 min scores 100, scaling down for
        slower tasks). Beating timers and hitting due dates both push this up.
      </>
    ),
  },
  {
    title: 'Focus Tracking',
    icon: (
      <Icon>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M9 2h6" />
        <path d="M19 5l1.5 1.5" />
      </Icon>
    ),
    body: (
      <>
        Measures how much of your planned focus time you actually put in. Your
        score is your{' '}
        <strong>total focused time ÷ total focus goal × 100</strong> (capped at
        100), using the daily goal you set on the dashboard&apos;s Focus panel.
        Completing your focus goal every day keeps this at 100.
      </>
    ),
  },
];

export function ScoringDetails() {
  return (
    <aside className="ratings-scales" aria-label="Scoring details">
      <h2 className="details-title">
        Grades and Scoring Breakdown — Details
      </h2>

      {DETAILS.map((detail) => (
        <div className="detail-card" key={detail.title}>
          <span className="detail-icon" aria-hidden="true">
            {detail.icon}
          </span>
          <div className="detail-body">
            <h3>{detail.title}</h3>
            <p>{detail.body}</p>
          </div>
        </div>
      ))}
    </aside>
  );
}
