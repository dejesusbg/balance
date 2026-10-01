// Tithing: owed = rate × qualifying income − tithing expenses recorded.
// Each income's share is rounded on its own, so suggestions add up exactly.

import type { Amount, ID, Movement, Reason } from "./types";
import { sortChronologically } from "./ledger";

/** Tithe due for one income (whole pesos). */
export const titheOf = (amount: Amount, rate: number): Amount => Math.round(amount * rate);

export interface TithingRules {
  rate: number;
  /** Income reasons that count toward tithing. */
  countingReasonIds: Set<ID>;
  /** The built-in "Diezmo" expense reason. */
  tithingReasonId: ID | undefined;
}

export function tithingRules(reasons: Reason[], rate: number): TithingRules {
  return {
    rate,
    countingReasonIds: new Set(
      reasons.filter((r) => r.group === "income" && r.countsForTithing).map((r) => r.id),
    ),
    tithingReasonId: reasons.find((r) => r.role === "tithing")?.id,
  };
}

/** How a movement changes the pending tithe: + for counted income, − for tithes paid. */
export function tithingDelta(m: Movement, rules: TithingRules): Amount {
  if (m.type === "income" && m.reasonId && rules.countingReasonIds.has(m.reasonId)) {
    return titheOf(m.amount, rules.rate);
  }
  if (m.type === "expense" && m.reasonId && m.reasonId === rules.tithingReasonId) {
    return -m.amount;
  }
  return 0;
}

export interface TithingSummary {
  /** Positive = still to give; negative = given in advance. */
  pending: Amount;
  due: Amount;
  paid: Amount;
}

export function tithingSummary(movements: Movement[], rules: TithingRules): TithingSummary {
  let due = 0;
  let paid = 0;
  for (const m of movements) {
    const d = tithingDelta(m, rules);
    if (d > 0) due += d;
    else paid -= d;
  }
  return { pending: due - paid, due, paid };
}

export interface TithingEntry {
  movement: Movement;
  delta: Amount;
  /** Pending after this movement. */
  pending: Amount;
}

/** Newest-first history of tithing-relevant movements with running pending. */
export function tithingHistory(movements: Movement[], rules: TithingRules): TithingEntry[] {
  const out: TithingEntry[] = [];
  let pending = 0;
  for (const m of sortChronologically(movements)) {
    const delta = tithingDelta(m, rules);
    if (delta === 0) continue;
    pending += delta;
    out.push({ movement: m, delta, pending });
  }
  return out.reverse();
}

/**
 * What to offer to set aside right after saving an income: its tithe, capped
 * at what's actually pending (tithes given in advance reduce it). 0 = no prompt.
 */
export function tithingSuggestion(
  income: Movement,
  movementsIncludingIt: Movement[],
  rules: TithingRules,
): Amount {
  const share = tithingDelta(income, rules);
  if (share <= 0) return 0;
  const { pending } = tithingSummary(movementsIncludingIt, rules);
  return Math.max(0, Math.min(share, pending));
}
