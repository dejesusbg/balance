"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useAppData } from "@/components/AppData";
import { MovementRow } from "@/components/MovementRow";
import { useQuickAdd } from "@/components/quick-add/QuickAdd";
import { Badge, Button, ChipGroup, Field, IconButton, inputClass } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { filterMovements, groupByDay, type MovementFilter } from "@/domain/query";
import { ENTRY_KINDS, ENTRY_TYPES, type EntryKind } from "@/domain/entry";
import { t } from "@/i18n";
import { formatDayHeader, fromDateInput, toDateInput } from "@/lib/dates";
import styles from "./movimientos.module.css";

const PAGE = 150;
const ALL = "all";

export default function MovementsPage() {
  return (
    <Suspense>
      <MovementsFromUrl />
    </Suspense>
  );
}

/** Reports link here with ?motivo=&desde=&hasta= to preset the filters. */
function MovementsFromUrl() {
  const params = useSearchParams();
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const initial: MovementFilter = {
    reasonId: params.get("motivo") ?? undefined,
    from: num("desde"),
    to: num("hasta"),
  };
  return <Movements key={params.toString()} initial={initial} />;
}

function Movements({ initial }: { initial: MovementFilter }) {
  const data = useAppData();
  const { openEdit } = useQuickAdd();
  const [filter, setFilter] = useState<MovementFilter>(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [kind, setKind] = useState<string>(ALL);

  const filtered = useMemo(
    () => (data ? filterMovements(data.movements, filter) : []),
    [data, filter],
  );
  const groups = useMemo(() => groupByDay(filtered.slice(0, limit)), [filtered, limit]);

  if (!data) return null;

  const set = (patch: Partial<MovementFilter>) => {
    setLimit(PAGE);
    setFilter((f) => ({ ...f, ...patch }));
  };
  const extraCount = [filter.accountId, filter.personId, filter.reasonId, filter.from, filter.to].filter(
    (v) => v !== undefined,
  ).length;
  const allOption = { value: ALL, label: t.movements.all };

  return (
    <div className={styles.page}>
      <h1 className="page-title">{t.movements.title}</h1>

      <div className={styles.searchRow}>
        <label className={styles.search}>
          <Search size={22} strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            value={filter.text ?? ""}
            onChange={(e) => set({ text: e.target.value || undefined })}
            placeholder={t.movements.search}
            aria-label={t.movements.search}
          />
        </label>
        <span className={styles.filterButton}>
          <IconButton
            icon={SlidersHorizontal}
            label={t.movements.filters}
            tone="neutral"
            onClick={() => setSheetOpen(true)}
          />
          {extraCount > 0 && <Badge>{extraCount}</Badge>}
        </span>
      </div>

      <ChipGroup
        label={t.movements.type}
        options={[allOption, ...ENTRY_KINDS.map((k) => ({ value: k, label: t.entryKind[k] }))]}
        value={kind}
        onChange={(v) => {
          setKind(v);
          set({ types: v === ALL ? undefined : ENTRY_TYPES[v as EntryKind] });
        }}
      />

      <p className={`muted ${styles.count}`}>{t.movements.count(filtered.length)}</p>

      {groups.length === 0 && <p className={`muted ${styles.empty}`}>{t.movements.empty}</p>}

      {groups.map((g) => (
        <section key={g.key} className={styles.day}>
          <h2 className={styles.dayHead}>
            <span>{formatDayHeader(g.date)}</span>
            {g.net !== 0 && (
              <span className={`money ${g.net > 0 ? "money-in" : "muted"}`}>
                {data.fmt(g.net, { signed: true })}
              </span>
            )}
          </h2>
          {g.movements.map((m) => (
            <MovementRow key={m.id} movement={m} data={data} onClick={() => openEdit(m.id)} />
          ))}
        </section>
      ))}

      {filtered.length > limit && (
        <div className={styles.more}>
          <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>
            {t.movements.showMore}
          </Button>
        </div>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.movements.filters}
        footer={
          <div className={styles.sheetActions}>
            <Button
              variant="secondary"
              onClick={() =>
                set({ accountId: undefined, personId: undefined, reasonId: undefined, from: undefined, to: undefined })
              }
            >
              {t.movements.clear}
            </Button>
            <Button full onClick={() => setSheetOpen(false)}>
              {t.movements.count(filtered.length)}
            </Button>
          </div>
        }
      >
        <div className={styles.sheetBody}>
          <Field label={t.movements.account}>
            <ChipGroup
              label={t.movements.account}
              wrap
              options={[allOption, ...data.accounts.map((a) => ({ value: a.id, label: a.name }))]}
              value={filter.accountId ?? ALL}
              onChange={(v) => set({ accountId: v === ALL ? undefined : v })}
            />
          </Field>
          <Field label={t.movements.person}>
            <ChipGroup
              label={t.movements.person}
              wrap
              options={[allOption, ...data.people.map((p) => ({ value: p.id, label: p.name }))]}
              value={filter.personId ?? ALL}
              onChange={(v) => set({ personId: v === ALL ? undefined : v })}
            />
          </Field>
          <Field label={t.movements.reason}>
            <ChipGroup
              label={t.movements.reason}
              wrap
              options={[
                allOption,
                ...data.reasons
                  .filter((r) => !r.archived || r.id === filter.reasonId)
                  .map((r) => ({ value: r.id, label: `${r.name} · ${t.reasonGroup[r.group]}` })),
              ]}
              value={filter.reasonId ?? ALL}
              onChange={(v) => set({ reasonId: v === ALL ? undefined : v })}
            />
          </Field>
          <div className={styles.dates}>
            <Field label={t.movements.from} htmlFor="f-from">
              <input
                id="f-from"
                type="date"
                className={inputClass}
                value={filter.from !== undefined ? toDateInput(filter.from) : ""}
                onChange={(e) => set({ from: e.target.value ? fromDateInput(e.target.value) : undefined })}
              />
            </Field>
            <Field label={t.movements.to} htmlFor="f-to">
              <input
                id="f-to"
                type="date"
                className={inputClass}
                value={filter.to !== undefined ? toDateInput(filter.to) : ""}
                onChange={(e) => set({ to: e.target.value ? fromDateInput(e.target.value, true) : undefined })}
              />
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
