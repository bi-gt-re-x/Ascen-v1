/**
 * The three-dots menu on a grid block: Edit, Delete.
 *
 * The dropdown is portalled to the body and positioned against the button,
 * because a block clips its own overflow and the menu is taller than most
 * blocks are. It flips above or left rather than running off the screen.
 *
 * The glyph changes with the block's height: a thin strip gets the horizontal
 * ellipsis, anything taller the usual vertical one.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CardMenuProps {
  /** The block's height in pixels, which decides the glyph. */
  height: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function CardMenu({ height, onEdit, onDelete }: CardMenuProps) {
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  // Anchor after the popup exists, so its real size decides whether it flips.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const anchor = button.current.getBoundingClientRect();
    const width = popup.current?.offsetWidth || 120;
    const tall = popup.current?.offsetHeight || 72;
    const left = Math.max(6, Math.min(anchor.right - width, window.innerWidth - width - 6));
    let top = anchor.bottom + 4;
    if (top + tall > window.innerHeight - 6) top = Math.max(6, anchor.top - tall - 4);
    setPosition({ left, top });
  }, [open]);

  // Anything that moves the page out from under the menu closes it: a click
  // elsewhere, a scroll of the grid, a resize.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="wk-card-menu"
        aria-label="Options"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((was) => !was);
        }}
      >
        {height < 44 ? '⋯' : '⋮'}
      </button>

      {open &&
        createPortal(
          <div
            ref={popup}
            className="wk-card-pop"
            style={{ left: position.left, top: position.top }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="wk-dd-item"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="wk-dd-item wk-dd-del"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
