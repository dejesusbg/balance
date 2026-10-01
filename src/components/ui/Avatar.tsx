import styles from "./Avatar.module.css";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Circle with initials, brand-soft fill (design system Avatar). */
export function Avatar({ name, size = 48, muted }: { name: string; size?: number; muted?: boolean }) {
  return (
    <span
      className={`${styles.avatar} ${muted ? styles.muted : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
