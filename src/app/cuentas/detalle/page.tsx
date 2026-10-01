"use client";

import { Archive, ArchiveRestore, Pencil, Scale } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AccountFormSheet } from "@/components/AccountForm";
import { useAppData } from "@/components/AppData";
import { useFeedback } from "@/components/Feedback";
import { MovementRow } from "@/components/MovementRow";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { Button, TopBar } from "@/components/ui";
import { updateAccount } from "@/db/repo";
import { accountHistory } from "@/domain/ledger";
import { t } from "@/i18n";
import { formatShortDate } from "@/lib/dates";
import styles from "../cuentas.module.css";

const LIMIT = 100;

export default function AccountDetailPage() {
  return (
    <Suspense>
      <AccountDetail />
    </Suspense>
  );
}

function AccountDetail() {
  const id = useSearchParams().get("id");
  const data = useAppData();
  const { openNew, openEdit } = useQuickAdd();
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  if (!data) return null;

  const account = id ? data.accountById.get(id) : undefined;
  if (!account) {
    return (
      <>
        <TopBar />
        <p className="page muted">{t.accounts.notFound}</p>
      </>
    );
  }

  const history = accountHistory(account, data.movements);
  const balance = history.at(-1)?.balance ?? account.openingBalance;
  const recent = history.slice(-LIMIT).reverse();

  async function toggleArchive() {
    if (!account) return;
    if (!account.archived) {
      const ok = await confirm(t.accounts.archiveConfirm, { confirmLabel: t.accounts.archive });
      if (!ok) return;
    }
    await updateAccount(account.id, { archived: !account.archived });
  }

  return (
    <>
      <TopBar />
      <header className={styles.header}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {account.name}
        </h1>
        <div className={styles.label}>{t.accounts.balance}</div>
        <div className={`money ${styles.big}`}>{data.fmt(balance)}</div>
        <div className={styles.actions}>
          <Button
            size="md"
            icon={Scale}
            onClick={() => openNew({ type: "adjustment", accountId: account.id, amount: Math.max(0, balance) })}
          >
            {t.accounts.adjust}
          </Button>
          <Button size="md" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
            {t.accounts.edit}
          </Button>
          <Button
            size="md"
            variant="secondary"
            icon={account.archived ? ArchiveRestore : Archive}
            onClick={toggleArchive}
          >
            {account.archived ? t.accounts.unarchive : t.accounts.archive}
          </Button>
        </div>
      </header>

      <h2 className={`section-title ${styles.historyHead}`}>{t.accounts.history}</h2>
      {recent.length === 0 && <p className="page muted">{t.home.empty}</p>}
      {recent.map(({ movement, delta, balance: after }) => (
        <MovementRow
          key={movement.id}
          movement={movement}
          data={data}
          delta={delta}
          showTime={false}
          balanceAfter={`${formatShortDate(movement.date)} · ${data.fmt(after)}`}
          onClick={() => openEdit(movement.id)}
        />
      ))}

      <AccountFormSheet open={editing} account={account} onClose={() => setEditing(false)} />
    </>
  );
}
