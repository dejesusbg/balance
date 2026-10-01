"use client";

import { useAccounts, useMovements, usePeople, useSettings } from "@/db/hooks";
import { accountBalances, totals } from "@/domain/ledger";
import { formatMoney } from "@/domain/money";
import { t } from "@/i18n";

// Milestone 1: functional preview of derived balances.
// The designed Home (quick-add, latest movements) arrives in milestone 2.
export default function Home() {
  const accounts = useAccounts();
  const people = usePeople();
  const movements = useMovements();
  const settings = useSettings();

  if (!accounts || !people || !movements) return <p>{t.common.loading}</p>;

  const fmt = (n: number) => formatMoney(n, settings?.currency);
  const sum = totals(accounts, people, movements);
  const balances = accountBalances(accounts, movements);

  return (
    <>
      <h1>{t.home.totalNow}</h1>
      <p className="money" style={{ fontSize: "var(--text-2xl)", margin: 0 }}>
        {fmt(sum.liquid)}
      </p>
      <p>
        {t.home.owedToMe}: <span className="money">{fmt(sum.owedToMe)}</span>
        {" · "}
        {t.home.iOwe}: <span className="money">{fmt(sum.iOwe)}</span>
      </p>

      <h2>{t.home.accounts}</h2>
      <ul>
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <li key={a.id}>
              {a.name}: <span className="money">{fmt(balances.get(a.id) ?? 0)}</span>
            </li>
          ))}
      </ul>

      <p>
        {movements.length === 0
          ? t.home.empty
          : `${movements.length} ${t.nav.movements.toLowerCase()}`}
      </p>
    </>
  );
}
