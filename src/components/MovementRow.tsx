"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  HandCoins,
  Handshake,
  HandHeart,
  Scale,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { flowOf } from "@/domain/query";
import type { Movement, MovementType } from "@/domain/types";
import { t } from "@/i18n";
import { formatTime } from "@/lib/dates";
import type { AppData } from "./AppData";
import styles from "./MovementRow.module.css";

export const TYPE_ICON: Record<MovementType, LucideIcon> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
  lend: HandCoins,
  repayment: Undo2,
  settlement: Handshake,
  borrow: HandHeart,
  adjustment: Scale,
};

/** Title, subtitle and signed amount for a movement in a list. */
export function describeMovement(m: Movement, data: AppData) {
  const account = m.accountId ? data.accountById.get(m.accountId)?.name : undefined;
  const toAccount = m.toAccountId ? data.accountById.get(m.toAccountId)?.name : undefined;
  const person = m.personId ? data.personById.get(m.personId)?.name : undefined;
  const reason = m.reasonId ? data.reasonById.get(m.reasonId)?.name : undefined;

  let title: string;
  let context: string | undefined;
  switch (m.type) {
    case "transfer":
      title = t.movementType.transfer;
      context = `${account ?? "?"} → ${toAccount ?? "?"}`;
      break;
    case "adjustment":
      title = t.movementType.adjustment;
      context =
        m.targetBalance !== undefined
          ? `${account} · ${t.movements.adjustTo(data.fmt(m.targetBalance))}`
          : account;
      break;
    case "repayment":
    case "settlement":
      title = reason ?? t.movementType[m.type];
      context = [`${t.direction[m.type][m.direction ?? "in"]} · ${person ?? ""}`, account]
        .filter(Boolean)
        .join(" · ");
      break;
    case "lend":
    case "borrow":
      title = reason ?? t.movementType[m.type];
      context = [`${t.movementType[m.type]} · ${person ?? ""}`, account].filter(Boolean).join(" · ");
      break;
    default:
      title = reason ?? t.movementType[m.type];
      context = account;
  }

  const flow = flowOf(m);
  // Settlements don't touch accounts: show their face value, neutral.
  const shown = m.type === "adjustment" ? m.amount : flow === "out" ? -m.amount : m.amount;
  return { title, context, flow, shown };
}

export function MovementRow({
  movement: m,
  data,
  onClick,
  showTime = true,
  balanceAfter,
  delta,
  neutralTone,
}: {
  movement: Movement;
  data: AppData;
  onClick?: () => void;
  showTime?: boolean;
  /** Running balance shown under the amount (account/person history). */
  balanceAfter?: string;
  /** Effect on one account/person; overrides the global in/out reading. */
  delta?: number;
  /** Keep the sign but don't color as in/out (e.g. a person's balance). */
  neutralTone?: boolean;
}) {
  const Icon = TYPE_ICON[m.type];
  const described = describeMovement(m, data);
  const { title, context } = described;
  const flow = delta === undefined ? described.flow : delta > 0 ? "in" : delta < 0 ? "out" : "neutral";
  const shown = delta ?? described.shown;
  const tone = neutralTone ? "neutral" : flow;
  const subtitle = [context, m.note, showTime ? formatTime(m.date) : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <button type="button" className={styles.row} onClick={onClick}>
      <span className={`${styles.icon} ${styles[tone]}`} aria-hidden>
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      <span className={styles.amountCol}>
        <span className={`money ${styles.amount} money-${tone}`}>
          {data.fmt(shown, { signed: delta !== undefined ? shown > 0 : flow === "in" })}
        </span>
        {balanceAfter && <span className={`money ${styles.after}`}>{balanceAfter}</span>}
      </span>
    </button>
  );
}
