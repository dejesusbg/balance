# Balance

PWA offline-first para registrar cada movimiento de dinero (ingresos, gastos,
transferencias, préstamos) y saber a dónde se va la plata. Todo vive en el
dispositivo (IndexedDB); no hay backend.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests de la lógica del ledger
npm run build    # export estático en out/ + service worker
npm start        # sirve out/ para probar la PWA/offline
```

## Estructura

- `src/domain/` – lógica pura y testeada (saldos derivados, validación, dinero)
- `src/db/` – Dexie: esquema versionado, datos iniciales, datos de ejemplo
- `src/i18n/es.ts` – todos los textos de la interfaz
- `src/theme/tokens.css` – tokens de diseño (variables CSS)
- `scripts/build-sw.mjs` – genera el service worker con Workbox

Despliegue en Netlify: ver `netlify.toml` (instrucciones completas en el hito 7).
