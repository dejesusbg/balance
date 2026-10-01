"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "@/i18n";
import { Button } from "./ui";
import styles from "./Feedback.module.css";

interface ConfirmOptions {
  confirmLabel?: string;
  danger?: boolean;
}
interface ToastOptions {
  /** Shows a "Deshacer" action. */
  onUndo?: () => void | Promise<void>;
  /** A primary one-tap action (e.g. record the tithe now). Stays up longer. */
  action?: { label: string; run: () => void | Promise<void> };
}

interface FeedbackApi {
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, opts?: ToastOptions) => void;
}

const Ctx = createContext<FeedbackApi | null>(null);

export const useFeedback = () => {
  const api = useContext(Ctx);
  if (!api) throw new Error("useFeedback outside FeedbackProvider");
  return api;
};

const TOAST_MS = 6000;
const ACTION_TOAST_MS = 12000;

/** App-wide confirm dialog and toast (with undo). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    message: string;
    opts: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; opts: ToastOptions } | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback(
    (message: string, opts: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => setPending({ message, opts, resolve })),
    [],
  );

  const showToast = useCallback((message: string, opts: ToastOptions = {}) => {
    setToast({ id: Date.now(), message, opts });
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (pending && d && !d.open) d.showModal();
  }, [pending]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.opts.action ? ACTION_TOAST_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const answer = (ok: boolean) => {
    dialogRef.current?.close();
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ confirm, toast: showToast }}>
      {children}

      <dialog
        ref={dialogRef}
        className={styles.confirm}
        onCancel={(e) => {
          e.preventDefault();
          answer(false);
        }}
      >
        {pending && (
          <>
            <p className={styles.message}>{pending.message}</p>
            <div className={styles.actions}>
              <Button variant="secondary" size="md" onClick={() => answer(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant={pending.opts.danger ? "danger" : "primary"}
                size="md"
                onClick={() => answer(true)}
                autoFocus
              >
                {pending.opts.confirmLabel ?? t.common.confirm}
              </Button>
            </div>
          </>
        )}
      </dialog>

      <div className={styles.toastRegion} role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={styles.toast}>
            <span>{toast.message}</span>
            {toast.opts.action && (
              <button
                type="button"
                className={styles.action}
                onClick={async () => {
                  setToast(null);
                  await toast.opts.action?.run();
                }}
              >
                {toast.opts.action.label}
              </button>
            )}
            {toast.opts.onUndo && (
              <button
                type="button"
                className={styles.undo}
                onClick={async () => {
                  setToast(null);
                  await toast.opts.onUndo?.();
                }}
              >
                {t.common.undo}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
