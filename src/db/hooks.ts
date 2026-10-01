"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "./schema";

// Live queries re-render automatically whenever the underlying tables change.
// They return undefined while loading.

export const useAccounts = () =>
  useLiveQuery(() => getDB().accounts.orderBy("order").toArray());

export const usePeople = () =>
  useLiveQuery(() => getDB().people.orderBy("order").toArray());

export const useReasons = () =>
  useLiveQuery(() => getDB().reasons.orderBy("order").toArray());

/** Active (not soft-deleted) movements, newest first. */
export const useMovements = () =>
  useLiveQuery(() =>
    getDB()
      .movements.orderBy("date")
      .reverse()
      .filter((m) => !m.deletedAt)
      .toArray(),
  );

export const useSettings = () =>
  useLiveQuery(() => getDB().settings.get("settings"));
