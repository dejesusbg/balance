import { describe, expect, it } from "vitest";
import {
  dayKey,
  filterMovements,
  flowOf,
  groupByDay,
  rankReasons,
} from "./query";
import type { Movement, MovementType, Reason } from "./types";

let seq = 0;
const mv = (type: MovementType, extra: Partial<Movement> = {}): Movement => ({
  id: `m${++seq}`,
  type,
  amount: 1000,
  date: new Date(2026, 8, 10, 12).getTime(),
  note: "",
  createdAt: seq,
  updatedAt: seq,
  accountId: "nu",
  ...extra,
});

const reason = (id: string, group: Reason["group"], order: number, archived = false): Reason => ({
  id,
  name: id,
  group,
  order,
  archived,
  essential: false,
  createdAt: 0,
});

describe("filterMovements", () => {
  const list = [
    mv("expense", { reasonId: "food", note: "Almuerzo con Café" }),
    mv("income", { reasonId: "work", accountId: "nequi" }),
    mv("transfer", { accountId: "nu", toAccountId: "cash" }),
    mv("lend", { personId: "mom", reasonId: "lunch" }),
  ];

  it("keeps everything without filters", () => {
    expect(filterMovements(list, {})).toHaveLength(4);
  });

  it("filters by type, account (either side of a transfer), person and reason", () => {
    expect(filterMovements(list, { options: ["income", "lend"] })).toHaveLength(2);
    expect(filterMovements(list, { accountId: "cash" }).map((m) => m.type)).toEqual([
      "transfer",
    ]);
    expect(filterMovements(list, { personId: "mom" })).toHaveLength(1);
    expect(filterMovements(list, { reasonId: "food" })).toHaveLength(1);
  });

  it("filters by who benefits, splitting repayments by direction", () => {
    const pays = [
      mv("repayment", { personId: "mom", direction: "in" }),
      mv("repayment", { personId: "mom", direction: "out" }),
      mv("settlement", { accountId: undefined, personId: "mom", direction: "out", forgiven: true }),
    ];
    const ids = (f: Parameters<typeof filterMovements>[1]) => filterMovements(pays, f).map((m) => m.id);
    expect(ids({ side: "in" })).toEqual([pays[0].id, pays[2].id]);
    expect(ids({ side: "out" })).toEqual([pays[1].id]);
    expect(ids({ options: ["forgivenMe"] })).toEqual([pays[2].id]);
    expect(filterMovements(list, { side: "move" }).map((m) => m.type)).toEqual(["transfer"]);
  });

  it("searches notes ignoring case and accents", () => {
    expect(filterMovements(list, { text: "cafe" })).toHaveLength(1);
    expect(filterMovements(list, { text: "ALMUERZO" })).toHaveLength(1);
  });

  it("filters by inclusive date range", () => {
    const d = list[0].date;
    expect(filterMovements(list, { from: d, to: d })).toHaveLength(4);
    expect(filterMovements(list, { from: d + 1 })).toHaveLength(0);
  });
});

describe("groupByDay", () => {
  it("groups by local day, newest first, with the day's net", () => {
    const a = mv("income", { amount: 500, date: new Date(2026, 8, 10, 9).getTime() });
    const b = mv("expense", { amount: 200, date: new Date(2026, 8, 10, 20).getTime() });
    const c = mv("expense", { amount: 50, date: new Date(2026, 8, 9, 23, 59).getTime() });
    const t = mv("transfer", { amount: 999, toAccountId: "cash", date: a.date });
    const groups = groupByDay([a, c, b, t]);
    expect(groups.map((g) => g.key)).toEqual(["2026-09-10", "2026-09-09"]);
    expect(groups[0].movements[0].id).toBe(b.id);
    expect(groups[0].net).toBe(300);
    expect(groups[1].net).toBe(-50);
  });

  it("dayKey pads month and day", () => {
    expect(dayKey(new Date(2026, 0, 5).getTime())).toBe("2026-01-05");
  });
});

describe("flowOf", () => {
  it("classifies movements by their effect on my accounts", () => {
    expect(flowOf(mv("income"))).toBe("in");
    expect(flowOf(mv("expense"))).toBe("out");
    expect(flowOf(mv("transfer", { toAccountId: "cash" }))).toBe("neutral");
    expect(flowOf(mv("settlement", { accountId: undefined, personId: "mom", direction: "in" }))).toBe(
      "neutral",
    );
    expect(flowOf(mv("repayment", { personId: "mom", direction: "in" }))).toBe("in");
  });
});

describe("rankReasons", () => {
  const reasons = [
    reason("food", "expense", 0),
    reason("transport", "expense", 1),
    reason("gift", "expense", 2),
    reason("old", "expense", 3, true),
    reason("work", "income", 0),
  ];

  it("orders by usage, then manual order, skipping archived and other groups", () => {
    const ms = [
      mv("expense", { reasonId: "gift" }),
      mv("expense", { reasonId: "gift" }),
      mv("expense", { reasonId: "transport" }),
      mv("expense", { reasonId: "old" }),
    ];
    expect(rankReasons(reasons, ms, "expense").map((r) => r.id)).toEqual([
      "gift",
      "transport",
      "food",
    ]);
  });

  it("returns nothing for types without reasons", () => {
    expect(rankReasons(reasons, [], "transfer")).toEqual([]);
  });
});
