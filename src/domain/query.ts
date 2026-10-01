// Pure helpers for listing, filtering and ranking movements.

import { movementEffect } from "./ledger";
import type { ID, Movement, MovementType, Reason } from "./types";
import { REASON_GROUP_BY_TYPE } from "./types";

export interface MovementFilter {
  types?: MovementType[];
  accountId?: ID;
  personId?: ID;
  reasonId?: ID;
  /** Inclusive, epoch ms. */
  from?: number;
  /** Inclusive, epoch ms. */
  to?: number;
  /** Case- and accent-insensitive search in notes. */
  text?: string;
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function filterMovements(
  movements: Movement[],
  f: MovementFilter,
): Movement[] {
  const text = f.text ? normalize(f.text) : "";
  return movements.filter((m) => {
    if (f.types?.length && !f.types.includes(m.type)) return false;
    if (f.accountId && m.accountId !== f.accountId && m.toAccountId !== f.accountId)
      return false;
    if (f.personId && m.personId !== f.personId) return false;
    if (f.reasonId && m.reasonId !== f.reasonId) return false;
    if (f.from !== undefined && m.date < f.from) return false;
    if (f.to !== undefined && m.date > f.to) return false;
    if (text && !normalize(m.note).includes(text)) return false;
    return true;
  });
}

/** Local-time day key, e.g. "2026-10-01". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface DayGroup {
  key: string;
  date: number;
  movements: Movement[];
  /** Net effect on my accounts that day (in minus out). */
  net: number;
}

/** Groups by local day, newest day first and newest movement first. */
export function groupByDay(movements: Movement[]): DayGroup[] {
  const sorted = [...movements].sort(
    (a, b) => b.date - a.date || b.createdAt - a.createdAt,
  );
  const groups: DayGroup[] = [];
  for (const m of sorted) {
    const key = dayKey(m.date);
    let g = groups.at(-1);
    if (!g || g.key !== key) {
      g = { key, date: m.date, movements: [], net: 0 };
      groups.push(g);
    }
    g.movements.push(m);
    g.net += accountNet(m);
  }
  return groups;
}

/** Net change across all my accounts (transfers cancel out). */
export function accountNet(m: Movement): number {
  return Object.values(movementEffect(m).accounts).reduce((a, b) => a + b, 0);
}

/** How a movement reads in a list: inflow, outflow or neutral. */
export function flowOf(m: Movement): "in" | "out" | "neutral" {
  const net = accountNet(m);
  if (net > 0) return "in";
  if (net < 0) return "out";
  return "neutral";
}

/**
 * Active reasons for a movement type, most-used first (ties keep the
 * user's manual order).
 */
export function rankReasons(
  reasons: Reason[],
  movements: Movement[],
  type: MovementType,
): Reason[] {
  const group = REASON_GROUP_BY_TYPE[type];
  if (!group) return [];
  const uses = new Map<ID, number>();
  for (const m of movements) {
    if (!m.reasonId) continue;
    uses.set(m.reasonId, (uses.get(m.reasonId) ?? 0) + 1);
  }
  return reasons
    .filter((r) => r.group === group && !r.archived)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.order - b.order);
}
