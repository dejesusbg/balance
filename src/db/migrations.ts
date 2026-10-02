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

/** Seeded reasons renamed in v3: [group, old name, new name]. */
const V3_RENAMES: [string, string, string][] = [
  ["income", "Tarea/Trabajo", "Trabajo"],
  ["loan", "Almuerzo/comida", "Comida"],
];

/** v2 → v3: shorter names for two seeded reasons (only if not renamed by the user). */
export function migrateV2toV3(data: RawData): RawData {
  return {
    ...data,
    reasons: data.reasons.map((r) => {
      const hit = V3_RENAMES.find(([group, from]) => r.group === group && r.name === from);
      return hit ? { ...r, name: hit[2] } : r;
    }),
  };
}

/** Upgrades data from `fromVersion` to the latest schema, step by step. */
export function migrate(data: RawData, fromVersion: number): RawData {
  let out = data;
  if (fromVersion < 2) out = migrateV1toV2(out);
  if (fromVersion < 3) out = migrateV2toV3(out);
  // Next: if (fromVersion < 4) out = migrateV3toV4(out);
  return out;
}
