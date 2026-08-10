/**
 * Benchmarks — how far along is this, against something that means anything?
 *
 * Four standards, in descending order of how much this account can support
 * them: the reader's own record, a goal they set with a deadline on it, a
 * ladder of round numbers, and — nowhere on this page — a cohort.
 *
 * **There is no leaderboard and there will not be one.** The app stores one
 * account's days. A percentile against other people would be a number with
 * nothing behind it, and the one percentile here is against the reader's own
 * two hundred-odd 30-day windows, shown only once there are enough of them to
 * mean something. Below that the page says so and shows the baseline
 * comparison, which is the honest version of the same question.
 *
 * **The external standards are named and declined.** Codeforces, LeetCode, an
 * RCM grade: none of them are in this database, and four empty category cards
 * would be worse than one panel saying which ones it cannot see. What it does
 * instead is point at the one place a reader can track them — a goal with a
 * number and a date — and then read those goals back with a pace on each.
 *
 * The arithmetic is in utils/growthBench.
 */
import { useMemo } from 'react';
import type { Goal, GrowthDay, Task } from '@/types';
import {
  benchCategories,
  benchHero,
  goalBenchmarks,
  personalRecords,
  xpLadder,
} from '@/utils/growthBench';
import { longDate } from '@/utils/growthChapters';
import { EmptyChapter, HeroRow, Notes, PanelHead } from './ChapterParts';
import { Glyph } from './GrowthPanels';

export interface BenchmarksChapterProps {
  all: GrowthDay[];
  tasks: Task[];
  goals: Goal[];
  /** True while the goals call is still out, so the panel waits rather than
   *  claiming there are none. */
  goalsLoading: boolean;
  streak: number;
}

export function BenchmarksChapter({
  all,
  tasks,
  goals,
  goalsLoading,
  streak,
}: BenchmarksChapterProps) {
  const today = all[all.length - 1]?.date ?? '';

  const hero = useMemo(() => benchHero(all), [all]);
  const categories = useMemo(() => benchCategories(all, tasks, streak), [all, streak, tasks]);
  const ladder = useMemo(() => xpLadder(all), [all]);
  const records = useMemo(() => personalRecords(all, tasks, streak), [all, streak, tasks]);
  const goalRows = useMemo(() => goalBenchmarks(goals, all, today), [all, goals, today]);

  if (all.length < 3) {
    return (
      <EmptyChapter
        title="Benchmarks"
        message="There is no record to beat yet — come back after a week or so."
      />
    );
  }

  const held = records.filter((record) => record.on !== null).length;

  return (
    <div className="gr-grid">
      {/* --- Where the present stands --------------------------------------- */}
      <div className="gr-span-3">
        <HeroRow
          cards={[
            hero.percentile !== null
              ? {
                  key: 'percentile',
                  label: 'Your progress',
                  value: hero.percentile,
                  scale: 'th percentile',
                  foot: `of your own ${hero.windows} thirty-day windows — not of other people`,
                  icon: 'trophy',
                }
              : {
                  key: 'baseline',
                  label: 'Personal benchmark',
                  value: hero.fromBaseline,
                  suffix: '%',
                  foot:
                    hero.fromBaseline === null
                      ? 'needs a fortnight before a baseline means anything'
                      : `against your opening stretch — ${hero.baselineXp.toLocaleString()} XP then, ${hero.currentXp.toLocaleString()} now`,
                  icon: 'trophy',
                },
            {
              key: 'now',
              label: 'Last 30 days',
              value: hero.currentXp,
              suffix: ' XP',
              foot: `your best 30 is ${hero.bestXp.toLocaleString()} XP${
                hero.bestEndedOn ? `, ending ${longDate(hero.bestEndedOn)}` : ''
              }`,
              icon: 'spark',
            },
            {
              key: 'ofbest',
              label: 'Against your best month',
              value: hero.bestXp > 0 ? Math.round((hero.currentXp / hero.bestXp) * 100) : 0,
              suffix: '%',
              foot: 'a hundred percent means you are equalling your own record',
              icon: 'target',
            },
            {
              key: 'records',
              label: 'Records with a date on them',
              value: held,
              foot: `of ${records.length} tracked — every one of them yours`,
              icon: 'award',
            },
          ]}
        />
      </div>

      {/* --- The ladder ------------------------------------------------------ */}
      <section className="gr-panel gr-span-3">
        <PanelHead
          title="The XP ladder"
          icon="trend"
          hint="Round numbers, with the day each was cleared. The rungs ahead carry an estimate at the pace of your last 30 days — a straight line, and nothing more."
          note={`${Math.round(Number(all[all.length - 1]?.cumulative_xp) || 0).toLocaleString()} XP lifetime`}
        />
        <ol className="gr-ladder">
          {ladder.map((step) => (
            <li className={`gr-ladder-step is-${step.state}`} key={step.value}>
              <span className="gr-ladder-mark" aria-hidden="true">
                {step.state === 'done' ? <Glyph name="check" size={12} /> : ''}
              </span>
              <span className="gr-ladder-value">{step.label}</span>
              <span className="gr-ladder-sub">
                {step.state === 'done'
                  ? step.on
                    ? longDate(step.on)
                    : 'cleared'
                  : step.inDays === null
                    ? 'no pace yet'
                    : `~${step.inDays}d`}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Category by category -------------------------------------------- */}
      <section className="gr-panel gr-span-2">
        <PanelHead
          title="Against your own record"
          hint="Every row is the last 30 days, the 30 before it, and the best 30 you have ever had. The bar is now against that best — a full bar means you are equalling your record."
          note="30-day windows"
        />
        <div className="gr-cats">
          {categories.map((category) => (
            <div className="gr-cat" key={category.key}>
              <div className="gr-cat-head">
                <h3 className="gr-cat-name">{category.label}</h3>
                <span className="gr-cat-note">{category.note}</span>
              </div>
              <ul className="gr-cat-rows">
                {category.rows.map((row) => (
                  <li className="gr-cat-row" key={row.key}>
                    <span className="gr-cat-label">{row.label}</span>
                    <span className="gr-cat-figures">
                      <strong>{row.current}</strong>
                      <span>{row.note ?? `was ${row.previous}`}</span>
                      <span>best {row.best}</span>
                    </span>
                    <span className="gr-cat-track">
                      <i className="gr-cat-fill" style={{ width: `${row.percent}%` }} />
                    </span>
                    <span className="gr-cat-pct">
                      {row.percent}%
                      {row.delta !== null && (
                        <i className={`gr-chip${row.delta >= 0 ? ' is-up' : ' is-down'}`}>
                          {row.delta >= 0 ? '+' : '−'}
                          {Math.abs(row.delta)}%
                        </i>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* --- The high scores -------------------------------------------------- */}
      <section className="gr-panel">
        <PanelHead
          title="Personal records"
          icon="trophy"
          hint="The best each of these has ever been, and the day it happened."
        />
        <ul className="gr-records">
          {records.map((record) => (
            <li className="gr-record" key={record.key}>
              <span className="gr-record-ico" aria-hidden="true">
                <Glyph name={record.icon} size={14} />
              </span>
              <span className="gr-record-name">{record.label}</span>
              <span className="gr-record-value">{record.value}</span>
              <span className="gr-record-on">{record.on ? longDate(record.on) : '—'}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* --- The goals, read as benchmarks ------------------------------------ */}
      <section className="gr-panel gr-span-2">
        <PanelHead
          title="Goal benchmarks"
          icon="target"
          hint="Your own goals, with the pace each needs against the pace you are going. The pace comes from your last 30 days, because a goal set yesterday has no history of its own."
          note={goalRows.length ? `${goalRows.length} set` : undefined}
        />
        {goalsLoading ? (
          <p className="gr-empty">Reading your goals…</p>
        ) : goalRows.length === 0 ? (
          <p className="gr-empty">
            No goals set. A goal is the one place a target this app does not track — a
            Codeforces rating, an RCM grade, a book count — becomes a number with a deadline
            on it, and it appears here the moment it exists.
          </p>
        ) : (
          <ul className="gr-goals">
            {goalRows.map((goal) => (
              <li className="gr-goal" key={goal.key}>
                <div className="gr-goal-head">
                  <span className="gr-goal-name">{goal.title}</span>
                  <span className={`gr-goal-flag is-${goal.standing.replace(/\s/g, '-')}`}>
                    {goal.standing}
                  </span>
                </div>
                <span className="gr-goal-track">
                  <i className="gr-goal-fill" style={{ width: `${goal.percent}%` }} />
                </span>
                <div className="gr-goal-foot">
                  <span>
                    {Math.round(goal.current).toLocaleString()} /{' '}
                    {Math.round(goal.target).toLocaleString()} {goal.unit}
                  </span>
                  <span>
                    {goal.deadline
                      ? goal.daysLeft !== null && goal.daysLeft >= 0
                        ? `${goal.daysLeft} days left`
                        : 'past its deadline'
                      : 'no deadline'}
                  </span>
                  <span className="is-quiet">
                    {goal.needPace !== null && goal.havePace !== null
                      ? `needs ${round(goal.needPace)}/day · going ${round(goal.havePace)}/day`
                      : goal.standing === 'done'
                        ? 'reached'
                        : 'no pace to compare'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- What a benchmark means here -------------------------------------- */}
      <section className="gr-panel">
        <PanelHead title="Reading these" icon="bulb" />
        <Notes
          rows={[
            {
              tone: 'note',
              icon: 'info',
              head: 'Nothing here compares you to another person.',
              hint: 'This app stores one account. The only percentile on the page is against your own thirty-day windows, and it appears only once there are enough of them.',
            },
            {
              tone: 'watch',
              icon: 'alert',
              head: 'External standards are not tracked.',
              hint: 'A Codeforces rating, a LeetCode count, an RCM level — none of them are recorded anywhere in this app. Set one as a goal with a deadline and it becomes a row above, paced against what you are actually doing.',
            },
            {
              tone: 'good',
              icon: 'check',
              head: 'A full bar means you are equalling your own best.',
              hint: 'Not that you have finished. The bar is the present against the record, which is the only benchmark that cannot be gamed and cannot be lost.',
            },
          ]}
        />
      </section>
    </div>
  );
}

/** A pace, at the precision the figure deserves. */
function round(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString();
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}
