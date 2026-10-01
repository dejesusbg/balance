"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAppData } from "@/components/AppData";
import { PersonFormSheet } from "@/components/PersonForm";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { peopleWithBalances, type PersonRow } from "@/domain/people";
import { t } from "@/i18n";
import { formatShortDate } from "@/lib/dates";
import styles from "./personas.module.css";

export default function PeoplePage() {
  const data = useAppData();
  const [adding, setAdding] = useState(false);
  if (!data) return null;

  const rows = peopleWithBalances(data.people, data.movements);
  const active = rows.filter((r) => !r.person.archived);
  const archived = rows.filter((r) => r.person.archived);
  const owedToMe = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const iOwe = rows.reduce((s, r) => s + Math.max(0, -r.balance), 0);

  const row = ({ person, balance, lastActivity }: PersonRow) => (
    <li key={person.id}>
      <Link href={`/personas/detalle?id=${person.id}`} className={styles.row}>
        <Avatar name={person.name} muted={person.archived} />
        <span className={styles.text}>
          <span className={styles.name}>{person.name}</span>
          <span className={styles.sub}>
            {lastActivity ? t.people.lastActivity(formatShortDate(lastActivity)) : t.people.noHistory}
          </span>
        </span>
        <span className={styles.amountCol}>
          <span className={styles.state}>{t.people.state(Math.sign(balance))}</span>
          {balance !== 0 && (
            <span className={`money ${styles.amount} ${balance > 0 ? "money-in" : ""}`}>
              {data.fmt(Math.abs(balance))}
            </span>
          )}
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className={styles.chevron} aria-hidden />
      </Link>
    </li>
  );

  return (
    <>
      <div className={styles.page}>
        <h1 className="page-title">{t.people.title}</h1>
        <div className={styles.totals}>
          <div className={styles.total}>
            <span>{t.people.owedToMe}</span>
            <strong className="money money-in">{data.fmt(owedToMe)}</strong>
          </div>
          <div className={styles.total}>
            <span>{t.people.iOwe}</span>
            <strong className="money">{data.fmt(iOwe)}</strong>
          </div>
        </div>
      </div>

      {active.length === 0 && <p className="page muted">{t.people.empty}</p>}
      <ul className={styles.list}>{active.map(row)}</ul>

      <div className="page">
        <Button variant="secondary" icon={Plus} full onClick={() => setAdding(true)}>
          {t.people.add}
        </Button>
      </div>

      {archived.length > 0 && (
        <>
          <div className="page">
            <h2 className="section-title">{t.people.archived}</h2>
          </div>
          <ul className={styles.list}>{archived.map(row)}</ul>
        </>
      )}

      <PersonFormSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
