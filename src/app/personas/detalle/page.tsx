"use client";

import {
  Archive,
  ArchiveRestore,
  Gift,
  HandCoins,
  HandHeart,
  Handshake,
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
import { personSummary, personTimeline } from "@/domain/people";
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

  const actions = [
    { icon: HandCoins, label: t.people.actions.lend, type: "lend", brand: true },
    { icon: Undo2, label: t.people.actions.paidMe, type: "repayment", direction: "in" },
    { icon: Gift, label: t.people.actions.kindIn, type: "settlement", direction: "in" },
    { icon: HandHeart, label: t.people.actions.borrow, type: "borrow" },
    { icon: Wallet, label: t.people.actions.iPaid, type: "repayment", direction: "out" },
    { icon: Handshake, label: t.people.actions.kindOut, type: "settlement", direction: "out" },
  ] as const;

  // Signed contributions, in the order money usually flows.
  const lines = [
    { label: t.people.summary.opening, value: summary.opening },
    { label: t.people.summary.lent, value: summary.lent },
    { label: t.people.summary.paidMe, value: -summary.paidMe },
    { label: t.people.summary.kindIn, value: -summary.kindIn },
    { label: t.people.summary.borrowed, value: -summary.borrowed },
    { label: t.people.summary.iPaid, value: summary.iPaid },
    { label: t.people.summary.kindOut, value: summary.kindOut },
  ].filter((l) => l.value !== 0);

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
                tone={"brand" in a ? "brand" : "neutral"}
                onClick={() =>
                  openNew({
                    type: a.type,
                    personId: person.id,
                    ...("direction" in a ? { direction: a.direction } : {}),
                  })
                }
              />
            ))}
          </ActionRow>
        </div>
      )}

      {lines.length > 0 && (
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
        </section>
      )}

      {summary.byReason.length > 0 && (
        <section className={styles.section}>
          <h2 className="section-title">{t.people.byReason}</h2>
          <ul className={styles.reasons}>
            {summary.byReason.map((r) => {
              const name = r.reasonId
                ? (data.reasonById.get(r.reasonId)?.name ?? t.people.noReason)
                : t.people.noReason;
              const big = Math.max(r.up, r.down);
              const small = Math.min(r.up, r.down);
              return (
                <li key={r.reasonId ?? "none"} className={styles.reason}>
                  <div className={styles.reasonHead}>
                    <span className={styles.reasonName}>{name}</span>
                    <span className="money">{data.fmt(r.up - r.down, { signed: true })}</span>
                  </div>
                  <div
                    className={styles.bar}
                    role="img"
                    aria-label={`${t.people.up} ${data.fmt(r.up)}, ${t.people.down} ${data.fmt(r.down)}`}
                  >
                    <span style={{ width: big ? `${(small / big) * 100}%` : 0 }} />
                  </div>
                  <div className={styles.reasonSub}>
                    {t.people.up} <span className="money">{data.fmt(r.up)}</span> · {t.people.down}{" "}
                    <span className="money">{data.fmt(r.down)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={styles.historySection}>
        <h2 className={`section-title ${styles.historyHead}`}>{t.people.history}</h2>
        {timeline.length === 0 && <p className="page muted">{t.people.noHistory}</p>}
        {timeline.slice(0, HISTORY_LIMIT).map(({ movement, delta, balance }) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            data={data}
            delta={delta}
            neutralTone
            showTime={false}
            balanceAfter={`${formatShortDate(movement.date)} · ${stateText(balance)}`}
            onClick={() => openEdit(movement.id)}
          />
        ))}
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
