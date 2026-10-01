// Pure report math: totals by reason for a period, comparisons, monthly series.

import type { Amount, ID, Movement } from "./types";

export type PeriodPreset = "thisMonth" | "lastMonth" | "last3" | "custom";

export interface Period {
  /** Inclusive, epoch ms. */
  from: number;
  /** Inclusive, epoch ms. */
  to: number;
  /**
   * Calendar months the period spans when month-aligned. The previous period
   * then shifts by that many months (so "this month so far" is compared with
   * the same days of last month); otherwise by the period's length.
   */
  months?: number;
}

const startOfMonth = (ts: number, offset = 0) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();
};

/** Same day/time `n` months away, clamped to the target month's last day. */
export function shiftMonths(ts: number, n: number): number {
  const d = new Date(ts);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  target.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return target.getTime();
}

export function presetPeriod(preset: Exclude<PeriodPreset, "custom">, now: number): Period {
  switch (preset) {
    case "thisMonth":
      return { from: startOfMonth(now), to: now, months: 1 };
    case "lastMonth":
      return { from: startOfMonth(now, -1), to: startOfMonth(now) - 1, months: 1 };
    case "last3":
      return { from: startOfMonth(now, -2), to: now, months: 3 };
  }
}

export function previousPeriod(p: Period): Period {
  if (p.months) {
    const from = shiftMonths(p.from, -p.months);
    // A full-month "to" (last ms of a month) maps to the last ms of that month.
    const fullMonthEnd = p.to === startOfMonth(p.to + 1) - 1;
    const to = fullMonthEnd ? startOfMonth(p.from) - 1 : shiftMonths(p.to, -p.months);
    return { from, to, months: p.months };
  }
  const length = p.to - p.from + 1;
  return { from: p.from - length, to: p.from - 1 };
}

const inPeriod = (m: Movement, p: Period) => m.date >= p.from && m.date <= p.to;

export interface ReasonRow {
  reasonId: ID | undefined;
  amount: Amount;
  count: number;
  /** Same reason in the previous period. */
  previous: Amount;
}

export interface ReasonBreakdown {
  total: Amount;
  previousTotal: Amount;
  rows: ReasonRow[];
}

/** Totals per reason for movements matching `select`, with the previous period. */
export function breakdown(
  movements: Movement[],
  period: Period,
  select: (m: Movement) => boolean,
): ReasonBreakdown {
  const prev = previousPeriod(period);
  const rows = new Map<ID | undefined, ReasonRow>();
  const row = (id: ID | undefined) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { reasonId: id, amount: 0, count: 0, previous: 0 }));
    return r;
  };
  let total = 0;
  let previousTotal = 0;
  for (const m of movements) {
    if (!select(m)) continue;
    if (inPeriod(m, period)) {
      const r = row(m.reasonId);
      r.amount += m.amount;
      r.count += 1;
      total += m.amount;
    } else if (inPeriod(m, prev)) {
      row(m.reasonId).previous += m.amount;
      previousTotal += m.amount;
    }
  }
  return {
    total,
    previousTotal,
    // Reasons only seen in the previous period are dropped from the ranking.
    rows: [...rows.values()].filter((r) => r.count > 0).sort((a, b) => b.amount - a.amount),
  };
}

export const SELECTORS = {
  income: (m: Movement) => m.type === "income",
  expense: (m: Movement) => m.type === "expense",
  lent: (m: Movement) => m.type === "lend",
  borrowed: (m: Movement) => m.type === "borrow",
};

export interface Report {
  income: ReasonBreakdown;
  expense: ReasonBreakdown;
  lent: ReasonBreakdown;
  borrowed: ReasonBreakdown;
  /** Debt I forgave others in the period: money that won't come back. */
  forgivenByMe: Amount;
}

export function buildReport(movements: Movement[], period: Period): Report {
  let forgivenByMe = 0;
  for (const m of movements) {
    if (m.type === "settlement" && m.forgiven && m.direction !== "out" && inPeriod(m, period)) {
      forgivenByMe += m.amount;
    }
  }
  return {
    income: breakdown(movements, period, SELECTORS.income),
    expense: breakdown(movements, period, SELECTORS.expense),
    lent: breakdown(movements, period, SELECTORS.lent),
    borrowed: breakdown(movements, period, SELECTORS.borrowed),
    forgivenByMe,
  };
}

export interface MonthTotals {
  /** Start of the month (epoch ms, local). */
  start: number;
  income: Amount;
  expense: Amount;
}

/** Income and expense per calendar month, oldest first, ending with `now`'s month. */
export function monthlyTotals(movements: Movement[], months: number, now: number): MonthTotals[] {
  const out: MonthTotals[] = Array.from({ length: months }, (_, i) => ({
    start: startOfMonth(now, i - months + 1),
    income: 0,
    expense: 0,
  }));
  const first = out[0].start;
  const end = startOfMonth(now, 1);
  for (const m of movements) {
    if (m.date < first || m.date >= end) continue;
    if (m.type !== "income" && m.type !== "expense") continue;
    const d = new Date(m.date);
    const now0 = new Date(now);
    const index =
      months - 1 - ((now0.getFullYear() - d.getFullYear()) * 12 + now0.getMonth() - d.getMonth());
    out[index][m.type] += m.amount;
  }
  return out;
}

/** Percentage change, or null when there's no previous value to compare. */
export const percentChange = (current: Amount, previous: Amount): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
