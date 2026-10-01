// Generates out/sw.js after `next build` so every page and asset of the
// static export is precached and the app opens offline.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
  globDirectory: "out",
  globPatterns: ["**/*.{html,js,css,txt,json,webmanifest,png,svg,ico,woff2}"],
  globIgnores: ["sw.js", "workbox-*.js"],
  swDest: "out/sw.js",
  // Precache routing already maps "/movimientos" to "/movimientos.html".
  // Pages use query params (e.g. ?id=...) that must still hit the cached HTML,
  // and Next adds ?_rsc=... to its payload requests.
  ignoreURLParametersMatching: [/.*/],
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/sw\.js$/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});

warnings.forEach((w) => console.warn(w));
console.log(`sw.js: precached ${count} files (${(size / 1024).toFixed(0)} KB)`);
