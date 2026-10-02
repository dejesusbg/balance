// Pure data migrations, shared by the Dexie upgrade (schema.ts) and by
// importing backups made with an older version (backup.ts).

/** Loosely typed rows: older versions had fields the current types don't. */
type Row = Record<string, unknown>;

export interface RawData {
  accounts: Row[];
  people: Row[];
  reasons: Row[];
  movements: Row[];
  settings: Row[];
}

const without = (row: Row, key: string): Row => {
  const copy = { ...row };
  delete copy[key];
  return copy;
};

/** v1 → v2: "Añadir al diezmo" moves from the income reason to each income. */
export function migrateV1toV2(data: RawData): RawData {
  const counted = new Set(data.reasons.filter((r) => r.countsForTithing).map((r) => r.id));
  return {
    ...data,
    movements: data.movements.map((m) =>
      m.type === "income" && counted.has(m.reasonId) ? { ...m, tithe: true } : m,
    ),
    reasons: data.reasons.map((r) => without(r, "countsForTithing")),
    settings: data.settings.map((s) => without(s, "tithingRate")),
  };
}

/** Upgrades data from `fromVersion` to the latest schema, step by step. */
export function migrate(data: RawData, fromVersion: number): RawData {
  let out = data;
  if (fromVersion < 2) out = migrateV1toV2(out);
  // Next: if (fromVersion < 3) out = migrateV2toV3(out);
  return out;
}
