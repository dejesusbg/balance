import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { buildBackup, InvalidBackup, movementsCsv, parseBackup, restoreBackup } from "./backup";
import { saveMovement } from "./repo";
import { BalanceDB, SCHEMA_VERSION } from "./schema";

const fresh = async () => {
  const db = new BalanceDB(`backup-${crypto.randomUUID()}`);
  await db.open();
  return db;
};

describe("backup", () => {
  it("round-trips everything through JSON into another device", async () => {
    const a = await fresh();
    const nu = (await a.accounts.orderBy("order").first())!.id;
    const work = (await a.reasons.toArray()).find((r) => r.group === "income" && r.name === "Trabajo")!.id;
    await saveMovement({ type: "income", amount: 500_000, date: 1, accountId: nu, reasonId: work, note: 'con "comillas", y coma', tithe: true }, undefined, a);
    const file = JSON.stringify(await buildBackup(123, a));

    const b = await fresh();
    await restoreBackup(parseBackup(file), b);
    expect(await b.movements.toArray()).toEqual(await a.movements.toArray());
    expect(await b.accounts.toArray()).toEqual(await a.accounts.toArray());
    expect((await b.settings.get("settings"))!.lastExportAt).toBe(123);
  });

  it("migrates backups made with schema v1", () => {
    const v1 = {
      app: "balance",
      schemaVersion: 1,
      exportedAt: 5,
      data: {
        accounts: [],
        people: [],
        reasons: [{ id: "work", group: "income", name: "Tarea/Trabajo", countsForTithing: true }],
        movements: [{ id: "m", type: "income", reasonId: "work", amount: 10, date: 1 }],
        settings: [{ key: "settings", tithingRate: 0.1, lastUsed: {} }],
      },
    };
    const b = parseBackup(JSON.stringify(v1));
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
    expect(b.data.movements[0]).toMatchObject({ tithe: true });
    expect(b.data.reasons[0]).not.toHaveProperty("countsForTithing");
    expect(b.data.reasons[0]).toMatchObject({ name: "Trabajo" }); // v3 rename applies too
    expect(b.data.settings[0]).not.toHaveProperty("tithingRate");
  });

  it("rejects files that aren't backups or come from a newer version", () => {
    expect(() => parseBackup("nope")).toThrow(InvalidBackup);
    expect(() => parseBackup(JSON.stringify({ app: "other" }))).toThrow(InvalidBackup);
    expect(() => parseBackup(JSON.stringify({ app: "balance", schemaVersion: 99, data: {} }))).toThrow(
      "newer version",
    );
    expect(() =>
      parseBackup(JSON.stringify({ app: "balance", schemaVersion: 2, data: { accounts: [] } })),
    ).toThrow(InvalidBackup);
  });

  it("exports movements as CSV with escaping and signed amounts", async () => {
    const a = await fresh();
    const [nu] = await a.accounts.orderBy("order").toArray();
    const mom = (await a.people.toArray())[0];
    const food = (await a.reasons.toArray()).find((r) => r.group === "expense" && r.name === "Comida")!.id;
    await saveMovement({ type: "expense", amount: 12_000, date: 2, accountId: nu.id, reasonId: food, note: 'dijo "hola", ok' }, undefined, a);
    await saveMovement({ type: "settlement", direction: "in", amount: 5_000, date: 3, personId: mom.id, note: "" }, undefined, a);
    const csv = movementsCsv((await buildBackup(0, a)).data);
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("Fecha,Lado,Qué pasó,Monto,Cuenta,Cuenta destino,Persona,Motivo,Nota,Diezmo");
    expect(lines[1]).toContain(',Doy,Gasto,-12000,Nu,,,Comida,"dijo ""hola"", ok",');
    expect(lines[2]).toContain(`,Recibo,Me pagaron (en especie),5000,,,${mom.name},,,`);
  });
});
