import { describe, expect, it } from "vitest";
import {
  accountBalanceAt,
  accountBalances,
  accountHistory,
  adjustmentDelta,
  movementEffect,
  personBalances,
  personHistory,
  totals,
} from "./ledger";
import type { Account, Movement, MovementType, Person } from "./types";

const account = (id: string, openingBalance = 0): Account => ({
  id,
  name: id,
  openingBalance,
  archived: false,
  order: 0,
  createdAt: 0,
});

const person = (id: string, openingBalance = 0): Person => ({
  id,
  name: id,
  openingBalance,
  archived: false,
  order: 0,
  createdAt: 0,
});

let seq = 0;
const mv = (
  type: MovementType,
  amount: number,
  extra: Partial<Movement> = {},
): Movement => ({
  id: `m${++seq}`,
  type,
  amount,
  date: seq,
  note: "",
  createdAt: seq,
  updatedAt: seq,
  ...extra,
});

const nu = account("nu", 100_000);
const nequi = account("nequi", 50_000);
const cash = account("cash");
const mom = person("mom");
const bro = person("bro", -20_000);

describe("movementEffect", () => {
  it("income adds to the account", () => {
    expect(movementEffect(mv("income", 10, { accountId: "nu" }))).toEqual({
      accounts: { nu: 10 },
    });
  });

  it("expense subtracts from the account", () => {
    expect(movementEffect(mv("expense", 10, { accountId: "nu" }))).toEqual({
      accounts: { nu: -10 },
    });
  });

  it("transfer moves between accounts without changing the total", () => {
    const eff = movementEffect(
      mv("transfer", 10, { accountId: "nu", toAccountId: "cash" }),
    );
    expect(eff.accounts).toEqual({ nu: -10, cash: 10 });
    expect(eff.person).toBeUndefined();
  });

  it("lend takes money out and increases what the person owes", () => {
    expect(
      movementEffect(mv("lend", 10, { accountId: "nu", personId: "mom" })),
    ).toEqual({ accounts: { nu: -10 }, person: { id: "mom", delta: 10 } });
  });

  it("borrow puts money in and makes me owe the person", () => {
    expect(
      movementEffect(mv("borrow", 10, { accountId: "nu", personId: "mom" })),
    ).toEqual({ accounts: { nu: 10 }, person: { id: "mom", delta: -10 } });
  });

  it("repayment in: they pay me back", () => {
    expect(
      movementEffect(
        mv("repayment", 10, { accountId: "nu", personId: "mom", direction: "in" }),
      ),
    ).toEqual({ accounts: { nu: 10 }, person: { id: "mom", delta: -10 } });
  });

  it("repayment out: I pay back what I owe", () => {
    expect(
      movementEffect(
        mv("repayment", 10, { accountId: "nu", personId: "mom", direction: "out" }),
      ),
    ).toEqual({ accounts: { nu: -10 }, person: { id: "mom", delta: 10 } });
  });

  it("settlement in kind never touches accounts", () => {
    const inKind = movementEffect(
      mv("settlement", 10, { personId: "mom", direction: "in", accountId: "nu" }),
    );
    expect(inKind).toEqual({ accounts: {}, person: { id: "mom", delta: -10 } });
    const outKind = movementEffect(
      mv("settlement", 10, { personId: "mom", direction: "out" }),
    );
    expect(outKind.person).toEqual({ id: "mom", delta: 10 });
  });

  it("adjustment applies its signed delta", () => {
    expect(
      movementEffect(mv("adjustment", -3_000, { accountId: "cash" })).accounts,
    ).toEqual({ cash: -3_000 });
  });
});

describe("balances", () => {
  const movements = [
    mv("income", 1_000_000, { accountId: "nu" }),
    mv("expense", 45_000, { accountId: "nequi" }),
    mv("transfer", 200_000, { accountId: "nu", toAccountId: "cash" }),
    mv("lend", 30_000, { accountId: "cash", personId: "mom" }),
    mv("settlement", 12_000, { personId: "mom", direction: "in" }),
    mv("repayment", 10_000, { accountId: "nequi", personId: "mom", direction: "in" }),
    mv("repayment", 20_000, { accountId: "nu", personId: "bro", direction: "out" }),
    mv("borrow", 5_000, { accountId: "cash", personId: "bro" }),
  ];

  it("derives account balances from opening balance + movements", () => {
    const b = accountBalances([nu, nequi, cash], movements);
    expect(b.get("nu")).toBe(100_000 + 1_000_000 - 200_000 - 20_000);
    expect(b.get("nequi")).toBe(50_000 - 45_000 + 10_000);
    expect(b.get("cash")).toBe(200_000 - 30_000 + 5_000);
  });

  it("derives signed person balances", () => {
    const b = personBalances([mom, bro], movements);
    expect(b.get("mom")).toBe(30_000 - 12_000 - 10_000); // owes me 8.000
    expect(b.get("bro")).toBe(-20_000 + 20_000 - 5_000); // I owe 5.000
  });

  it("computes totals", () => {
    const t = totals([nu, nequi, cash], [mom, bro], movements);
    expect(t.liquid).toBe(880_000 + 15_000 + 175_000);
    expect(t.owedToMe).toBe(8_000);
    expect(t.iOwe).toBe(5_000);
    expect(t.netWorth).toBe(t.liquid + 8_000 - 5_000);
  });

  it("ignores soft-deleted movements", () => {
    const deleted = mv("income", 999, { accountId: "cash", deletedAt: 1 });
    expect(accountBalances([cash], [deleted]).get("cash")).toBe(0);
  });

  it("editing a movement recalculates (pure derivation)", () => {
    const m = mv("expense", 100, { accountId: "cash" });
    expect(accountBalances([cash], [m]).get("cash")).toBe(-100);
    const edited = { ...m, amount: 40, accountId: "nu" };
    const b = accountBalances([cash, nu], [edited]);
    expect(b.get("cash")).toBe(0);
    expect(b.get("nu")).toBe(100_000 - 40);
  });
});

describe("history", () => {
  it("person history has a running balance in date order", () => {
    const later = mv("lend", 30, { accountId: "nu", personId: "mom", date: 200 });
    const earlier = mv("lend", 50, { accountId: "nu", personId: "mom", date: 100 });
    const paid = mv("repayment", 20, {
      accountId: "nu",
      personId: "mom",
      direction: "in",
      date: 300,
    });
    const other = mv("lend", 99, { accountId: "nu", personId: "bro", date: 150 });
    const h = personHistory(mom, [paid, later, other, earlier]);
    expect(h.map((e) => e.movement.id)).toEqual([earlier.id, later.id, paid.id]);
    expect(h.map((e) => e.balance)).toEqual([50, 80, 60]);
  });

  it("account history ends at the derived balance", () => {
    const ms = [
      mv("income", 10, { accountId: "nu" }),
      mv("transfer", 4, { accountId: "nequi", toAccountId: "nu" }),
      mv("expense", 3, { accountId: "nu" }),
    ];
    const h = accountHistory(nu, ms);
    expect(h.at(-1)!.balance).toBe(accountBalances([nu], ms).get("nu"));
  });
});

describe("adjustments", () => {
  it("computes the delta to reach the real balance", () => {
    expect(adjustmentDelta(10_000, 7_500)).toBe(-2_500);
    expect(adjustmentDelta(10_000, 12_000)).toBe(2_000);
  });

  it("balanceAt only counts movements up to that moment", () => {
    const ms = [
      mv("income", 10, { accountId: "cash", date: 10 }),
      mv("income", 5, { accountId: "cash", date: 20 }),
    ];
    expect(accountBalanceAt(cash, ms, 15)).toBe(10);
    const adj = mv("adjustment", adjustmentDelta(15, 12), {
      accountId: "cash",
      date: 30,
    });
    expect(accountBalances([cash], [...ms, adj]).get("cash")).toBe(12);
  });
});

describe("invariants (random ledgers)", () => {
  // Deterministic PRNG so failures are reproducible.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
  }

  const accounts = [nu, nequi, cash];
  const people = [mom, bro];
  const types: MovementType[] = [
    "income",
    "expense",
    "transfer",
    "lend",
    "repayment",
    "settlement",
    "borrow",
    "adjustment",
  ];

  function randomLedger(seed: number, n: number): Movement[] {
    const r = rng(seed);
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    return Array.from({ length: n }, () => {
      const type = pick(types);
      const amount = 1 + Math.floor(r() * 500_000);
      const from = pick(accounts).id;
      return mv(type, type === "adjustment" && r() < 0.5 ? -amount : amount, {
        accountId: type === "settlement" ? undefined : from,
        toAccountId:
          type === "transfer"
            ? pick(accounts.filter((a) => a.id !== from)).id
            : undefined,
        personId: pick(people).id,
        direction: pick(["in", "out"] as const),
        date: Math.floor(r() * 1e9),
        deletedAt: r() < 0.1 ? 1 : null,
      });
    });
  }

  for (const seed of [1, 2, 3, 42, 2026]) {
    it(`balances equal the sum of their movements (seed ${seed})`, () => {
      const ms = randomLedger(seed, 400);
      const ab = accountBalances(accounts, ms);
      for (const a of accounts) {
        const h = accountHistory(a, ms);
        const sum = h.reduce((s, e) => s + e.delta, a.openingBalance);
        expect(ab.get(a.id)).toBe(sum);
        expect(h.at(-1)?.balance ?? a.openingBalance).toBe(sum);
      }
      const pb = personBalances(people, ms);
      for (const p of people) {
        const h = personHistory(p, ms);
        expect(pb.get(p.id)).toBe(
          h.reduce((s, e) => s + e.delta, p.openingBalance),
        );
      }
    });

    it(`money is conserved: transfers and in-kind settlements never change the total (seed ${seed})`, () => {
      const ms = randomLedger(seed, 400).filter((m) => !m.deletedAt);
      const liquid = (list: Movement[]) =>
        [...accountBalances(accounts, list).values()].reduce((a, b) => a + b, 0);
      const opening = liquid([]);
      const external = ms.reduce((s, m) => {
        switch (m.type) {
          case "income":
          case "adjustment":
          case "borrow":
            return s + m.amount;
          case "expense":
          case "lend":
            return s - m.amount;
          case "repayment":
            return s + (m.direction === "out" ? -m.amount : m.amount);
          default:
            return s; // transfer, settlement
        }
      }, 0);
      expect(liquid(ms)).toBe(opening + external);
    });
  }
});
