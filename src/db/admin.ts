// Whole-database operations used from Settings.

import { getDB } from "./schema";
import { generateSampleMovements } from "./sample";
import { buildBaseSeed } from "./seed";

/** Replaces all movements with ~6 months of sample data. */
export async function loadSampleData(now = Date.now()) {
  const db = getDB();
  await db.transaction("rw", [db.accounts, db.people, db.reasons, db.movements], async () => {
    const [accounts, people, reasons] = await Promise.all([
      db.accounts.orderBy("order").toArray(),
      db.people.orderBy("order").toArray(),
      db.reasons.toArray(),
    ]);
    const movements = generateSampleMovements({ accounts, people, reasons, now });
    await db.movements.clear();
    await db.movements.bulkAdd(movements);
  });
}

/** Deletes everything and seeds the first-run data again. */
export async function resetAll() {
  const db = getDB();
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((tb) => tb.clear()));
    const seed = buildBaseSeed(Date.now());
    await db.accounts.bulkAdd(seed.accounts);
    await db.people.bulkAdd(seed.people);
    await db.reasons.bulkAdd(seed.reasons);
    await db.settings.add(seed.settings);
  });
}
