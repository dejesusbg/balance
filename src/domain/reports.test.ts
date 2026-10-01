import { describe, expect, it } from "vitest";
import {
  breakdown,
  buildReport,
  monthlyTotals,
  percentChange,
  presetPeriod,
  previousPeriod,
  SELECTORS,
  shiftMonths,
} from "./reports";
import type { Movement, MovementType } from "./types";

const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();
let seq = 0;
const mv = (type: MovementType, amount: number, date: number, extra: Partial<Movement> = {}): Movement => ({
  id: `m${++seq}`,
  type,
  amount,
  date,
  note: "",
  createdAt: seq,
  updatedAt: seq,
  accountId: "nu",
  ...extra,
});

const NOW = at(2026, 10, 15, 18);

describe("periods", () => {
  it("builds month-aligned presets", () => {
    expect(presetPeriod("thisMonth", NOW)).toEqual({ from: at(2026, 10, 1, 0), to: NOW, months: 1 });
    const last = presetPeriod("lastMonth", NOW);
    expect(last.from).toBe(at(2026, 9, 1, 0));
    expect(last.to).toBe(at(2026, 10, 1, 0) - 1);
    expect(presetPeriod("last3", NOW).from).toBe(at(2026, 8, 1, 0));
  });

  it("compares this month so far with the same days of last month", () => {
    const prev = previousPeriod(presetPeriod("thisMonth", NOW));
    expect(prev).toEqual({ from: at(2026, 9, 1, 0), to: at(2026, 9, 15, 18), months: 1 });
  });

  it("compares a full month with the full month before", () => {
    const prev = previousPeriod(presetPeriod("lastMonth", NOW));
    expect(prev.from).toBe(at(2026, 8, 1, 0));
    expect(prev.to).toBe(at(2026, 9, 1, 0) - 1);
  });

  it("custom periods compare with the same length right before", () => {
    expect(previousPeriod({ from: 100, to: 199 })).toEqual({ from: 0, to: 99 });
  });

  it("shiftMonths clamps to the end of shorter months", () => {
    expect(shiftMonths(at(2026, 3, 31), -1)).toBe(at(2026, 2, 28));
  });
});

describe("breakdown", () => {
  const period = presetPeriod("thisMonth", NOW);
  const ms = [
    mv("expense", 30_000, at(2026, 10, 2), { reasonId: "food" }),
    mv("expense", 20_000, at(2026, 10, 9), { reasonId: "food" }),
    mv("expense", 45_000, at(2026, 10, 10), { reasonId: "fun" }),
    mv("expense", 40_000, at(2026, 9, 5), { reasonId: "food" }),
    mv("expense", 99_000, at(2026, 9, 20), { reasonId: "food" }), // after the 15th: outside prev
    mv("expense", 7_000, at(2026, 9, 3), { reasonId: "gone" }),
    mv("income", 500_000, at(2026, 10, 3), { reasonId: "work" }),
    mv("transfer", 1_000_000, at(2026, 10, 3), { toAccountId: "cash" }),
  ];

  it("ranks reasons by amount with previous-period values", () => {
    const b = breakdown(ms, period, SELECTORS.expense);
    expect(b.total).toBe(95_000);
    expect(b.previousTotal).toBe(47_000);
    expect(b.rows).toEqual([
      { reasonId: "food", amount: 50_000, count: 2, previous: 40_000 },
      { reasonId: "fun", amount: 45_000, count: 1, previous: 0 },
    ]);
  });

  it("builds the full report, ignoring transfers and counting forgiven debts", () => {
    const r = buildReport(
      [
        ...ms,
        mv("lend", 50_000, at(2026, 10, 4), { reasonId: "lunch", personId: "dad" }),
        mv("settlement", 5_000, at(2026, 10, 6), { personId: "dad", direction: "in", forgiven: true }),
        mv("settlement", 3_000, at(2026, 10, 6), { personId: "dad", direction: "in" }),
      ],
      period,
    );
    expect(r.income.total).toBe(500_000);
    expect(r.lent.rows[0]).toMatchObject({ reasonId: "lunch", amount: 50_000 });
    expect(r.borrowed.total).toBe(0);
    expect(r.forgivenByMe).toBe(5_000);
  });
});

describe("monthlyTotals", () => {
  it("sums income and expense per calendar month, oldest first", () => {
    const series = monthlyTotals(
      [
        mv("income", 100, at(2026, 10, 1)),
        mv("expense", 40, at(2026, 10, 14)),
        mv("expense", 25, at(2026, 8, 31, 23)),
        mv("income", 999, at(2026, 4, 30)), // too old
        mv("lend", 999, at(2026, 10, 2)),
      ],
      3,
      NOW,
    );
    expect(series).toEqual([
      { start: at(2026, 8, 1, 0), income: 0, expense: 25 },
      { start: at(2026, 9, 1, 0), income: 0, expense: 0 },
      { start: at(2026, 10, 1, 0), income: 100, expense: 40 },
    ]);
  });

  it("crosses year boundaries", () => {
    const series = monthlyTotals([mv("income", 7, at(2025, 12, 20))], 2, at(2026, 1, 10));
    expect(series[0]).toMatchObject({ start: at(2025, 12, 1, 0), income: 7 });
  });
});

describe("percentChange", () => {
  it("is null without a previous value", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(122, 100)).toBe(22);
    expect(percentChange(50, 100)).toBe(-50);
  });
});
