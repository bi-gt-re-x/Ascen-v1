/**
 * The hour rail and a day's column — the two halves of the time grid.
 *
 * Both the Week view (seven columns) and the Day view (one) are built from
 * these, which is the point: the original rendered the same markup from the
 * same function into two different containers, and the two views could only
 * disagree by someone editing one call site.
 *
 * The now line is here rather than in a page because it belongs to the grid:
 * it is a position in the hour window, and the window is defined here.
 */
import { GridBlock } from './GridBlock';
import {
  GRID_HEIGHT,
  HOUR_H,
  START_HOUR,
  END_HOUR,
  gridHours,
  hourLabel,
  nowLabel,
  nowOffset,
  type Block,
} from '@/utils/calendarGrid';

export interface TimeLabelsProps {
  /** Where "now" sits, or null when it is off the window or another day. */
  now: number | null;
  at?: Date;
}

/**
 * How near the now badge an hour label has to be to give way to it.
 *
 * The rail is only wide enough for one of them. Twice an hour the badge lands
 * on a label and the two print over each other — "7:59 AM" over "8 AM" is a
 * red smudge that says neither. The hour is the one that goes: it can be read
 * off the rows above and below it, and the badge cannot be read off anything.
 */
const LABEL_CLEARANCE = 11;

/** The 6 AM – 5 AM rail down the left of the grid. */
export function TimeLabels({ now, at }: TimeLabelsProps) {
  return (
    <div className="wk-timelabels" style={{ height: GRID_HEIGHT }}>
      {gridHours().map((hour) => {
        const y = (hour - START_HOUR) * HOUR_H;
        const eclipsed = now !== null && Math.abs(y - now) < LABEL_CLEARANCE;
        return (
          <div key={hour} className="wk-timelabel" style={{ height: HOUR_H }}>
            <span hidden={eclipsed}>{hourLabel(hour)}</span>
          </div>
        );
      })}
      {now !== null && (
        <div className="wk-nowlabel" style={{ top: now }}>
          {nowLabel(at)}
        </div>
      )}
    </div>
  );
}

export interface DayColumnProps {
  iso: string;
  blocks: Block[];
  today?: boolean;
  /** Where "now" sits on this column, or null. */
  now?: number | null;
  /** The Day view's single column carries a second class. */
  className?: string;
  /**
   * The drag hook's hit area, when the caller wants this column to be one.
   * The Week view hands the ref to the row holding all seven; the Day view has
   * only this, so it hands it here — see hooks/useGridDrag.
   */
  hostRef?: (node: HTMLDivElement | null) => void;
  onEdit: (block: Block) => void;
  onDelete: (block: Block) => void;
  onComplete: (taskId: string) => void;
  completingId?: string | null;
}

export function DayColumn({
  iso,
  blocks,
  today,
  now = null,
  className = '',
  hostRef,
  onEdit,
  onDelete,
  onComplete,
  completingId,
}: DayColumnProps) {
  return (
    <div
      ref={hostRef}
      className={`wk-daycol${today ? ' today' : ''}${className ? ` ${className}` : ''}`}
      data-iso={iso}
      style={{ height: GRID_HEIGHT }}
    >
      {/* One rule per hour, and one under the last of them.
          The floor used to be left to the column's own edge, which draws
          nothing: the grid simply ran out under 5 AM. It is drawn here, and
          drawn heavier than the rules above it — those are a ruler behind the
          day, this is where the day stops. */}
      {gridHours().map((hour) => (
        <div
          key={hour}
          className={`wk-hourline${hour === END_HOUR ? ' is-last' : ''}`}
          style={{ top: (hour - START_HOUR) * HOUR_H }}
        />
      ))}

      {blocks.map((block) => (
        <GridBlock
          key={block.kind === 'event' ? `e:${block.name}:${block.startHM}` : `t:${block.id}`}
          block={block}
          iso={iso}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
          completing={block.kind === 'task' && completingId === block.id}
        />
      ))}

      {now !== null && <div className="wk-nowline" style={{ top: now }} />}
    </div>
  );
}

/** Where the now line goes on a day, or null when that day is not today. */
export function nowFor(iso: string, todayIso: string, at: Date): number | null {
  return iso === todayIso ? nowOffset(at) : null;
}
