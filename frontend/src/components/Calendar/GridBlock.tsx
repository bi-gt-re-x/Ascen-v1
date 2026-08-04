/**
 * One block on the time grid — an event, or a task.
 *
 * The two share a shape and differ in what they can tell you. An event is
 * painted in its own colour and says when it runs; a task is coloured by
 * difficulty, carries its XP, and says whether it is due, was finished, or
 * runs on into tomorrow. Both carry the icon guessed from their name and the
 * three-dots menu.
 *
 * A task's *name* is the button, not the block: clicking it finishes the task.
 * That is deliberate and is why the title has a role of its own — the rest of
 * the block is the block, and only the name is a commitment.
 */
import { CardMenu } from './CardMenu';
import { iconUrlFor } from '@/utils/calendarIcons';
import {
  blockLabel,
  dueLabel,
  hmLabel,
  hmLabelShort,
  shortDateTime,
  timeLabel,
  timeLabelShort,
  type Block,
} from '@/utils/calendarGrid';
import { dates } from '@/utils';

export interface GridBlockProps {
  block: Block;
  /** The day this block is drawn on, for the actions that need to know. */
  iso: string;
  onEdit: (block: Block) => void;
  onDelete: (block: Block) => void;
  /** Finishing a task from its name. Events have nothing to finish. */
  onComplete: (taskId: string) => void;
  /** True while its completion is in flight, so it cannot be clicked twice. */
  completing?: boolean;
}

/** The `.cal-ico` mask, which paints the SVG in the block's own text colour. */
function LeadIcon({ name }: { name: string }) {
  return (
    <span className="wk-event-lead">
      <i className="cal-ico" style={{ ['--ico' as string]: `url(${iconUrlFor(name)})` }} />
    </span>
  );
}

/**
 * The two strips that change one end's time.
 *
 * Dragging the rest of the block moves the whole thing, so these have to be
 * distinguishable targets — hooks/useGridDrag reads which one the press landed
 * on. They are invisible until hovered; styles/calendar/week.css draws them.
 */
function ResizeHandles() {
  return (
    <>
      <span className="wk-resize wk-resize-top" aria-hidden="true" />
      <span className="wk-resize wk-resize-bot" aria-hidden="true" />
    </>
  );
}

export function GridBlock({
  block,
  iso,
  onEdit,
  onDelete,
  onComplete,
  completing,
}: GridBlockProps) {
  const position = {
    top: block.top,
    height: block.height,
    left: 4,
    right: 4,
  };

  if (block.kind === 'event') {
    return (
      <div
        className={`wk-event wk-event-cal${block.compact ? ' is-compact' : ''}`}
        data-kind="event"
        data-iso={iso}
        data-id={block.name}
        data-start={block.startHM}
        data-end={block.endHM}
        data-move="1"
        style={{
          ...position,
          background: block.colors.fill,
          borderColor: block.colors.border,
          borderLeftColor: block.colors.left,
        }}
      >
        <ResizeHandles />
        <LeadIcon name={block.name} />
        <CardMenu
          height={block.height}
          onEdit={() => onEdit(block)}
          onDelete={() => onDelete(block)}
        />

        {block.compact ? (
          <div className="wk-event-head">
            <div className="wk-event-title">{block.name}</div>
            <span className="wk-event-start">{hmLabelShort(block.startHM)}</span>
          </div>
        ) : (
          <>
            <div className="wk-event-title">{block.name}</div>
            <div className="wk-event-foot">
              <span className="wk-event-due">
                {`${hmLabel(block.startHM)} – ${hmLabel(block.endHM)}`}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  const priorityClass =
    block.priority === 'high' ? 'prio-high' : block.priority === 'medium' ? 'prio-medium' : 'prio-low';

  // The footer says the one thing worth knowing about this block's timing: a
  // task that overruns the column says where it goes, a finished one when it
  // was finished, and everything else when it is due.
  let footText = '';
  let footClass = 'wk-event-due';
  if (block.contDT) {
    footText = `Continued on ${dates.formatDate(block.contDT, { month: 'short', day: 'numeric' })}`;
    footClass = 'wk-event-cont';
  } else if (block.done) {
    const end = block.completedDT || block.dueDT;
    footText = end ? (dates.isoDate(end) === iso ? timeLabel(end) : shortDateTime(end)) : '';
    footClass = 'wk-event-done-time';
  } else if (block.dueDT) {
    footText = `Due ${dueLabel(block.dueDT)}`;
  }

  const startText = block.compact ? timeLabelShort(block.startDT) : timeLabel(block.startDT);
  const title = `${block.title}${block.cont ? ' — continued' : ''}`;

  return (
    <div
      className={`wk-event wk-task ${priorityClass}${block.done ? ' is-done' : ''}${
        block.compact ? ' is-compact' : ''
      }${completing ? ' is-completing' : ''}`}
      data-kind="task"
      data-iso={iso}
      data-id={block.id}
      // A finished task is a record of what happened, so it does not move.
      data-move={block.done ? undefined : '1'}
      style={position}
    >
      {!block.done && <ResizeHandles />}
      <LeadIcon name={block.title} />
      <CardMenu
        height={block.height}
        onEdit={() => onEdit(block)}
        onDelete={() => onDelete(block)}
      />

      <div className="wk-event-head">
        {block.done ? (
          <div className="wk-event-title">
            <span className="wk-event-check">✓</span> {title}
          </div>
        ) : (
          <div
            className="wk-event-title wk-task-name"
            role="button"
            tabIndex={0}
            title="Click to mark complete"
            onClick={(event) => {
              event.stopPropagation();
              onComplete(block.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onComplete(block.id);
            }}
          >
            <span className="wk-task-tick" aria-hidden="true">
              ✓
            </span>
            {title}
          </div>
        )}
        {startText && <span className="wk-event-start">{startText}</span>}
      </div>

      {!block.compact && (
        <div className="wk-event-foot">
          {footText && <span className={footClass}>{footText}</span>}
          {/* "+ 60 XP", as the design writes it — what finishing this is worth,
              not a quantity it already has. */}
          <span className="wk-event-xp">+ {block.xp} XP</span>
        </div>
      )}
    </div>
  );
}

/** The label a dialog should use for a block. */
export { blockLabel };
