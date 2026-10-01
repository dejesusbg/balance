"use client";

import { HandHeart } from "lucide-react";
import { useAppData } from "@/components/AppData";
import { MovementRow } from "@/components/MovementRow";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { Button, TopBar } from "@/components/ui";
import { tithingHistory, tithingRules, tithingSummary } from "@/domain/tithing";
import { t } from "@/i18n";
import { formatShortDate } from "@/lib/dates";
import styles from "./diezmo.module.css";

const HISTORY_LIMIT = 100;

export default function TithingPage() {
  const data = useAppData();
  const { openNew, openEdit } = useQuickAdd();
  if (!data) return null;

  const rules = tithingRules(data.reasons);
  const summary = tithingSummary(data.movements, rules);
  const history = tithingHistory(data.movements, rules);
  const pendingText = (n: number) =>
    n > 0 ? data.fmt(n) : n < 0 ? `${t.tithing.advance} ${data.fmt(-n)}` : t.tithing.upToDate;

  return (
    <>
      <TopBar />
      <header className={styles.header}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t.tithing.title}
        </h1>
        <div className={styles.label}>{t.tithing.pending}</div>
        <div className={`money ${styles.big}`}>{pendingText(summary.pending)}</div>
        <div className={styles.totals}>
          <span>
            {t.tithing.due} <strong className="money">{data.fmt(summary.due)}</strong>
          </span>
          <span>
            {t.tithing.paid} <strong className="money">{data.fmt(summary.paid)}</strong>
          </span>
        </div>
        <p className={styles.formula}>{t.tithing.formula}</p>
        <Button
          icon={HandHeart}
          onClick={() =>
            openNew({
              kind: "expense",
              reasonId: rules.tithingReasonId,
              amount: Math.max(0, summary.pending),
            })
          }
        >
          {t.tithing.record}
        </Button>
      </header>

      <section>
        <h2 className={`section-title ${styles.historyHead}`}>{t.tithing.history}</h2>
        {history.length === 0 && <p className="page muted">{t.tithing.noHistory}</p>}
        {history.slice(0, HISTORY_LIMIT).map(({ movement, delta, pending }) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            data={data}
            delta={delta}
            neutralTone
            showTime={false}
            balanceAfter={`${formatShortDate(movement.date)} · ${pendingText(pending)}`}
            onClick={() => openEdit(movement.id)}
          />
        ))}
      </section>
    </>
  );
}
