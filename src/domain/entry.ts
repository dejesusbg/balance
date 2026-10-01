// The quick-add options the user sees, grouped by who benefits, mapped to
// stored movement types (which stay fine-grained, so the ledger never changes).
//
//   ＋ Recibo (I benefit)          − Doy (someone else benefits)
//   income        -> income        expense    -> expense
//   borrow        -> borrow        lend       -> lend
//   repaidMe      -> repayment in  iPaid      -> repayment out
//                 or settlement in (in kind)          or settlement out (in kind)
//   forgivenMe    -> settlement out + forgiven
//                                  iForgave   -> settlement in + forgiven
//   ⇄ Muevo (my total doesn't change): transfer, adjustment
//
// Settlement/repayment direction stays debtor-centric in storage: "in" means
// their debt to me shrinks, "out" means my debt to them shrinks.

import type { Direction, Movement, MovementType } from "./types";

export type Side = "in" | "out" | "move";
export type EntryOption =
  | "income"
  | "borrow"
  | "repaidMe"
  | "forgivenMe"
  | "expense"
  | "lend"
  | "iPaid"
  | "iForgave"
  | "transfer"
  | "adjustment";
export type PaymentMethod = "money" | "goods";

export interface Entry {
  option: EntryOption;
  method: PaymentMethod;
}

export const SIDES: Side[] = ["in", "out", "move"];

export const OPTIONS_BY_SIDE: Record<Side, EntryOption[]> = {
  in: ["income", "borrow", "repaidMe", "forgivenMe"],
  out: ["expense", "lend", "iPaid", "iForgave"],
  move: ["transfer", "adjustment"],
};

export const sideOf = (option: EntryOption): Side =>
  SIDES.find((s) => OPTIONS_BY_SIDE[s].includes(option))!;

/** Options that pay down a debt and can be paid with money or in kind. */
export const hasMethod = (option: EntryOption) => option === "repaidMe" || option === "iPaid";

export interface MovementShape {
  type: MovementType;
  direction?: Direction;
  forgiven?: boolean;
}

export function toMovementShape({ option, method }: Entry): MovementShape {
  switch (option) {
    case "repaidMe":
      return method === "goods"
        ? { type: "settlement", direction: "in" }
        : { type: "repayment", direction: "in" };
    case "iPaid":
      return method === "goods"
        ? { type: "settlement", direction: "out" }
        : { type: "repayment", direction: "out" };
    case "forgivenMe":
      return { type: "settlement", direction: "out", forgiven: true };
    case "iForgave":
      return { type: "settlement", direction: "in", forgiven: true };
    default:
      return { type: option };
  }
}

export function entryOf(m: Pick<Movement, "type" | "direction" | "forgiven">): Entry & { side: Side } {
  const entry = (option: EntryOption, method: PaymentMethod = "money") => ({
    option,
    method,
    side: sideOf(option),
  });
  const out = m.direction === "out";
  switch (m.type) {
    case "repayment":
      return entry(out ? "iPaid" : "repaidMe");
    case "settlement":
      if (m.forgiven) return entry(out ? "forgivenMe" : "iForgave");
      return entry(out ? "iPaid" : "repaidMe", "goods");
    default:
      return entry(m.type);
  }
}
