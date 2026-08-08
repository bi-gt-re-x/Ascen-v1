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
  hmToDate,
  hmLabelShort,
  rangeLabel,
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
  /**
   * One of the two blocks the overlap dialog is asking about. Rings it, so
   * "Show me on the grid" has something to point at.
   */
  flagged?: boolean;
}

/**
 * A block's title, with its icon on the same line.
 *
 * The icon used to be a badge floated against the block's left edge and
 * vertically centred, and only in the Day view — the Week's columns were
 * judged too narrow for it, so six days out of seven a block had no picture at
 * all. It sits inline ahead of the name in both views now, which is where the
 * design puts it: the name is the line it belongs to, and the times and the XP
 * underneath keep the block's full width instead of being indented past a
 * badge that has nothing to do with them.
 *
 * Where the drawing comes from is the other half. `iconUrlFor` guesses one
 * from the name and is still the fallback, but a task that has been *told* what
 * it is about should not be guessed at — so a task filed under a subject wears
 * that subject's icon, the same one the picker showed when it was chosen and
 * the same one the dashboard's row and the week's XP breakdown draw beside it.
 *
 * `.cal-ico` is a mask, so the SVG is painted in the block's own text colour
 * and stays legible in either theme.
 */
function BlockTitle({
  name,
  icon,
  subject,
  children,
}: {
  name: string;
  /** A subject's icon file, when the thing has a subject. */
  icon?: string;
  /** The subject's label, for the title attribute. */
  subject?: string;
  /** The ✓ or the tick placeholder a task puts before its name. */
  children?: React.ReactNode;
}) {
  const url = icon ? `/static/icons/${icon}.svg` : iconUrlFor(name);
  return (
    <>
      <i
        className="cal-ico wk-event-ico"
        style={{ ['--ico' as string]: `url(${url})` }}
        title={subject}
        aria-hidden="true"
      />
      {children}
      <span className="wk-event-name">{name}</span>
    </>
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
  flagged,
}: GridBlockProps) {
  const clash = flagged ? ' is-clashing' : '';
  const position = {
    top: block.top,
    height: block.height,
    left: 4,
    right: 4,
  };

  if (block.kind === 'event') {
    return (
      <div
        className={`wk-event wk-event-cal${block.compact ? ' is-compact' : ''}${
          block.snug ? ' is-snug' : ''
        }${clash}`}
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
        <CardMenu
          height={block.height}
          onEdit={() => onEdit(block)}
          onDelete={() => onDelete(block)}
        />

        {block.compact ? (
          <div className="wk-event-head">
            <div className="wk-event-title">
              <BlockTitle name={block.name} />
            </div>
            <span className="wk-event-start">{hmLabelShort(block.startHM)}</span>
          </div>
        ) : (
          <>
            <div className="wk-event-title">
              <BlockTitle name={block.name} />
            </div>
            <div className="wk-event-foot">
              <span className="wk-event-due">
                {rangeLabel(hmToDate(block.startHM), hmToDate(block.endHM))}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  const priorityClass =
    block.priority === 'high' ? 'prio-high' : block.priority === 'medium' ? 'prio-medium' : 'prio-low';

  // A task writes its two ends where they actually are: the start beside the
  // name on the block's top edge, the end on its bottom edge. The block *is*
  // the span, so the two labels sit on the two lines the reader is already
  // reading the times off — and the pair no longer has to fit on one line, so
  // neither of them ellipsises in a column a seventh of the grid wide. (This
  // line used to be the whole range, "11 AM – 12:25 PM", and before that "Due
  // Aug 4, 12:25 PM", which did ellipsise.) Events keep the range: an event
  // has no start label at the top to pair with.
  //
  // The exceptions are the two cases where an end time would be a lie: a task
  // that overruns the column says where it goes instead, and a finished one
  // says when it was actually finished.
  let footText = timeLabelShort(block.dueDT ?? block.startDT);
  let footClass = 'wk-event-due';
  if (block.contDT) {
    footText = `Continued on ${dates.formatDate(block.contDT, { month: 'short', day: 'numeric' })}`;
    footClass = 'wk-event-cont';
  } else if (block.done) {
    const end = block.completedDT || block.dueDT;
    footText = end ? (dates.isoDate(end) === iso ? timeLabel(end) : shortDateTime(end)) : '';
    // Finished after the deadline. The block keeps the size it was scheduled
    // at — it is a record of what was booked, and letting it grow would claim
    // time the reader never planned — so the overrun is carried entirely by
    // this label: the real finishing time, in deep red, on the block's floor.
    // Without it a late finish and an on-time one looked identical.
    const late = Boolean(
      block.completedDT && block.dueDT && block.completedDT > block.dueDT,
    );
    footClass = late ? 'wk-event-done-time is-late' : 'wk-event-done-time';
  }

  // Every task layout keeps the start beside the title, the one-row one
  // included — there it is the only time there is room for.
  const startText = timeLabelShort(block.startDT);
  const title = `${block.title}${block.cont ? ' — continued' : ''}`;

  return (
    <div
      className={`wk-event wk-task ${priorityClass}${block.done ? ' is-done' : ''}${
        block.compact ? ' is-compact' : ''
      }${block.snug ? ' is-snug' : ''}${completing ? ' is-completing' : ''}${clash}`}
      data-kind="task"
      data-iso={iso}
      data-id={block.id}
      // A finished task is a record of what happened, so it does not move.
      data-move={block.done ? undefined : '1'}
      style={position}
    >
      {!block.done && <ResizeHandles />}
      <CardMenu
        height={block.height}
        onEdit={() => onEdit(block)}
        onDelete={() => onDelete(block)}
      />

      <div className="wk-event-head">
        {block.done ? (
          <div className="wk-event-title">
            <BlockTitle
              name={title}
              icon={block.subjectIcon}
              subject={block.subjectLabel}
            >
              <span className="wk-event-check">✓</span>
            </BlockTitle>
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
            <BlockTitle
              name={title}
              icon={block.subjectIcon}
              subject={block.subjectLabel}
            >
              <span className="wk-task-tick" aria-hidden="true">
                ✓
              </span>
            </BlockTitle>
          </div>
        )}
        {startText && <span className="wk-event-start">{startText}</span>}
      </div>

      {!block.compact && (
        <>
          {/* "+ 60 XP", as the design writes it — what finishing this is worth,
              not a quantity it already has. It stays with the name at the top:
              only the end time goes to the floor of the block. */}
          <span className="wk-event-xp">+ {block.xp} XP</span>
          {footText && <span className={`wk-event-end ${footClass}`}>{footText}</span>}
        </>
      )}
    </div>
  );
}

/** The label a dialog should use for a block. */
export { blockLabel };
