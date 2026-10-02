// Persistent storage: asks the browser not to evict IndexedDB under storage
// pressure. Data lives only on this device, so losing it would be permanent.
// Chrome on Android usually grants it to installed / frequently used apps.

export type PersistState = "persisted" | "not-persisted" | "unsupported";

export async function persistState(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported";
  return (await navigator.storage.persisted()) ? "persisted" : "not-persisted";
}

export async function requestPersist(): Promise<PersistState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";
  return (await navigator.storage.persist()) ? "persisted" : "not-persisted";
}
