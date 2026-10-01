// Pure ledger math. Every balance in the app is derived here from the list
// of movements; nothing is stored.

import type { Account, Amount, ID, Movement, Person } from "./types";

export interface MovementEffect {
  /** Delta applied to each account touched by the movement. */
  accounts: Record<ID, Amount>;
  /** Delta applied to a person's signed balance (positive = they owe me more). */
  person?: { id: ID; delta: Amount };
}

/** How a single movement changes accounts and people. */
export function movementEffect(m: Movement): MovementEffect {
  const accounts: Record<ID, Amount> = {};
  const add = (id: ID | undefined, delta: Amount) => {
    if (!id || delta === 0) return;
    accounts[id] = (accounts[id] ?? 0) + delta;
  };
  const a = m.amount;

  switch (m.type) {
    case "income":
      add(m.accountId, a);
      return { accounts };
    case "expense":
      add(m.accountId, -a);
      return { accounts };
    case "transfer":
      add(m.accountId, -a);
      add(m.toAccountId, a);
      return { accounts };
    case "adjustment":
      add(m.accountId, a);
      return { accounts };
    case "lend":
      add(m.accountId, -a);
      return { accounts, person: personDelta(m, a) };
    case "borrow":
      add(m.accountId, a);
      return { accounts, person: personDelta(m, -a) };
    case "repayment":
      // "in": they pay me, money enters my account and their debt shrinks.
      // "out": I pay them, money leaves my account and my debt shrinks.
      if (m.direction === "out") {
        add(m.accountId, -a);
        return { accounts, person: personDelta(m, a) };
      }
      add(m.accountId, a);
      return { accounts, person: personDelta(m, -a) };
    case "settlement":
      return {
        accounts,
        person: personDelta(m, m.direction === "out" ? a : -a),
      };
  }
}

function personDelta(m: Movement, delta: Amount) {
  return m.personId ? { id: m.personId, delta } : undefined;
}

export function accountBalances(
  accounts: Account[],
  movements: Movement[],
): Map<ID, Amount> {
  const balances = new Map<ID, Amount>();
  for (const acc of accounts) balances.set(acc.id, acc.openingBalance);
  for (const m of movements) {
    for (const [id, delta] of Object.entries(movementEffect(m).accounts)) {
      balances.set(id, (balances.get(id) ?? 0) + delta);
    }
  }
  return balances;
}

export function personBalances(
  people: Person[],
  movements: Movement[],
): Map<ID, Amount> {
  const balances = new Map<ID, Amount>();
  for (const p of people) balances.set(p.id, p.openingBalance);
  for (const m of movements) {
    const eff = movementEffect(m).person;
    if (eff) balances.set(eff.id, (balances.get(eff.id) ?? 0) + eff.delta);
  }
  return balances;
}

export interface Totals {
  /** Sum of all account balances. */
  liquid: Amount;
  /** Sum of positive person balances. */
  owedToMe: Amount;
  /** Sum of negative person balances, as a positive number. */
  iOwe: Amount;
  /** liquid + owedToMe - iOwe */
  netWorth: Amount;
}

export function totals(
  accounts: Account[],
  people: Person[],
  movements: Movement[],
): Totals {
  let liquid = 0;
  for (const v of accountBalances(accounts, movements).values()) liquid += v;
  let owedToMe = 0;
  let iOwe = 0;
  for (const v of personBalances(people, movements).values()) {
    if (v > 0) owedToMe += v;
    else iOwe -= v;
  }
  return { liquid, owedToMe, iOwe, netWorth: liquid + owedToMe - iOwe };
}

export interface HistoryEntry {
  movement: Movement;
  delta: Amount;
  /** Balance after this movement. */
  balance: Amount;
}

/** Chronological history for a person with a running balance. */
export function personHistory(
  person: Person,
  movements: Movement[],
): HistoryEntry[] {
  return runningHistory(
    person.openingBalance,
    movements,
    (m) => {
      const eff = movementEffect(m).person;
      return eff && eff.id === person.id ? eff.delta : null;
    },
  );
}

/** Chronological history for an account with a running balance. */
export function accountHistory(
  account: Account,
  movements: Movement[],
): HistoryEntry[] {
  return runningHistory(account.openingBalance, movements, (m) => {
    const delta = movementEffect(m).accounts[account.id];
    return delta === undefined ? null : delta;
  });
}

function runningHistory(
  opening: Amount,
  movements: Movement[],
  deltaOf: (m: Movement) => Amount | null,
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let balance = opening;
  for (const m of sortChronologically(movements)) {
    const delta = deltaOf(m);
    if (delta === null) continue;
    balance += delta;
    out.push({ movement: m, delta, balance });
  }
  return out;
}

/** Oldest first; ties broken by creation time so order is stable. */
export function sortChronologically(movements: Movement[]): Movement[] {
  return [...movements].sort(
    (a, b) => a.date - b.date || a.createdAt - b.createdAt,
  );
}

/** Signed delta an adjustment must apply so the account matches reality. */
export function adjustmentDelta(current: Amount, target: Amount): Amount {
  return target - current;
}

/** Balance of one account right before a given moment (for adjustments). */
export function accountBalanceAt(
  account: Account,
  movements: Movement[],
  at: number,
): Amount {
  return accountBalances(
    [account],
    movements.filter((m) => m.date <= at),
  ).get(account.id)!;
}
