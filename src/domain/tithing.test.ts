import { describe, expect, it } from "vitest";
import {
  titheOf,
  tithingHistory,
  tithingRules,
  tithingSuggestion,
  tithingSummary,
} from "./tithing";
import type { Movement, MovementType, Reason } from "./types";

const reason = (id: string, group: Reason["group"], extra: Partial<Reason> = {}): Reason => ({
  id,
  name: id,
  group,
  order: 0,
  archived: false,
  essential: false,
  countsForTithing: false,
  createdAt: 0,
  ...extra,
});

const reasons = [
  reason("work", "income", { countsForTithing: true }),
  reason("gift", "income", { countsForTithing: false }),
  reason("tithe", "expense", { role: "tithing" }),
  reason("food", "expense"),
];
const rules = tithingRules(reasons, 0.1);

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

describe("tithing", () => {
  it("rounds each income's tithe to whole pesos", () => {
    expect(titheOf(123_456, 0.1)).toBe(12_346);
    expect(titheOf(1_000_000, 0.12)).toBe(120_000);
  });

  it("owes rate × counted income minus tithes recorded", () => {
    const ms = [
      mv("income", 1_000_000, "work"),
      mv("income", 200_000, "gift"), // excluded reason
      mv("income", 345_000, "work"),
      mv("expense", 80_000, "tithe"),
      mv("expense", 50_000, "food"),
      mv("transfer", 999_999, "work", { toAccountId: "cash" }),
    ];
    expect(tithingSummary(ms, rules)).toEqual({ due: 134_500, paid: 80_000, pending: 54_500 });
  });

  it("can be given in advance (negative pending)", () => {
    expect(tithingSummary([mv("expense", 30_000, "tithe")], rules).pending).toBe(-30_000);
  });

  it("keeps a newest-first history with running pending", () => {
    const ms = [mv("income", 500_000, "work"), mv("expense", 50_000, "tithe"), mv("income", 100_000, "gift")];
    const h = tithingHistory(ms, rules);
    expect(h.map((e) => [e.delta, e.pending])).toEqual([
      [-50_000, 0],
      [50_000, 50_000],
    ]);
  });

  it("suggests the income's tithe, capped by what's pending", () => {
    const income = mv("income", 300_000, "work");
    expect(tithingSuggestion(income, [income], rules)).toBe(30_000);
    const advance = mv("expense", 20_000, "tithe");
    expect(tithingSuggestion(income, [advance, income], rules)).toBe(10_000);
    expect(tithingSuggestion(income, [mv("expense", 99_000, "tithe"), income], rules)).toBe(0);
    const gift = mv("income", 300_000, "gift");
    expect(tithingSuggestion(gift, [gift], rules)).toBe(0);
  });

  it("follows the per-reason toggle and a zero rate", () => {
    const off = tithingRules(reasons.map((r) => ({ ...r, countsForTithing: false })), 0.1);
    expect(tithingSummary([mv("income", 100, "work")], off).due).toBe(0);
    expect(tithingSummary([mv("income", 100, "work")], tithingRules(reasons, 0)).due).toBe(0);
  });
});
