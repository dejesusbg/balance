import { t } from "@/i18n";
import { DEFAULT_CURRENCY } from "@/domain/money";
import type {
  Account,
  Person,
  Reason,
  ReasonGroup,
  Settings,
} from "@/domain/types";

/**
 * Random UUID v4. crypto.randomUUID() only exists in secure contexts
 * (HTTPS/localhost), so fall back to getRandomValues for http://<LAN-IP>.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const DEFAULT_SETTINGS: Settings = {
  key: "settings",
  currency: DEFAULT_CURRENCY,
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
      role: r.role,
      createdAt: now,
    })),
  );

  return { accounts, people, reasons, settings: { ...DEFAULT_SETTINGS } };
}
