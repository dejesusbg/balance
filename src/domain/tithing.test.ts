import { describe, expect, it } from "vitest";
import { titheOf, tithingHistory, tithingRules, tithingSummary } from "./tithing";
import type { Movement, MovementType, Reason } from "./types";

const reason = (id: string, group: Reason["group"], extra: Partial<Reason> = {}): Reason => ({
  id,
  name: id,
  group,
  order: 0,
  archived: false,
  essential: false,
  createdAt: 0,
  ...extra,
});

const rules = tithingRules([
  reason("work", "income"),
  reason("tithe", "expense", { role: "tithing" }),
  reason("food", "expense"),
]);

let seq = 0;
const mv = (type: MovementType, amount: number, reasonId: string, extra: Partial<Movement> = {}): Movement => ({
  id: `m${++seq}`,
  type,
  amount,
  reasonId,
  date: seq,
  note: "",
  createdAt: seq,
  updatedAt: seq,
  accountId: "nu",
  ...extra,
});
const income = (amount: number, tithe = true) => mv("income", amount, "work", { tithe });

describe("tithing", () => {
  it("is a fixed 10%, rounded per income", () => {
    expect(titheOf(123_456)).toBe(12_346);
    expect(titheOf(1_000_000)).toBe(100_000);
  });

  it("owes 10% of marked income minus tithes recorded", () => {
    const ms = [
      income(1_000_000),
      income(200_000, false), // not marked
      income(345_000),
      mv("expense", 80_000, "tithe"),
      mv("expense", 50_000, "food"),
      mv("transfer", 999_999, "work", { toAccountId: "cash", tithe: true }),
    ];
    expect(tithingSummary(ms, rules)).toEqual({ due: 134_500, paid: 80_000, pending: 54_500 });
  });

  it("can be given in advance (negative pending)", () => {
    expect(tithingSummary([mv("expense", 30_000, "tithe")], rules).pending).toBe(-30_000);
  });

  it("keeps a newest-first history with running pending", () => {
    const h = tithingHistory([income(500_000), mv("expense", 50_000, "tithe"), income(100_000, false)], rules);
    expect(h.map((e) => [e.delta, e.pending])).toEqual([
      [-50_000, 0],
      [50_000, 50_000],
    ]);
  });
});
