// The quick-add categories the user sees, mapped to stored movement types.
// Stored types stay fine-grained so the ledger math never changes.
//
//   Préstamo     · out (yo le presté)      -> lend
//   Préstamo     · in  (me prestó)         -> borrow
//   Saldar deuda · money  · in/out          -> repayment
//   Saldar deuda · goods  · in/out          -> settlement
//   Saldar deuda · forgiven · in/out        -> settlement + forgiven
//
// Direction for "Saldar deuda" is debtor-centric: "in" = their debt to me
// shrinks, "out" = my debt to them shrinks.

import type { Direction, Movement, MovementType } from "./types";

export type EntryKind = "expense" | "income" | "transfer" | "loan" | "payment" | "adjustment";
export type PaymentMethod = "money" | "goods" | "forgiven";

export interface Entry {
  kind: EntryKind;
  direction: Direction;
  method: PaymentMethod;
}

export const ENTRY_KINDS: EntryKind[] = [
  "expense",
  "income",
  "transfer",
  "loan",
  "payment",
  "adjustment",
];

export const PAYMENT_METHODS: PaymentMethod[] = ["money", "goods", "forgiven"];

/** Stored types behind each category (for list filters). */
export const ENTRY_TYPES: Record<EntryKind, MovementType[]> = {
  expense: ["expense"],
  income: ["income"],
  transfer: ["transfer"],
  loan: ["lend", "borrow"],
  payment: ["repayment", "settlement"],
  adjustment: ["adjustment"],
};

export interface MovementShape {
  type: MovementType;
  direction?: Direction;
  forgiven?: boolean;
}

export function toMovementShape({ kind, direction, method }: Entry): MovementShape {
  switch (kind) {
    case "loan":
      return { type: direction === "in" ? "borrow" : "lend" };
    case "payment":
      if (method === "money") return { type: "repayment", direction };
      return method === "forgiven"
        ? { type: "settlement", direction, forgiven: true }
        : { type: "settlement", direction };
    default:
      return { type: kind };
  }
}

export function entryOf(m: Pick<Movement, "type" | "direction" | "forgiven">): Entry {
  const base = { direction: "out" as Direction, method: "money" as PaymentMethod };
  switch (m.type) {
    case "lend":
      return { ...base, kind: "loan", direction: "out" };
    case "borrow":
      return { ...base, kind: "loan", direction: "in" };
    case "repayment":
      return { kind: "payment", direction: m.direction ?? "in", method: "money" };
    case "settlement":
      return {
        kind: "payment",
        direction: m.direction ?? "in",
        method: m.forgiven ? "forgiven" : "goods",
      };
    default:
      return { ...base, kind: m.type };
  }
}
