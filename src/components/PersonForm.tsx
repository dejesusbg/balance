"use client";

import { useState } from "react";
import { createPerson, updatePerson } from "@/db/repo";
import { parseAmount } from "@/domain/money";
import type { Person } from "@/domain/types";
import { t } from "@/i18n";
import { useAppData } from "./AppData";
import { Button, ChipGroup, Field, inputClass } from "./ui";
import { Sheet } from "./ui/Sheet";

/** Sheet to create (no person) or edit a person's name and opening balance. */
export function PersonFormSheet({
  open,
  person,
  onClose,
}: {
  open: boolean;
  person?: Person;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={person ? person.name : t.people.add}>
      {open && <PersonForm key={person?.id ?? "new"} person={person} onDone={onClose} />}
    </Sheet>
  );
}

function PersonForm({ person, onDone }: { person?: Person; onDone: () => void }) {
  const data = useAppData()!;
  const [name, setName] = useState(person?.name ?? "");
  const [amount, setAmount] = useState(Math.abs(person?.openingBalance ?? 0));
  const [sign, setSign] = useState<"owesMe" | "iOwe">(
    (person?.openingBalance ?? 0) < 0 ? "iOwe" : "owesMe",
  );

  async function submit() {
    if (!name.trim()) return;
    const openingBalance = sign === "iOwe" ? -amount : amount;
    if (person) await updatePerson(person.id, { name, openingBalance });
    else await createPerson(name, openingBalance);
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
      <Field label={t.people.name} htmlFor="person-name">
        <input
          id="person-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.people.namePlaceholder}
          maxLength={40}
          required
          autoFocus={!person}
        />
      </Field>
      <Field label={t.people.opening} htmlFor="person-opening">
        <ChipGroup
          label={t.people.opening}
          wrap
          options={[
            { value: "owesMe", label: t.people.openingOwesMe },
            { value: "iOwe", label: t.people.openingIOwe },
          ]}
          value={sign}
          onChange={setSign}
        />
        <input
          id="person-opening"
          className={inputClass}
          inputMode="numeric"
          value={amount ? data.fmt(amount, { reveal: true }) : ""}
          placeholder={data.fmt(0, { reveal: true })}
          onChange={(e) => setAmount(parseAmount(e.target.value))}
          aria-describedby="person-opening-hint"
        />
        <span id="person-opening-hint" className="muted" style={{ fontSize: "var(--fs-body-sm)" }}>
          {t.people.openingHint}
        </span>
      </Field>
      <Button type="submit" full disabled={!name.trim()}>
        {t.people.save}
      </Button>
    </form>
  );
}
