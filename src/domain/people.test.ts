import { describe, expect, it } from "vitest";
import { personBalances } from "./ledger";
import { peopleWithBalances, personSummary, personTimeline } from "./people";
import type { Movement, MovementType, Person } from "./types";

const person = (id: string, openingBalance = 0, order = 0): Person => ({
  id,
  name: id,
  openingBalance,
  archived: false,
  order,
  createdAt: 0,
});

let seq = 0;
const mv = (type: MovementType, amount: number, extra: Partial<Movement> = {}): Movement => ({
  id: `m${++seq}`,
  type,
  amount,
  date: seq,
  note: "",
  createdAt: seq,
  updatedAt: seq,
  accountId: type === "settlement" ? undefined : "nu",
  personId: "dad",
  ...extra,
});

describe("personSummary", () => {
  const dad = person("dad", 10_000);
  const movements = [
    mv("lend", 50_000, { reasonId: "lunch" }),
    mv("lend", 20_000, { reasonId: "emergency" }),
    mv("repayment", 30_000, { direction: "in", reasonId: "lunch" }),
    mv("settlement", 12_000, { direction: "in", reasonId: "lunch" }),
    mv("borrow", 5_000, { reasonId: "emergency" }),
    mv("repayment", 5_000, { direction: "out", reasonId: "emergency" }),
    mv("settlement", 1_000, { direction: "out" }),
    mv("lend", 999, { personId: "mom", reasonId: "lunch" }),
  ];

  it("totals each kind of movement and matches the ledger balance", () => {
    const s = personSummary(dad, movements);
    expect(s).toMatchObject({
      opening: 10_000,
      lent: 70_000,
      borrowed: 5_000,
      paidMe: 30_000,
      iPaid: 5_000,
      kindIn: 12_000,
      kindOut: 1_000,
    });
    expect(s.balance).toBe(personBalances([dad], movements).get("dad"));
    expect(s.balance).toBe(10_000 + 70_000 - 5_000 - 30_000 + 5_000 - 12_000 + 1_000);
  });

  it("counts prior-debt payments apart, without touching the balance", () => {
    const prior = [
      mv("repayment", 30_000, { direction: "in", priorDebt: true, reasonId: "lunch" }),
      mv("repayment", 4_000, { direction: "out", priorDebt: true }),
    ];
    const s = personSummary(person("dad"), prior);
    expect(s).toMatchObject({ balance: 0, paidMe: 0, priorIn: 30_000, priorOut: 4_000, byReason: [] });
  });

  it("breaks loans and in-kind settlements down by reason, ignoring repayments", () => {
    const s = personSummary(dad, movements);
    expect(s.byReason).toEqual([
      { reasonId: "lunch", up: 50_000, down: 12_000 },
      { reasonId: "emergency", up: 20_000, down: 5_000 },
      { reasonId: undefined, up: 1_000, down: 0 },
    ]);
  });
});

describe("peopleWithBalances", () => {
  it("puts open balances first, biggest first, then settled people by order", () => {
    const people = [person("mom", 0, 0), person("dad", 0, 1), person("bro", 0, 2), person("sis", 0, 3)];
    const ms = [
      mv("lend", 5_000, { personId: "dad", date: 100 }),
      mv("borrow", 9_000, { personId: "sis", date: 200 }),
      mv("lend", 1_000, { personId: "bro", date: 50 }),
      mv("repayment", 1_000, { personId: "bro", direction: "in", date: 300 }),
    ];
    const rows = peopleWithBalances(people, ms);
    expect(rows.map((r) => [r.person.id, r.balance])).toEqual([
      ["sis", -9_000],
      ["dad", 5_000],
      ["mom", 0],
      ["bro", 0],
    ]);
    expect(rows.find((r) => r.person.id === "bro")!.lastActivity).toBe(300);
    expect(rows.find((r) => r.person.id === "mom")!.lastActivity).toBeUndefined();
  });
});

describe("personTimeline", () => {
  it("is newest first with the running balance after each movement", () => {
    const dad = person("dad");
    const t = personTimeline(dad, [
      mv("lend", 100, { date: 1 }),
      mv("repayment", 40, { direction: "in", date: 2 }),
    ]);
    expect(t.map((e) => e.balance)).toEqual([60, 100]);
  });
});
