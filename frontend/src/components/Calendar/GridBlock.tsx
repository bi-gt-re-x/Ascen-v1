/**
 * One block on the time grid — an event, or a task.
 *
 * The two share a shape and differ in what they can tell you. An event says
 * when it runs; a task carries its XP, its difficulty and whether it is
 * overdue, finished, or running on into tomorrow. Both carry the icon guessed
 * from their name and the three-dots menu.
 *
 * **No colour is written here.** Every block carries `data-family` — one of the
 * twelve in utils/eventPalette — and styles/calendar/palette.css turns that into
 * a tint, an edge and an ink for whichever theme and state it is in. The one
 * thing that is not the family's is a task's left edge, which is its
 * difficulty; the category is then carried by the tint and by the dot beside
 * the name, so it is never invisible.
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
  dot,
  done,
  children,
}: {
  name: string;
  /** A subject's icon file, when the thing has a subject. */
  icon?: string;
  /** The subject's label, for the title attribute. */
  subject?: string;
  /**
   * Draw the small category mark ahead of the icon.
   *
   * Tasks only. An event says which family it is in with the accent down its
   * left edge; on a task that edge is spent on difficulty, so the family needs
   * somewhere else to be said out loud. The tint alone is not enough — at the
   * lightest rung two families can look similar across a whole grid — and this
   * is a solid 7px of the accent itself.
   */
  dot?: boolean;
  /**
   * The task is finished, so the mark is a tick rather than a dot.
   *
   * The same slot, the same colour, one glyph instead of a disc — a finished
   * task used to carry both, which is two marks saying two things in the space
   * the eye reads as one. The tick is the more useful of the two and the family
   * is still on the block in its tint, so this is the one that wins.
   */
  done?: boolean;
  /** The ✓ or the tick placeholder a task puts before its name. */
  children?: React.ReactNode;
}) {
  const url = icon ? `/static/icons/${icon}.svg` : iconUrlFor(name);
  return (
    <>
      {dot &&
        (done ? (
          <span className="cal-dot is-done" aria-hidden="true">
            ✓
          </span>
        ) : (
          <i className="cal-dot" aria-hidden="true" />
        ))}
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
        // Every colour on this element comes from the family — see
        // styles/calendar/palette.css. Nothing is painted inline any more.
        data-family={block.family}
        style={position}
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

  // Difficulty is the left edge and nothing else.
  //
  // It used to be the whole block: a task was painted blue, amber or red from
  // end to end, so twenty tasks on a week were three colours and the only thing
  // a reader could tell at a glance was how hard their week was — not which of
  // the twenty they were looking at. The class still rides on the element, and
  // styles/calendar/palette.css spends it on `border-left-color` alone.
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
  // The one exception is a task that overruns the column: it says where it
  // goes instead, because that is a different day and a time alone would not
  // say so.
  const endDT = block.dueDT ?? block.startDT;
  let footText = timeLabelShort(endDT);
  let footClass = 'wk-event-due';
  if (block.contDT) {
    // The one case that still names a day, because it is a different one.
    footText = `Continued on ${dates.formatDate(block.contDT, { month: 'short', day: 'numeric' })}`;
    footClass = 'wk-event-cont';
  } else if (block.snug) {
    // A short block gets one line under its name, and that line is the whole
    // span: "8:30 – 9 AM". It used to be a single time, and on a finished task
    // it was the moment it was ticked off *with its date on it* — so a block
    // drawn from 8:30 to 9:00 read "Aug 10 7:13 PM", which is neither of the
    // two times the reader dragged out. A block says when it runs. When it was
    // actually finished is what the tick and the green name are for.
    footText = rangeLabel(block.startDT, endDT);
  }

  // Every task layout keeps the start beside the title, the one-row one
  // included — there it is the only time there is room for.
  const startText = timeLabelShort(block.startDT);
  const title = `${block.title}${block.cont ? ' — continued' : ''}`;

  return (
    <div
      className={`wk-event wk-task ${priorityClass}${block.done ? ' is-done' : ''}${
        block.overdue ? ' is-overdue' : ''
      }${
        block.compact ? ' is-compact' : ''
      }${block.snug ? ' is-snug' : ''}${completing ? ' is-completing' : ''}${clash}`}
      data-kind="task"
      data-iso={iso}
      data-id={block.id}
      // A finished task is a record of what happened, so it does not move.
      data-move={block.done ? undefined : '1'}
      // The family paints the tint, the edge and the ink; `priorityClass` owns
      // the left edge alone. See styles/calendar/palette.css.
      data-family={block.family}
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
              dot
              done
            />
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
              dot
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
