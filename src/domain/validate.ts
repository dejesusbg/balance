import { isValidAmount } from "./money";
import {
  REASON_GROUP_BY_TYPE,
  type Movement,
  type Reason,
  type ID,
} from "./types";

export type ValidationError =
  | "amountRequired"
  | "accountRequired"
  | "toAccountRequired"
  | "sameAccount"
  | "personRequired"
  | "reasonRequired"
  | "reasonWrongGroup"
  | "directionRequired"
  | "unexpectedAccount";

export type MovementDraft = Omit<
  Movement,
  "id" | "createdAt" | "updatedAt"
>;

/** Returns the list of problems with a movement; empty means valid. */
export function validateMovement(
  m: MovementDraft,
  reasons: Map<ID, Reason>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isValidAmount(m.amount) || m.amount === 0) errors.push("amountRequired");
  else if (m.type !== "adjustment" && m.amount < 0) errors.push("amountRequired");

  if (m.type === "settlement") {
    if (m.accountId) errors.push("unexpectedAccount");
  } else if (!m.accountId) {
    errors.push("accountRequired");
  }

  if (m.type === "transfer") {
    if (!m.toAccountId) errors.push("toAccountRequired");
    else if (m.toAccountId === m.accountId) errors.push("sameAccount");
  }

  const needsPerson = ["lend", "repayment", "settlement", "borrow"].includes(
    m.type,
  );
  if (needsPerson && !m.personId) errors.push("personRequired");

  if ((m.type === "repayment" || m.type === "settlement") && !m.direction) {
    errors.push("directionRequired");
  }

  const group = REASON_GROUP_BY_TYPE[m.type];
  if (group) {
    const reason = m.reasonId ? reasons.get(m.reasonId) : undefined;
    if (!reason) errors.push("reasonRequired");
    else if (reason.group !== group) errors.push("reasonWrongGroup");
  }

  return errors;
}
