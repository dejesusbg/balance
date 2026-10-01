import { describe, expect, it } from "vitest";
import { formatMoney, parseAmount } from "./money";

describe("formatMoney", () => {
  it("formats COP with dots as thousands separators", () => {
    expect(formatMoney(1_234_567)).toBe("$ 1.234.567");
    expect(formatMoney(0)).toBe("$ 0");
    expect(formatMoney(1_000)).toBe("$ 1.000");
  });

  it("handles negatives and explicit signs", () => {
    expect(formatMoney(-2_500)).toBe("-$ 2.500");
    expect(formatMoney(2_500, undefined, { signed: true })).toBe("+$ 2.500");
  });
});

describe("parseAmount", () => {
  it("keeps digits only", () => {
    expect(parseAmount("$ 1.234.567")).toBe(1_234_567);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
  });
});
