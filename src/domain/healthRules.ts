// Health-check verdicts. Every threshold is here, in one place: tweak the
// numbers in THRESHOLDS to make the app stricter or more relaxed. Wording
// lives in i18n (t.health.verdicts).

import { DAYS_PER_MONTH, type HealthMetrics } from "./health";
import type { Amount } from "./types";

export const THRESHOLDS = {
  /** Projected month spend vs the 3-month average: above → warn / bad. */
  spendPace: { warn: 0.05, bad: 0.2 },
  /** Don't judge the pace before this many days of the month. */
  spendPaceMinDays: 5,
  /** Runway in months: below → bad / warn. */
  runway: { bad: 1, warn: 3 },
  /** Savings rate this month: below → warn (negative is always bad). */
  savingsWarn: 0.1,
  /** Income variation (stdev / average): above → warn, below → good. */
  incomeCv: { stable: 0.25, volatile: 0.5 },
  /** Months of data needed before judging income stability. */
  incomeMinMonths: 3,
  /** Share of spending that is discretionary: above → warn. */
  discretionaryShare: 0.5,
  /** Share of my money that's lent out: above → warn. */
  lentShare: 0.3,
  /** An unpaid loan older than this many days → warn. */
  oldLoanDays: 90,
} as const;

export type Level = "good" | "warn" | "bad";

/** Data a verdict needs; the UI turns it into a sentence via t.health.verdicts. */
export type Verdict =
  | { id: "spendPace"; level: Level; pct: number }
  | { id: "runway"; level: Level; months: number; days: number }
  | { id: "projection"; level: Level; net: Amount }
  | { id: "savings"; level: Level; rate: number; avg: number | null }
  | { id: "noIncomeYet"; level: Level; spent: Amount }
  | { id: "incomeVolatile"; level: Level; min: Amount; max: Amount }
  | { id: "incomeStable"; level: Level }
  | { id: "discretionary"; level: Level; pct: number }
  | { id: "lentShare"; level: Level; pct: number }
  | { id: "oldLoan"; level: Level; name: string; amount: Amount; days: number }
  | { id: "tithing"; level: Level; amount: Amount };

const ORDER: Record<Level, number> = { bad: 0, warn: 1, good: 2 };

export function verdicts(h: HealthMetrics): Verdict[] {
  const out: Verdict[] = [];
  const T = THRESHOLDS;

  // Spending pace vs the recent average.
  if (h.avgSpend && h.month.daysElapsed >= T.spendPaceMinDays) {
    const diff = h.month.projectedExpense / h.avgSpend - 1;
    const level: Level = diff >= T.spendPace.bad ? "bad" : diff >= T.spendPace.warn ? "warn" : "good";
    out.push({ id: "spendPace", level, pct: Math.round(diff * 100) });
  }

  // Where the month ends at this pace.
  if (h.month.expense > 0 && h.month.income > 0) {
    out.push({ id: "projection", level: h.month.projectedNet < 0 ? "bad" : "good", net: h.month.projectedNet });
  }

  // Savings this month.
  if (h.savingsRateMonth !== null) {
    const r = h.savingsRateMonth;
    const level: Level = r < 0 ? "bad" : r < T.savingsWarn ? "warn" : "good";
    out.push({ id: "savings", level, rate: Math.round(r * 100), avg: h.savingsRateAvg === null ? null : Math.round(h.savingsRateAvg * 100) });
  } else if (h.month.expense > 0) {
    out.push({ id: "noIncomeYet", level: "warn", spent: h.month.expense });
  }

  // Runway.
  if (h.runwayMonths !== null) {
    const m = h.runwayMonths;
    const level: Level = m < T.runway.bad ? "bad" : m < T.runway.warn ? "warn" : "good";
    out.push({ id: "runway", level, months: Math.round(m * 10) / 10, days: Math.round(m * DAYS_PER_MONTH) });
  }

  // Income stability.
  if (h.income && h.months.length >= T.incomeMinMonths) {
    if (h.income.cv >= T.incomeCv.volatile) {
      out.push({ id: "incomeVolatile", level: "warn", min: h.income.min, max: h.income.max });
    } else if (h.income.cv <= T.incomeCv.stable) {
      out.push({ id: "incomeStable", level: "good" });
    }
  }

  // Discretionary share of spending.
  if (h.avgSplit) {
    const total = h.avgSplit.essential + h.avgSplit.discretionary + h.avgSplit.tithing;
    const share = total > 0 ? h.avgSplit.discretionary / total : 0;
    if (share > T.discretionaryShare) out.push({ id: "discretionary", level: "warn", pct: Math.round(share * 100) });
  }

  // Money tied up in loans.
  const mine = Math.max(0, h.liquid) + h.owedToMe;
  if (mine > 0 && h.owedToMe / mine >= T.lentShare) {
    out.push({ id: "lentShare", level: "warn", pct: Math.round((h.owedToMe / mine) * 100) });
  }

  // Oldest unpaid loan.
  const old = h.loans.find((l) => l.ageDays >= T.oldLoanDays);
  if (old) out.push({ id: "oldLoan", level: "warn", name: old.person.name, amount: old.amount, days: old.ageDays });

  // Pending tithe.
  if (h.tithingPending > 0) out.push({ id: "tithing", level: "warn", amount: h.tithingPending });

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
