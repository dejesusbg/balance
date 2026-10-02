"use client";

import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { exportBackup } from "@/db/backup";
import { updateSettings } from "@/db/repo";
import { t } from "@/i18n";
import { useAppData } from "./AppData";
import { useFeedback } from "./Feedback";
import { Button } from "./ui";
import styles from "./BackupReminder.module.css";

const DAY = 86_400_000;
/** Remind when the last backup is at least this old. */
export const BACKUP_REMINDER_DAYS = 7;

/** Home banner: data only lives on this phone, so nudge to save a copy weekly. */
export function BackupReminder() {
  const data = useAppData();
  const { toast } = useFeedback();
  const [now] = useState(() => Date.now());
  if (!data || data.movements.length === 0) return null;

  const { lastExportAt, backupSnoozedUntil } = data.settings;
  const days = lastExportAt ? Math.floor((now - lastExportAt) / DAY) : null;
  const due = days === null || days >= BACKUP_REMINDER_DAYS;
  if (!due || (backupSnoozedUntil && backupSnoozedUntil > now)) return null;

  return (
    <div className={styles.banner} role="status">
      <CloudUpload size={22} strokeWidth={1.75} aria-hidden />
      <p>{t.backup.reminder(days)}</p>
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => updateSettings({ backupSnoozedUntil: Date.now() + DAY })}
        >
          {t.backup.later}
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            if (await exportBackup()) toast(t.backup.saved);
          }}
        >
          {t.backup.save}
        </Button>
      </div>
    </div>
  );
}
