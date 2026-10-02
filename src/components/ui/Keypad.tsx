"use client";

import { ArrowRight, Delete } from "lucide-react";
import { t } from "@/i18n";
import styles from "./Keypad.module.css";

const MAX_DIGITS = 13;

/**
 * Calculator-style keypad: digits on the left, ⌫ and a tall "next" disc on
 * the right (grey while disabled, as in the design system's flows).
 * Updates are applied to the latest value, so fast taps never drop digits.
 */
export function Keypad({
  onChange,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  onChange: (update: (prev: number) => number) => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
}) {
  const press = (key: string) =>
    onChange((value) => {
      const next = value === 0 ? key.replace(/^0+/, "") : `${value}${key}`;
      if (next.length > MAX_DIGITS) return value;
      return next ? Number(next) : 0;
    });

  const digit = (k: string, area?: string) => (
    <button key={k} type="button" className={styles.key} style={area ? { gridArea: area } : undefined} onClick={() => press(k)}>
      {k}
    </button>
  );

  return (
    <div className={styles.keypad}>
      {["1", "2", "3"].map((k) => digit(k))}
      <button
        type="button"
        className={styles.key}
        onClick={() => onChange((value) => Math.floor(value / 10))}
        onContextMenu={(e) => {
          e.preventDefault();
          onChange(() => 0);
        }}
        aria-label={t.quickAdd.backspace}
      >
        <Delete size={26} strokeWidth={1.75} aria-hidden />
      </button>
      {["4", "5", "6"].map((k) => digit(k))}
      <button
        type="button"
        className={styles.next}
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
      >
        <ArrowRight size={28} strokeWidth={2} aria-hidden />
      </button>
      {["7", "8", "9"].map((k) => digit(k))}
      {digit("000")}
      {digit("0", "auto / span 2")}
    </div>
  );
}
