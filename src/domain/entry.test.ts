import { describe, expect, it } from "vitest";
import { ENTRY_KINDS, ENTRY_TYPES, entryOf, PAYMENT_METHODS, toMovementShape, type Entry } from "./entry";

describe("entry kinds", () => {
  it("round-trips every category/direction/method combination", () => {
    for (const kind of ENTRY_KINDS) {
      for (const direction of ["in", "out"] as const) {
        for (const method of PAYMENT_METHODS) {
          const shape = toMovementShape({ kind, direction, method });
          const back = entryOf(shape);
          expect(back.kind).toBe(kind);
          if (kind === "loan" || kind === "payment") expect(back.direction).toBe(direction);
          if (kind === "payment") expect(back.method).toBe(method);
          expect(ENTRY_TYPES[kind]).toContain(shape.type);
        }
      }
    }
  });

  it("maps to the stored types", () => {
    const e = (x: Partial<Entry>): Entry => ({ kind: "payment", direction: "in", method: "money", ...x });
    expect(toMovementShape(e({ kind: "loan", direction: "out" }))).toEqual({ type: "lend" });
    expect(toMovementShape(e({ kind: "loan", direction: "in" }))).toEqual({ type: "borrow" });
    expect(toMovementShape(e({ method: "money", direction: "out" }))).toEqual({ type: "repayment", direction: "out" });
    expect(toMovementShape(e({ method: "goods" }))).toEqual({ type: "settlement", direction: "in" });
    expect(toMovementShape(e({ method: "forgiven" }))).toEqual({
      type: "settlement",
      direction: "in",
      forgiven: true,
    });
  });

  it("reads old in-kind settlements as goods", () => {
    expect(entryOf({ type: "settlement", direction: "out" })).toEqual({
      kind: "payment",
      direction: "out",
      method: "goods",
    });
  });
});
