import { describe, expect, it } from "vitest";
import { completeMonths, healthMetrics, monthProgress, openLoans, spendSplit, stats } from "./health";
import { THRESHOLDS, verdicts } from "./healthRules";
import type { Account, Movement, MovementType, Person, Reason } from "./types";

const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();
const NOW = at(2026, 10, 15, 12); // Oct 15: 15 days elapsed of 31

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
const reason = (id: string, extra: Partial<Reason> = {}): Reason => ({
  id,
  name: id,
  group: "expense",
  order: 0,
  archived: false,
  essential: false,
  createdAt: 0,
  ...extra,
});
const reasons = [reason("food", { essential: true }), reason("fun"), reason("tithe", { role: "tithing" })];
const nu: Account = { id: "nu", name: "Nu", openingBalance: 0, archived: false, order: 0, createdAt: 0 };
const bro: Person = { id: "bro", name: "Hermano", openingBalance: 0, archived: false, order: 0, createdAt: 0 };

describe("stats", () => {
  it("computes average, range and variation", () => {
    expect(stats([100, 100, 100])).toEqual({ avg: 100, min: 100, max: 100, cv: 0 });
    const s = stats([0, 200])!;
    expect(s).toMatchObject({ avg: 100, min: 0, max: 200 });
    expect(s.cv).toBeCloseTo(1);
    expect(stats([])).toBeNull();
  });
});

describe("completeMonths", () => {
  it("skips the current month and months before the app was used", () => {
    const ms = [mv("income", 1, at(2026, 7, 3)), mv("income", 2, at(2026, 9, 9))];
    expect(completeMonths(ms, NOW).map((m) => new Date(m.start).getMonth() + 1)).toEqual([7, 8, 9]);
  });

  it("treats a late first month as partial", () => {
    const ms = [mv("income", 1, at(2026, 7, 20))];
    expect(completeMonths(ms, NOW).map((m) => new Date(m.start).getMonth() + 1)).toEqual([8, 9]);
  });
});

describe("monthProgress", () => {
  it("projects expenses at the current daily pace (income isn't extrapolated)", () => {
    const p = monthProgress([mv("expense", 150_000, at(2026, 10, 2)), mv("income", 500_000, at(2026, 10, 5))], NOW);
    expect(p).toMatchObject({ daysElapsed: 15, daysInMonth: 31, expense: 150_000, income: 500_000 });
    expect(p.projectedExpense).toBe(310_000);
    expect(p.projectedNet).toBe(190_000);
  });
});

describe("spendSplit", () => {
  it("buckets expenses by the essential flag, tithing apart", () => {
    const ms = [
      mv("expense", 10, at(2026, 10, 1), { reasonId: "food" }),
      mv("expense", 20, at(2026, 10, 1), { reasonId: "fun" }),
      mv("expense", 5, at(2026, 10, 1), { reasonId: "tithe" }),
      mv("expense", 7, at(2026, 10, 1)),
    ];
    expect(spendSplit(ms, reasons, 0, NOW)).toEqual({ essential: 10, discretionary: 27, tithing: 5 });
  });
});

describe("openLoans", () => {
  it("reports what's still owed and how old the oldest open part is", () => {
    const ms = [
      mv("lend", 50_000, at(2026, 6, 1), { personId: "bro" }),
      mv("lend", 20_000, at(2026, 9, 1), { personId: "bro" }),
      mv("repayment", 50_000, at(2026, 9, 10), { personId: "bro", direction: "in" }),
    ];
    const [loan] = openLoans([bro], ms, NOW);
    expect(loan).toMatchObject({ amount: 20_000, since: at(2026, 9, 1) });
    expect(loan.ageDays).toBe(44);
  });
});

describe("verdicts", () => {
  // Three complete months spending 300k, earning 1M.
  const history = [7, 8, 9].flatMap((mo) => [
    mv("income", 1_000_000, at(2026, mo, 2)),
    mv("expense", 200_000, at(2026, mo, 5), { reasonId: "food" }),
    mv("expense", 100_000, at(2026, mo, 6), { reasonId: "fun" }),
  ]);
  const metrics = (extra: Movement[], people: Person[] = []) =>
    healthMetrics({ accounts: [nu], people, reasons, movements: [...history, ...extra], now: NOW });
  const find = (vs: ReturnType<typeof verdicts>, id: string) => vs.find((v) => v.id === id);

  it("flags spending well above the 3-month average", () => {
    // 15 of 31 days, 250k spent -> ~517k projected vs 300k avg (+72%).
    const v = find(verdicts(metrics([mv("expense", 250_000, at(2026, 10, 10), { reasonId: "fun" })])), "spendPace");
    expect(v).toMatchObject({ level: "bad", pct: 72 });
  });

  it("is happy with a normal pace and a long runway", () => {
    const vs = verdicts(metrics([mv("expense", 140_000, at(2026, 10, 10), { reasonId: "food" })]));
    expect(find(vs, "spendPace")?.level).toBe("good");
    expect(find(vs, "runway")).toMatchObject({ level: "good" }); // 2.1M / 300k = 7 months
    expect(find(vs, "incomeStable")?.level).toBe("good");
  });

  it("warns about no income yet this month, pending tithe and old loans", () => {
    const vs = verdicts(
      metrics(
        [
          mv("expense", 10_000, at(2026, 10, 3), { reasonId: "food" }),
          mv("lend", 900_000, at(2026, 6, 15), { personId: "bro" }),
          mv("income", 500_000, at(2026, 9, 20), { tithe: true }),
        ],
        [bro],
      ),
    );
    expect(find(vs, "noIncomeYet")).toMatchObject({ level: "warn", spent: 10_000 });
    expect(find(vs, "tithing")).toMatchObject({ amount: 50_000 });
    expect(find(vs, "oldLoan")).toMatchObject({ name: "Hermano", amount: 900_000 });
    expect(find(vs, "lentShare")?.level).toBe("warn");
    // Worst first.
    const levels = vs.map((v) => v.level);
    expect([...levels].sort((a, b) => ["bad", "warn", "good"].indexOf(a) - ["bad", "warn", "good"].indexOf(b))).toEqual(levels);
  });

  it("says nothing it can't back with data", () => {
    const empty = healthMetrics({ accounts: [nu], people: [], reasons, movements: [], now: NOW });
    expect(verdicts(empty)).toEqual([]);
    expect(THRESHOLDS.runway.warn).toBeGreaterThan(THRESHOLDS.runway.bad);
  });
});
