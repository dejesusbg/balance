// Tithing: 10% of every income marked "Añadir al diezmo", minus the tithes
// recorded (expenses with the built-in "Diezmo" reason). Each income's share
// is rounded on its own, so suggestions add up exactly.

import { sortChronologically } from "./ledger";
import type { Amount, ID, Movement, Reason } from "./types";

export const TITHE_RATE = 0.1;

/** Tithe due for one income (whole pesos). */
export const titheOf = (amount: Amount): Amount => Math.round(amount * TITHE_RATE);

export interface TithingRules {
  /** The built-in "Diezmo" expense reason. */
  tithingReasonId: ID | undefined;
}

export const tithingRules = (reasons: Reason[]): TithingRules => ({
  tithingReasonId: reasons.find((r) => r.role === "tithing")?.id,
});

/** How a movement changes the pending tithe: + for marked income, − for tithes given. */
export function tithingDelta(m: Movement, rules: TithingRules): Amount {
  if (m.type === "income" && m.tithe) return titheOf(m.amount);
  if (m.type === "expense" && m.reasonId && m.reasonId === rules.tithingReasonId) return -m.amount;
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
