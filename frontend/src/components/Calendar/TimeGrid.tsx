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

/** The 6 AM – 5 AM rail down the left of the grid. */
export function TimeLabels({ now, at }: TimeLabelsProps) {
  return (
    <div className="wk-timelabels" style={{ height: GRID_HEIGHT }}>
      {gridHours().map((hour) => (
        <div key={hour} className="wk-timelabel" style={{ height: HOUR_H }}>
          <span>{hourLabel(hour)}</span>
        </div>
      ))}
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
      {/* One rule per hour. The last one is the window's floor, drawn by the
          column's own edge, so the loop stops short of it. */}
      {gridHours()
        .filter((hour) => hour < END_HOUR)
        .map((hour) => (
          <div
            key={hour}
            className="wk-hourline"
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
