import Dexie, { type EntityTable } from "dexie";
import type { Account, Movement, Person, Reason, Settings } from "@/domain/types";
import { migrateV1toV2, migrateV2toV3, type RawData } from "./migrations";
import { buildBaseSeed } from "./seed";

/**
 * Bump when the stored shape changes, and add a matching
 * `this.version(n).stores(...).upgrade(...)` block below. Exported backups
 * carry this number so imports can be migrated too (see backup.ts).
 */
export const SCHEMA_VERSION = 3;

export class BalanceDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  people!: EntityTable<Person, "id">;
  reasons!: EntityTable<Reason, "id">;
  movements!: EntityTable<Movement, "id">;
  settings!: EntityTable<Settings, "key">;

  constructor(name = "balance") {
    super(name);

    // v1: initial schema. Only indexed fields are listed.
    this.version(1).stores({
      accounts: "id, order",
      people: "id, order",
      reasons: "id, group, order",
      movements: "id, date, type, accountId, toAccountId, personId, reasonId",
      settings: "key",
    });

    // v2: "Añadir al diezmo" moves from the income reason to each income.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const tables = ["accounts", "people", "reasons", "movements", "settings"] as const;
        const raw = Object.fromEntries(
          await Promise.all(tables.map(async (n) => [n, await tx.table(n).toArray()])),
        ) as RawData;
        const next = migrateV1toV2(raw);
        for (const n of ["reasons", "movements", "settings"] as const) {
          await tx.table(n).clear();
          await tx.table(n).bulkAdd(next[n]);
        }
      });

    // v3: "Tarea/Trabajo" → "Trabajo", "Almuerzo/comida" → "Comida".
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const reasons = await tx.table("reasons").toArray();
        const next = migrateV2toV3({ accounts: [], people: [], reasons, movements: [], settings: [] });
        await tx.table("reasons").bulkPut(next.reasons);
      });

    // Next schema change: add this.version(4) and a step in migrations.ts.

    // First run: seed accounts, people, reasons and settings.
    this.on("populate", async (tx) => {
      const seed = buildBaseSeed(Date.now());
      await tx.table("accounts").bulkAdd(seed.accounts);
      await tx.table("people").bulkAdd(seed.people);
      await tx.table("reasons").bulkAdd(seed.reasons);
      await tx.table("settings").add(seed.settings);
    });
  }
}

let instance: BalanceDB | null = null;

/** Lazily created so nothing touches IndexedDB during static prerendering. */
export function getDB(): BalanceDB {
  instance ??= new BalanceDB();
  return instance;
}
