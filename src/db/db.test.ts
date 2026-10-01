import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { accountBalances } from "@/domain/ledger";
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
    db.close();
  });
});
