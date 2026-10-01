// Core domain model. Balances are never stored: they are always derived
// from the ledger of movements (see ledger.ts).

export type ID = string;

/** Epoch milliseconds. */
export type Timestamp = number;

/** Integer amount in the smallest unit we use (whole COP). */
export type Amount = number;

export type MovementType =
  | "income" // outside -> account
  | "expense" // account -> outside
  | "transfer" // account -> account
  | "lend" // account -> person (they owe me more)
  | "repayment" // money between a person and an account that settles a debt
  | "settlement" // in kind: changes a person's balance without touching accounts
  | "borrow" // person -> account (I owe them more)
  | "adjustment"; // reconciliation: signed delta on one account

/**
 * Direction for movements where value can flow either way with a person.
 * - "in":  value comes to me from the person (their balance goes down)
 * - "out": value goes from me to the person (their balance goes up)
 *
 * repayment "in"   = they paid me back
 * repayment "out"  = I paid back what I owed
 * settlement "in"  = they gave me something in kind (e.g. mom bought me lunch)
 * settlement "out" = I gave them something in kind
 */
export type Direction = "in" | "out";

export type ReasonGroup = "income" | "expense" | "loan";

export interface Account {
  id: ID;
  name: string;
  openingBalance: Amount;
  archived: boolean;
  order: number;
  createdAt: Timestamp;
}

export interface Person {
  id: ID;
  name: string;
  /** Signed: positive = they owe me, negative = I owe them. */
  openingBalance: Amount;
  archived: boolean;
  order: number;
  createdAt: Timestamp;
}

export interface Reason {
  id: ID;
  name: string;
  group: ReasonGroup;
  order: number;
  archived: boolean;
  /** Expense reasons: counts as essential spending in the health check. */
  essential: boolean;
  /** Income reasons: counts toward tithing. */
  countsForTithing: boolean;
  /** Special built-in meaning. */
  role?: "tithing" | "fee";
  createdAt: Timestamp;
}

export interface Movement {
  id: ID;
  type: MovementType;
  /**
   * Always a positive integer, except for "adjustment" where it is the
   * signed difference applied to the account.
   */
  amount: Amount;
  date: Timestamp;
  /** Source account (or the only account for income/repayment-in/borrow/adjustment). */
  accountId?: ID;
  /** Destination account for transfers. */
  toAccountId?: ID;
  personId?: ID;
  reasonId?: ID;
  direction?: Direction;
  note: string;
  /** Links a transfer and its fee expense. */
  linkedId?: ID;
  /** Adjustment only: the real balance typed by the user. */
  targetBalance?: Amount;
  /**
   * Repayment/settlement only: settles a debt from before the app existed.
   * Accounts move as usual, but the person's balance doesn't change,
   * because that debt was never recorded.
   */
  priorDebt?: boolean;
  /**
   * Settlement only: the debt was forgiven (nothing was given in exchange).
   * Same ledger effect as an in-kind settlement.
   */
  forgiven?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Settings {
  key: "settings";
  currency: CurrencyConfig;
  tithingRate: number;
  theme: "system" | "light" | "dark";
  lastExportAt: Timestamp | null;
  /** Mask amounts on screen (privacy in public). */
  hideAmounts?: boolean;
  lastUsed: {
    type?: MovementType;
    accountId?: ID;
    /** Last reason picked per movement type. */
    reasonByType?: Partial<Record<MovementType, ID>>;
  };
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
}

/**
 * Which reason group each movement type uses. Anything that settles a debt
 * (repayment, in-kind, forgiveness) has no reason: the "why" belongs to the
 * loan. Transfers and adjustments don't have one either.
 */
export const REASON_GROUP_BY_TYPE: Partial<Record<MovementType, ReasonGroup>> = {
  income: "income",
  expense: "expense",
  lend: "loan",
  borrow: "loan",
};
