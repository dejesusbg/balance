"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Period, ReasonBreakdown } from "@/domain/reports";
import { percentChange } from "@/domain/reports";
import type { AppData } from "../AppData";
import { t } from "@/i18n";
import styles from "./charts.module.css";

/**
 * Ranked list + horizontal bar per reason (single series, so the section
 * title names it and no legend is needed). Each row opens its movements.
 */
export function ReasonBars({
  title,
  breakdown,
  series,
  period,
  data,
}: {
  title: string;
  breakdown: ReasonBreakdown;
  series: "in" | "out" | "neutral";
  period: Period;
  data: AppData;
}) {
  const max = breakdown.rows[0]?.amount ?? 0;
  const change = percentChange(breakdown.total, breakdown.previousTotal);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className="section-title">{title}</h2>
        <span className={`money ${styles.total}`}>{data.fmt(breakdown.total)}</span>
      </div>
      {change !== null && <p className={styles.change}>{t.reports.vsPrevious(change)}</p>}

      {breakdown.rows.length === 0 ? (
        <p className="muted">{t.reports.noData}</p>
      ) : (
        <ul className={styles.rows}>
          {breakdown.rows.map((r) => {
            const name = r.reasonId
              ? (data.reasonById.get(r.reasonId)?.name ?? t.reports.noReason)
              : t.reports.noReason;
            const pct = percentChange(r.amount, r.previous);
            const params = new URLSearchParams({
              desde: String(period.from),
              hasta: String(period.to),
              ...(r.reasonId ? { motivo: r.reasonId } : {}),
            });
            return (
              <li key={r.reasonId ?? "none"}>
                <Link
                  href={`/movimientos?${params}`}
                  className={styles.row}
                  aria-label={t.reports.seeMovements(name)}
                >
                  <span className={styles.rowHead}>
                    <span className={styles.rowName}>{name}</span>
                    <span className={`money ${styles.rowAmount}`}>{data.fmt(r.amount)}</span>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden className={styles.chevron} />
                  </span>
                  <span className={styles.track} aria-hidden>
                    <span
                      className={styles[`fill_${series}`]}
                      style={{ width: `${max ? Math.max(2, (r.amount / max) * 100) : 0}%` }}
                    />
                  </span>
                  <span className={styles.rowSub}>
                    {t.reports.count(r.count)} ·{" "}
                    {Math.round((r.amount / breakdown.total) * 100)}%
                    {pct !== null ? ` · ${t.reports.vsPrevious(pct)}` : ` · ${t.reports.newInPeriod}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
