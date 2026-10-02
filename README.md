# Balance

¿A dónde se va mi plata? PWA para registrar cada movimiento de dinero en el
momento: ingresos, gastos, transferencias, préstamos con personas y pagos de
deudas. Responde de dónde vino y a dónde fue el dinero, y por qué.

- **Offline-first:** funciona sin internet una vez instalada.
- **Local:** los datos viven solo en tu teléfono (IndexedDB). No hay servidor
  ni cuentas de usuario. Por eso conviene guardar copias de seguridad (ver abajo).
- **Saldos derivados:** ningún saldo se guarda; todo se calcula a partir de
  los movimientos.

## Correr en tu computador

Requisitos: Node.js 22 o superior.

```bash
npm install
npm run dev        # http://localhost:3000
```

**Desde el celular, en la misma red Wi-Fi:** abre `http://<IP-de-tu-computador>:3000`.
Para ver la IP en macOS: `ipconfig getifaddr en0`. En modo desarrollo la app no
se instala ni funciona offline; para eso necesita HTTPS (Netlify).

Otros comandos:

```bash
npm test           # tests de la lógica (ledger, reportes, diezmo, salud, copias…)
npm run lint
npm run build      # sitio estático en out/ + service worker (sw.js)
npm start          # sirve out/ para probar la versión de producción
```

## Desplegar en Netlify (gratis)

La app es un sitio 100% estático. La configuración ya está en `netlify.toml`.

**Opción A: desde GitHub (recomendada, se actualiza sola en cada push)**
1. Sube el repositorio a GitHub.
2. En [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** y elige el repo.
3. Netlify lee `netlify.toml`: build `npm run build`, carpeta `out`, Node 24. Dale a **Deploy**.
4. Tendrás una URL como `https://tu-sitio.netlify.app`. Puedes cambiar el nombre en *Site configuration → Change site name*.

**Opción B: arrastrar y soltar**
1. `npm run build`
2. Arrastra la carpeta `out/` a [app.netlify.com/drop](https://app.netlify.com/drop).

> Si Netlify instala automáticamente el plugin de Next.js y el build falla,
> ve a *Site configuration → Build & deploy → Plugins* y quítalo. La app es un
> export estático y no lo necesita.

## Instalar en Android

1. Abre la URL de Netlify en **Chrome**.
2. Menú ⋮ → **Instalar app** (o **Agregar a pantalla principal**).
3. Ábrela desde el ícono: se ve a pantalla completa y funciona sin internet.

Las actualizaciones llegan solas: cuando publicas una versión nueva, la app la
descarga en segundo plano y la usa la próxima vez que la abras.

## Copias de seguridad

Tus datos solo existen en el teléfono. Si lo pierdes, lo cambias o borras los
datos del navegador, se pierden.

- **Ajustes → Copia de seguridad → Guardar copia** crea un archivo `.json` con
  todo. En Android se abre el menú de compartir: elige **Drive** (o WhatsApp,
  correo…). En computador se descarga.
- **Restaurar desde una copia** reemplaza los datos del teléfono por los del
  archivo. Funciona también con copias de versiones anteriores de la app: se
  migran solas.
- **Exportar movimientos (CSV)** sirve para abrirlos en Excel o Google Sheets.
- Inicio te recuerda guardar una copia **cada 7 días**.
- La app le pide al navegador **almacenamiento persistente**, para que no borre
  los datos cuando falte espacio. El estado se ve en Ajustes.

## Cómo está hecho

- **Next.js 16** (App Router) con `output: "export"`: HTML estático, sin servidor.
- **Dexie** sobre IndexedDB, con versiones de esquema y migraciones (`src/db/schema.ts`, `src/db/migrations.ts`).
- **Workbox** genera el service worker después del build (`scripts/build-sw.mjs`).
- **Vitest** para la lógica pura.
- Diseño inspirado en un design system de Claude Design (ver `docs/design.md`).

```
src/
  domain/            lógica pura y testeada
    ledger.ts          saldos de cuentas y personas
    entry.ts           opciones de "Registrar" (Recibo / Doy / Muevo) → tipos guardados
    people.ts          resumen por persona, deudas FIFO
    reports.ts         reportes por motivo y mes a mes
    tithing.ts         diezmo (10% de los ingresos marcados)
    health.ts          métricas de salud financiera
    healthRules.ts     umbrales y veredictos (edítalo para ajustar los semáforos)
  db/                Dexie: esquema, migraciones, repositorio, copias, datos de ejemplo
  components/        UI compartida (quick-add, filas, gráficas, sheets…)
  app/               pantallas (Inicio, Movimientos, Personas, Reportes, Salud, Ajustes…)
  i18n/es.ts         todos los textos (para traducir, copia este archivo)
  theme/tokens.css   tokens de diseño (colores, tipografía, espaciado, modo oscuro)
```

### Modelo de datos

Todo es un **movimiento**. Lo que eliges al registrar se traduce a un tipo guardado:

| Registrar | Se guarda como | Efecto |
|---|---|---|
| Recibo → Ingreso | `income` | cuenta + |
| Recibo → Me prestaron | `borrow` | cuenta +, le debo más |
| Recibo → Me pagaron (dinero / en especie) | `repayment` in / `settlement` in | cuenta + (o nada), me debe menos |
| Recibo → Me perdonaron | `settlement` out + `forgiven` | le debo menos |
| Doy → Gasto | `expense` | cuenta − |
| Doy → Presté | `lend` | cuenta −, me debe más |
| Doy → Pagué (dinero / en especie) | `repayment` out / `settlement` out | cuenta − (o nada), le debo menos |
| Doy → Perdoné | `settlement` in + `forgiven` | me debe menos |
| Muevo → Transferencia | `transfer` (+ gasto de comisión opcional) | entre cuentas |
| Muevo → Ajuste | `adjustment` | corrige una cuenta al saldo real |
