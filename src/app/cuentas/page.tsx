"use client";

import { ArrowDown, ArrowUp, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountFormSheet } from "@/components/AccountForm";
import { useAppData } from "@/components/AppData";
import { Button, IconButton, TopBar } from "@/components/ui";
import { moveAccount } from "@/db/repo";
import { accountBalances } from "@/domain/ledger";
import type { Account } from "@/domain/types";
import { t } from "@/i18n";
import styles from "./cuentas.module.css";

export default function AccountsPage() {
  const data = useAppData();
  const [adding, setAdding] = useState(false);
  if (!data) return null;

  const balances = accountBalances(data.accounts, data.movements);
  const active = data.accounts.filter((a) => !a.archived);
  const archived = data.accounts.filter((a) => a.archived);

  const row = (a: Account, i: number, list: Account[]) => (
    <li key={a.id} className={styles.row}>
      <Link href={`/cuentas/detalle?id=${a.id}`} className={styles.link}>
        <span className={styles.icon} aria-hidden>
          <Wallet size={22} strokeWidth={1.75} />
        </span>
        <span className={styles.name}>{a.name}</span>
        <span className={`money ${styles.balance}`}>{data.fmt(balances.get(a.id) ?? 0)}</span>
      </Link>
      {!a.archived && (
        <span className={styles.order}>
          <IconButton
            icon={ArrowUp}
            label={`${t.accounts.moveUp} ${a.name}`}
            size={36}
            iconSize={18}
            disabled={i === 0}
            onClick={() => moveAccount(a.id, -1)}
          />
          <IconButton
            icon={ArrowDown}
            label={`${t.accounts.moveDown} ${a.name}`}
            size={36}
            iconSize={18}
            disabled={i === list.length - 1}
            onClick={() => moveAccount(a.id, 1)}
          />
        </span>
      )}
    </li>
  );

  return (
    <>
      <TopBar fallback="/ajustes" />
      <div className="page" style={{ paddingTop: 0 }}>
        <h1 className="page-title">{t.accounts.title}</h1>
      </div>
      <ul className={styles.list}>{active.map(row)}</ul>
      <div className="page">
        <Button variant="secondary" icon={Plus} full onClick={() => setAdding(true)}>
          {t.accounts.add}
        </Button>
      </div>

      {archived.length > 0 && (
        <>
          <div className="page">
            <h2 className="section-title">{t.accounts.archived}</h2>
          </div>
          <ul className={`${styles.list} ${styles.archived}`}>{archived.map(row)}</ul>
        </>
      )}

      <AccountFormSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
