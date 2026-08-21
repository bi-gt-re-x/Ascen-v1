/**
 * Long Term — the future, and the only chapter that states anything that has
 * not happened.
 *
 * Every other tab is a reading of what is recorded. This one takes the
 * account's own trend and follows it forwards, which is worth doing and worth
 * being careful about: every figure in it is a straight line at a measured
 * pace, the panel says which pace and over how many days, and the last panel
 * says what the line does not know.
 *
 * The parts it is drawn with — the hero row, the tiles, the notes — are shared
 * with the other three chapters (ChapterParts), because the four tabs are one
 * system looking at one account from four angles, and a tab that re-invented
 * the furniture would read as a different product.
 */
import {
  PACE_DAYS,
  compact,
  longDate,
  milestoneEtas,
  outlook,
  projection,
} from '@/utils/growthChapters';
import type { GrowthDay } from '@/types';
import { levelForTotalXp } from '@/utils/format';
import {
  EmptyChapter,
  H,
  HeroRow,
  Notes,
  PanelHead,
  Tiles,
  W,
  monthMarks,
} from './ChapterParts';
import { Glyph, Hint } from './GrowthPanels';

/**
 * The cumulative curve, and the straight line it becomes.
 *
 * Two paths over one x-axis: the recorded points, then the projected ones
 * starting at the last recorded value so the join is a continuation rather
 * than a step. The projected half is drawn in the accent at half weight, and
 * the split is marked, because the one thing a reader must be able to see at a
 * glance is where measurement stops and arithmetic starts.
 *
 * The dots and labels reuse the long term panel's classes, so this looks like
 * the chart on Overview rather than like a second chart language.
 */
function ProjectionPlot({ all }: { all: GrowthDay[] }) {
  const data = projection(all);
  if (data.past.length < 2) return null;

  const top = data.ticks[data.ticks.length - 1] || 1;
  const count = data.past.length + data.future.length - 1;
  const step = count > 1 ? W / (count - 1) : 0;
  const y = (value: number) => H - Math.min(1, Math.max(0, value / top)) * H;

  const path = (values: number[], from: number) =>
    values
      .map((value, index) => `${index === 0 ? 'M' : 'L'}${((from + index) * step).toFixed(2)} ${y(value).toFixed(2)}`)
      .join(' ');

  return (
    <div className="gr-lt-plot">
      <div className="gr-lt-ticks" aria-hidden="true">
        {[...data.ticks].reverse().map((tick) => (
          <span key={tick}>{compact(tick)}</span>
        ))}
      </div>

      <div className="gr-lt-box">
        <svg
          className="gr-lt-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Cumulative XP so far, and projected forward at ${Math.round(
            data.rate,
          )} XP a day.`}
        >
          {data.ticks.map((tick) => (
            <line
              key={tick}
              className="gr-lt-grid"
              x1="0"
              x2={W}
              y1={y(tick)}
              y2={y(tick)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Where measurement stops. */}
          <line
            className="gr-lt-grid gr-split"
            x1={(data.splitAt * step).toFixed(2)}
            x2={(data.splitAt * step).toFixed(2)}
            y1="0"
            y2={H}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="gr-lt-line tone-xp"
            d={path(data.past, 0)}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="gr-lt-line tone-future"
            d={path(data.future, data.splitAt)}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="gr-lt-dots" aria-hidden="true">
          {data.past.map((value, index) => (
            <i
              key={`past-${index}`}
              className="gr-lt-dot tone-xp"
              style={{
                left: `${index * step}%`,
                bottom: `${Math.min(100, Math.max(0, (value / top) * 100))}%`,
                ['--i' as string]: index,
                ['--n' as string]: Math.max(1, count - 1),
              }}
            />
          ))}
          {data.future.slice(1).map((value, index) => (
            <i
              key={`future-${index}`}
              className="gr-lt-dot tone-future"
              style={{
                left: `${(data.splitAt + index + 1) * step}%`,
                bottom: `${Math.min(100, Math.max(0, (value / top) * 100))}%`,
                ['--i' as string]: data.splitAt + index + 1,
                ['--n' as string]: Math.max(1, count - 1),
              }}
            />
          ))}
        </div>

        <div className="gr-lt-marks" aria-hidden="true">
          {monthMarks(data.labels).map((mark) => (
            <span
              key={`${mark.label}-${mark.index}`}
              className={mark.index === count - 1 ? 'is-end' : undefined}
              style={{ left: `${mark.index * step}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface LongTermChapterProps {
  all: GrowthDay[];
  streak: number;
}

/**
 * Long Term — where this ends up.
 *
 * The chapter Overview cannot be: every other panel on this page is a reading
 * of what happened, and this one is the only place the account's own trend is
 * pointed forwards and followed. It is deliberately modest about it — one
 * rate, stated, applied four ways.
 */
export function LongTermChapter({ all, streak }: LongTermChapterProps) {
  if (all.length < 3) {
    return (
      <EmptyChapter
        title="Long Term"
        message="A few more days of history and there will be a trend worth projecting."
      />
    );
  }

  const rows = outlook(all);
  const etas = milestoneEtas(all, streak);
  const data = projection(all);
  const rate = Math.round(data.rate);
  const now = Number(all[all.length - 1]?.cumulative_xp) || 0;
  const level = levelForTotalXp(now);
  const year = rows[rows.length - 1];
  const nextXp = etas.find((row) => row.kind === 'xp');

  return (
    <div className="gr-grid">
      {/* --- Four figures, the whole width ---------------------------------- */}
      <div className="gr-span-3">
        <HeroRow
          cards={[
            {
              key: 'level',
              label: 'Level today',
              value: level.level,
              scale: `· ${Math.round(level.percent)}% through`,
              foot: `${Math.round(now).toLocaleString()} XP earned, all of it recorded`,
              icon: 'trophy',
            },
            {
              key: 'pace',
              label: 'Pace',
              value: rate,
              suffix: ' XP',
              scale: 'a day',
              foot: `the last ${PACE_DAYS} days averaged out, quiet days included`,
              icon: 'trend',
            },
            {
              key: 'year',
              label: 'In a year, at this pace',
              value: year?.level ?? level.level,
              scale: `· ${compact(year?.xp ?? now)} XP`,
              foot:
                year && year.levelsGained > 0
                  ? `${year.levelsGained} levels from here — arithmetic, not a promise`
                  : 'the same level — this is a straight line, not a forecast',
              icon: 'target',
            },
            {
              key: 'next',
              label: nextXp ? nextXp.name : 'Next milestone',
              value: nextXp?.inDays ?? 0,
              scale: 'days',
              foot:
                nextXp && nextXp.on
                  ? `about ${longDate(nextXp.on)} if nothing changes`
                  : 'already reached',
              icon: 'award',
            },
          ]}
        />
      </div>

      <section className="gr-panel gr-span-2 gr-chart-panel">
        <div className="gr-panel-head">
          <h2 className="gr-panel-title">
            Where this is heading
            <Hint
              text={`The recorded curve, continued at ${rate} XP a day — your last ${PACE_DAYS} days, quiet ones included. A straight line, nothing more.`}
            />
          </h2>
          <span className="gr-panel-note">
            projected at {rate.toLocaleString()} XP/day
          </span>
        </div>
        <ProjectionPlot all={all} />
        <ul className="gr-lt-legend">
          <li>
            <i className="gr-lt-key tone-xp" aria-hidden="true" />
            <span className="gr-lt-name">Recorded</span>
          </li>
          <li>
            <i className="gr-lt-key tone-future" aria-hidden="true" />
            <span className="gr-lt-name">Projected</span>
          </li>
        </ul>
      </section>

      <section className="gr-panel">
        <PanelHead title="The outlook" icon="trend" note="if nothing changes" />
        <Tiles
          tiles={rows.map((row, index) => ({
            key: row.key,
            label: row.label,
            value: row.xp,
            icon: ['spark', 'target', 'trend', 'trophy'][index] ?? 'spark',
            foot: `Level ${row.level}${
              row.levelsGained > 0 ? ` · +${row.levelsGained}` : ''
            } · ${longDate(row.on)}`,
          }))}
        />
      </section>

      <section className="gr-panel gr-span-2">
        <PanelHead
          title="When the next ones land"
          icon="award"
          hint="XP and focus can be projected. A streak only counts down"
        />
        <ul className="gr-miles">
          {etas.map((row) => (
            <li className={`gr-mile tone-${row.kind}`} key={row.kind}>
              <span className={`gr-mile-ico tone-${row.kind}`} aria-hidden="true">
                <Glyph
                  name={row.kind === 'xp' ? 'trophy' : row.kind === 'focus' ? 'clock' : 'flame'}
                  size={15}
                />
              </span>
              <div className="gr-mile-body">
                <span className="gr-mile-name">{row.name}</span>
                <span className="gr-mile-sub">
                  {row.inDays === null
                    ? 'Reached — nothing to wait for'
                    : row.kind === 'streak'
                      ? `${row.inDays} more days without missing one`
                      : `About ${row.inDays} days — ${longDate(row.on!)}`}
                </span>
                <span className="gr-mile-track">
                  <i
                    className={`gr-mile-fill tone-${row.kind}`}
                    style={{
                      width: `${Math.min(100, Math.round((row.progress / row.target) * 100))}%`,
                    }}
                  />
                </span>
              </div>
              <span className={`gr-mile-reward tone-${row.kind}`}>+{row.reward} XP</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="gr-panel">
        <PanelHead title="What the line assumes" icon="bulb" />
        <Notes
          rows={[
            {
              tone: 'note',
              icon: 'info',
              head: `${rate.toLocaleString()} XP a day, every day.`,
              hint: `That is the last ${PACE_DAYS} days averaged out, quiet days included — not the average of the days you worked.`,
            },
            {
              tone: 'watch',
              icon: 'alert',
              head: 'Nothing here knows about next month.',
              hint: 'No holidays, no exam weeks, no slow Decembers. A straight line is the most this data can honestly support.',
            },
            {
              tone: 'good',
              icon: 'check',
              head: `${Math.round(now).toLocaleString()} XP is the part that is real.`,
              hint: 'Everything to the right of the marked line is arithmetic, and everything to the left of it happened.',
            },
          ]}
        />
      </section>
    </div>
  );
}
