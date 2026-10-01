"use client";

import { ChevronRight, Eye, EyeOff, Wallet } from "lucide-react";
import Link from "next/link";
import { useAppData } from "@/components/AppData";
import { MovementRow } from "@/components/MovementRow";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { IconButton } from "@/components/ui";
import { updateSettings } from "@/db/repo";
import { accountBalances, totals } from "@/domain/ledger";
import { t } from "@/i18n";
import styles from "./home.module.css";

const LATEST = 8;

export default function Home() {
  const data = useAppData();
  const { openEdit } = useQuickAdd();
  if (!data) return null;

  const { accounts, people, movements, settings, fmt } = data;
  const sum = totals(accounts, people, movements);
  const balances = accountBalances(accounts, movements);
  const hidden = Boolean(settings.hideAmounts);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.brand}>{t.app.name}</span>
          <IconButton
            icon={hidden ? EyeOff : Eye}
            label={hidden ? t.home.showAmounts : t.home.hideAmounts}
            onClick={() => updateSettings({ hideAmounts: !hidden })}
          />
        </div>
        <div className={styles.heroLabel}>{t.home.totalNow}</div>
        <div className={`money ${styles.heroAmount}`}>{fmt(sum.liquid)}</div>

        <div className={styles.heroCards}>
          <Link href="/personas" className={styles.heroCard}>
            <span>{t.home.owedToMe}</span>
            <strong className="money">{fmt(sum.owedToMe)}</strong>
          </Link>
          <Link href="/personas" className={styles.heroCard}>
            <span>{t.home.iOwe}</span>
            <strong className="money">{fmt(sum.iOwe)}</strong>
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <Link href="/cuentas" className={styles.sectionHead}>
          <h2 className="section-title">{t.home.accounts}</h2>
          <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
        </Link>
        <ul className={styles.accounts}>
          {accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <li key={a.id}>
                <Link href={`/cuentas/detalle?id=${a.id}`} className={styles.account}>
                  <span className={styles.accountIcon} aria-hidden>
                    <Wallet size={22} strokeWidth={1.75} />
                  </span>
                  <span className={styles.accountName}>{a.name}</span>
                  <span className={`money ${styles.accountBalance}`}>
                    {fmt(balances.get(a.id) ?? 0)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section className={styles.latest}>
        <div className={styles.sectionHeadPlain}>
          <h2 className="section-title">{t.home.latest}</h2>
          {movements.length > 0 && <Link href="/movimientos">{t.home.seeAll}</Link>}
        </div>
        {movements.length === 0 ? (
          <p className={`muted ${styles.empty}`}>{t.home.empty}</p>
        ) : (
          movements
            .slice(0, LATEST)
            .map((m) => (
              <MovementRow key={m.id} movement={m} data={data} onClick={() => openEdit(m.id)} />
            ))
        )}
      </section>
    </>
  );
}
