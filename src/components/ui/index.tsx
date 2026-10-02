"use client";

import { ChevronLeft, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { t } from "@/i18n";
import styles from "./ui.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "inverse" | "danger" | "link";
  size?: "lg" | "md" | "sm";
  full?: boolean;
  icon?: LucideIcon;
};

export function Button({
  variant = "primary",
  size = "lg",
  full,
  icon: Icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[size], styles[variant], full && styles.full, className)}
      {...rest}
    >
      {Icon && <Icon size={20} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  tone?: "plain" | "neutral" | "onBrand";
  size?: number;
  iconSize?: number;
};

export function IconButton({
  icon: Icon,
  label,
  tone = "plain",
  size = 48,
  iconSize = 24,
  className,
  style,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, tone !== "plain" && styles[tone], className)}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/** Single-select chip row. Scrolls horizontally unless `wrap`. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  wrap,
}: {
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.chips, wrap && styles.chipsWrap)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={styles.chip}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass = styles.input;

export function Toggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.toggleText}>
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
      </span>
    </label>
  );
}

export const fieldLabelClass = styles.fieldLabel;

export function Badge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}

/**
 * Minimal bar with a back chevron; big titles live in the page body.
 * Goes back in history, or to `fallback` when the page was opened directly.
 */
export function TopBar({
  title,
  onBack,
  fallback = "/",
}: {
  title?: string;
  onBack?: () => void;
  fallback?: string;
}) {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push(fallback));
  return (
    <div className={styles.topBar}>
      <IconButton icon={ChevronLeft} iconSize={28} label={t.common.back} onClick={onBack ?? back} />
      <div className={styles.topBarTitle}>{title}</div>
      <span />
    </div>
  );
}
