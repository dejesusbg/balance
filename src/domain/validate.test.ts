import { describe, expect, it } from "vitest";
import { validateMovement, type MovementDraft } from "./validate";
import type { Reason } from "./types";

const reason = (id: string, group: Reason["group"]): Reason => ({
  id,
  name: id,
  group,
  order: 0,
  archived: false,
  essential: false,
  countsForTithing: false,
  createdAt: 0,
});
const reasons = new Map(
  [reason("work", "income"), reason("food", "expense"), reason("lunch", "loan")].map(
    (r) => [r.id, r],
  ),
);
const draft = (d: Partial<MovementDraft>): MovementDraft => ({
  type: "expense",
  amount: 1000,
  date: 0,
  note: "",
  ...d,
});

describe("validateMovement", () => {
  it("accepts a valid expense", () => {
    expect(
      validateMovement(draft({ accountId: "nu", reasonId: "food" }), reasons),
    ).toEqual([]);
  });

  it("requires a positive integer amount", () => {
    for (const amount of [0, -5, 1.5]) {
      expect(
        validateMovement(draft({ amount, accountId: "nu", reasonId: "food" }), reasons),
      ).toContain("amountRequired");
    }
  });

  it("allows negative adjustments without a reason", () => {
    expect(
      validateMovement(draft({ type: "adjustment", amount: -500, accountId: "nu" }), reasons),
    ).toEqual([]);
  });

  it("rejects transfers to the same account", () => {
    expect(
      validateMovement(
        draft({ type: "transfer", accountId: "nu", toAccountId: "nu" }),
        reasons,
      ),
    ).toEqual(["sameAccount"]);
  });

  it("requires reasons from the matching group", () => {
    expect(
      validateMovement(draft({ type: "income", accountId: "nu", reasonId: "food" }), reasons),
    ).toEqual(["reasonWrongGroup"]);
  });

  it("repayments need no reason", () => {
    expect(
      validateMovement(
        draft({ type: "repayment", accountId: "nu", personId: "dad", direction: "in" }),
        reasons,
      ),
    ).toEqual([]);
  });

  it("settlement needs a person and direction but no account", () => {
    expect(
      validateMovement(
        draft({ type: "settlement", accountId: "nu", reasonId: "lunch" }),
        reasons,
      ),
    ).toEqual(["unexpectedAccount", "personRequired", "directionRequired"]);
  });
});
