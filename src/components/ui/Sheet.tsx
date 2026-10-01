"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { t } from "@/i18n";
import { IconButton } from ".";
import styles from "./Sheet.module.css";

/**
 * Bottom sheet built on <dialog> (focus trap, Esc to close, inert page).
 * Tapping the scrim closes it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall,
  bare,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  /** Children manage their own scrolling and padding. */
  bare?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${tall ? styles.tall : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.inner}>
          <div className={styles.handle} aria-hidden />
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <IconButton icon={X} label={t.quickAdd.close} onClick={onClose} size={40} />
          </header>
          <div className={bare ? styles.bodyBare : styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
