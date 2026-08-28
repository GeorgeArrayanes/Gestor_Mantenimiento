import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container) {
  return Array.from(container?.querySelectorAll(focusableSelector) || []).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0,
  );
}

/**
 * Accessible overlay shared by the fleet forms.
 * It owns focus while open, restores it on close and keeps the document behind it still.
 * Backdrop clicks are ignored by default so an accidental click cannot discard form data.
 */
export default function Modal({
  as: Element = 'div',
  children,
  labelledBy,
  describedBy,
  initialFocusSelector = '[data-autofocus]',
  onClose,
  closeOnBackdrop = false,
  className = 'modal',
  ...elementProps
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusInitialElement = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const preferred = dialog.querySelector(initialFocusSelector);
      (preferred || getFocusable(dialog)[0] || dialog).focus();
    });

    function handleKeyDown(event) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInitialElement);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const returnTarget = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
  }, [initialFocusSelector]);

  function handleBackdropClick(event) {
    if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current?.();
  }

  return createPortal(
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <Element
        {...elementProps}
        ref={dialogRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy || undefined}
        tabIndex={-1}
      >
        {children}
      </Element>
    </div>,
    document.body,
  );
}
