/**
 * The badge wall.
 *
 * A hundred badges, and the page is arranged so that a reader meets them in
 * the order the questions arrive: how far am I, what did I just get, which
 * kinds am I behind on, and then the whole list.
 *
 *     the ring and three figures   how far along the wall is, and the streak
 *     Recently Earned              the last four, largest — the news
 *     Achievement Categories       five bars, one per heading
 *     All Achievements             the list, searchable and filterable
 *
 * ## Nothing here is computed
 *
 * The server decides what is earned and holds the date it happened. This page
 * draws what it is given. That matters for the streak badges in particular: a
 * badge earned in March is still earned in July, and a client recomputing
 * "streak >= 30" against the *current* streak would take it away again on the
 * first missed day. See the note in backend/api/achievements.py.
 *
 * The category counts and the achievement score arrive counted for the same
 * reason — two places counting the same badges is two places that can disagree
 * about a wall the reader is looking at all at once.
 *
 * ## Progress is only drawn on locked badges
 *
 * An earned badge shows the day it was earned instead. A full bar under a
 * badge that is already won is a bar nobody reads, and it takes the row's
 * width from the one thing on it that is still news.
 *
 * ## The five hidden ones draw as they arrive
 *
 * A locked hidden badge arrives with no name, no threshold and no progress —
 * see the service. The page does not have to know which five they are, and
 * could not leak them if it wanted to: it draws "???" because that is what it
 * was sent. What it adds is the lock styling and the line at the foot of the
 * list saying how many are still out there, which is the honest version of
 * "more achievements coming soon" — they are not coming, they are already here
 * and you have not found them.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Ambient, ErrorState, Loading, RefreshButton } from '@/components';
import { useApi, useDocumentTitle, usePageEntrance, useUserData } from '@/hooks';
import { achievements as service } from '@/services';
import type { Badge, Category, Metric } from '@/services/achievements';
import '@/styles/achievements.css';

/** The filter's options. "All" first, then the five headings. */
const FILTERS = ['All Achievements', 'Productivity', 'Consistency', 'Learning', 'Milestones', 'Special'] as const;
type Filter = (typeof FILTERS)[number];

/** How many of the most recent earnings lead the page. */
const RECENT = 4;

// --------------------------------------------------------------------------
// The drawings
// --------------------------------------------------------------------------
/**
 * Sixteen line drawings, inline and stroked in `currentColor`.
 *
 * Inline rather than files under utils/icons/ for the reason
 * components/Analytics/glyphs.ts gives for doing the same: a closed set
 * belonging to one page, living in the shared icon folder, is how that folder
 * got to 80 entries. Stroked in `currentColor` so one drawing sits legibly in
 * a green hexagon, a gold one, and on either theme without a second copy.
 */
const GLYPH = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
    </>
  ),
  bolt: <path d="M13 2 4.5 13.5H11l-1 8.5L19 10.5h-6.5L13 2Z" />,
  star: <path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />,
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 10h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 10h18M8 2.5v4M16 2.5v4m-6.5 9 2 2 4-4" />
    </>
  ),
  sparkle: (
    <path d="M12 2.5l1.8 5.3a4 4 0 002.4 2.4l5.3 1.8-5.3 1.8a4 4 0 00-2.4 2.4L12 21.5l-1.8-5.3a4 4 0 00-2.4-2.4L2.5 12l5.3-1.8a4 4 0 002.4-2.4z" />
  ),
  levelUp: <path d="m5 13.5 7-7 7 7M5 20l7-7 7 7" />,
  flame: <path d="M12 22a6.5 6.5 0 006.5-6.5c0-5-5-7-4.5-13-4 2.2-6.5 5.6-6.5 9.5a4 4 0 01-1.2-2.7S5.5 12.5 5.5 15.5A6.5 6.5 0 0012 22Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  sunrise: <path d="M17.5 19a5.5 5.5 0 00-11 0M12 2.5v4.5M4.4 9.4l1.5 1.5m12.2-1.5-1.5 1.5M2 19h2m16 0h2M3.5 22.5h17" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.6m0 14.8V22M4.2 4.2l1.9 1.9m11.8 11.8 1.9 1.9M2 12h2.6m14.8 0H22M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9" />
    </>
  ),
  moon: <path d="M20.5 14.8A8.6 8.6 0 019.2 3.5a8.6 8.6 0 1011.3 11.3Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.8V12l3.4 2" />
    </>
  ),
  layers: <path d="m12 2.8 8.6 4.6L12 12 3.4 7.4 12 2.8Zm-8.6 9.6L12 17l8.6-4.6M3.4 16.8 12 21.4l8.6-4.6" />,
  book: (
    <>
      <path d="M4 5A2.5 2.5 0 016.5 2.5H20v16H6.5A2.5 2.5 0 004 21z" />
      <path d="M4 18.5A2.5 2.5 0 016.5 16H20" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.5" r="6.2" />
      <path d="M8.6 8.9 6 2.5h12l-2.6 6.4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 3.5h9v5.5a4.5 4.5 0 01-9 0z" />
      <path d="M16.5 4.8h3.2v1.9a3.2 3.2 0 01-3.2 3.2M7.5 4.8H4.3v1.9a3.2 3.2 0 003.2 3.2M12 13.5v4.2M8.5 20.5h7" />
    </>
  ),
} satisfies Record<string, ReactNode>;

/**
 * What a badge is measured on decides what it is drawn as.
 *
 * By metric rather than one drawing hand-assigned per badge: a hundred hand
 * assignments is a hundred chances for the picture to disagree with the rule,
 * and a reader who learns that the flame means a streak has learned it for all
 * seven streak badges at once. Several metrics share a drawing where they
 * genuinely mean the same thing — three ways of counting focus are all a
 * clock — because inventing a distinct picture for each would be drawing a
 * distinction the badges do not make.
 */
const METRIC_GLYPH: Record<Metric, ReactNode> = {
  tasks: GLYPH.check,
  priority: GLYPH.bolt,
  day_tasks: GLYPH.star,
  events: GLYPH.calendar,
  xp: GLYPH.sparkle,
  day_xp: GLYPH.sparkle,
  level: GLYPH.levelUp,
  streak: GLYPH.flame,
  active_days: GLYPH.calendarCheck,
  perfect_days: GLYPH.target,
  months: GLYPH.calendar,
  early: GLYPH.sunrise,
  weekend: GLYPH.sun,
  night: GLYPH.moon,
  focus: GLYPH.clock,
  focus_days: GLYPH.clock,
  focus_best: GLYPH.clock,
  subjects: GLYPH.layers,
  notes: GLYPH.book,
  goals: GLYPH.target,
  records: GLYPH.medal,
};

/** The five headings, drawn. The same drawing the category's badges carry. */
const CATEGORY_GLYPH: Record<Category, ReactNode> = {
  Productivity: GLYPH.target,
  Consistency: GLYPH.flame,
  Learning: GLYPH.book,
  Milestones: GLYPH.trophy,
  Special: GLYPH.star,
};

function pretty(iso: string | null): string {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * "2h ago", "1d ago", "3w ago".
 *
 * Relative rather than absolute on the recent cards because the whole reason
 * they are at the top is that they are news, and "Earned 2h ago" is news in a
 * way that "Earned 28 Apr" is not. The list below prints the date, which is
 * the right form for a row somebody is scrolling past.
 */
function ago(iso: string | null): string {
  if (!iso) return '';
  const when = new Date(iso).getTime();
  if (Number.isNaN(when)) return '';
  const mins = Math.max(0, Math.round((Date.now() - when) / 60000));
  if (mins < 60) return `${mins || 1}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return pretty(iso);
}

/**
 * A badge's mark: a hexagon, and inside it the thing the badge is about.
 *
 * One shape for every badge and the tier carried in its colour, so a reader
 * scanning the list reads difficulty from the hue rather than from a word. The
 * hexagon rather than a circle because the wall is the one page in this app
 * that is allowed to look like a game.
 *
 * Three states, and the drawing is what separates them. An earned badge gets a
 * tick, because what a reader wants from a row they have already cleared is
 * confirmation. A locked one gets its own drawing — the flame, the clock, the
 * stack of subjects — because a wall of identical padlocks says only "not yet"
 * a hundred times, where a wall of drawings says what each of them wants. The
 * padlock is kept for the one case where it is the whole truth: a hidden badge
 * nobody has been told the shape of.
 */
function Mark({ badge, size }: { badge: Badge; size?: 'lg' }) {
  const secret = badge.hidden && !badge.earned;
  const glyph = secret ? GLYPH.lock : badge.earned ? GLYPH.check : METRIC_GLYPH[badge.metric as Metric] ?? GLYPH.star;
  return (
    <span
      className={`ac-mark tier-${badge.tier}${badge.earned ? ' is-earned' : ''}${secret ? ' is-secret' : ''}${size === 'lg' ? ' is-lg' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="ac-mark-hex">
        <path d="M16 1.6 29 9v14L16 30.4 3 23V9z" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="ac-mark-glyph"
        fill="none"
        stroke="currentColor"
        strokeWidth={badge.earned ? 2.6 : 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </svg>
    </span>
  );
}

/** One of the four cards along the top — the badges most recently earned. */
function RecentCard({ badge }: { badge: Badge }) {
  return (
    <li className={`ac-recent-card tier-${badge.tier}`}>
      <Mark badge={badge} size="lg" />
      <strong>{badge.name}</strong>
      <span className="ac-quiet">{badge.description}</span>
      <div className="ac-recent-foot">
        <span className="ac-xp">+{badge.xp_reward} XP</span>
        <span className="ac-quiet">Earned {ago(badge.earned_at)}</span>
      </div>
    </li>
  );
}

/** One row of the full list. */
function BadgeRow({ badge }: { badge: Badge }) {
  const secret = badge.hidden && !badge.earned;
  const share = badge.threshold > 0 ? Math.min(1, badge.value / badge.threshold) : 0;

  return (
    <li className={`ac-row tier-${badge.tier}${badge.earned ? ' is-earned' : ''}${secret ? ' is-secret' : ''}`}>
      <Mark badge={badge} />

      <div className="ac-row-text">
        <strong>
          {badge.name}
          {badge.title && <em className="ac-title">Title unlocked · {badge.title}</em>}
        </strong>
        <span className="ac-quiet">{badge.description}</span>
      </div>

      <div className="ac-row-state">
        {badge.earned ? (
          <>
            <span className="ac-done">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l2.6 2.6L16 9.5" />
              </svg>
              Completed
            </span>
            <span className="ac-quiet">Earned {pretty(badge.earned_at)}</span>
          </>
        ) : secret ? (
          /* No bar and no figures: the server sent neither, and inventing an
             empty one would say "you are at zero" about a threshold nobody
             has been told. */
          <span className="ac-quiet ac-secret-note">Hidden until earned</span>
        ) : (
          <div className="ac-progress">
            <div className="ac-bar" role="presentation">
              <i style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
            <span className="ac-quiet ac-figures">
              {badge.value.toLocaleString()} / {badge.threshold.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* A secret badge's score is withheld with everything else about it. The
          server blanks the name, the threshold and the progress but still
          sends `xp_reward`, and printing it undoes the rest: four hidden rows
          at +1,000 and one at +5,000 tells a reader exactly which of the five
          is the monster, and its tier colour would tell them how rare it is.
          The pill keeps its place so the column stays straight. */}
      {secret ? (
        <span className="ac-xp" title="Withheld until it is earned">??? XP</span>
      ) : (
        <span
          className={`ac-xp${badge.earned ? ' is-earned' : ''}`}
          title={`${badge.tier_label} · worth ${badge.xp_reward} toward your achievement score`}
        >
          +{badge.xp_reward} XP
        </span>
      )}
    </li>
  );
}

/**
 * One of the three figures beside the ring.
 *
 * The drawing is not decoration: three numbers of the same size in a row read
 * as one table, and the reader has to get to the label under each before they
 * know which is which. A trophy, a flame and a sparkle are told apart before
 * they are read.
 */
function Stat({
  glyph,
  tone,
  value,
  label,
  note,
}: {
  glyph: ReactNode;
  tone: string;
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className={`ac-stat tone-${tone}`}>
      <div className="ac-stat-top">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {glyph}
        </svg>
        <strong>{value}</strong>
      </div>
      <span className="ac-stat-label">{label}</span>
      <span className="ac-quiet">{note}</span>
    </div>
  );
}

/** The completion ring. One arc, drawn as a stroked circle. */
function Ring({ share }: { share: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="ac-ring">
      <svg viewBox="0 0 100 100">
        <circle className="ac-ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="ac-ring-arc"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
        />
      </svg>
      <div className="ac-ring-face">
        <strong>{Math.round(share * 100)}%</strong>
      </div>
    </div>
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

  const [filter, setFilter] = useState<Filter>('All Achievements');
  const [query, setQuery] = useState('');

  /* "View All" — clear both narrowings and go to the list. Scrolled rather
     than routed because the full list is already on this page. */
  const listRef = useRef<HTMLElement | null>(null);
  const showAll = useCallback(() => {
    setFilter('All Achievements');
    setQuery('');
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const badges = useMemo(() => data?.achievements ?? [], [data]);

  /* The last four earned, newest first. A badge with no date sorts last rather
     than being dropped: the date is written the first time a read sees it
     earned, so the only rows without one are older than that mechanism. */
  const recent = useMemo(
    () =>
      badges
        .filter((badge) => badge.earned)
        .sort((a, b) => (b.earned_at ?? '').localeCompare(a.earned_at ?? ''))
        .slice(0, RECENT),
    [badges],
  );

  /* The list, filtered and searched. Earned first within a difficulty, so the
     wall reads as what you have and then what is next on the same rung —
     ordering purely by difficulty buries every earned badge under the locked
     ones above it. */
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return badges
      .filter((badge) => filter === 'All Achievements' || badge.category === filter)
      .filter(
        (badge) =>
          !needle ||
          badge.name.toLowerCase().includes(needle) ||
          badge.description.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.tier - b.tier || Number(b.earned) - Number(a.earned) || a.name.localeCompare(b.name));
  }, [badges, filter, query]);

  const hiddenLeft = useMemo(
    () => badges.filter((badge) => badge.hidden && !badge.earned).length,
    [badges],
  );

  /* The arrival cascade. Bound to the read rather than to mount, so it
     starts when there is something to animate — see hooks/usePageEntrance. */
  const entering = usePageEntrance(!loading);

  if (loading) return <Loading label="Reading your record" />;
  if (error && !badges.length) return <ErrorState message={error} onRetry={reload} />;

  const earned = data?.earned ?? 0;
  const total = data?.total ?? 0;
  const share = total > 0 ? earned / total : 0;

  return (
    <div className="ac-page">
      <Ambient />
      <div className={`ac-shell page-shell${entering ? ' pg-enter' : ''}`}>
        <header className="ac-head">
          <div>
            <h1>Achievements</h1>
            <p className="ac-quiet">Celebrate your progress. Every step forward counts.</p>
          </div>
          <div className="ac-head-tools">
            <label className="ac-select">
              <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
                {FILTERS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <RefreshButton busy={refreshing} onRefresh={reload} />
          </div>
        </header>

        {error && <ErrorState message={error} onRetry={reload} />}

        {/* The band. The ring is the wall; the three figures beside it are the
            account — what it has earned, whether it is still turning up, and
            what the wall scores. */}
        <section className="ac-band">
          <div className="ac-band-ring">
            <Ring share={share} />
            <span className="ac-quiet">Overall Completion</span>
          </div>

          <Stat
            glyph={GLYPH.trophy}
            tone="gold"
            value={String(earned)}
            label="Achievements Earned"
            note={`/ ${total} total`}
          />

          <Stat
            glyph={GLYPH.flame}
            tone="flame"
            value={String(data?.streak ?? 0)}
            label="Day Streak"
            note={(data?.streak ?? 0) > 0 ? 'Keep it going!' : 'Finish a task to start one'}
          />

          {/* Not the account's XP, and it does not say it is. The badges are
              weighted by difficulty and this is their sum — see the note on the
              endpoint. Printed against the full wall, because the number on its
              own says nothing, and labelled "score" rather than "XP" because a
              reader who reads it as XP will wait for a level that never comes. */}
          <Stat
            glyph={GLYPH.sparkle}
            tone="violet"
            value={(data?.achievement_xp ?? 0).toLocaleString()}
            label="Achievement Score"
            note={`of ${(data?.total_xp ?? 0).toLocaleString()} on the wall`}
          />
        </section>

        {data?.title && (
          <p className="ac-title-banner">
            You have earned the title <strong>{data.title}</strong>.
          </p>
        )}

        {recent.length > 0 && (
          <section className="ac-section">
            <header className="ac-section-head">
              <h2>Recently Earned</h2>
              {/* It goes somewhere: it clears the filter and the search and
                  puts the reader at the top of the full list, which is the only
                  honest "all" on a page whose list is already here. A link that
                  navigated away would be leaving the page it is on. */}
              <button type="button" className="ac-view-all" onClick={showAll}>
                View All
              </button>
            </header>
            <ul className="ac-recent">
              {recent.map((badge) => (
                <RecentCard badge={badge} key={badge.id} />
              ))}
            </ul>
          </section>
        )}

        <section className="ac-section">
          <header className="ac-section-head">
            <h2>Achievement Categories</h2>
          </header>
          <ul className="ac-cats">
            {(data?.categories ?? []).map((category) => (
              /* A chip is the filter it names. The row was five read-only
                 gauges sitting directly above a list with a category filter on
                 it — the control the reader wanted was already on screen and
                 not connected to the thing that looked like it. */
              <li className={`ac-cat cat-${category.name.toLowerCase()}`} key={category.name}>
                <button
                  type="button"
                  aria-pressed={filter === category.name}
                  onClick={() => setFilter(filter === category.name ? 'All Achievements' : category.name)}
                >
                  <span className="ac-cat-head">
                    <span className="ac-cat-ico" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        {CATEGORY_GLYPH[category.name]}
                      </svg>
                    </span>
                    <span className="ac-cat-text">
                      <strong>{category.name}</strong>
                      <span className="ac-quiet">
                        {category.earned} / {category.total}
                      </span>
                    </span>
                  </span>
                  <span className="ac-bar" role="presentation">
                    <i
                      style={{
                        width: `${category.total > 0 ? Math.round((category.earned / category.total) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="ac-section" ref={listRef}>
          <header className="ac-section-head">
            <h2>All Achievements</h2>
            <label className="ac-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                placeholder="Search achievements…"
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search achievements"
              />
            </label>
          </header>

          {shown.length === 0 ? (
            <p className="ac-empty">Nothing matches that.</p>
          ) : (
            <ul className="ac-list">
              {shown.map((badge) => (
                <BadgeRow badge={badge} key={badge.id} />
              ))}
            </ul>
          )}

          {/* The honest version of "more coming soon". They are not coming;
              they are on the wall already and have not been found. */}
          {hiddenLeft > 0 && filter === 'All Achievements' && !query && (
            <p className="ac-foot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2.5" />
                <path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
              </svg>
              {hiddenLeft} hidden {hiddenLeft === 1 ? 'achievement is' : 'achievements are'} still out
              there. Nobody is told what they are.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
