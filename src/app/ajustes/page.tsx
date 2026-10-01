"use client";

import { useState } from "react";
import { loadSampleData, resetAll } from "@/db/admin";
import { t } from "@/i18n";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function run(confirmText: string, action: () => Promise<void>) {
    // TODO(milestone 2): replace with the app's confirm dialog component.
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await action();
      setStatus(t.settings.done);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{t.settings.title}</h1>
      <h2>{t.settings.data}</h2>
      <p>{t.settings.loadSampleHint}</p>
      <button
        disabled={busy}
        onClick={() => run(t.settings.loadSampleConfirm, () => loadSampleData())}
      >
        {t.settings.loadSample}
      </button>{" "}
      <button
        disabled={busy}
        onClick={() => run(t.settings.resetAllConfirm, resetAll)}
      >
        {t.settings.resetAll}
      </button>
      <p role="status">{status}</p>
    </>
  );
}
