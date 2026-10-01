import { describe, expect, it } from "vitest";
import {
  entryOf,
  hasMethod,
  OPTIONS_BY_SIDE,
  SIDES,
  sideOf,
  toMovementShape,
  type EntryOption,
} from "./entry";
import { movementEffect } from "./ledger";
import type { Movement } from "./types";

const all = SIDES.flatMap((s) => OPTIONS_BY_SIDE[s]);
const movementFor = (option: EntryOption, method: "money" | "goods" = "money"): Movement => ({
  ...toMovementShape({ option, method }),
  id: "x",
  amount: 1_000,
  date: 0,
  accountId: "nu",
  toAccountId: "cash",
  personId: "dad",
  note: "",
  createdAt: 0,
  updatedAt: 0,
});

describe("entry options", () => {
  it("every option belongs to exactly one side", () => {
    expect(all).toHaveLength(10);
    expect(new Set(all).size).toBe(10);
  });

  it("round-trips every option and payment method", () => {
    for (const option of all) {
      for (const method of hasMethod(option) ? (["money", "goods"] as const) : (["money"] as const)) {
        const back = entryOf(toMovementShape({ option, method }));
        expect(back).toEqual({ option, method, side: sideOf(option) });
      }
    }
  });

  it("follows who benefits: ＋ never takes money from me, − never gives me money", () => {
    for (const option of all) {
      for (const method of ["money", "goods"] as const) {
        const eff = movementEffect(movementFor(option, method));
        const net = Object.values(eff.accounts).reduce((a, b) => a + b, 0);
        if (sideOf(option) === "in") expect(net).toBeGreaterThanOrEqual(0);
        if (sideOf(option) === "out") expect(net).toBeLessThanOrEqual(0);
      }
    }
    // Without money: they paid me in kind / forgave my debt -> my position improves.
    expect(movementEffect(movementFor("repaidMe", "goods")).person!.delta).toBe(-1_000); // they owe me less
    expect(movementEffect(movementFor("forgivenMe")).person!.delta).toBe(1_000); // I owe them less
    expect(movementEffect(movementFor("iPaid", "goods")).person!.delta).toBe(1_000); // I owe less
    expect(movementEffect(movementFor("iForgave")).person!.delta).toBe(-1_000); // they owe me less
    expect(movementEffect(movementFor("forgivenMe")).accounts).toEqual({});
  });

  it("reads movements saved before this layout", () => {
    expect(entryOf({ type: "settlement", direction: "out" })).toMatchObject({ option: "iPaid", method: "goods" });
    expect(entryOf({ type: "settlement", direction: "in" })).toMatchObject({ option: "repaidMe", method: "goods" });
    expect(entryOf({ type: "settlement", direction: "in", forgiven: true })).toMatchObject({ option: "iForgave" });
    expect(entryOf({ type: "settlement", direction: "out", forgiven: true })).toMatchObject({
      option: "forgivenMe",
      side: "in",
    });
    expect(entryOf({ type: "lend" })).toMatchObject({ option: "lend", side: "out" });
    expect(entryOf({ type: "adjustment" })).toMatchObject({ side: "move" });
  });
});
