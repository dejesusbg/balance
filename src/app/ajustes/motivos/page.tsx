"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/AppData";
import { Badge, Button, ChipGroup, Field, IconButton, inputClass, Toggle, TopBar } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { createReason, moveReason, updateReason } from "@/db/repo";
import type { ID, Reason, ReasonGroup } from "@/domain/types";
import { t } from "@/i18n";
import styles from "./motivos.module.css";

const GROUPS: ReasonGroup[] = ["expense", "income", "loan"];

export default function ReasonsPage() {
  const data = useAppData();
  const [group, setGroup] = useState<ReasonGroup>("expense");
  const [editing, setEditing] = useState<Reason | "new" | null>(null);

  const uses = useMemo(() => {
    const map = new Map<ID, number>();
    for (const m of data?.movements ?? []) {
      if (m.reasonId) map.set(m.reasonId, (map.get(m.reasonId) ?? 0) + 1);
    }
    return map;
  }, [data]);

  if (!data) return null;
  const inGroup = data.reasons.filter((r) => r.group === group);
  const active = inGroup.filter((r) => !r.archived);
  const archived = inGroup.filter((r) => r.archived);

  const row = (r: Reason, i: number, list: Reason[]) => (
    <li key={r.id} className={styles.row}>
      <button type="button" className={styles.main} onClick={() => setEditing(r)}>
        <span className={styles.name}>{r.name}</span>
        <span className={styles.meta}>
          {r.role === "tithing" && <Badge>{t.reasons.builtInTithing}</Badge>}
          {r.role === "fee" && <Badge>{t.reasons.builtInFee}</Badge>}
          {r.group === "expense" && r.essential && <span className={styles.tag}>{t.reasons.essential}</span>}
          {r.group === "income" && r.countsForTithing && (
            <span className={styles.tag}>{t.reasons.builtInTithing}</span>
          )}
          <span>{t.reasons.uses(uses.get(r.id) ?? 0)}</span>
        </span>
      </button>
      {!r.archived && (
        <span className={styles.order}>
          <IconButton
            icon={ArrowUp}
            label={`${t.reasons.moveUp} ${r.name}`}
            size={36}
            iconSize={18}
            disabled={i === 0}
            onClick={() => moveReason(r.id, -1)}
          />
          <IconButton
            icon={ArrowDown}
            label={`${t.reasons.moveDown} ${r.name}`}
            size={36}
            iconSize={18}
            disabled={i === list.length - 1}
            onClick={() => moveReason(r.id, 1)}
          />
        </span>
      )}
    </li>
  );

  return (
    <>
      <TopBar />
      <div className="page" style={{ paddingTop: 0 }}>
        <h1 className="page-title">{t.reasons.title}</h1>
        <ChipGroup
          label={t.reasons.title}
          wrap
          options={GROUPS.map((g) => ({ value: g, label: t.reasonGroup[g] }))}
          value={group}
          onChange={setGroup}
        />
      </div>

      <ul className={styles.list}>{active.map(row)}</ul>
      <div className="page">
        <Button variant="secondary" icon={Plus} full onClick={() => setEditing("new")}>
          {t.reasons.add}
        </Button>
      </div>

      {archived.length > 0 && (
        <>
          <div className="page">
            <h2 className="section-title">{t.reasons.archived}</h2>
          </div>
          <ul className={`${styles.list} ${styles.archived}`}>{archived.map(row)}</ul>
        </>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t.reasons.add : t.reasons.edit}
      >
        {editing !== null && (
          <ReasonForm
            key={editing === "new" ? `new-${group}` : editing.id}
            reason={editing === "new" ? undefined : editing}
            group={group}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function ReasonForm({
  reason,
  group,
  onDone,
}: {
  reason?: Reason;
  group: ReasonGroup;
  onDone: () => void;
}) {
  const g = reason?.group ?? group;
  const [name, setName] = useState(reason?.name ?? "");
  const [essential, setEssential] = useState(reason?.essential ?? false);
  const [tithing, setTithing] = useState(reason?.countsForTithing ?? g === "income");

  async function submit() {
    if (!name.trim()) return;
    const flags = {
      ...(g === "expense" ? { essential } : {}),
      ...(g === "income" ? { countsForTithing: tithing } : {}),
    };
    if (reason) await updateReason(reason.id, { name, ...flags });
    else await updateReason(await createReason(g, name), flags);
    onDone();
  }

  async function toggleArchive() {
    if (!reason) return;
    await updateReason(reason.id, { archived: !reason.archived });
    onDone();
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label={t.reasons.name} htmlFor="reason-name">
        <input
          id="reason-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.reasons.namePlaceholder}
          maxLength={40}
          required
          autoFocus={!reason}
        />
      </Field>

      {g === "expense" && (
        <Toggle
          checked={essential}
          onChange={setEssential}
          title={t.reasons.essential}
          hint={t.reasons.essentialHint}
        />
      )}
      {g === "income" && (
        <Toggle checked={tithing} onChange={setTithing} title={t.reasons.tithing} hint={t.reasons.tithingHint} />
      )}

      <Button type="submit" full disabled={!name.trim()}>
        {t.reasons.save}
      </Button>

      {reason &&
        (reason.role ? (
          <p className="muted" style={{ margin: 0, fontSize: "var(--fs-body-sm)" }}>
            {t.reasons.builtInHint}
          </p>
        ) : (
          <>
            <Button variant="secondary" full onClick={toggleArchive}>
              {reason.archived ? t.reasons.unarchive : t.reasons.archive}
            </Button>
            {!reason.archived && (
              <p className="muted" style={{ margin: 0, fontSize: "var(--fs-body-sm)" }}>
                {t.reasons.archiveHint}
              </p>
            )}
          </>
        ))}
    </form>
  );
}
