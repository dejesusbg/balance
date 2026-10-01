import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { accountBalances, personBalances } from "@/domain/ledger";
import { BalanceDB } from "./schema";
import {
  adjustAccount,
  createAccount,
  createPerson,
  deleteMovement,
  moveAccount,
  updatePerson,
  saveMovement,
  undo,
  ValidationFailed,
} from "./repo";

let db: BalanceDB;
let nu: string, nequi: string, cash: string, mom: string;
let food: string, work: string, lunch: string;

beforeEach(async () => {
  db = new BalanceDB(`repo-${crypto.randomUUID()}`);
  await db.open();
  const accounts = await db.accounts.orderBy("order").toArray();
  [nu, nequi, cash] = accounts.map((a) => a.id);
  mom = (await db.people.orderBy("order").first())!.id;
  const reasons = await db.reasons.toArray();
  food = reasons.find((r) => r.name === "Comida")!.id;
  work = reasons.find((r) => r.name === "Tarea/Trabajo")!.id;
  lunch = reasons.find((r) => r.name === "Almuerzo/comida")!.id;
});

const balances = async () =>
  accountBalances(await db.accounts.toArray(), await db.movements.toArray());

describe("saveMovement", () => {
  it("creates, then edits, recalculating balances", async () => {
    const { id } = await saveMovement(
      { type: "income", amount: 100_000, date: 1, accountId: nu, reasonId: work, note: " pago " },
      undefined,
      db,
    );
    expect((await db.movements.get(id))!.note).toBe("pago");
    expect((await balances()).get(nu)).toBe(100_000);

    await saveMovement(
      { type: "income", amount: 80_000, date: 1, accountId: nequi, reasonId: work, note: "" },
      id,
      db,
    );
    const b = await balances();
    expect(b.get(nu)).toBe(0);
    expect(b.get(nequi)).toBe(80_000);
    expect(await db.movements.count()).toBe(1);
  });

  it("rejects invalid movements", async () => {
    await expect(
      saveMovement({ type: "expense", amount: 0, date: 1, accountId: nu, note: "" }, undefined, db),
    ).rejects.toBeInstanceOf(ValidationFailed);
  });

  it("strips fields that don't belong to the type", async () => {
    const { id } = await saveMovement(
      {
        type: "settlement",
        amount: 15_000,
        date: 1,
        personId: mom,
        direction: "in",
        reasonId: lunch,
        toAccountId: cash,
        note: "",
      },
      undefined,
      db,
    );
    const m = (await db.movements.get(id))!;
    expect(m.accountId).toBeUndefined();
    expect(m.toAccountId).toBeUndefined();
  });

  it("stores forgiven only on settlements, without reason or priorDebt", async () => {
    const base = { amount: 5_000, date: 1, personId: mom, reasonId: lunch, note: "", forgiven: true, priorDebt: true };
    const { id: a } = await saveMovement({ ...base, type: "settlement", direction: "in" }, undefined, db);
    const { id: b } = await saveMovement({ ...base, type: "repayment", direction: "in", accountId: nu }, undefined, db);
    expect(await db.movements.get(a)).toMatchObject({ forgiven: true });
    expect((await db.movements.get(a))!.reasonId).toBeUndefined();
    expect((await db.movements.get(a))!.priorDebt).toBeUndefined();
    expect((await db.movements.get(b))!.forgiven).toBeUndefined();
  });

  it("does not store a reason on repayments", async () => {
    const { id } = await saveMovement(
      { type: "repayment", direction: "in", amount: 10_000, date: 1, accountId: nu, personId: mom, reasonId: lunch, note: "" },
      undefined,
      db,
    );
    expect((await db.movements.get(id))!.reasonId).toBeUndefined();
  });

  it("keeps priorDebt only on repayments and settlements", async () => {
    const base = { amount: 30_000, date: 1, accountId: nu, personId: mom, reasonId: lunch, note: "", priorDebt: true };
    const { id: a } = await saveMovement({ ...base, type: "repayment", direction: "in" }, undefined, db);
    const { id: b } = await saveMovement({ ...base, type: "lend" }, undefined, db);
    expect((await db.movements.get(a))!.priorDebt).toBe(true);
    expect((await db.movements.get(b))!.priorDebt).toBeUndefined();
    const pb = personBalances(await db.people.toArray(), await db.movements.toArray());
    expect(pb.get(mom)).toBe(30_000);
  });

  it("remembers the last type, account and reason", async () => {
    await saveMovement(
      { type: "expense", amount: 5_000, date: 1, accountId: cash, reasonId: food, note: "" },
      undefined,
      db,
    );
    const s = (await db.settings.get("settings"))!;
    expect(s.lastUsed).toEqual({ type: "expense", accountId: cash, reasonByType: { expense: food } });
  });
});

describe("transfer fee", () => {
  const transfer = (fee: number) => ({
    type: "transfer" as const,
    amount: 50_000,
    date: 10,
    accountId: nu,
    toAccountId: nequi,
    note: "",
    fee,
  });

  it("creates a linked fee expense and keeps it in sync", async () => {
    const { id } = await saveMovement(transfer(2_000), undefined, db);
    const t = (await db.movements.get(id))!;
    const fee = (await db.movements.get(t.linkedId!))!;
    expect(fee).toMatchObject({ type: "expense", amount: 2_000, accountId: nu, linkedId: id });
    let b = await balances();
    expect(b.get(nu)).toBe(-52_000);
    expect(b.get(nequi)).toBe(50_000);

    await saveMovement(transfer(3_500), id, db);
    expect(await db.movements.count()).toBe(2);
    expect((await db.movements.get(fee.id))!.amount).toBe(3_500);

    await saveMovement(transfer(0), id, db);
    expect(await db.movements.count()).toBe(1);
    b = await balances();
    expect(b.get(nu)).toBe(-50_000);
  });

  it("deleting a transfer deletes its fee; undo brings both back", async () => {
    const { id } = await saveMovement(transfer(1_000), undefined, db);
    const token = await deleteMovement(id, db);
    expect(await db.movements.count()).toBe(0);
    await undo(token, db);
    expect(await db.movements.count()).toBe(2);
    expect((await balances()).get(nu)).toBe(-51_000);
  });
});

describe("undo", () => {
  it("undoing a create removes it", async () => {
    const { undo: token } = await saveMovement(
      { type: "expense", amount: 1_000, date: 1, accountId: nu, reasonId: food, note: "" },
      undefined,
      db,
    );
    await undo(token, db);
    expect(await db.movements.count()).toBe(0);
  });

  it("undoing an edit restores the previous version", async () => {
    const { id } = await saveMovement(
      { type: "lend", amount: 20_000, date: 1, accountId: nu, personId: mom, reasonId: lunch, note: "" },
      undefined,
      db,
    );
    const { undo: token } = await saveMovement(
      { type: "lend", amount: 5_000, date: 1, accountId: nu, personId: mom, reasonId: lunch, note: "" },
      id,
      db,
    );
    await undo(token, db);
    const pb = personBalances(await db.people.toArray(), await db.movements.toArray());
    expect(pb.get(mom)).toBe(20_000);
  });
});

describe("accounts", () => {
  it("adjusts an account to the real balance at a date", async () => {
    await saveMovement(
      { type: "income", amount: 30_000, date: 100, accountId: cash, reasonId: work, note: "" },
      undefined,
      db,
    );
    const res = await adjustAccount(cash, 27_500, 200, "", db);
    expect(res!.delta).toBe(-2_500);
    expect((await balances()).get(cash)).toBe(27_500);
    expect((await db.movements.get(res!.id))!.targetBalance).toBe(27_500);
    expect(await adjustAccount(cash, 27_500, 300, "", db)).toBeNull();
  });

  it("creates accounts at the end and reorders them", async () => {
    const id = await createAccount("  Daviplata ", 10_000, db);
    const list = await db.accounts.orderBy("order").toArray();
    expect(list.at(-1)).toMatchObject({ id, name: "Daviplata", order: 3 });
    await moveAccount(id, -1, db);
    const names = (await db.accounts.orderBy("order").toArray()).map((a) => a.name);
    expect(names).toEqual(["Nu", "Nequi", "Daviplata", "Efectivo"]);
  });
});

describe("people", () => {
  it("creates people with a signed opening balance that counts in their balance", async () => {
    const id = await createPerson(" Tía ", -15_000, db);
    expect(await db.people.get(id)).toMatchObject({ name: "Tía", order: 3, openingBalance: -15_000 });
    await updatePerson(mom, { openingBalance: 40_000 }, db);
    const pb = personBalances(await db.people.toArray(), await db.movements.toArray());
    expect(pb.get(mom)).toBe(40_000);
    expect(pb.get(id)).toBe(-15_000);
  });
});
