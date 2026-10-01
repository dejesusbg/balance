"use client";

import { ChevronRight, Database, HandHeart, Tags, Trash2, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useAppData } from "@/components/AppData";
import { useFeedback } from "@/components/Feedback";
import { Button, ChipGroup, Field } from "@/components/ui";
import { loadSampleData, resetAll } from "@/db/admin";
import { updateSettings } from "@/db/repo";
import type { Settings } from "@/domain/types";
import { t } from "@/i18n";
import styles from "./ajustes.module.css";

export default function SettingsPage() {
  const data = useAppData();
  const { confirm, toast } = useFeedback();
  if (!data) return null;

  async function run(message: string, action: () => Promise<void>) {
    if (!(await confirm(message, { danger: true }))) return;
    await action();
    toast(t.settings.done);
  }

  return (
    <div className={styles.page}>
      <h1 className="page-title">{t.settings.title}</h1>

      <Link href="/cuentas" className={styles.tile}>
        <Wallet size={24} strokeWidth={1.75} aria-hidden />
        <span className={styles.tileText}>
          <span className={styles.tileTitle}>{t.settings.accounts}</span>
          <span className={styles.tileSub}>{t.settings.accountsHint}</span>
        </span>
        <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
      </Link>

      <Link href="/personas" className={`${styles.tile} ${styles.tileGap}`}>
        <Users size={24} strokeWidth={1.75} aria-hidden />
        <span className={styles.tileText}>
          <span className={styles.tileTitle}>{t.settings.people}</span>
          <span className={styles.tileSub}>{t.settings.peopleHint}</span>
        </span>
        <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
      </Link>

      <Link href="/ajustes/motivos" className={`${styles.tile} ${styles.tileGap}`}>
        <Tags size={24} strokeWidth={1.75} aria-hidden />
        <span className={styles.tileText}>
          <span className={styles.tileTitle}>{t.settings.reasons}</span>
          <span className={styles.tileSub}>{t.settings.reasonsHint}</span>
        </span>
        <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
      </Link>

      <Link href="/diezmo" className={`${styles.tile} ${styles.tileGap}`}>
        <HandHeart size={24} strokeWidth={1.75} aria-hidden />
        <span className={styles.tileText}>
          <span className={styles.tileTitle}>{t.settings.tithing}</span>
          <span className={styles.tileSub}>{t.settings.tithingHint}</span>
        </span>
        <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
      </Link>

      <section className={styles.section}>
        <Field label={t.settings.theme}>
          <ChipGroup<Settings["theme"]>
            label={t.settings.theme}
            wrap
            options={[
              { value: "system", label: t.settings.themeSystem },
              { value: "light", label: t.settings.themeLight },
              { value: "dark", label: t.settings.themeDark },
            ]}
            value={data.settings.theme}
            onChange={(theme) => updateSettings({ theme })}
          />
        </Field>
      </section>

      <section className={styles.section}>
        <h2 className="section-title">{t.settings.data}</h2>
        <p className="muted">{t.settings.loadSampleHint}</p>
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
