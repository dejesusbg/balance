"use client";

import { ChevronRight, Eye, EyeOff, HandHeart, Wallet } from "lucide-react";
import Link from "next/link";
import { useAppData } from "@/components/AppData";
import { BackupReminder } from "@/components/BackupReminder";
import { MovementRow } from "@/components/MovementRow";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { IconButton } from "@/components/ui";
import { updateSettings } from "@/db/repo";
import { accountBalances, totals } from "@/domain/ledger";
import { tithingRules, tithingSummary } from "@/domain/tithing";
import { t } from "@/i18n";
import styles from "./home.module.css";

const LATEST = 5;

export default function Home() {
  const data = useAppData();
  const { openEdit } = useQuickAdd();
  if (!data) return null;

  const { accounts, people, movements, settings, fmt } = data;
  const sum = totals(accounts, people, movements);
  const balances = accountBalances(accounts, movements);
  const hidden = Boolean(settings.hideAmounts);
  const tithing = tithingSummary(movements, tithingRules(data.reasons));

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

        {/* Hero cards: accounts, then debts. The row bleeds off the right
            edge to show it scrolls, as in the design system. */}
        <div className={styles.heroCards} aria-label={t.home.accounts}>
          {accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <Link key={a.id} href={`/cuentas/detalle?id=${a.id}`} className={styles.heroCard}>
                <span>{a.name}</span>
                <strong className="money">{fmt(balances.get(a.id) ?? 0)}</strong>
              </Link>
            ))}
          <Link href="/personas" className={`${styles.heroCard} ${styles.heroCardSoft}`}>
            <span>{t.home.owedToMe}</span>
            <strong className="money">{fmt(sum.owedToMe)}</strong>
          </Link>
          <Link href="/personas" className={`${styles.heroCard} ${styles.heroCardSoft}`}>
            <span>{t.home.iOwe}</span>
            <strong className="money">{fmt(sum.iOwe)}</strong>
          </Link>
          <Link href="/cuentas" className={`${styles.heroCard} ${styles.heroCardMore}`}>
            <Wallet size={22} strokeWidth={1.75} aria-hidden />
            <span>{t.home.accounts}</span>
          </Link>
        </div>
      </section>

      <div className={styles.tiles}>
        <BackupReminder />
        {(tithing.due > 0 || tithing.paid > 0) && (
          <Link href="/diezmo" className={styles.tile}>
            <HandHeart size={22} strokeWidth={1.75} aria-hidden />
            <span>{t.tithing.pending}</span>
            <strong className="money">
              {tithing.pending > 0
                ? fmt(tithing.pending)
                : tithing.pending < 0
                  ? `${t.tithing.advance} ${fmt(-tithing.pending)}`
                  : t.tithing.upToDate}
            </strong>
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
      </div>

      <section className={styles.latest}>
        <div className={styles.sectionHead}>
          <h2 className="section-title">{t.home.latest}</h2>
          {movements.length > LATEST && <Link href="/movimientos">{t.home.seeAll}</Link>}
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
