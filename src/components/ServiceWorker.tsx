"use client";

import { useEffect } from "react";

/** Registers the Workbox service worker generated after `next build`. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is best effort; the app still works online.
    });
  }, []);
  return null;
}
