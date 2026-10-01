// All writes go through here. Every mutation returns an UndoToken holding
// the previous state of the rows it touched, so "Deshacer" can put them back.

import { accountBalanceAt, adjustmentDelta } from "@/domain/ledger";
import {
  REASON_GROUP_BY_TYPE,
  type Account,
  type Amount,
  type ID,
  type Movement,
  type Person,
  type Reason,
  type ReasonGroup,
  type Settings,
} from "@/domain/types";
import {
  validateMovement,
  type MovementDraft,
  type ValidationError,
} from "@/domain/validate";
import { getDB, type BalanceDB } from "./schema";
import { newId } from "./seed";

export interface UndoToken {
  movements: { id: ID; before: Movement | null }[];
}

export class ValidationFailed extends Error {
  constructor(public errors: ValidationError[]) {
    super(errors.join(", "));
  }
}

export interface MovementInput extends MovementDraft {
  /** Transfers only: creates/updates a linked fee expense. */
  fee?: Amount;
}

/** Creates (no id) or updates (with id) a movement. */
export async function saveMovement(
  input: MovementInput,
  id?: ID,
  db: BalanceDB = getDB(),
): Promise<{ id: ID; undo: UndoToken }> {
  const { fee = 0, ...draft } = input;
  const reasons = new Map((await db.reasons.toArray()).map((r) => [r.id, r]));
  const errors = validateMovement(draft, reasons);
  if (fee < 0 || !Number.isSafeInteger(fee)) errors.push("amountRequired");
  if (errors.length) throw new ValidationFailed(errors);

  const undo: UndoToken = { movements: [] };
  const now = Date.now();
  const movementId = id ?? newId();

  await db.transaction("rw", [db.movements, db.reasons, db.settings], async () => {
    const before = id ? ((await db.movements.get(id)) ?? null) : null;
    const linked = before?.linkedId ? await db.movements.get(before.linkedId) : undefined;
    undo.movements.push({ id: movementId, before });

    const movement: Movement = {
      ...clean(draft),
      id: movementId,
      createdAt: before?.createdAt ?? now,
      updatedAt: now,
    };

    // A transfer's fee is a separate expense linked both ways.
    const wantsFee = draft.type === "transfer" && fee > 0;
    const isTransferWithFee = before?.type === "transfer" && linked;
    if (wantsFee) {
      const feeReason =
        [...reasons.values()].find((r) => r.role === "fee" && !r.archived) ??
        [...reasons.values()].find((r) => r.group === "expense" && !r.archived);
      const feeId = isTransferWithFee ? linked.id : newId();
      undo.movements.push({ id: feeId, before: isTransferWithFee ? linked : null });
      await db.movements.put({
        id: feeId,
        type: "expense",
        amount: fee,
        date: draft.date,
        accountId: draft.accountId,
        reasonId: isTransferWithFee ? linked.reasonId : feeReason?.id,
        note: isTransferWithFee ? linked.note : "",
        linkedId: movementId,
        createdAt: isTransferWithFee ? linked.createdAt : now,
        updatedAt: now,
      });
      movement.linkedId = feeId;
    } else if (isTransferWithFee) {
      undo.movements.push({ id: linked.id, before: linked });
      await db.movements.delete(linked.id);
      delete movement.linkedId;
    } else if (before?.linkedId && draft.type !== "transfer") {
      // Editing a fee expense keeps its link to the transfer.
      movement.linkedId = before.linkedId;
    }

    await db.movements.put(movement);
    await rememberLastUsed(db, movement);
  });

  return { id: movementId, undo };
}

/** Deletes a movement (and a transfer's fee). Undo restores them. */
export async function deleteMovement(id: ID, db: BalanceDB = getDB()): Promise<UndoToken> {
  const undo: UndoToken = { movements: [] };
  await db.transaction("rw", db.movements, async () => {
    const m = await db.movements.get(id);
    if (!m) return;
    undo.movements.push({ id, before: m });
    await db.movements.delete(id);
    if (m.type === "transfer" && m.linkedId) {
      const fee = await db.movements.get(m.linkedId);
      if (fee) {
        undo.movements.push({ id: fee.id, before: fee });
        await db.movements.delete(fee.id);
      }
    }
  });
  return undo;
}

export async function undo(token: UndoToken, db: BalanceDB = getDB()) {
  await db.transaction("rw", db.movements, async () => {
    // Reverse order so the earliest snapshot of a row wins.
    for (const { id, before } of [...token.movements].reverse()) {
      if (before) await db.movements.put(before);
      else await db.movements.delete(id);
    }
  });
}

/** Records an adjustment so the account matches the real balance. */
export async function adjustAccount(
  accountId: ID,
  target: Amount,
  date: number,
  note = "",
  db: BalanceDB = getDB(),
): Promise<{ id: ID; delta: Amount; undo: UndoToken } | null> {
  const account = await db.accounts.get(accountId);
  if (!account) throw new Error("Account not found");
  const movements = await db.movements.toArray();
  const delta = adjustmentDelta(accountBalanceAt(account, movements, date), target);
  if (delta === 0) return null;
  const { id, undo } = await saveMovement(
    { type: "adjustment", amount: delta, targetBalance: target, accountId, date, note },
    undefined,
    db,
  );
  return { id, delta, undo };
}

// ---- Accounts ----

export async function createAccount(
  name: string,
  openingBalance: Amount,
  db: BalanceDB = getDB(),
): Promise<ID> {
  const last = await db.accounts.orderBy("order").last();
  const account: Account = {
    id: newId(),
    name: name.trim(),
    openingBalance,
    archived: false,
    order: (last?.order ?? -1) + 1,
    createdAt: Date.now(),
  };
  await db.accounts.add(account);
  return account.id;
}

export async function updateAccount(
  id: ID,
  patch: Partial<Pick<Account, "name" | "openingBalance" | "archived">>,
  db: BalanceDB = getDB(),
) {
  await db.accounts.update(id, {
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  });
}

/** Swaps an account with its neighbour in the list order. */
export const moveAccount = (id: ID, dir: -1 | 1, db: BalanceDB = getDB()) =>
  moveInOrder(db, "accounts", id, dir);

// ---- People ----

export async function createPerson(
  name: string,
  openingBalance: Amount,
  db: BalanceDB = getDB(),
): Promise<ID> {
  const last = await db.people.orderBy("order").last();
  const person: Person = {
    id: newId(),
    name: name.trim(),
    openingBalance,
    archived: false,
    order: (last?.order ?? -1) + 1,
    createdAt: Date.now(),
  };
  await db.people.add(person);
  return person.id;
}

export async function updatePerson(
  id: ID,
  patch: Partial<Pick<Person, "name" | "openingBalance" | "archived">>,
  db: BalanceDB = getDB(),
) {
  await db.people.update(id, {
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  });
}

async function moveInOrder(db: BalanceDB, tableName: "accounts" | "people", id: ID, dir: -1 | 1) {
  const table = db.table<{ id: ID; order: number }, ID>(tableName);
  await db.transaction("rw", table, async () => {
    const list = await table.orderBy("order").toArray();
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((x, order) => table.update(x.id, { order })));
  });
}

// ---- Reasons ----

export async function createReason(
  group: ReasonGroup,
  name: string,
  db: BalanceDB = getDB(),
): Promise<ID> {
  const inGroup = await db.reasons.where("group").equals(group).toArray();
  const reason: Reason = {
    id: newId(),
    name: name.trim(),
    group,
    order: Math.max(-1, ...inGroup.map((r) => r.order)) + 1,
    archived: false,
    essential: false,
    createdAt: Date.now(),
  };
  await db.reasons.add(reason);
  return reason.id;
}

export async function updateReason(
  id: ID,
  patch: Partial<Pick<Reason, "name" | "essential" | "archived">>,
  db: BalanceDB = getDB(),
) {
  const reason = await db.reasons.get(id);
  if (!reason) return;
  // Built-in reasons (tithing, transfer fee) are used by the app itself.
  if (patch.archived && reason.role) throw new Error("Built-in reasons can't be archived");
  await db.reasons.update(id, {
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  });
}

/** Swaps a reason with its neighbour within its group. */
export async function moveReason(id: ID, dir: -1 | 1, db: BalanceDB = getDB()) {
  await db.transaction("rw", db.reasons, async () => {
    const reason = await db.reasons.get(id);
    if (!reason) return;
    const list = (await db.reasons.where("group").equals(reason.group).toArray()).sort(
      (a, b) => a.order - b.order,
    );
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((r, order) => db.reasons.update(r.id, { order })));
  });
}

// ---- Settings ----

export async function updateSettings(
  patch: Partial<Omit<Settings, "key">>,
  db: BalanceDB = getDB(),
) {
  await db.settings.update("settings", patch);
}

async function rememberLastUsed(db: BalanceDB, m: Movement) {
  if (m.type === "adjustment" || (m.linkedId && m.type === "expense")) return;
  const settings = await db.settings.get("settings");
  if (!settings) return;
  const reasonByType = { ...settings.lastUsed.reasonByType };
  if (m.reasonId) reasonByType[m.type] = m.reasonId;
  await db.settings.update("settings", {
    lastUsed: {
      type: m.type,
      accountId: m.accountId ?? settings.lastUsed.accountId,
      reasonByType,
      tithe: m.type === "income" ? Boolean(m.tithe) : settings.lastUsed.tithe,
    },
  });
}

/** Drops fields that don't apply to the movement type. */
function clean(d: MovementDraft): MovementDraft {
  const out: MovementDraft = {
    type: d.type,
    amount: d.amount,
    date: d.date,
    note: d.note.trim(),
  };
  if (d.type !== "settlement") out.accountId = d.accountId;
  if (d.type === "transfer") out.toAccountId = d.toAccountId;
  if (["lend", "repayment", "settlement", "borrow"].includes(d.type)) out.personId = d.personId;
  if (d.type === "repayment" || d.type === "settlement") {
    out.direction = d.direction;
    const forgiven = d.type === "settlement" && d.forgiven;
    if (forgiven) out.forgiven = true;
    // Forgiving a debt the app never knew about changes nothing.
    else if (d.priorDebt) out.priorDebt = true;
  }
  if (d.reasonId && REASON_GROUP_BY_TYPE[d.type]) out.reasonId = d.reasonId;
  if (d.type === "adjustment" && d.targetBalance !== undefined) out.targetBalance = d.targetBalance;
  if (d.type === "income" && d.tithe) out.tithe = true;
  return out;
}
