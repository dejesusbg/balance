// Pure summaries of the money relationship with one person.

import { movementEffect, personHistory } from "./ledger";
import type { Amount, ID, Movement, Person } from "./types";

export interface PersonSummary {
  balance: Amount;
  opening: Amount;
  /** Money I lent them (lend). */
  lent: Amount;
  /** Money they lent me (borrow). */
  borrowed: Amount;
  /** Money they paid back to me (repayment in). */
  paidMe: Amount;
  /** Money I paid back to them (repayment out). */
  iPaid: Amount;
  /** Value they gave me in kind (settlement in). */
  kindIn: Amount;
  /** Value I gave them in kind (settlement out). */
  kindOut: Amount;
  /** Payments/settlements of debts from before the app (balance unchanged). */
  priorIn: Amount;
  priorOut: Amount;
  /** Per reason (loans and in-kind settlements): how much it raised and lowered the balance. */
  byReason: { reasonId: ID | undefined; up: Amount; down: Amount }[];
}

export function personSummary(person: Person, movements: Movement[]): PersonSummary {
  const s: PersonSummary = {
    balance: person.openingBalance,
    opening: person.openingBalance,
    lent: 0,
    borrowed: 0,
    paidMe: 0,
    iPaid: 0,
    kindIn: 0,
    kindOut: 0,
    priorIn: 0,
    priorOut: 0,
    byReason: [],
  };
  const reasons = new Map<ID | undefined, { up: Amount; down: Amount }>();

  for (const m of movements) {
    const eff = movementEffect(m).person;
    if (!eff || eff.id !== person.id) continue;
    s.balance += eff.delta;
    const a = m.amount;
    if (m.priorDebt) {
      if (m.direction === "out") s.priorOut += a;
      else s.priorIn += a;
      continue;
    }
    if (m.type === "lend") s.lent += a;
    else if (m.type === "borrow") s.borrowed += a;
    else if (m.type === "repayment") {
      if (m.direction === "out") s.iPaid += a;
      else s.paidMe += a;
    } else if (m.type === "settlement") {
      if (m.direction === "out") s.kindOut += a;
      else s.kindIn += a;
    }

    // The "why" lives on loans and in-kind settlements, not on repayments.
    if (m.type === "repayment") continue;
    const r = reasons.get(m.reasonId) ?? { up: 0, down: 0 };
    if (eff.delta > 0) r.up += eff.delta;
    else r.down -= eff.delta;
    reasons.set(m.reasonId, r);
  }

  s.byReason = [...reasons]
    .map(([reasonId, v]) => ({ reasonId, ...v }))
    .sort((a, b) => b.up + b.down - (a.up + a.down));
  return s;
}

export interface PersonRow {
  person: Person;
  balance: Amount;
  /** Date of the latest movement with this person, if any. */
  lastActivity?: number;
}

/**
 * Active people with their balances: open balances first (largest first),
 * then settled people in the user's order.
 */
export function peopleWithBalances(people: Person[], movements: Movement[]): PersonRow[] {
  const rows = new Map<ID, PersonRow>(
    people.map((p) => [p.id, { person: p, balance: p.openingBalance }]),
  );
  for (const m of movements) {
    const eff = movementEffect(m).person;
    const row = eff && rows.get(eff.id);
    if (!row) continue;
    row.balance += eff.delta;
    row.lastActivity = Math.max(row.lastActivity ?? 0, m.date);
  }
  return [...rows.values()].sort(
    (a, b) =>
      Number(b.balance !== 0) - Number(a.balance !== 0) ||
      Math.abs(b.balance) - Math.abs(a.balance) ||
      a.person.order - b.person.order,
  );
}

/** Newest-first history with running balance, for the person screen. */
export function personTimeline(person: Person, movements: Movement[]) {
  return personHistory(person, movements).reverse();
}
