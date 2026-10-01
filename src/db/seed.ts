import { t } from "@/i18n";
import { DEFAULT_CURRENCY } from "@/domain/money";
import type {
  Account,
  Person,
  Reason,
  ReasonGroup,
  Settings,
} from "@/domain/types";

export const newId = () => crypto.randomUUID();

export const DEFAULT_SETTINGS: Settings = {
  key: "settings",
  currency: DEFAULT_CURRENCY,
  tithingRate: 0.1,
  theme: "system",
  lastExportAt: null,
  lastUsed: {},
};

/** Accounts, people, reasons and settings created on first run. */
export function buildBaseSeed(now: number) {
  const accounts: Account[] = t.seed.accounts.map((name, order) => ({
    id: newId(),
    name,
    openingBalance: 0,
    archived: false,
    order,
    createdAt: now,
  }));

  const people: Person[] = t.seed.people.map((name, order) => ({
    id: newId(),
    name,
    openingBalance: 0,
    archived: false,
    order,
    createdAt: now,
  }));

  const reasons: Reason[] = (
    Object.entries(t.seed.reasons) as [
      ReasonGroup,
      readonly {
        name: string;
        essential?: boolean;
        countsForTithing?: boolean;
        role?: Reason["role"];
      }[],
    ][]
  ).flatMap(([group, list]) =>
    list.map((r, order) => ({
      id: newId(),
      name: r.name,
      group,
      order,
      archived: false,
      essential: r.essential ?? false,
      countsForTithing: r.countsForTithing ?? false,
      role: r.role,
      createdAt: now,
    })),
  );

  return { accounts, people, reasons, settings: { ...DEFAULT_SETTINGS } };
}
