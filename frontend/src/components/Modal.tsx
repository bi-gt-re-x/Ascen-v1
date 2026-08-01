/**
 * A modal dialog.
 *
 * Built on the native `<dialog>` element, which is the only way to get the top
 * layer, the backdrop, focus trapping and Escape without reimplementing all
 * four badly. What is added on top is the part `<dialog>` does not do:
 *
 *   * a click on the backdrop closes it — the element's own hit area covers
 *     the whole viewport, so "was the click outside the panel?" is answered
 *     geometrically rather than by walking the DOM;
 *   * `cancel` (Escape) is routed through the same `onClose` as everything
 *     else, so a caller has one way to hear about a close;
 *   * body scrolling is locked while it is open, or the page behind it scrolls
 *     under the user's cursor.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Buttons along the bottom. */
  footer?: ReactNode;
  /** Set false for a step the user must answer rather than dismiss. */
  dismissable?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissable = true,
  className = '',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleCancel = useCallback(
    (event: Event) => {
      // Escape. Prevented when the dialog is not dismissable, otherwise routed
      // through onClose so React state stays in step with the DOM.
      event.preventDefault();
      if (dismissable) onClose();
    },
    [dismissable, onClose],
  );

  useEffect(() => {
    const dialog = ref.current;
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [handleCancel]);

  /** A click on the dialog itself, outside the panel, is a backdrop click. */
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (!dismissable || event.target !== ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const outside =
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom;
    if (outside) onClose();
  };

  return (
    <dialog ref={ref} className={`modal ${className}`.trim()} onClick={handleClick}>
      <div className="modal-panel">
        {(title || dismissable) && (
          <header className="modal-header">
            {title && <h2 className="modal-title">{title}</h2>}
            {dismissable && (
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                &times;
              </button>
            )}
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
