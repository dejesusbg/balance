// Pure health-check metrics, based only on recorded past data.
// Verdicts built on these live in healthRules.ts.

import { totals } from "./ledger";
import { debtLots } from "./people";
import { monthlyTotals, type MonthTotals } from "./reports";
import { tithingRules, tithingSummary } from "./tithing";
import type { Account, Amount, Movement, Person, Reason } from "./types";

const DAY = 86_400_000;
export const DAYS_PER_MONTH = 30.44;

/**
 * If the first movement lands after this day of its month, that month is
 * treated as partial and left out of averages (the app wasn't in use yet).
 */
const FIRST_MONTH_GRACE_DAYS = 7;

/** How many recent complete months averages look back over (at most). */
export const LOOKBACK_MONTHS = 6;
/** Spending is compared with this many recent complete months. */
export const SPEND_AVG_MONTHS = 3;

export interface Stats {
  avg: Amount;
  min: Amount;
  max: Amount;
  /** Coefficient of variation (stdev / mean); 0 when there's no spread. */
  cv: number;
}

export function stats(values: Amount[]): Stats | null {
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return {
    avg: Math.round(avg),
    min: Math.min(...values),
    max: Math.max(...values),
    cv: avg > 0 ? Math.sqrt(variance) / avg : 0,
  };
}

/**
 * Complete calendar months (oldest first) since the app started being used,
 * at most `max`. The current month is never included.
 */
export function completeMonths(movements: Movement[], now: number, max = LOOKBACK_MONTHS): MonthTotals[] {
  if (movements.length === 0) return [];
  const first = Math.min(...movements.map((m) => m.date));
  const firstDate = new Date(first);
  const startOffset = firstDate.getDate() > FIRST_MONTH_GRACE_DAYS ? 1 : 0;
  const firstUsable = new Date(firstDate.getFullYear(), firstDate.getMonth() + startOffset, 1).getTime();
  // max complete months + the current one, then drop the current.
  return monthlyTotals(movements, max + 1, now)
    .slice(0, -1)
    .filter((m) => m.start >= firstUsable);
}

export type SpendBucket = "essential" | "discretionary" | "tithing";

export interface SpendSplit {
  essential: Amount;
  discretionary: Amount;
  tithing: Amount;
}

/** Splits expenses in [from, to] by the reason's "essential" flag (tithing apart). */
export function spendSplit(
  movements: Movement[],
  reasons: Reason[],
  from: number,
  to: number,
): SpendSplit {
  const byId = new Map(reasons.map((r) => [r.id, r]));
  const split: SpendSplit = { essential: 0, discretionary: 0, tithing: 0 };
  for (const m of movements) {
    if (m.type !== "expense" || m.date < from || m.date > to) continue;
    const r = m.reasonId ? byId.get(m.reasonId) : undefined;
    const bucket: SpendBucket = r?.role === "tithing" ? "tithing" : r?.essential ? "essential" : "discretionary";
    split[bucket] += m.amount;
  }
  return split;
}

export interface MonthProgress {
  start: number;
  daysElapsed: number;
  daysInMonth: number;
  income: Amount;
  expense: Amount;
  /** Expense at the current daily pace, for the whole month. */
  projectedExpense: Amount;
  /** Income so far minus projected expense (income isn't extrapolated: it's irregular). */
  projectedNet: Amount;
}

export function monthProgress(movements: Movement[], now: number): MonthProgress {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  // Count today as elapsed, so day 1 projects from one full day.
  const daysElapsed = Math.min(daysInMonth, Math.floor((now - start) / DAY) + 1);
  let income = 0;
  let expense = 0;
  for (const m of movements) {
    if (m.date < start || m.date > now) continue;
    if (m.type === "income") income += m.amount;
    if (m.type === "expense") expense += m.amount;
  }
  const projectedExpense = Math.round((expense / daysElapsed) * daysInMonth);
  return {
    start,
    daysElapsed,
    daysInMonth,
    income,
    expense,
    projectedExpense,
    projectedNet: income - projectedExpense,
  };
}

/** Savings rate = (income − expense) / income; null without income. */
export const savingsRate = (income: Amount, expense: Amount): number | null =>
  income > 0 ? (income - expense) / income : null;

export interface OpenLoan {
  person: Person;
  amount: Amount;
  /** When the oldest still-open part was lent. */
  since: number;
  ageDays: number;
}

/** What each person still owes me (FIFO), with the age of the oldest open part. */
export function openLoans(people: Person[], movements: Movement[], now: number): OpenLoan[] {
  const out: OpenLoan[] = [];
  for (const person of people) {
    const open = debtLots(person, movements).filter((l) => l.side === "theyOwe" && l.remaining > 0);
    if (open.length === 0) continue;
    const since = Math.min(...open.map((l) => l.date));
    out.push({
      person,
      amount: open.reduce((s, l) => s + l.remaining, 0),
      since,
      ageDays: Math.max(0, Math.floor((now - since) / DAY)),
    });
  }
  return out.sort((a, b) => b.ageDays - a.ageDays);
}

export interface HealthMetrics {
  now: number;
  /** Complete months used for averages (oldest first). */
  months: MonthTotals[];
  income: Stats | null;
  /** Average monthly expense over the last SPEND_AVG_MONTHS complete months. */
  avgSpend: Amount | null;
  /** Average split over the same months, per month. */
  avgSplit: SpendSplit | null;
  savingsRateAvg: number | null;
  month: MonthProgress;
  monthSplit: SpendSplit;
  savingsRateMonth: number | null;
  liquid: Amount;
  owedToMe: Amount;
  /** Months the money I have lasts at the average spend. */
  runwayMonths: number | null;
  loans: OpenLoan[];
  tithingPending: Amount;
}

export function healthMetrics(input: {
  accounts: Account[];
  people: Person[];
  reasons: Reason[];
  movements: Movement[];
  now: number;
}): HealthMetrics {
  const { accounts, people, reasons, movements, now } = input;
  const months = completeMonths(movements, now);
  const recent = months.slice(-SPEND_AVG_MONTHS);
  const avgSpend = recent.length ? Math.round(recent.reduce((s, m) => s + m.expense, 0) / recent.length) : null;

  let avgSplit: SpendSplit | null = null;
  if (recent.length) {
    const from = recent[0].start;
    const to = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime() - 1;
    const total = spendSplit(movements, reasons, from, to);
    avgSplit = {
      essential: Math.round(total.essential / recent.length),
      discretionary: Math.round(total.discretionary / recent.length),
      tithing: Math.round(total.tithing / recent.length),
    };
  }

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const month = monthProgress(movements, now);
  const t = totals(accounts, people, movements);

  return {
    now,
    months,
    income: stats(months.map((m) => m.income)),
    avgSpend,
    avgSplit,
    savingsRateAvg: savingsRate(totalIncome, totalExpense),
    month,
    monthSplit: spendSplit(movements, reasons, month.start, now),
    savingsRateMonth: savingsRate(month.income, month.expense),
    liquid: t.liquid,
    owedToMe: t.owedToMe,
    runwayMonths: avgSpend && avgSpend > 0 ? Math.max(0, t.liquid) / avgSpend : null,
    loans: openLoans(people, movements, now),
    tithingPending: tithingSummary(movements, tithingRules(reasons)).pending,
  };
}
