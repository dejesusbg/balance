"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteMovement, saveMovement, undo, ValidationFailed, type MovementInput } from "@/db/repo";
import { accountBalanceAt, previewPersonBalance } from "@/domain/ledger";
import { rankReasons } from "@/domain/query";
import {
  ENTRY_KINDS,
  entryOf,
  PAYMENT_METHODS,
  toMovementShape,
  type EntryKind,
  type PaymentMethod,
} from "@/domain/entry";
import { titheOf, tithingRules, tithingSuggestion } from "@/domain/tithing";
import { REASON_GROUP_BY_TYPE, type Direction, type ID, type Movement } from "@/domain/types";
import { t } from "@/i18n";
import { fromLocalInput, toLocalInput } from "@/lib/dates";
import { useAppData, type AppData } from "../AppData";
import { useFeedback } from "../Feedback";
import { Button, ChipGroup, Field, inputClass, Toggle } from "../ui";
import { Keypad } from "../ui/Keypad";
import styles from "./QuickAdd.module.css";

interface FormState {
  kind: EntryKind;
  /** Loan: "out" = I lent, "in" = they lent me. Payment: "in" = their debt shrinks. */
  direction: Direction;
  method: PaymentMethod;
  /** For adjustments: the real balance typed by the user. */
  amount: number;
  accountId?: ID;
  toAccountId?: ID;
  personId?: ID;
  reasonId?: ID;
  note: string;
  /** null = "now" at save time. */
  date: number | null;
  fee: number;
  /** Payment of a debt from before the app. */
  priorDebt: boolean;
  /** Income: "Añadir al diezmo". */
  tithe: boolean;
}

export type QuickAddPreset = Partial<FormState>;

/** Read at save time (event handlers), never during render. */
const currentTime = () => Date.now();

/** Default direction when switching to a category. */
const defaultDirection = (kind: EntryKind): Direction => (kind === "loan" ? "out" : "in");

function initialState(data: AppData, editId?: ID, preset?: QuickAddPreset): FormState {
  const editing = editId ? data.movements.find((m) => m.id === editId) : undefined;
  if (editing) {
    const fee = editing.type === "transfer" && editing.linkedId
      ? (data.movements.find((m) => m.id === editing.linkedId)?.amount ?? 0)
      : 0;
    return {
      ...entryOf(editing),
      amount: editing.type === "adjustment" ? (editing.targetBalance ?? 0) : editing.amount,
      accountId: editing.accountId,
      toAccountId: editing.toAccountId,
      personId: editing.personId,
      reasonId: editing.reasonId,
      note: editing.note,
      date: editing.date,
      fee,
      priorDebt: Boolean(editing.priorDebt),
      tithe: Boolean(editing.tithe),
    };
  }
  const active = data.accounts.filter((a) => !a.archived);
  const last = data.settings.lastUsed;
  const accountId =
    active.find((a) => a.id === last.accountId)?.id ?? active[0]?.id;
  const lastKind = last.type && last.type !== "adjustment" ? entryOf({ type: last.type }).kind : "expense";
  const kind = preset?.kind ?? lastKind;
  return {
    kind,
    direction: defaultDirection(kind),
    method: "money",
    amount: 0,
    accountId,
    toAccountId: active.find((a) => a.id !== accountId)?.id,
    note: "",
    date: null,
    fee: 0,
    priorDebt: false,
    // Remember the last choice; tithing is on until the user says otherwise.
    tithe: last.tithe ?? true,
    ...preset,
  };
}

export function QuickAddForm({
  editId,
  preset,
  onDone,
}: {
  editId?: ID;
  preset?: QuickAddPreset;
  onDone: () => void;
}) {
  const data = useAppData()!;
  const { toast, confirm } = useFeedback();
  const [s, setS] = useState<FormState>(() => initialState(data, editId, preset));
  // "Now" as of opening the sheet; the saved date is taken at save time.
  const [openedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(
    () => Boolean(s.note || (editId && s.date) || s.fee || preset?.date),
  );

  const set = (patch: Partial<FormState>) => {
    setError(null);
    setS((prev) => ({ ...prev, ...patch }));
  };

  const shape = toMovementShape(s);
  const type = shape.type;

  const changeKind = (kind: EntryKind) => {
    if (kind === s.kind) return;
    const patch: Partial<FormState> = { kind, direction: defaultDirection(kind), method: "money" };
    // Keep the reason only if it belongs to the new category's group.
    const next = toMovementShape({ ...s, ...patch } as FormState).type;
    if (!rankReasons(data.reasons, [], next).some((r) => r.id === s.reasonId)) patch.reasonId = undefined;
    if (kind === "transfer" && s.toAccountId === s.accountId) {
      patch.toAccountId = data.accounts.find((a) => !a.archived && a.id !== s.accountId)?.id;
    }
    set(patch);
  };

  const activeAccounts = data.accounts.filter(
    (a) => !a.archived || a.id === s.accountId || a.id === s.toAccountId,
  );
  const activePeople = data.people.filter((p) => !p.archived || p.id === s.personId);
  const reasons = useMemo(() => {
    const ranked = rankReasons(data.reasons, data.movements, type);
    // Keep an archived reason visible when editing a movement that uses it.
    const current = s.reasonId ? data.reasonById.get(s.reasonId) : undefined;
    return current && !ranked.includes(current) && current.archived ? [...ranked, current] : ranked;
  }, [data, type, s.reasonId]);

  const isAdjustment = s.kind === "adjustment";
  const isPayment = s.kind === "payment";
  const needsPerson = s.kind === "loan" || isPayment;
  // In-kind payments and forgiveness don't touch accounts.
  const usesAccount = type !== "settlement";
  const canBePriorDebt = isPayment && s.method !== "forgiven";

  // Show how the person's balance changes, and warn when a repayment
  // overshoots the recorded debt (usually an unrecorded older debt).
  const personPreview = useMemo(() => {
    if (!needsPerson || !s.personId || s.amount <= 0) return null;
    const person = data.personById.get(s.personId);
    if (!person) return null;
    const draft = {
      ...shape,
      id: editId ?? "draft",
      amount: s.amount,
      date: s.date ?? openedAt,
      accountId: s.accountId,
      personId: s.personId,
      priorDebt: canBePriorDebt && s.priorDebt,
      note: "",
      createdAt: 0,
      updatedAt: 0,
    };
    return { name: person.name, ...previewPersonBalance(person, data.movements, draft, editId) };
  }, [needsPerson, canBePriorDebt, shape, s, data, editId, openedAt]);

  // Adjustment: compare the typed real balance with what the app computes.
  const adjustment = useMemo(() => {
    if (!isAdjustment || !s.accountId) return null;
    const account = data.accountById.get(s.accountId);
    if (!account) return null;
    const others = data.movements.filter((m) => m.id !== editId);
    const current = accountBalanceAt(account, others, s.date ?? openedAt);
    return { current, delta: s.amount - current };
  }, [isAdjustment, s.accountId, s.amount, s.date, data, editId, openedAt]);

  async function save() {
    const date = s.date ?? currentTime();
    const input: MovementInput = {
      ...shape,
      amount: isAdjustment ? (adjustment?.delta ?? 0) : s.amount,
      date,
      accountId: usesAccount ? s.accountId : undefined,
      toAccountId: type === "transfer" ? s.toAccountId : undefined,
      personId: needsPerson ? s.personId : undefined,
      reasonId: s.reasonId,
      targetBalance: isAdjustment ? s.amount : undefined,
      priorDebt: canBePriorDebt && s.priorDebt,
      tithe: type === "income" && s.tithe,
      note: s.note,
      fee: type === "transfer" ? s.fee : 0,
    };
    setBusy(true);
    try {
      const res = await saveMovement(input, editId);
      onDone();
      const tithe = editId ? 0 : suggestTithe({ ...input, id: res.id, createdAt: date, updatedAt: date });
      if (tithe > 0) {
        // One tap to set aside the tithe from the same account, or ignore it.
        toast(`${t.quickAdd.saved}. ${t.tithing.prompt(data.fmt(tithe, { reveal: true }))}`, {
          onUndo: () => undo(res.undo),
          action: {
            label: t.tithing.promptAction,
            run: async () => {
              const r = await saveMovement({
                type: "expense",
                amount: tithe,
                date: currentTime(),
                accountId: input.accountId,
                reasonId: tithingRules(data.reasons).tithingReasonId,
                note: "",
              });
              toast(t.tithing.recorded, { onUndo: () => undo(r.undo) });
            },
          },
        });
      } else {
        toast(editId ? t.quickAdd.updated : t.quickAdd.saved, { onUndo: () => undo(res.undo) });
      }
    } catch (e) {
      if (e instanceof ValidationFailed) {
        const first = e.errors[0];
        setError(isAdjustment && first === "amountRequired" ? t.accounts.noChange : t.errors[first]);
      } else {
        throw e;
      }
    } finally {
      setBusy(false);
    }
  }

  function suggestTithe(saved: Movement): number {
    if (saved.type !== "income") return 0;
    const rules = tithingRules(data.reasons);
    return tithingSuggestion(saved, [...data.movements, saved], rules);
  }

  async function remove() {
    if (!editId) return;
    const ok = await confirm(t.quickAdd.deleteConfirm, {
      confirmLabel: t.quickAdd.delete,
      danger: true,
    });
    if (!ok) return;
    const token = await deleteMovement(editId);
    onDone();
    toast(t.quickAdd.deleted, { onUndo: () => undo(token) });
  }

  const accountOptions = activeAccounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className={styles.scroll}>
        <ChipGroup
          label={t.movements.type}
          options={ENTRY_KINDS.map((kind) => ({ value: kind, label: t.entryKind[kind] }))}
          value={s.kind}
          onChange={changeKind}
        />

        <div className={styles.amountBlock}>
          <div className={styles.amountLabel}>
            {isAdjustment ? t.quickAdd.realBalance : t.quickAdd.amount}
          </div>
          <output
            className={`${styles.amount} ${s.amount === 0 ? styles.amountZero : ""}`}
            aria-live="polite"
          >
            {data.fmt(s.amount, { reveal: true })}
          </output>
          {adjustment && (
            <div className={styles.hint}>
              {t.quickAdd.currentBalance}: {data.fmt(adjustment.current, { reveal: true })} ·{" "}
              {t.quickAdd.difference}:{" "}
              <strong>{data.fmt(adjustment.delta, { signed: true, reveal: true })}</strong>
            </div>
          )}
        </div>

        {usesAccount && (
          <Field label={type === "transfer" ? t.quickAdd.fromAccount : t.quickAdd.account}>
              <ChipGroup
                label={t.quickAdd.account}
                options={accountOptions}
                value={s.accountId}
                onChange={(accountId) =>
                  set({
                    accountId,
                    ...(s.toAccountId === accountId
                      ? { toAccountId: activeAccounts.find((a) => a.id !== accountId)?.id }
                      : {}),
                  })
                }
              />
          </Field>
        )}

        {type === "transfer" && (
          <Field label={t.quickAdd.toAccount}>
            <ChipGroup
              label={t.quickAdd.toAccount}
              options={accountOptions.filter((o) => o.value !== s.accountId)}
              value={s.toAccountId}
              onChange={(toAccountId) => set({ toAccountId })}
            />
          </Field>
        )}

        {needsPerson && (
          <Field label={t.quickAdd.person}>
            {activePeople.length ? (
              <ChipGroup
                label={t.quickAdd.person}
                options={activePeople.map((p) => ({ value: p.id, label: p.name }))}
                value={s.personId}
                onChange={(personId) => set({ personId })}
              />
            ) : (
              <p className={styles.empty}>{t.quickAdd.noPeople}</p>
            )}
          </Field>
        )}

        {s.kind === "loan" && (
          <Field label={t.loanDirection.label}>
            <ChipGroup
              label={t.loanDirection.label}
              options={(["out", "in"] as const).map((d) => ({ value: d, label: t.loanDirection[d] }))}
              value={s.direction}
              onChange={(direction) => set({ direction })}
            />
          </Field>
        )}

        {isPayment && (
          <Field label={t.paymentMethod.label}>
            <ChipGroup
              label={t.paymentMethod.label}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: t.paymentMethod[m] }))}
              value={s.method}
              onChange={(method) => set({ method, ...(method === "forgiven" ? { priorDebt: false } : {}) })}
            />
            {t.paymentHint[s.method] && <span className={styles.empty}>{t.paymentHint[s.method]}</span>}
          </Field>
        )}

        {isPayment && (
          <Field label={t.paymentDirection.label}>
            <ChipGroup
              label={t.paymentDirection.label}
              options={(["in", "out"] as const).map((d) => ({
                value: d,
                label: t.paymentDirection[s.method][d],
              }))}
              value={s.direction}
              onChange={(direction) => set({ direction })}
            />
          </Field>
        )}

        {personPreview && (
          <div className={personPreview.overshoots ? styles.warning : styles.hint} role="status">
            {personPreview.name}:{" "}
            {t.quickAdd.personState(Math.sign(personPreview.before), data.fmt(Math.abs(personPreview.before), { reveal: true }))}
            {" → "}
            <strong>
              {t.quickAdd.personState(Math.sign(personPreview.after), data.fmt(Math.abs(personPreview.after), { reveal: true }))}
            </strong>
            {personPreview.overshoots && <p>{t.quickAdd.overshoot(personPreview.name)}</p>}
          </div>
        )}

        {canBePriorDebt && personPreview && (personPreview.overshoots || s.priorDebt) && (
          <Toggle
            checked={s.priorDebt}
            onChange={(priorDebt) => set({ priorDebt })}
            title={t.quickAdd.priorDebt}
            hint={t.quickAdd.priorDebtHint(personPreview.name)}
          />
        )}

        {REASON_GROUP_BY_TYPE[type] && (
          <Field label={t.quickAdd.reason}>
            {reasons.length ? (
              <ChipGroup
                label={t.quickAdd.reason}
                wrap
                options={reasons.map((r) => ({ value: r.id, label: r.name }))}
                value={s.reasonId}
                onChange={(reasonId) => set({ reasonId })}
              />
            ) : (
              <p className={styles.empty}>{t.quickAdd.noReasons}</p>
            )}
          </Field>
        )}

        {type === "income" && (
          <Toggle
            checked={s.tithe}
            onChange={(tithe) => set({ tithe })}
            title={t.quickAdd.tithe}
            hint={s.amount > 0 ? t.quickAdd.titheHint(data.fmt(titheOf(s.amount), { reveal: true })) : undefined}
          />
        )}

        <Button
          variant="link"
          size="sm"
          className={styles.moreToggle}
          icon={more ? ChevronUp : ChevronDown}
          onClick={() => setMore(!more)}
          aria-expanded={more}
        >
          {t.quickAdd.more}
        </Button>

        {more && (
          <>
            <Field label={t.quickAdd.note} htmlFor="qa-note">
              <input
                id="qa-note"
                className={inputClass}
                value={s.note}
                placeholder={t.quickAdd.notePlaceholder}
                onChange={(e) => set({ note: e.target.value })}
                maxLength={200}
                enterKeyHint="done"
              />
            </Field>
            <Field label={t.quickAdd.date} htmlFor="qa-date">
              <input
                id="qa-date"
                type="datetime-local"
                className={inputClass}
                value={toLocalInput(s.date ?? openedAt)}
                onChange={(e) => e.target.value && set({ date: fromLocalInput(e.target.value) })}
              />
            </Field>
            {type === "transfer" && (
              <Field label={`${t.quickAdd.fee} (${data.fmt(s.fee, { reveal: true })})`} htmlFor="qa-fee">
                <input
                  id="qa-fee"
                  inputMode="numeric"
                  className={inputClass}
                  value={s.fee || ""}
                  placeholder="0"
                  onChange={(e) => set({ fee: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  aria-describedby="qa-fee-hint"
                />
                <span id="qa-fee-hint" className={styles.empty}>
                  {t.quickAdd.feeHint}
                </span>
              </Field>
            )}
            {editId && (
              <Button variant="danger" size="md" icon={Trash2} onClick={remove}>
                {t.quickAdd.delete}
              </Button>
            )}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Keypad
          onChange={(update) => {
            setError(null);
            setS((prev) => ({ ...prev, amount: update(prev.amount) }));
          }}
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" full disabled={busy}>
          {t.quickAdd.save}
        </Button>
      </div>
    </form>
  );
}
