"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppData, type AppData } from "@/components/AppData";
import { Button, TopBar } from "@/components/ui";
import { Segmented } from "@/components/ui/Segmented";
import { Avatar } from "@/components/ui/Avatar";
import { healthMetrics, type SpendSplit } from "@/domain/health";
import { THRESHOLDS, verdicts, type Level, type Verdict } from "@/domain/healthRules";
import { t } from "@/i18n";
import styles from "./salud.module.css";

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "short" });
const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const LEVEL_ICON = { good: Check, warn: AlertTriangle, bad: X } as const;
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

const TABS = ["income", "spending", "loans"] as const;
/** Worst verdicts first; the rest behind "Ver más". */
const VERDICTS_SHOWN = 3;

export default function HealthPage() {
  const data = useAppData();
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<(typeof TABS)[number]>("income");
  const [showAll, setShowAll] = useState(false);
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
          {(showAll ? vs : vs.slice(0, VERDICTS_SHOWN)).map((v) => {
            const Icon = LEVEL_ICON[v.level];
            return (
              <li key={v.id} className={`${styles.verdict} ${styles[v.level]}`}>
                <span className={styles.badge} aria-hidden>
                  <Icon size={16} strokeWidth={2.5} />
                </span>
                <p>
                  <span className="visually-hidden">{t.health.level[v.level as Level]}: </span>
                  {verdictText(v, fmt)}
                </p>
              </li>
            );
          })}
        </ul>
        {vs.length > VERDICTS_SHOWN && (
          <Button variant="link" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? t.health.showLess : t.health.showMore(vs.length - VERDICTS_SHOWN)}
          </Button>
        )}
      </div>

      {/* Key numbers at a glance: 2×2 tiles instead of long lists. */}
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span>{t.health.projectedNet}</span>
          {/* A projection from only a few days is noise; wait like the pace rule. */}
          {h.month.daysElapsed >= THRESHOLDS.spendPaceMinDays ? (
            <>
              <strong className={`money ${h.month.projectedNet > 0 ? "money-in" : ""}`}>
                {fmt(h.month.projectedNet, { signed: h.month.projectedNet > 0 })}
              </strong>
              <small>{t.health.projectedShort(fmt(h.month.projectedExpense))}</small>
            </>
          ) : (
            <>
              <strong>—</strong>
              <small>{t.health.projectionFrom(THRESHOLDS.spendPaceMinDays)}</small>
            </>
          )}
        </div>
        <div className={styles.kpi}>
          <span>{t.health.savingsRate}</span>
          <strong>{pct(h.savingsRateMonth)}</strong>
          <small>
            {t.health.savingsAvg} {pct(h.savingsRateAvg)}
          </small>
        </div>
        <div className={styles.kpi}>
          <span>{t.health.runway}</span>
          <strong>{h.runwayMonths === null ? "—" : t.health.runwayValue(decimal.format(h.runwayMonths))}</strong>
          <small>{h.runwayMonths === null ? t.health.needMonth : t.health.runwayDays(Math.round(h.runwayMonths * 30.44))}</small>
        </div>
        <div className={styles.kpi}>
          <span>{t.health.lent}</span>
          <strong className="money">{fmt(h.owedToMe)}</strong>
          <small>{t.health.lentShare(mine > 0 ? Math.round((h.owedToMe / mine) * 100) : 0)}</small>
        </div>
      </div>

      <div className={styles.tabs}>
        <Segmented
          label={t.health.title}
          size="sm"
          options={TABS.map((v) => ({ value: v, label: t.health.tabs[v] }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "income" && !h.income && <p className={`${styles.section} ${styles.hint}`}>{t.health.notEnough}</p>}
      {tab === "income" && h.income && (
        <section className={styles.section}>
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

      {tab === "spending" && (!split || h.avgSpend === null) && (
        <p className={`${styles.section} ${styles.hint}`}>{t.health.notEnough}</p>
      )}
      {tab === "spending" && split && h.avgSpend !== null && (
        <section className={styles.section}>
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

      {tab === "loans" && (
      <section className={styles.section}>
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

      )}

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
