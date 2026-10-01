"use client";

import { useState } from "react";
import { createAccount, updateAccount } from "@/db/repo";
import { parseAmount } from "@/domain/money";
import type { Account } from "@/domain/types";
import { t } from "@/i18n";
import { useAppData } from "./AppData";
import { Button, Field, inputClass } from "./ui";
import { Sheet } from "./ui/Sheet";

/** Sheet to create (no account) or edit an account's name and opening balance. */
export function AccountFormSheet({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account?: Account;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={account ? t.accounts.edit : t.accounts.add}>
      {open && <AccountForm key={account?.id ?? "new"} account={account} onDone={onClose} />}
    </Sheet>
  );
}

function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const data = useAppData()!;
  const [name, setName] = useState(account?.name ?? "");
  const [opening, setOpening] = useState(account?.openingBalance ?? 0);

  async function submit() {
    if (!name.trim()) return;
    if (account) await updateAccount(account.id, { name, openingBalance: opening });
    else await createAccount(name, opening);
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}
    >
      <Field label={t.accounts.name} htmlFor="acc-name">
        <input
          id="acc-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.accounts.namePlaceholder}
          maxLength={40}
          required
          autoFocus={!account}
        />
      </Field>
      <Field label={t.accounts.opening} htmlFor="acc-opening">
        <input
          id="acc-opening"
          className={inputClass}
          inputMode="numeric"
          value={opening ? data.fmt(opening, { reveal: true }) : ""}
          placeholder={data.fmt(0, { reveal: true })}
          onChange={(e) => setOpening(parseAmount(e.target.value))}
        />
        <span className="muted" style={{ fontSize: "var(--fs-body-sm)" }}>
          {t.accounts.openingHint}
        </span>
      </Field>
      <Button type="submit" full disabled={!name.trim()}>
        {t.accounts.save}
      </Button>
    </form>
  );
}
