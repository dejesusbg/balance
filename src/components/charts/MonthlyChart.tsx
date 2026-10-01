"use client";

import { useState } from "react";
import type { MonthTotals } from "@/domain/reports";
import { t } from "@/i18n";
import styles from "./charts.module.css";

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "short" });
const monthLongFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
/** "octubre de 2026" -> "Octubre de 2026" */
const monthLong = (ts: number) => {
  const s = monthLongFmt.format(ts);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const compactFmt = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });

const W = 340;
const H = 168;
const PAD = { top: 8, right: 4, bottom: 22, left: 40 };
const BAR_GAP = 2; // surface gap between the two bars of a month

/** Nice round max for the y axis (1, 2, 2.5 or 5 × 10^n). */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

/**
 * Income vs expense per month: grouped columns, one shared axis, legend,
 * hover/tap tooltip, and the same numbers as a table for screen readers.
 */
export function MonthlyChart({
  data,
  fmt,
}: {
  data: MonthTotals[];
  fmt: (n: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.income, d.expense))));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(18, (slot * 0.62 - BAR_GAP) / 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  // Column with rounded data-end (top), square at the baseline.
  const bar = (x: number, v: number, cls: string) => {
    const h = (v / max) * plotH;
    if (h <= 0) return null;
    const r = Math.min(4, h, barW / 2);
    const top = PAD.top + plotH - h;
    const base = PAD.top + plotH;
    return (
      <path
        className={cls}
        d={`M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`}
      />
    );
  };

  const a = active !== null ? data[active] : null;

  return (
    <figure className={styles.figure}>
      <div className={styles.legend} aria-hidden>
        <span><i className={styles.swatchIn} />{t.reports.in}</span>
        <span><i className={styles.swatchOut} />{t.reports.out}</span>
      </div>

      <div className={styles.plotWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={t.reports.monthlyHint}>
          {ticks.map((v) => (
            <g key={v}>
              <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className={styles.tick} x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
                {compactFmt.format(v)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const x0 = cx - barW - BAR_GAP / 2;
            return (
              <g key={d.start} className={active === i ? styles.active : undefined}>
                {bar(x0, d.income, styles.barIn)}
                {bar(cx + BAR_GAP / 2, d.expense, styles.barOut)}
                <text className={styles.tick} x={cx} y={H - 6} textAnchor="middle">
                  {monthFmt.format(d.start).replace(".", "")}
                </text>
                {/* Hit target: the whole column slot, bigger than the bars. */}
                <rect
                  className={styles.hit}
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH + PAD.bottom}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>

        {a && active !== null && (
          <div
            className={styles.tooltip}
            style={{ left: `${((PAD.left + slot * active + slot / 2) / W) * 100}%` }}
            role="status"
          >
            <strong>{monthLong(a.start)}</strong>
            <span><i className={styles.swatchIn} />{t.reports.in}: {fmt(a.income)}</span>
            <span><i className={styles.swatchOut} />{t.reports.out}: {fmt(a.expense)}</span>
            <span>{t.reports.net}: {fmt(a.income - a.expense)}</span>
          </div>
        )}
      </div>

      <table className={styles.table}>
        <caption className="visually-hidden">{t.reports.monthlyHint}</caption>
        <thead>
          <tr>
            <th scope="col">{t.reports.month}</th>
            <th scope="col">{t.reports.in}</th>
            <th scope="col">{t.reports.out}</th>
            <th scope="col">{t.reports.net}</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.start}>
              <th scope="row">{monthLong(d.start)}</th>
              <td className="money">{fmt(d.income)}</td>
              <td className="money">{fmt(d.expense)}</td>
              <td className={`money ${d.income - d.expense > 0 ? "money-in" : ""}`}>
                {fmt(d.income - d.expense)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
