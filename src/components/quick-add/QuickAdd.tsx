"use client";

import { Plus } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ID } from "@/domain/types";
import { t } from "@/i18n";
import { Sheet } from "../ui/Sheet";
import { QuickAddForm, type QuickAddPreset } from "./QuickAddForm";
import styles from "./QuickAdd.module.css";

interface QuickAddApi {
  /** Opens the sheet for a new movement, optionally pre-filled. */
  openNew: (preset?: QuickAddPreset) => void;
  /** Opens the sheet to edit an existing movement. */
  openEdit: (id: ID) => void;
}

const Ctx = createContext<QuickAddApi | null>(null);

export const useQuickAdd = () => {
  const api = useContext(Ctx);
  if (!api) throw new Error("useQuickAdd outside QuickAddProvider");
  return api;
};

type State = { open: false } | { open: true; key: number; editId?: ID; preset?: QuickAddPreset };

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false });

  const openNew = useCallback(
    (preset?: QuickAddPreset) => setState({ open: true, key: Date.now(), preset }),
    [],
  );
  const openEdit = useCallback((editId: ID) => setState({ open: true, key: Date.now(), editId }), []);
  const close = useCallback(() => setState({ open: false }), []);

  return (
    <Ctx.Provider value={{ openNew, openEdit }}>
      {children}

      <button
        type="button"
        className={styles.fab}
        onClick={() => openNew()}
        aria-label={t.quickAdd.open}
        title={t.quickAdd.open}
        hidden={state.open}
      >
        <Plus size={30} strokeWidth={2} aria-hidden />
      </button>

      <Sheet
        open={state.open}
        onClose={close}
        tall
        bare
        title={state.open && state.editId ? t.quickAdd.titleEdit : t.quickAdd.titleNew}
      >
        {state.open && (
          <QuickAddForm
            key={state.key}
            editId={state.editId}
            preset={state.preset}
            onDone={close}
          />
        )}
      </Sheet>
    </Ctx.Provider>
  );
}
