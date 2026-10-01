"use client";

import { Delete } from "lucide-react";
import { t } from "@/i18n";
import styles from "./Keypad.module.css";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0"] as const;
const MAX_DIGITS = 13;

/**
 * Large numeric keypad that edits an integer amount. Updates are applied to
 * the latest value, so fast taps between renders never drop digits.
 */
export function Keypad({
  onChange,
}: {
  onChange: (update: (prev: number) => number) => void;
}) {
  const press = (key: string) =>
    onChange((value) => {
      const next = value === 0 ? key.replace(/^0+/, "") : `${value}${key}`;
      if (next.length > MAX_DIGITS) return value;
      return next ? Number(next) : 0;
    });
  const back = () => onChange((value) => Math.floor(value / 10));

  return (
    <div className={styles.keypad}>
      {KEYS.map((k) => (
        <button key={k} type="button" className={styles.key} onClick={() => press(k)}>
          {k}
        </button>
      ))}
      <button
        type="button"
        className={styles.key}
        onClick={back}
        onContextMenu={(e) => {
          e.preventDefault();
          onChange(() => 0);
        }}
        aria-label={t.quickAdd.backspace}
      >
        <Delete size={26} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
