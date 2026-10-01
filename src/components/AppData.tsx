"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getDB } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/db/seed";
import { formatMoney } from "@/domain/money";
import type { Account, ID, Movement, Person, Reason, Settings } from "@/domain/types";
import { t } from "@/i18n";

export interface AppData {
  accounts: Account[];
  people: Person[];
  reasons: Reason[];
  /** Newest first. */
  movements: Movement[];
  settings: Settings;
  accountById: Map<ID, Account>;
  personById: Map<ID, Person>;
  reasonById: Map<ID, Reason>;
  /** Formats money, honoring "hide amounts". */
  fmt: (amount: number, opts?: { signed?: boolean; reveal?: boolean }) => string;
}

const Ctx = createContext<AppData | null>(null);

/** Returns null while IndexedDB is loading. */
export const useAppData = () => useContext(Ctx);

export function AppDataProvider({ children }: { children: ReactNode }) {
  // One live query over every table: data is small (thousands of rows) and
  // this keeps derived balances consistent across the whole screen.
  const raw = useLiveQuery(async () => {
    const db = getDB();
    const [accounts, people, reasons, movements, settings] = await Promise.all([
      db.accounts.orderBy("order").toArray(),
      db.people.orderBy("order").toArray(),
      db.reasons.orderBy("order").toArray(),
      db.movements.orderBy("date").reverse().toArray(),
      db.settings.get("settings"),
    ]);
    return { accounts, people, reasons, movements, settings: settings ?? DEFAULT_SETTINGS };
  });

  const value = useMemo<AppData | null>(() => {
    if (!raw) return null;
    const { settings } = raw;
    return {
      ...raw,
      accountById: new Map(raw.accounts.map((a) => [a.id, a])),
      personById: new Map(raw.people.map((p) => [p.id, p])),
      reasonById: new Map(raw.reasons.map((r) => [r.id, r])),
      fmt: (amount, opts = {}) =>
        settings.hideAmounts && !opts.reveal
          ? `${settings.currency.symbol} ${t.common.hidden}`
          : formatMoney(amount, settings.currency, opts),
    };
  }, [raw]);

  const theme = raw?.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (!theme || theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
