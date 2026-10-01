import Dexie, { type EntityTable } from "dexie";
import type { Account, Movement, Person, Reason, Settings } from "@/domain/types";
import { buildBaseSeed } from "./seed";

/**
 * Bump when the stored shape changes, and add a matching
 * `this.version(n).stores(...).upgrade(...)` block below. Exported backups
 * carry this number so imports can be migrated too (see backup.ts).
 */
export const SCHEMA_VERSION = 2;

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
    // Existing incomes keep what their reason said; the reason flag goes away.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const reasons = await tx.table("reasons").toArray();
        const counted = new Set(reasons.filter((r) => r.countsForTithing).map((r) => r.id));
        await tx
          .table("movements")
          .where("type")
          .equals("income")
          .modify((m) => {
            if (m.reasonId && counted.has(m.reasonId)) m.tithe = true;
          });
        await tx.table("reasons").toCollection().modify((r) => {
          delete r.countsForTithing;
        });
        await tx.table("settings").toCollection().modify((s) => {
          delete s.tithingRate;
        });
      });

    // Next schema change: add this.version(3) with its own upgrade.

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
