"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData, type AppData } from "@/components/AppData";
import { TopBar } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { healthMetrics, type SpendSplit } from "@/domain/health";
import { THRESHOLDS, verdicts, type Level, type Verdict } from "@/domain/healthRules";
import { t } from "@/i18n";
import styles from "./salud.module.css";

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "short" });
const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const LEVEL_ICON = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle } as const;
const BUCKETS: (keyof SpendSplit)[] = ["essential", "discretionary", "tithing"];

function verdictText(v: Verdict, fmt: AppData["fmt"]): string {
  const T = t.health.verdicts;
  switch (v.id) {
    case "spendPace":
      return T.spendPace(v.pct);
    case "projection":
      return T.projection(fmt(Math.abs(v.net)), v.net < 0);
    case "savings":
      return T.savings(v.rate, v.avg);
    case "noIncomeYet":
      return T.noIncomeYet(fmt(v.spent));
    case "runway":
      return T.runway(decimal.format(v.months), v.days);
    case "incomeVolatile":
      return T.incomeVolatile(fmt(v.min), fmt(v.max));
    case "incomeStable":
      return T.incomeStable;
    case "discretionary":
      return T.discretionary(v.pct);
    case "lentShare":
      return T.lentShare(v.pct);
    case "oldLoan":
      return T.oldLoan(v.name, fmt(v.amount), v.days);
    case "tithing":
      return T.tithing(fmt(v.amount));
  }
}

export default function HealthPage() {
  const data = useAppData();
  const [now] = useState(() => Date.now());
  const h = useMemo(
    () =>
      data
        ? healthMetrics({
            accounts: data.accounts,
            people: data.people,
            reasons: data.reasons,
            movements: data.movements,
            now,
          })
        : null,
    [data, now],
  );
  if (!data || !h) return null;
  const { fmt } = data;
  const vs = verdicts(h);
  const maxIncome = Math.max(1, ...h.months.map((m) => m.income));
  const split = h.avgSplit;
  const splitTotal = split ? split.essential + split.discretionary + split.tithing : 0;
  const mine = Math.max(0, h.liquid) + h.owedToMe;
  const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

  return (
    <>
      <TopBar />
      <div className={styles.page}>
        <h1 className="page-title">{t.health.title}</h1>

        {h.months.length === 0 && <p className={styles.note}>{t.health.notEnough}</p>}

        <ul className={styles.verdicts}>
          {vs.map((v) => {
            const Icon = LEVEL_ICON[v.level];
            return (
              <li key={v.id} className={`${styles.verdict} ${styles[v.level]}`}>
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                <div>
                  <span className={styles.levelLabel}>{t.health.level[v.level as Level]}</span>
                  <p>{verdictText(v, fmt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <section className={styles.section}>
        <h2 className="section-title">{t.health.thisMonth}</h2>
        <p className={styles.hint}>{t.health.dayOf(h.month.daysElapsed, h.month.daysInMonth)}</p>
        <dl className={styles.lines}>
          <div><dt>{t.health.spentSoFar}</dt><dd className="money">{fmt(h.month.expense)}</dd></div>
          <div><dt>{t.health.projected}</dt><dd className="money">{fmt(h.month.projectedExpense)}</dd></div>
          <div><dt>{t.health.incomeSoFar}</dt><dd className="money">{fmt(h.month.income)}</dd></div>
          <div className={styles.total}>
            <dt>{t.health.projectedNet}</dt>
            <dd className={`money ${h.month.projectedNet > 0 ? "money-in" : ""}`}>
              {fmt(h.month.projectedNet, { signed: h.month.projectedNet > 0 })}
            </dd>
          </div>
          <div>
            <dt>{t.health.savingsRate}</dt>
            <dd>
              {pct(h.savingsRateMonth)}
              <span className={styles.muted}> · {t.health.savingsAvg} {pct(h.savingsRateAvg)}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className="section-title">{t.health.runway}</h2>
        {h.runwayMonths === null ? (
          <p className={styles.hint}>{t.health.notEnough}</p>
        ) : (
          <>
            <p className={`money ${styles.big}`}>{t.health.runwayValue(decimal.format(h.runwayMonths))}</p>
            <p className={styles.hint}>{t.health.runwayDays(Math.round(h.runwayMonths * 30.44))}</p>
          </>
        )}
      </section>

      {h.income && (
        <section className={styles.section}>
          <h2 className="section-title">{t.health.income}</h2>
          <p className={styles.hint}>{t.health.incomeHint(h.months.length)}</p>
          <div className={styles.tiles}>
            <div><span>{t.health.avg}</span><strong className="money">{fmt(h.income.avg)}</strong></div>
            <div><span>{t.health.min}</span><strong className="money">{fmt(h.income.min)}</strong></div>
            <div><span>{t.health.max}</span><strong className="money">{fmt(h.income.max)}</strong></div>
          </div>
          <div className={styles.bars} role="list" aria-label={t.health.income}>
            {h.months.map((m) => (
              <div key={m.start} className={styles.barCol} role="listitem" title={fmt(m.income)}>
                <span className="visually-hidden">{`${monthFmt.format(m.start)}: ${fmt(m.income)}`}</span>
                <span className={styles.barTrack} aria-hidden>
                  <span className={styles.barFill} style={{ height: `${(m.income / maxIncome) * 100}%` }} />
                </span>
                <span className={styles.barLabel} aria-hidden>{monthFmt.format(m.start).replace(".", "")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {split && h.avgSpend !== null && (
        <section className={styles.section}>
          <h2 className="section-title">{t.health.spending}</h2>
          <p className={styles.hint}>{t.health.spendingHint}</p>
          <p className={`money ${styles.big}`}>{fmt(h.avgSpend)}</p>
          {splitTotal > 0 && (
            <>
              <div className={styles.stack} aria-hidden>
                {BUCKETS.filter((b) => split[b] > 0).map((b) => (
                  <span key={b} className={styles[`seg_${b}`]} style={{ flexGrow: split[b] }} />
                ))}
              </div>
              <ul className={styles.legend}>
                {BUCKETS.map((b) => (
                  <li key={b}>
                    <i className={styles[`seg_${b}`]} aria-hidden />
                    <span>{t.health[b]}</span>
                    <span className="money">{fmt(split[b])}</span>
                    <span className={styles.muted}>{Math.round((split[b] / splitTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.hint}>
            <Link href="/ajustes/motivos">{t.health.essentialHint}</Link>
          </p>
        </section>
      )}

      <section className={styles.section}>
        <h2 className="section-title">{t.health.loans}</h2>
        {mine > 0 && (
          <>
            <div className={styles.stack} aria-hidden>
              {h.liquid > 0 && <span className={styles.seg_liquid} style={{ flexGrow: h.liquid }} />}
              {h.owedToMe > 0 && <span className={styles.seg_lent} style={{ flexGrow: h.owedToMe }} />}
            </div>
            <ul className={styles.legend}>
              <li>
                <i className={styles.seg_liquid} aria-hidden />
                <span>{t.health.liquid}</span>
                <span className="money">{fmt(Math.max(0, h.liquid))}</span>
                <span className={styles.muted}>{Math.round((Math.max(0, h.liquid) / mine) * 100)}%</span>
              </li>
              <li>
                <i className={styles.seg_lent} aria-hidden />
                <span>{t.health.lent}</span>
                <span className="money">{fmt(h.owedToMe)}</span>
                <span className={styles.muted}>{Math.round((h.owedToMe / mine) * 100)}%</span>
              </li>
            </ul>
          </>
        )}
        {h.loans.length === 0 ? (
          <p className={styles.hint}>{t.health.noLoans}</p>
        ) : (
          <ul className={styles.loans}>
            {h.loans.map((l) => (
              <li key={l.person.id}>
                <Link href={`/personas/detalle?id=${l.person.id}`} className={styles.loan}>
                  <Avatar name={l.person.name} size={40} />
                  <span className={styles.loanName}>
                    {l.person.name}
                    <span className={l.ageDays >= THRESHOLDS.oldLoanDays ? styles.old : styles.muted}>
                      {t.health.loanAge(l.ageDays)}
                    </span>
                  </span>
                  <span className="money">{fmt(l.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className={styles.rules}>
        <summary>{t.health.rules}</summary>
        <ul>
          {t.health.rulesList.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className={styles.hint}>{t.health.thresholds}</p>
        <pre>{JSON.stringify(THRESHOLDS, null, 2)}</pre>
      </details>
    </>
  );
}
