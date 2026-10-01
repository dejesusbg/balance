import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { accountBalances, previewPersonBalance } from "@/domain/ledger";
import { validateMovement } from "@/domain/validate";
import { BalanceDB } from "./schema";
import { generateSampleMovements } from "./sample";

describe("database", () => {
  it("seeds accounts, people, reasons and settings on first run", async () => {
    const db = new BalanceDB("test-seed");
    await db.open();
    expect((await db.accounts.orderBy("order").toArray()).map((a) => a.name)).toEqual([
      "Nu",
      "Nequi",
      "Efectivo",
    ]);
    expect(await db.people.count()).toBe(3);
    const reasons = await db.reasons.toArray();
    expect(reasons.filter((r) => r.group === "income")).toHaveLength(4);
    expect(reasons.find((r) => r.role === "tithing")?.group).toBe("expense");
    expect((await db.settings.get("settings"))?.currency.code).toBe("COP");
    db.close();
  });

  it("generates sample movements that are all valid and never overdraw", async () => {
    const db = new BalanceDB("test-sample");
    await db.open();
    const [accounts, people, reasons] = await Promise.all([
      db.accounts.toArray(),
      db.people.toArray(),
      db.reasons.toArray(),
    ]);
    const now = new Date(2026, 9, 1).getTime();
    const ms = generateSampleMovements({ accounts, people, reasons, now });
    expect(ms.length).toBeGreaterThan(200);
    const byId = new Map(reasons.map((r) => [r.id, r]));
    for (const m of ms) expect(validateMovement(m, byId)).toEqual([]);
    for (const v of accountBalances(accounts, ms).values()) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(ms.every((m) => m.date <= now)).toBe(true);
    // No repayment or in-kind settlement overshoots the debt at that point.
    const sorted = [...ms].sort((a, b) => a.date - b.date);
    sorted.forEach((m, i) => {
      const p = people.find((x) => x.id === m.personId);
      if (!p) return;
      expect(previewPersonBalance(p, sorted.slice(0, i), m).overshoots).toBe(false);
    });
    expect(sorted.some((m) => m.type === "repayment")).toBe(true);
    db.close();
  });

  it("migrates v1 → v2: the tithing flag moves from income reasons to each income", async () => {
    const name = "test-migrate-v2";
    const v1 = new Dexie(name);
    v1.version(1).stores({
      accounts: "id, order",
      people: "id, order",
      reasons: "id, group, order",
      movements: "id, date, type, accountId, toAccountId, personId, reasonId",
      settings: "key",
    });
    await v1.open();
    await v1.table("reasons").bulkAdd([
      { id: "work", group: "income", countsForTithing: true },
      { id: "gift", group: "income", countsForTithing: false },
    ]);
    await v1.table("movements").bulkAdd([
      { id: "a", type: "income", reasonId: "work", amount: 100, date: 1 },
      { id: "b", type: "income", reasonId: "gift", amount: 100, date: 2 },
      { id: "c", type: "expense", reasonId: "work", amount: 100, date: 3 },
    ]);
    await v1.table("settings").add({ key: "settings", tithingRate: 0.1, lastUsed: {} });
    v1.close();

    const db = new BalanceDB(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect((await db.movements.get("a"))!.tithe).toBe(true);
    expect((await db.movements.get("b"))!.tithe).toBeUndefined();
    expect((await db.movements.get("c"))!.tithe).toBeUndefined();
    expect(await db.reasons.get("work")).not.toHaveProperty("countsForTithing");
    expect(await db.settings.get("settings")).not.toHaveProperty("tithingRate");
    db.close();
  });
});
