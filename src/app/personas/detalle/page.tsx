"use client";

import {
  Archive,
  ArchiveRestore,
  HandCoins,
  HandHeart,
  HeartHandshake,
  Pencil,
  Undo2,
  Wallet,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAppData } from "@/components/AppData";
import { useFeedback } from "@/components/Feedback";
import { MovementRow } from "@/components/MovementRow";
import { PersonFormSheet } from "@/components/PersonForm";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { Button, TopBar } from "@/components/ui";
import { ActionCircle, ActionRow } from "@/components/ui/ActionCircle";
import { Avatar } from "@/components/ui/Avatar";
import { updatePerson } from "@/db/repo";
import { personSummary, personTimeline, type ReasonDebt } from "@/domain/people";
import type { QuickAddPreset } from "@/components/quick-add/QuickAddForm";
import { t } from "@/i18n";
import { formatShortDate } from "@/lib/dates";
import styles from "./detalle.module.css";

const HISTORY_LIMIT = 150;

export default function PersonDetailPage() {
  return (
    <Suspense>
      <PersonDetail />
    </Suspense>
  );
}

function PersonDetail() {
  const id = useSearchParams().get("id");
  const data = useAppData();
  const { openNew, openEdit } = useQuickAdd();
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  if (!data) return null;

  const person = id ? data.personById.get(id) : undefined;
  if (!person) {
    return (
      <>
        <TopBar />
        <p className="page muted">{t.people.notFound}</p>
      </>
    );
  }

  const summary = personSummary(person, data.movements);
  const timeline = personTimeline(person, data.movements);
  const sign = Math.sign(summary.balance);
  const stateText = (n: number) =>
    n === 0 ? t.people.state(0) : `${t.people.state(Math.sign(n))} ${data.fmt(Math.abs(n))}`;

  // En especie is picked inside the form ("¿Cómo se saldó?").
  const actions: { icon: typeof HandCoins; label: string; preset: QuickAddPreset; brand?: boolean }[] = [
    { icon: HandCoins, label: t.people.actions.lend, preset: { kind: "loan", direction: "out" }, brand: true },
    { icon: HandHeart, label: t.people.actions.borrow, preset: { kind: "loan", direction: "in" } },
    { icon: Undo2, label: t.people.actions.paidMe, preset: { kind: "payment", method: "money", direction: "in" } },
    { icon: Wallet, label: t.people.actions.iPaid, preset: { kind: "payment", method: "money", direction: "out" } },
    {
      icon: HeartHandshake,
      label: t.people.actions.forgive,
      preset: { kind: "payment", method: "forgiven", direction: "in" },
    },
  ];
  const lotById = new Map(summary.lots.map((l) => [l.movementId, l]));

  // Signed contributions, in the order money usually flows.
  const priorLines = [
    { label: t.people.summary.priorIn, value: summary.priorIn },
    { label: t.people.summary.priorOut, value: summary.priorOut },
  ].filter((l) => l.value !== 0);

  const lines = [
    { label: t.people.summary.opening, value: summary.opening },
    { label: t.people.summary.lent, value: summary.lent },
    { label: t.people.summary.paidMe, value: -summary.paidMe },
    { label: t.people.summary.kindIn, value: -summary.kindIn },
    { label: t.people.summary.borrowed, value: -summary.borrowed },
    { label: t.people.summary.iPaid, value: summary.iPaid },
    { label: t.people.summary.kindOut, value: summary.kindOut },
    { label: t.people.summary.forgivenIn, value: -summary.forgivenIn },
    { label: t.people.summary.forgivenOut, value: summary.forgivenOut },
  ].filter((l) => l.value !== 0);

  const reasonBlock = (title: string, list: ReasonDebt[]) =>
    list.length > 0 && (
      <section className={styles.section}>
        <h2 className="section-title">{title}</h2>
        <ul className={styles.reasons}>
          {list.map((r) => {
            const name = r.reasonId
              ? (data.reasonById.get(r.reasonId)?.name ?? t.people.noReason)
              : t.people.noReason;
            const settled = r.amount - r.open;
            const line = t.people.reasonLine(data.fmt(r.amount), r.open ? data.fmt(r.open) : null);
            return (
              <li key={r.reasonId ?? "none"}>
                <div className={styles.reasonHead}>
                  <span className={styles.reasonName}>{name}</span>
                </div>
                <div className={styles.bar} role="img" aria-label={line}>
                  <span style={{ width: r.amount ? `${(settled / r.amount) * 100}%` : 0 }} />
                </div>
                <div className={styles.reasonSub}>{line}</div>
              </li>
            );
          })}
        </ul>
      </section>
    );

  async function toggleArchive() {
    if (!person) return;
    if (!person.archived) {
      const message =
        summary.balance !== 0
          ? t.people.archiveWithBalance(stateText(summary.balance))
          : t.people.archiveConfirm;
      if (!(await confirm(message, { confirmLabel: t.people.archive }))) return;
    }
    await updatePerson(person.id, { archived: !person.archived });
  }

  return (
    <>
      <TopBar />
      <header className={styles.header}>
        <Avatar name={person.name} size={56} muted={person.archived} />
        <h1 className="page-title" style={{ margin: "var(--space-12) 0 0" }}>
          {person.name}
        </h1>
        <div className={styles.state}>{t.people.state(sign)}</div>
        {sign !== 0 && (
          <div className={`money ${styles.big} ${sign > 0 ? "money-in" : ""}`}>
            {data.fmt(Math.abs(summary.balance))}
          </div>
        )}
      </header>

      {!person.archived && (
        <div className={styles.actions}>
          <ActionRow>
            {actions.map((a) => (
              <ActionCircle
                key={a.label}
                icon={a.icon}
                label={a.label}
                tone={a.brand ? "brand" : "neutral"}
                onClick={() => openNew({ ...a.preset, personId: person.id })}
              />
            ))}
          </ActionRow>
        </div>
      )}

      {(lines.length > 0 || priorLines.length > 0) && (
        <section className={styles.section}>
          <h2 className="section-title">{t.people.summary.title}</h2>
          <dl className={styles.summary}>
            {lines.map((l) => (
              <div key={l.label} className={styles.line}>
                <dt>{l.label}</dt>
                <dd className="money">{data.fmt(l.value, { signed: true })}</dd>
              </div>
            ))}
            <div className={`${styles.line} ${styles.totalLine}`}>
              <dt>{t.people.summary.balance}</dt>
              <dd className="money">{stateText(summary.balance)}</dd>
            </div>
          </dl>
          {priorLines.length > 0 && (
            <div className={styles.prior}>
              <dl className={styles.summary}>
                {priorLines.map((l) => (
                  <div key={l.label} className={styles.line}>
                    <dt>{l.label}</dt>
                    <dd className="money">{data.fmt(l.value)}</dd>
                  </div>
                ))}
              </dl>
              <p>{t.people.summary.priorHint}</p>
            </div>
          )}
        </section>
      )}

      {reasonBlock(t.people.lentByReason, summary.lentByReason)}
      {reasonBlock(t.people.borrowedByReason, summary.borrowedByReason)}

      <section className={styles.historySection}>
        <h2 className={`section-title ${styles.historyHead}`}>{t.people.history}</h2>
        {timeline.length === 0 && <p className="page muted">{t.people.noHistory}</p>}
        {timeline.slice(0, HISTORY_LIMIT).map(({ movement, delta, balance }) => {
          // Loans show what's still open; everything else the running balance.
          const lot = lotById.get(movement.id);
          const status = lot?.isLoan
            ? t.people.lotState(lot.remaining ? data.fmt(lot.remaining) : null)
            : stateText(balance);
          return (
            <MovementRow
              key={movement.id}
              movement={movement}
              data={data}
              delta={delta}
              neutralTone
              showTime={false}
              balanceAfter={`${formatShortDate(movement.date)} · ${status}`}
              onClick={() => openEdit(movement.id)}
            />
          );
        })}
        {summary.opening !== 0 && (
          <p className={styles.openingNote}>
            {t.people.summary.opening}: {stateText(summary.opening)}
          </p>
        )}
      </section>

      <div className={`page ${styles.footer}`}>
        <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
          {t.people.edit}
        </Button>
        <Button
          variant="secondary"
          icon={person.archived ? ArchiveRestore : Archive}
          onClick={toggleArchive}
        >
          {person.archived ? t.people.unarchive : t.people.archive}
        </Button>
      </div>

      <PersonFormSheet open={editing} person={person} onClose={() => setEditing(false)} />
    </>
  );
}
