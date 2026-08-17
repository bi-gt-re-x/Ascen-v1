/**
 * Records — the account's own high scores, and the ones it is closest to.
 *
 * Two questions, one page, and the order between them is the design. **What
 * you have done** comes first, because a record is a thing somebody earned and
 * it should be read as an achievement rather than as a hurdle. **What you are
 * near** comes second, because it only means anything once you know what it is
 * measured against.
 *
 * The figures count up from zero on arrival. That is not decoration here in
 * the way it would be on a settings page: this is the one screen in the app
 * whose entire content is numbers somebody is proud of, and a page of high
 * scores that simply appears reads as a table. Nothing moves under
 * `prefers-reduced-motion` — see hooks/useCountUp, which is the same tween the
 * dashboard and the week's overview use, so a number arriving here behaves
 * exactly as a number arriving there.
 *
 * **Why this is not the analytics tab.** The Records tab under Analytics
 * (components/Growth/BenchmarksChapter) is about *standing*: where the last
 * thirty days rank against every other thirty, how the goals with deadlines
 * are pacing, which round numbers are cleared. This page is about the high
 * scores themselves — the single best day, the heaviest task, the longest
 * streak, and what it would take today to beat each one. Both read the same
 * history; they ask different things of it, and the tab keeps its own question
 * rather than being emptied into this.
 *
 * The arithmetic is `personalRecords` and `recordChase` in utils/growthBench.
 */
import { useCallback, useMemo } from 'react';
import { ErrorState, Loading } from '@/components';
import { Glyph } from '@/components/Growth/GrowthPanels';
import { useApi, useCountUp, useDocumentTitle, useUserData } from '@/hooks';
import { growth as growthService } from '@/services';
import type { GrowthSeries } from '@/services/growth';
import { longDate } from '@/utils/growthChapters';
import {
  personalRecords,
  recordChase,
  type BestRecord,
  type RecordChase,
} from '@/utils/growthBench';
import type { GrowthDay } from '@/types';
import '@/styles/records.css';

/** Below this there is no record worth the name — see the empty state. */
const NEED_DAYS = 3;

/**
 * One number, counted up, printed at the precision it was measured to.
 *
 * `useCountUp` is fed the rounded value rather than the raw one, which is what
 * its own note asks for: a figure shown to one decimal should not animate the
 * digits below it.
 */
function Counted({
  amount,
  decimals,
  unit,
}: {
  amount: number;
  decimals: number;
  unit: string;
}) {
  const shown = useCountUp(amount);
  const text =
    decimals > 0
      ? shown.toFixed(decimals)
      : Math.round(shown).toLocaleString();

  return (
    <span className="rc-figure">
      {/* `tabular-nums` in the stylesheet, so the digits do not jitter sideways
          while they travel. */}
      <span className="rc-num">{text}</span>
      {unit && <span className="rc-unit">{unit}</span>}
    </span>
  );
}

function RecordCard({ record }: { record: BestRecord }) {
  const unset = record.amount <= 0;

  return (
    <li className={`rc-card${unset ? ' is-unset' : ''}`}>
      <span className="rc-ico" aria-hidden="true">
        <Glyph name={record.icon} />
      </span>
      <span className="rc-label">{record.label}</span>
      {unset ? (
        /* Nothing set yet is said in words rather than as a zero. A page of
           high scores reading "0 XP" six times is a page telling somebody they
           have done nothing, which is not what an empty record means. */
        <span className="rc-none">Not set yet</span>
      ) : (
        <Counted amount={record.amount} decimals={record.decimals} unit={record.unit} />
      )}
      {record.on && <span className="rc-when">{longDate(record.on)}</span>}
    </li>
  );
}

function ChaseRow({ row }: { row: RecordChase }) {
  const shown = useCountUp(row.percent);
  const remaining =
    row.decimals > 0 ? row.remaining.toFixed(row.decimals) : Math.round(row.remaining).toLocaleString();
  const target =
    row.decimals > 0 ? row.target.toFixed(row.decimals) : Math.round(row.target).toLocaleString();

  return (
    <li className={`rc-chase${row.held ? ' is-held' : ''}`}>
      <div className="rc-chase-head">
        <span className="rc-chase-ico" aria-hidden="true">
          <Glyph name={row.icon} />
        </span>
        <span className="rc-chase-label">{row.label}</span>
        <span className="rc-chase-target">
          {target}
          {row.unit ? ` ${row.unit}` : ''}
        </span>
      </div>

      <div
        className="rc-track"
        role="progressbar"
        aria-valuenow={Math.round(row.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.label}: ${row.current} of ${row.target}`}
      >
        <i style={{ width: `${shown}%` }} />
      </div>

      <p className="rc-chase-foot">
        {row.held ? (
          <strong>Holding it — {row.window} is your best yet.</strong>
        ) : (
          <>
            <strong>
              {remaining}
              {row.unit ? ` ${row.unit}` : ''} to go
            </strong>{' '}
            — {row.window} stands at {row.decimals > 0 ? row.current.toFixed(row.decimals) : row.current.toLocaleString()}
            {row.unit ? ` ${row.unit}` : ''}.
          </>
        )}
      </p>
    </li>
  );
}

export default function Records() {
  useDocumentTitle('Records');

  const account = useUserData();
  const { username } = account;

  const seriesCall = useCallback(
    () =>
      username
        ? growthService.series(username, 0)
        : Promise.resolve({ success: false as const, message: 'Sign in to see your records.' }),
    [username],
  );
  const series = useApi<GrowthSeries>(seriesCall, [username]);

  const all: GrowthDay[] = useMemo(() => series.data?.growth_data ?? [], [series.data]);
  const streak = Number(account.data?.stats?.current_streak) || 0;
  const tasks = useMemo(() => account.data?.tasks ?? [], [account.data]);

  const records = useMemo(
    () => personalRecords(all, tasks, streak),
    [all, streak, tasks],
  );
  const chase = useMemo(() => recordChase(all, streak), [all, streak]);

  const held = records.filter((record) => record.amount > 0).length;

  if (series.loading || account.loading) return <Loading label="Reading your record" />;
  if (series.error) return <ErrorState message={series.error} onRetry={series.reload} />;

  return (
    <div className="rc-page">
      <header className="rc-head">
        <h1 className="rc-title">Records</h1>
        <p className="rc-sub">
          {all.length < NEED_DAYS
            ? 'Your high scores will appear here once there are a few days on the record.'
            : `Your own best, and how close today is to beating it. ${held} of ${records.length} set.`}
        </p>
      </header>

      {all.length < NEED_DAYS ? (
        <p className="rc-empty">
          There is nothing to beat yet. Finish some work over the next few days and this
          page fills itself in.
        </p>
      ) : (
        <>
          <section className="rc-section">
            <h2 className="rc-section-title">Personal records</h2>
            <ul className="rc-cards">
              {records.map((record) => (
                <RecordCard key={record.key} record={record} />
              ))}
            </ul>
          </section>

          <section className="rc-section">
            <h2 className="rc-section-title">Next records to go for</h2>
            {chase.length === 0 ? (
              <p className="rc-empty">
                Nothing to chase yet — a record needs to exist before there is a gap to it.
              </p>
            ) : (
              <>
                <ul className="rc-chases">
                  {chase.map((row) => (
                    <ChaseRow key={row.key} row={row} />
                  ))}
                </ul>
                <p className="rc-note">
                  Only the records with something running against them right now are here.
                  The heaviest single task has no daily counterpart to measure against — it
                  is beaten the moment it is beaten.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
