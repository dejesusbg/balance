import type { Amount, CurrencyConfig } from "./types";

export const DEFAULT_CURRENCY: CurrencyConfig = {
  code: "COP",
  symbol: "$",
  locale: "es-CO",
};

const groupers = new Map<string, Intl.NumberFormat>();

function grouper(locale: string) {
  let f = groupers.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      useGrouping: "always",
    });
    groupers.set(locale, f);
  }
  return f;
}

/** Formats an integer amount as "$ 1.234.567" (or "-$ 1.234.567"). */
export function formatMoney(
  amount: Amount,
  currency: CurrencyConfig = DEFAULT_CURRENCY,
  opts: { signed?: boolean } = {},
): string {
  const abs = grouper(currency.locale).format(Math.abs(Math.round(amount)));
  const sign = amount < 0 ? "-" : opts.signed && amount > 0 ? "+" : "";
  return `${sign}${currency.symbol} ${abs}`;
}

/** Parses user input into a non-negative integer; non-digits are ignored. */
export function parseAmount(input: string): Amount {
  const digits = input.replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function isValidAmount(n: unknown): n is Amount {
  return typeof n === "number" && Number.isSafeInteger(n);
}
