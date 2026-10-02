"use client";

import { ChevronRight, HeartPulse } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/AppData";
import { MonthlyChart } from "@/components/charts/MonthlyChart";
import { ReasonBars } from "@/components/charts/ReasonBars";
import { ChipGroup, Field, inputClass } from "@/components/ui";
import { Segmented } from "@/components/ui/Segmented";
import {
  buildReport,
  monthlyTotals,
  presetPeriod,
  type Period,
  type PeriodPreset,
} from "@/domain/reports";
import { t } from "@/i18n";
import { fromDateInput, toDateInput } from "@/lib/dates";
import styles from "./reportes.module.css";

const PRESETS: PeriodPreset[] = ["thisMonth", "lastMonth", "last3", "custom"];
const TABS = ["out", "in", "loans", "monthly"] as const;
type Tab = (typeof TABS)[number];

export default function ReportsPage() {
  const data = useAppData();
  const [now] = useState(() => Date.now());
  const [preset, setPreset] = useState<PeriodPreset>("thisMonth");
  const [tab, setTab] = useState<Tab>("out");
  const [custom, setCustom] = useState<Period>(() => presetPeriod("last3", now));

  const period = preset === "custom" ? custom : presetPeriod(preset, now);
  const report = useMemo(() => (data ? buildReport(data.movements, period) : null), [data, period]);
  const monthly = useMemo(() => (data ? monthlyTotals(data.movements, 6, now) : []), [data, now]);

  if (!data || !report) return null;
  const net = report.income.total - report.expense.total;

  return (
    <>
      <div className={styles.page}>
        <h1 className="page-title">{t.reports.title}</h1>
        <Link href="/salud" className={styles.healthLink}>
          <HeartPulse size={24} strokeWidth={1.75} aria-hidden />
          <span>
            <strong>{t.health.link}</strong>
            <span>{t.health.linkHint}</span>
          </span>
          <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
        </Link>
        <ChipGroup
          label={t.reports.period}
          options={PRESETS.map((p) => ({ value: p, label: t.reports.presets[p] }))}
          value={preset}
          onChange={setPreset}
        />
        {preset === "custom" && (
          <div className={styles.dates}>
            <Field label={t.reports.from} htmlFor="r-from">
              <input
                id="r-from"
                type="date"
                className={inputClass}
                value={toDateInput(custom.from)}
                max={toDateInput(custom.to)}
                onChange={(e) => e.target.value && setCustom({ ...custom, from: fromDateInput(e.target.value) })}
              />
            </Field>
            <Field label={t.reports.to} htmlFor="r-to">
              <input
                id="r-to"
                type="date"
                className={inputClass}
                value={toDateInput(custom.to)}
                min={toDateInput(custom.from)}
                onChange={(e) => e.target.value && setCustom({ ...custom, to: fromDateInput(e.target.value, true) })}
              />
            </Field>
          </div>
        )}

        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span>{t.reports.in}</span>
            <strong className="money">{data.fmt(report.income.total)}</strong>
          </div>
          <div className={styles.tile}>
            <span>{t.reports.out}</span>
            <strong className="money">{data.fmt(report.expense.total)}</strong>
          </div>
          <div className={styles.tile}>
            <span>{t.reports.net}</span>
            <strong className={`money ${net > 0 ? "money-in" : ""}`}>
              {data.fmt(net, { signed: net > 0 })}
            </strong>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <Segmented
          label={t.reports.title}
          size="sm"
          options={TABS.map((v) => ({ value: v, label: t.reports.tabs[v] }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "out" && (
        <ReasonBars title={t.reports.expenseByReason} breakdown={report.expense} series="out" period={period} data={data} />
      )}
      {tab === "in" && (
        <ReasonBars title={t.reports.incomeByReason} breakdown={report.income} series="in" period={period} data={data} />
      )}
      {tab === "loans" && (
        <>
          <ReasonBars title={t.reports.lentByReason} breakdown={report.lent} series="neutral" period={period} data={data} />
          {report.borrowed.total > 0 && (
            <ReasonBars
              title={t.reports.borrowedByReason}
              breakdown={report.borrowed}
              series="neutral"
              period={period}
              data={data}
            />
          )}
          {report.forgivenByMe > 0 && (
            <section className={styles.forgiven}>
              <div>
                <h2 className="section-title">{t.reports.forgiven}</h2>
                <p className="muted">{t.reports.forgivenHint}</p>
              </div>
              <strong className="money">{data.fmt(report.forgivenByMe)}</strong>
            </section>
          )}
        </>
      )}
      {tab === "monthly" && (
        <section className={styles.monthly}>
          <h2 className="section-title">{t.reports.monthly}</h2>
          <p className="muted">{t.reports.monthlyHint}</p>
          <MonthlyChart data={monthly} fmt={(n) => data.fmt(n)} />
        </section>
      )}
    </>
  );
}
