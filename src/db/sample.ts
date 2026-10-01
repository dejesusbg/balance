// Deterministic sample data (about 6 months) for trying the app.

import { movementEffect } from "@/domain/ledger";
import type {
  Account,
  ID,
  Movement,
  Person,
  Reason,
  ReasonGroup,
} from "@/domain/types";
import type { MovementDraft } from "@/domain/validate";
import { newId } from "./seed";

const DAY = 86_400_000;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

export function generateSampleMovements(opts: {
  accounts: Account[];
  people: Person[];
  reasons: Reason[];
  now: number;
  months?: number;
  seed?: number;
}): Movement[] {
  const { accounts, people, reasons, now } = opts;
  const r = rng(opts.seed ?? 7);
  const between = (lo: number, hi: number) =>
    Math.round((lo + r() * (hi - lo)) / 500) * 500;
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  const active = (g: ReasonGroup) =>
    reasons.filter((x) => x.group === g && !x.archived);
  // Prefer the seeded reason with that name/role, fall back to any in the group.
  const reason = (g: ReasonGroup, match: string | Reason["role"]): ID =>
    (active(g).find((x) => x.role === match || x.name === match) ??
      pick(active(g))).id;

  const [main, wallet, cash] = [
    accounts[0],
    accounts[1] ?? accounts[0],
    accounts[2] ?? accounts[0],
  ];
  const balances = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  const owed = new Map(people.map((p) => [p.id, p.openingBalance]));
  const out: Movement[] = [];

  const push = (d: MovementDraft) => {
    // Never let a sample account go negative.
    const eff = movementEffect(d as Movement);
    for (const [id, delta] of Object.entries(eff.accounts)) {
      if ((balances.get(id) ?? 0) + delta < 0) return;
    }
    for (const [id, delta] of Object.entries(eff.accounts)) {
      balances.set(id, (balances.get(id) ?? 0) + delta);
    }
    if (eff.person) owed.set(eff.person.id, (owed.get(eff.person.id) ?? 0) + eff.person.delta);
    const ts = d.date;
    out.push({ ...d, id: newId(), createdAt: ts, updatedAt: ts });
  };

  const days = (opts.months ?? 6) * 30;
  const start = now - days * DAY;

  for (let i = 0; i <= days; i++) {
    const dayStart = start + i * DAY;
    const at = (h: number) => Math.min(now, dayStart + h * 3_600_000 + Math.floor(r() * 3_600_000));
    if (dayStart > now) break;

    // Irregular income: roughly 3 times a month.
    if (r() < 0.1) {
      const isGift = r() < 0.2;
      const amount = isGift ? between(50_000, 200_000) : between(250_000, 1_800_000);
      const date = at(10);
      push({
        type: "income",
        amount,
        date,
        accountId: isGift ? wallet.id : main.id,
        reasonId: reason("income", isGift ? "Regalo" : "Tarea/Trabajo"),
        note: isGift ? "Regalo" : pick(["Proyecto web", "Tarea", "Clases", "Freelance"]),
      });
      if (!isGift && r() < 0.8) {
        push({
          type: "expense",
          amount: Math.round(amount * 0.1),
          date: date + 3_600_000,
          accountId: main.id,
          reasonId: reason("expense", "tithing"),
          note: "",
        });
      }
    }

    // Food most days.
    if (r() < 0.7) {
      push({
        type: "expense",
        amount: between(6_000, 32_000),
        date: at(13),
        accountId: pick([wallet.id, cash.id, main.id]),
        reasonId: reason("expense", "Comida"),
        note: pick(["Almuerzo", "Mecato", "Café", "Mercado", ""]),
      });
    }

    // Transport.
    if (r() < 0.45) {
      push({
        type: "expense",
        amount: between(2_500, 12_000),
        date: at(8),
        accountId: pick([wallet.id, cash.id]),
        reasonId: reason("expense", "Transporte"),
        note: pick(["Bus", "Taxi", "Metro", ""]),
      });
    }

    // Monthly subscriptions on fixed days.
    const dom = new Date(dayStart).getDate();
    if (dom === 5) {
      push({
        type: "expense",
        amount: 26_900,
        date: at(7),
        accountId: main.id,
        reasonId: reason("expense", "Suscripción"),
        note: "Spotify",
      });
    }
    if (dom === 18) {
      push({
        type: "expense",
        amount: 44_900,
        date: at(7),
        accountId: main.id,
        reasonId: reason("expense", "Suscripción"),
        note: "Netflix",
      });
    }

    // Occasional wanted purchase.
    if (r() < 0.06) {
      push({
        type: "expense",
        amount: between(40_000, 260_000),
        date: at(18),
        accountId: main.id,
        reasonId: reason("expense", "Compra deseada"),
        note: pick(["Audífonos", "Ropa", "Libro", "Juego"]),
      });
    }

    // Move money between accounts.
    if (r() < 0.05) {
      push({
        type: "transfer",
        amount: between(50_000, 200_000),
        date: at(11),
        accountId: main.id,
        toAccountId: pick([wallet.id, cash.id]),
        note: "",
      });
    }

    // Loans with family. Repayments and in-kind settlements never exceed
    // the open debt, like real life.
    if (people.length && r() < 0.07) {
      const p = pick(people);
      const balance = owed.get(p.id) ?? 0;
      const kind = r();
      const loanReason = () =>
        reason("loan", pick(["Almuerzo/comida", "Compra de regalo", "Emergencia"]));
      if (balance > 0 && kind < 0.35) {
        push({
          type: "repayment",
          direction: "in",
          amount: Math.min(balance, between(10_000, 60_000)),
          date: at(16),
          accountId: wallet.id,
          personId: p.id,
          reasonId: loanReason(),
          note: "",
        });
      } else if (balance > 0 && kind < 0.55) {
        push({
          type: "settlement",
          direction: "in",
          amount: Math.min(balance, between(12_000, 35_000)),
          date: at(13),
          personId: p.id,
          reasonId: reason("loan", "Almuerzo/comida"),
          note: "Me invitó a almorzar",
        });
      } else if (balance < 0 && kind < 0.6) {
        push({
          type: "repayment",
          direction: "out",
          amount: Math.min(-balance, between(20_000, 100_000)),
          date: at(17),
          accountId: main.id,
          personId: p.id,
          reasonId: reason("loan", "Emergencia"),
          note: "",
        });
      } else if (kind < 0.9) {
        push({
          type: "lend",
          amount: between(10_000, 90_000),
          date: at(15),
          accountId: pick([wallet.id, cash.id, main.id]),
          personId: p.id,
          reasonId: loanReason(),
          note: "",
        });
      } else {
        push({
          type: "borrow",
          amount: between(20_000, 100_000),
          date: at(17),
          accountId: cash.id,
          personId: p.id,
          reasonId: reason("loan", "Emergencia"),
          note: "",
        });
      }
    }
  }

  return out;
}
