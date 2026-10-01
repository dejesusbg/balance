import type { LucideIcon } from "lucide-react";
import styles from "./ActionCircle.module.css";

/** 72px circle + label below (design system ActionCircle). */
export function ActionCircle({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "brand";
}) {
  return (
    <button type="button" className={styles.action} onClick={onClick}>
      <span className={`${styles.circle} ${tone === "brand" ? styles.brand : ""}`} aria-hidden>
        <Icon size={26} strokeWidth={1.75} />
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}

/** Horizontally scrolling row that bleeds off the right edge. */
export function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
