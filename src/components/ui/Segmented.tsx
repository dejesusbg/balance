"use client";

import type { LucideIcon } from "lucide-react";
import styles from "./Segmented.module.css";

/** Full-width pill segmented control (single choice). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  size?: "md" | "sm";
  label: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`${styles.segmented} ${size === "sm" ? styles.sm : ""}`}>
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={styles.segment}
          onClick={() => onChange(v)}
        >
          {Icon && <Icon size={18} strokeWidth={2} aria-hidden />}
          {l}
        </button>
      ))}
    </div>
  );
}
