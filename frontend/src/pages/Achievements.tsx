/**
 * The badge wall.
 *
 * Every badge the app has, earned or not, grouped into the four tiers that
 * order them by difficulty. A wall showing only what has been earned is a
 * trophy case, and a trophy case is worth one look; the locked ones are what
 * make it worth coming back to, because each carries the figure it needs and
 * how far along that figure already is.
 *
 * ## Nothing here is computed
 *
 * The server decides what is earned and holds the date it happened. This page
 * draws what it is given. That matters for the streak badges in particular: a
 * badge earned in March is still earned in July, and a client recomputing
 * "streak >= 30" against the *current* streak would take it away again on the
 * first missed day. See the note in backend/api/achievements.py.
 *
 * ## Progress is only drawn on locked badges
 *
 * An earned badge shows the day it was earned instead. A full bar under a
 * badge that is already won is a bar nobody reads, and it takes the row's
 * width from the one thing on it that is still news.
 */
import { useCallback, useMemo } from 'react';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useApi, useDocumentTitle, useUserData } from '@/hooks';
import { achievements as service } from '@/services';
import type { Badge } from '@/services/achievements';
import '@/styles/achievements.css';

/** The tier headings, in order. Index 0 is unused so tier N reads as TIERS[N]. */
const TIERS = [
  '',
  'Getting started',
  'Building the habit',
  'The long run',
  'Rare air',
] as const;

function pretty(iso: string | null): string {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A badge's mark. Earned ones are filled; locked ones are an outline. */
function Mark({ badge }: { badge: Badge }) {
  return (
    <span className={`ac-mark tier-${badge.tier}`} aria-hidden="true">
      {badge.earned ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="5" y="11" width="14" height="9" rx="2.5" />
          <path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
        </svg>
      )}
    </span>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const share = badge.threshold > 0 ? Math.min(1, badge.value / badge.threshold) : 0;
  const left = Math.max(0, badge.threshold - badge.value);

  return (
    <li className={`ac-badge tier-${badge.tier}${badge.earned ? ' is-earned' : ''}`}>
      <Mark badge={badge} />
      <div className="ac-badge-text">
        <strong>{badge.name}</strong>
        <span className="ac-quiet">{badge.description}</span>
      </div>

      {badge.earned ? (
        <span className="ac-earned-on">{pretty(badge.earned_at) || 'Earned'}</span>
      ) : (
        <div className="ac-progress">
          <div className="ac-bar" role="presentation">
            <i style={{ width: `${Math.round(share * 100)}%` }} />
          </div>
          <span className="ac-quiet ac-figures">
            {badge.value.toLocaleString()} / {badge.threshold.toLocaleString()}{' '}
            {badge.unit}
            {left > 0 && <> · {left.toLocaleString()} to go</>}
          </span>
        </div>
      )}
    </li>
  );
}

export default function Achievements() {
  useDocumentTitle('Achievements');

  const { username } = useUserData();
  const call = useCallback(
    () =>
      username
        ? service.getAchievements(username)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your badges.' }),
    [username],
  );
  const { data, error, loading, refreshing, reload } = useApi(call, [username]);

  const badges = useMemo(() => data?.achievements ?? [], [data]);

  /* Grouped by tier rather than sorted by it, so each row can carry its own
     heading — the wall reads as four shelves, and a locked badge sits beside
     the earned ones of the same difficulty rather than at the bottom of the
     page where it says nothing about what is next. */
  const shelves = useMemo(() => {
    const by = new Map<number, Badge[]>();
    badges.forEach((badge) => {
      by.set(badge.tier, [...(by.get(badge.tier) ?? []), badge]);
    });
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [badges]);

  if (loading) return <Loading label="Reading your record" />;
  if (error && !badges.length) return <ErrorState message={error} onRetry={reload} />;

  const earned = data?.earned ?? 0;
  const total = data?.total ?? 0;
  const share = total > 0 ? Math.round((earned / total) * 100) : 0;

  return (
    <div className="ac-page">
      <Ambient />
      <div className="ac-shell page-shell">
        <header className="ac-head">
          <div>
            <h1>Achievements</h1>
            <p className="ac-quiet">What the record has already earned.</p>
          </div>
          <div className="ac-head-tools">
            <RefreshButton busy={refreshing} onRefresh={reload} />
          </div>
        </header>

        {error && <ErrorState message={error} onRetry={reload} />}

        <section className="ac-summary">
          <div className="ac-count">
            <strong>{earned}</strong>
            <span className="ac-quiet">of {total} earned</span>
          </div>
          <div className="ac-summary-bar">
            <div className="ac-bar is-lg" role="presentation">
              <i style={{ width: `${share}%` }} />
            </div>
            <span className="ac-quiet">{share}% of the wall</span>
          </div>
        </section>

        {shelves.map(([tier, list]) => (
          <section className="ac-shelf" key={tier}>
            <header className="ac-shelf-head">
              <h2>{TIERS[tier] ?? `Tier ${tier}`}</h2>
              <span className="ac-quiet">
                {list.filter((badge) => badge.earned).length} of {list.length}
              </span>
            </header>
            <ul className="ac-grid">
              {list.map((badge) => (
                <BadgeCard badge={badge} key={badge.id} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
