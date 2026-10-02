"use client";

import {
  ChevronRight,
  CloudUpload,
  Database,
  FileSpreadsheet,
  FolderOpen,
  HandHeart,
  ShieldCheck,
  Tags,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/components/AppData";
import { useFeedback } from "@/components/Feedback";
import { Button, ChipGroup } from "@/components/ui";
import { loadSampleData, resetAll } from "@/db/admin";
import { exportBackup, exportCsv, InvalidBackup, parseBackup, restoreBackup } from "@/db/backup";
import { updateSettings } from "@/db/repo";
import type { CurrencyConfig, Settings } from "@/domain/types";
import { t } from "@/i18n";
import { formatDayHeader } from "@/lib/dates";
import { persistState, requestPersist, type PersistState } from "@/lib/storage";
import styles from "./ajustes.module.css";

const CURRENCIES: CurrencyConfig[] = [
  { code: "COP", symbol: "$", locale: "es-CO" },
  { code: "USD", symbol: "US$", locale: "es-CO" },
  { code: "EUR", symbol: "€", locale: "es-CO" },
];

function Tile({ href, icon: Icon, title, sub }: { href: string; icon: LucideIcon; title: string; sub: string }) {
  return (
    <Link href={href} className={styles.tile}>
      <Icon size={24} strokeWidth={1.75} aria-hidden />
      <span className={styles.tileText}>
        <span className={styles.tileTitle}>{title}</span>
        <span className={styles.tileSub}>{sub}</span>
      </span>
      <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

export default function SettingsPage() {
  const data = useAppData();
  const { confirm, toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    persistState().then(setPersist);
  }, []);

  if (!data) return null;
  const { settings } = data;

  async function run(message: string, action: () => Promise<void>) {
    if (!(await confirm(message, { danger: true }))) return;
    await action();
    toast(t.settings.done);
  }

  async function importFile(file: File) {
    try {
      const backup = parseBackup(await file.text());
      const when = backup.exportedAt ? formatDayHeader(backup.exportedAt) : file.name;
      if (!(await confirm(t.backup.importConfirm(when), { danger: true }))) return;
      await restoreBackup(backup);
      toast(t.backup.imported);
    } catch (e) {
      if (!(e instanceof InvalidBackup)) throw e;
      toast(e.message === "newer version" ? t.backup.newer : t.backup.invalid);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className="page-title">{t.settings.title}</h1>

      <div className={styles.tiles}>
        <Tile href="/cuentas" icon={Wallet} title={t.settings.accounts} sub={t.settings.accountsHint} />
        <Tile href="/personas" icon={Users} title={t.settings.people} sub={t.settings.peopleHint} />
        <Tile href="/ajustes/motivos" icon={Tags} title={t.settings.reasons} sub={t.settings.reasonsHint} />
        <Tile href="/diezmo" icon={HandHeart} title={t.settings.tithing} sub={t.settings.tithingHint} />
      </div>

      <section className={styles.section}>
        <h2 className="section-title">{t.backup.title}</h2>
        <p className={styles.hint}>{t.backup.why}</p>
        <p className={styles.status}>
          {settings.lastExportAt ? t.backup.last(formatDayHeader(settings.lastExportAt)) : t.backup.never}
        </p>
        <div className={styles.buttons}>
          <Button
            icon={CloudUpload}
            onClick={async () => {
              if (await exportBackup()) toast(t.backup.saved);
            }}
          >
            {t.backup.save}
          </Button>
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => exportCsv()}>
            {t.backup.csv.export}
          </Button>
          <Button variant="secondary" icon={FolderOpen} onClick={() => fileRef.current?.click()}>
            {t.backup.import}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importFile(file);
            }}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="section-title">{t.backup.storage}</h2>
        <p className={styles.hint}>
          {persist === "persisted"
            ? t.backup.storagePersisted
            : persist === "not-persisted"
              ? t.backup.storageNotPersisted
              : t.backup.storageUnknown}
        </p>
        {persist === "not-persisted" && (
          <Button
            variant="secondary"
            size="md"
            icon={ShieldCheck}
            onClick={async () => setPersist(await requestPersist())}
          >
            {t.backup.storageRequest}
          </Button>
        )}
      </section>

      <section className={styles.section}>
        <h2 className="section-title">{t.settings.theme}</h2>
        <ChipGroup<Settings["theme"]>
          label={t.settings.theme}
          wrap
          options={[
            { value: "system", label: t.settings.themeSystem },
            { value: "light", label: t.settings.themeLight },
            { value: "dark", label: t.settings.themeDark },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
      </section>

      <section className={styles.section}>
        <h2 className="section-title">{t.settings.currency}</h2>
        <p className={styles.hint}>{t.settings.currencyHint}</p>
        <ChipGroup
          label={t.settings.currency}
          wrap
          options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} (${c.symbol})` }))}
          value={settings.currency.code}
          onChange={(code) => updateSettings({ currency: CURRENCIES.find((c) => c.code === code)! })}
        />
      </section>

      <section className={styles.section}>
        <h2 className="section-title">{t.settings.data}</h2>
        <p className={styles.hint}>{t.settings.loadSampleHint}</p>
        <div className={styles.buttons}>
          <Button
            variant="secondary"
            icon={Database}
            onClick={() => run(t.settings.loadSampleConfirm, () => loadSampleData())}
          >
            {t.settings.loadSample}
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => run(t.settings.resetAllConfirm, resetAll)}>
            {t.settings.resetAll}
          </Button>
        </div>
      </section>
    </div>
  );
}
