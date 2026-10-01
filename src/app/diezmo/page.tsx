"use client";

import { HandHeart } from "lucide-react";
import { useState } from "react";
import { useAppData } from "@/components/AppData";
import { MovementRow } from "@/components/MovementRow";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { Button, Field, inputClass, Toggle, TopBar } from "@/components/ui";
import { updateReason, updateSettings } from "@/db/repo";
import { tithingHistory, tithingRules, tithingSummary } from "@/domain/tithing";
import { t } from "@/i18n";
import { formatShortDate } from "@/lib/dates";
import styles from "./diezmo.module.css";

const HISTORY_LIMIT = 100;
const pctFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export default function TithingPage() {
  const data = useAppData();
  const { openNew, openEdit } = useQuickAdd();
  if (!data) return null;

  const rate = data.settings.tithingRate;
  const rules = tithingRules(data.reasons, rate);
  const summary = tithingSummary(data.movements, rules);
  const history = tithingHistory(data.movements, rules);
  const incomeReasons = data.reasons.filter((r) => r.group === "income" && !r.archived);
  const pendingText = (n: number) =>
    n > 0 ? data.fmt(n) : n < 0 ? `${t.tithing.advance} ${data.fmt(-n)}` : t.tithing.upToDate;

  return (
    <>
      <TopBar />
      <header className={styles.header}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t.tithing.title}
        </h1>
        {rate === 0 ? (
          <p className="muted">{t.tithing.off}</p>
        ) : (
          <>
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
          </>
        )}
      </header>

      <section className={styles.section}>
        <h2 className="section-title">{t.tithing.settings}</h2>
        <RateField rate={rate} />
        <div className={styles.reasons}>
          <span className={styles.fieldLabel}>{t.tithing.countingReasons}</span>
          <span className={styles.hint}>{t.tithing.countingHint}</span>
          {incomeReasons.map((r) => (
            <Toggle
              key={r.id}
              checked={r.countsForTithing}
              onChange={(countsForTithing) => updateReason(r.id, { countsForTithing })}
              title={r.name}
            />
          ))}
        </div>
        <p className={styles.formula}>{t.tithing.formula}</p>
      </section>

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

/** Percentage input; saves valid values (0–100) as you type, keeping the text as typed. */
function RateField({ rate }: { rate: number }) {
  const [value, setValue] = useState(pctFmt.format(rate * 100));

  function change(text: string) {
    setValue(text);
    const n = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
    if (text.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100) {
      updateSettings({ tithingRate: n / 100 });
    }
  }

  return (
    <Field label={t.tithing.rate} htmlFor="tithing-rate">
      <div className={styles.rate}>
        <input
          id="tithing-rate"
          className={inputClass}
          inputMode="decimal"
          value={value}
          onChange={(e) => change(e.target.value)}
          aria-describedby="tithing-rate-hint"
        />
        <span aria-hidden>%</span>
      </div>
      <span id="tithing-rate-hint" className="muted" style={{ fontSize: "var(--fs-body-sm)" }}>
        {t.tithing.rateHint}
      </span>
    </Field>
  );
}
