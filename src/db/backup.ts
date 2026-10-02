// Backups: full JSON export/import (with schema migrations) and CSV of movements.

import { entryOf } from "@/domain/entry";
import type { Movement } from "@/domain/types";
import { t } from "@/i18n";
import { migrate, type RawData } from "./migrations";
import { getDB, SCHEMA_VERSION, type BalanceDB } from "./schema";

const APP_ID = "balance";
const TABLES = ["accounts", "people", "reasons", "movements", "settings"] as const;

export interface BackupFile {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: number;
  data: RawData;
}

export class InvalidBackup extends Error {}

export async function buildBackup(now = Date.now(), db: BalanceDB = getDB()): Promise<BackupFile> {
  const entries = await Promise.all(TABLES.map(async (n) => [n, await db.table(n).toArray()] as const));
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    data: Object.fromEntries(entries) as unknown as RawData,
  };
}

/** Parses and validates a backup file, migrating it to the current schema. */
export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidBackup("not json");
  }
  const b = json as Partial<BackupFile>;
  if (b?.app !== APP_ID || typeof b.schemaVersion !== "number" || !b.data) {
    throw new InvalidBackup("not a balance backup");
  }
  if (b.schemaVersion > SCHEMA_VERSION) throw new InvalidBackup("newer version");
  for (const n of TABLES) {
    if (!Array.isArray(b.data[n])) throw new InvalidBackup(`missing ${n}`);
  }
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof b.exportedAt === "number" ? b.exportedAt : 0,
    data: migrate(b.data as RawData, b.schemaVersion),
  };
}

/** Replaces everything on this device with the backup's contents. */
export async function restoreBackup(backup: BackupFile, db: BalanceDB = getDB()) {
  await db.transaction("rw", db.tables, async () => {
    for (const n of TABLES) {
      await db.table(n).clear();
      await db.table(n).bulkAdd(backup.data[n]);
    }
    // The restored copy counts as backed up as of when it was made.
    await db.settings.update("settings", { lastExportAt: backup.exportedAt || null });
  });
}

// ---- CSV ----

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** One row per movement, oldest first. Amounts are signed by who benefits. */
export function movementsCsv(data: RawData): string {
  const name = (rows: Record<string, unknown>[], id: unknown) =>
    (rows.find((r) => r.id === id)?.name as string | undefined) ?? "";
  const H = t.backup.csv;
  const header = [H.date, H.side, H.what, H.amount, H.account, H.toAccount, H.person, H.reason, H.note, H.tithe];
  const rows = (data.movements as unknown as Movement[])
    .slice()
    .sort((a, b) => a.date - b.date)
    .map((m) => {
      const e = entryOf(m);
      const signed = m.type === "adjustment" ? m.amount : e.side === "out" ? -m.amount : m.amount;
      return [
        isoLocal(m.date),
        t.side[e.side],
        t.entryOption[e.option] + (e.method === "goods" ? ` (${t.rowTag.goods})` : ""),
        signed,
        name(data.accounts, m.accountId),
        name(data.accounts, m.toAccountId),
        name(data.people, m.personId),
        name(data.reasons, m.reasonId),
        m.note,
        m.tithe ? H.yes : "",
      ];
    });
  // BOM so Excel opens accents correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// ---- Saving files ----

/**
 * Opens the system share sheet (Android: Drive, WhatsApp…) when the browser
 * can share files, otherwise downloads the file. Resolves false if the user
 * cancelled the share sheet.
 */
export async function shareOrDownload(file: File): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      // Share failed for another reason: fall back to downloading.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

const stamp = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Builds the JSON backup, shares/downloads it and records the date. */
export async function exportBackup(): Promise<boolean> {
  const now = Date.now();
  const backup = await buildBackup(now);
  const file = new File([JSON.stringify(backup)], `balance-${stamp(now)}.json`, { type: "application/json" });
  const done = await shareOrDownload(file);
  if (done) await getDB().settings.update("settings", { lastExportAt: now });
  return done;
}

export async function exportCsv(): Promise<boolean> {
  const now = Date.now();
  const backup = await buildBackup(now);
  const file = new File([movementsCsv(backup.data)], `balance-movimientos-${stamp(now)}.csv`, {
    type: "text/csv",
  });
  return shareOrDownload(file);
}
