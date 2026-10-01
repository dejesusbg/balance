import { describe, expect, it } from "vitest";
import { personBalances } from "./ledger";
import { debtLots, peopleWithBalances, personSummary, personTimeline } from "./people";
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
    mv("repayment", 30_000, { direction: "in" }),
    mv("settlement", 12_000, { direction: "in" }),
    mv("borrow", 5_000, { reasonId: "emergency" }),
    mv("repayment", 5_000, { direction: "out" }),
    mv("settlement", 1_000, { direction: "out" }),
    mv("settlement", 4_000, { direction: "in", forgiven: true }),
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
      forgivenIn: 4_000,
      forgivenOut: 0,
    });
    expect(s.balance).toBe(personBalances([dad], movements).get("dad"));
  });

  it("counts prior-debt payments apart, without touching the balance", () => {
    const prior = [
      mv("repayment", 30_000, { direction: "in", priorDebt: true }),
      mv("repayment", 4_000, { direction: "out", priorDebt: true }),
    ];
    const s = personSummary(person("dad"), prior);
    expect(s).toMatchObject({ balance: 0, paidMe: 0, priorIn: 30_000, priorOut: 4_000, lentByReason: [] });
  });
});

describe("debtLots (FIFO)", () => {
  const dad = person("dad");

  it("pays off the oldest loan first", () => {
    const a = mv("lend", 50_000, { reasonId: "lunch", date: 1 });
    const b = mv("lend", 20_000, { reasonId: "emergency", date: 2 });
    const pay = mv("repayment", 60_000, { direction: "in", date: 3 });
    const lots = debtLots(dad, [pay, b, a]);
    expect(lots.map((l) => [l.movementId, l.amount, l.remaining])).toEqual([
      [a.id, 50_000, 0],
      [b.id, 20_000, 10_000],
    ]);
    const s = personSummary(dad, [a, b, pay]);
    expect(s.lentByReason).toEqual([
      { reasonId: "lunch", amount: 50_000, open: 0 },
      { reasonId: "emergency", amount: 20_000, open: 10_000 },
    ]);
  });

  it("uses the opening balance as the first lot", () => {
    const lots = debtLots(person("dad", 15_000), [
      mv("lend", 10_000, { date: 1 }),
      mv("settlement", 20_000, { direction: "in", date: 2 }),
    ]);
    expect(lots.map((l) => [l.movementId, l.remaining])).toEqual([
      ["opening", 0],
      [expect.any(String), 5_000],
    ]);
  });

  it("an overpayment opens a lot on the other side", () => {
    const lots = debtLots(dad, [
      mv("lend", 10_000, { date: 1 }),
      mv("repayment", 15_000, { direction: "in", date: 2 }),
    ]);
    expect(lots.at(-1)).toMatchObject({ side: "iOwe", amount: 5_000, remaining: 5_000, isLoan: false });
  });

  it("a loan that offsets an older debt keeps its full amount but less open", () => {
    const lots = debtLots(dad, [
      mv("borrow", 10_000, { date: 1 }),
      mv("lend", 30_000, { reasonId: "gift", date: 2 }),
    ]);
    expect(lots.map((l) => [l.side, l.amount, l.remaining])).toEqual([
      ["iOwe", 10_000, 0],
      ["theyOwe", 30_000, 20_000],
    ]);
  });

  it("forgiveness pays down lots like any settlement", () => {
    const lots = debtLots(dad, [
      mv("lend", 10_000, { date: 1 }),
      mv("settlement", 10_000, { direction: "in", forgiven: true, date: 2 }),
    ]);
    expect(lots[0].remaining).toBe(0);
  });

  it("open lots always add up to the balance (random ledgers)", () => {
    let seed = 99;
    const r = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
    const types: MovementType[] = ["lend", "borrow", "repayment", "settlement"];
    for (let run = 0; run < 20; run++) {
      const p = person("dad", Math.round((r() - 0.5) * 100_000));
      const ms = Array.from({ length: 60 }, () =>
        mv(types[Math.floor(r() * 4)], 1 + Math.floor(r() * 80_000), {
          direction: r() < 0.5 ? "in" : "out",
          date: Math.floor(r() * 1e6),
          priorDebt: r() < 0.05,
        }),
      );
      const lots = debtLots(p, ms);
      const open = (side: string) =>
        lots.filter((l) => l.side === side).reduce((sum, l) => sum + l.remaining, 0);
      const theyOwe = open("theyOwe");
      const iOwe = open("iOwe");
      expect(theyOwe - iOwe).toBe(personBalances([p], ms).get("dad"));
      expect(Math.min(theyOwe, iOwe)).toBe(0);
      expect(lots.every((l) => l.remaining >= 0 && l.remaining <= l.amount)).toBe(true);
    }
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
