// Pure summaries of the money relationship with one person.

import { movementEffect, personHistory, sortChronologically } from "./ledger";
import type { Amount, ID, Movement, Person } from "./types";

export type DebtSide = "theyOwe" | "iOwe";

/**
 * A debt that opened at one moment: the opening balance, a loan, or the
 * excess of an overpayment. `remaining` is what's still open after later
 * movements were applied first-in, first-out.
 */
export interface DebtLot {
  movementId: ID | "opening";
  date: number;
  side: DebtSide;
  amount: Amount;
  remaining: Amount;
  reasonId?: ID;
  /** True for lend/borrow lots (as opposed to opening balance or overpayment). */
  isLoan: boolean;
}

/**
 * Applies a person's movements FIFO: anything that lowers what one side owes
 * pays off that side's oldest open lots first; any excess opens a lot on the
 * other side. Invariant: theyOwe remaining - iOwe remaining = balance.
 */
export function debtLots(person: Person, movements: Movement[]): DebtLot[] {
  const lots: DebtLot[] = [];
  if (person.openingBalance !== 0) {
    const amount = Math.abs(person.openingBalance);
    lots.push({
      movementId: "opening",
      date: person.createdAt,
      side: person.openingBalance > 0 ? "theyOwe" : "iOwe",
      amount,
      remaining: amount,
      isLoan: false,
    });
  }

  for (const m of sortChronologically(movements)) {
    const eff = movementEffect(m).person;
    if (!eff || eff.id !== person.id || eff.delta === 0) continue;
    // A positive delta pays down what I owe; a negative one what they owe.
    const paysDown: DebtSide = eff.delta > 0 ? "iOwe" : "theyOwe";
    const opens: DebtSide = eff.delta > 0 ? "theyOwe" : "iOwe";
    let left = Math.abs(eff.delta);
    for (const lot of lots) {
      if (left === 0) break;
      if (lot.side !== paysDown || lot.remaining === 0) continue;
      const used = Math.min(lot.remaining, left);
      lot.remaining -= used;
      left -= used;
    }
    const isLoan = m.type === "lend" || m.type === "borrow";
    if (isLoan || left > 0) {
      lots.push({
        movementId: m.id,
        date: m.date,
        side: opens,
        // A loan records its full amount; the part that offset an older debt
        // counts as already settled.
        amount: isLoan ? Math.abs(eff.delta) : left,
        remaining: left,
        reasonId: m.reasonId,
        isLoan,
      });
    }
  }
  return lots;
}

export interface ReasonDebt {
  reasonId: ID | undefined;
  /** Total lent (or borrowed) with this reason. */
  amount: Amount;
  /** How much of it is still open. */
  open: Amount;
}

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
  /** Debt I forgave them / they forgave me. */
  forgivenIn: Amount;
  forgivenOut: Amount;
  /** Payments/settlements of debts from before the app (balance unchanged). */
  priorIn: Amount;
  priorOut: Amount;
  /** Loans I made, by reason, with how much is still open (FIFO). */
  lentByReason: ReasonDebt[];
  /** Loans I received, by reason. */
  borrowedByReason: ReasonDebt[];
  lots: DebtLot[];
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
    forgivenIn: 0,
    forgivenOut: 0,
    priorIn: 0,
    priorOut: 0,
    lentByReason: [],
    borrowedByReason: [],
    lots: [],
  };

  for (const m of movements) {
    const eff = movementEffect(m).person;
    if (!eff || eff.id !== person.id) continue;
    s.balance += eff.delta;
    const a = m.amount;
    const out = m.direction === "out";
    if (m.priorDebt) {
      if (out) s.priorOut += a;
      else s.priorIn += a;
    } else if (m.type === "lend") s.lent += a;
    else if (m.type === "borrow") s.borrowed += a;
    else if (m.type === "repayment") {
      if (out) s.iPaid += a;
      else s.paidMe += a;
    } else if (m.type === "settlement" && m.forgiven) {
      if (out) s.forgivenOut += a;
      else s.forgivenIn += a;
    } else if (m.type === "settlement") {
      if (out) s.kindOut += a;
      else s.kindIn += a;
    }
  }

  s.lots = debtLots(person, movements);
  s.lentByReason = byReason(s.lots, "theyOwe");
  s.borrowedByReason = byReason(s.lots, "iOwe");
  return s;
}

function byReason(lots: DebtLot[], side: DebtSide): ReasonDebt[] {
  const map = new Map<ID | undefined, ReasonDebt>();
  for (const lot of lots) {
    if (!lot.isLoan || lot.side !== side) continue;
    const r = map.get(lot.reasonId) ?? { reasonId: lot.reasonId, amount: 0, open: 0 };
    r.amount += lot.amount;
    r.open += lot.remaining;
    map.set(lot.reasonId, r);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
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
