# Balance

Log every peso the moment it moves, and finally see where your money goes.

My income comes and goes, my money is split between Nu, Nequi and cash, and some of it is lent to family. A list of balances told me *where* the money was, never where it came from, where it went, or why. Balance fixes that: every movement gets a reason, every balance is calculated from those movements, and it all fits in a few taps.

It's in Spanish and made for COP, because that's how I use it.

**→ [dejesusbg-balance.netlify.app](https://dejesusbg-balance.netlify.app/)**

## Open it

No account, no sign-up. Open the link and start logging.

**Install it on Android (recommended)**

1. Open [dejesusbg-balance.netlify.app](https://dejesusbg-balance.netlify.app/) in **Chrome**.
2. Tap **⋮ → Instalar app** (or *Agregar a pantalla principal*).
3. Open it from the new icon. It runs full screen and **works offline**.

**On iPhone:** open it in Safari, tap **Share → Agregar a inicio**.

Updates arrive on their own: the app downloads the new version in the background and uses it the next time you open it.

**Just want to look around?** Go to **Ajustes → Datos de prueba → Cargar datos de ejemplo** for six months of fake movements, and **Borrar todo** when you're done.

## How it works

Tap **+** and answer two things: who benefits, and how much.

| | You'd pick |
|---|---|
| **＋ Recibo** (you benefit) | Ingreso, Me prestaron, Me pagaron, Me perdonaron |
| **− Doy** (someone else does) | Gasto, Presté, Pagué, Perdoné |
| **⇄ Muevo** (your total doesn't change) | Transferencia, Ajuste |

Then the details: account, person, reason, note. A regular expense is **+ → amount → reason → Guardar**.

From there:

- **Inicio** shows the money you have, per account, what people owe you and what you owe.
- **Movimientos** lets you search notes and filter by side, account, person, reason and dates.
- **Personas** keeps a running balance with each person, why you lent each amount, and how much is still pending. Debts can be paid with money, in kind (*mom bought me lunch*), or forgiven.
- **Reportes** splits money in and out by reason for any period, plus a month-by-month chart.
- **Salud financiera** says in plain words if you're doing well: spending pace, how long your money lasts, savings rate, old unpaid loans.
- **Diezmo**: tick *Añadir al diezmo* on an income and 10% of it adds up as pending until you log it.

## Your data

Everything lives **only on your phone**, in the browser's storage. There's no server and nothing leaves the device.

That also means that if you lose the phone or clear the browser's data, it's gone. So:

- **Ajustes → Copia de seguridad → Guardar copia** creates a `.json` with everything. On Android it opens the share menu, so send it to Drive, WhatsApp or wherever.
- **Restaurar desde una copia** brings it back on any phone.
- Home reminds you every 7 days.

## Run it yourself

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 117 tests for the money logic
npm run build   # static site in out/, with the offline service worker
```

It's a static export, so any static host works. Netlify reads `netlify.toml` and needs no setup.

<details>
<summary>Under the hood</summary>

- **Next.js 16** with `output: "export"`, so it's plain HTML/JS and needs no server.
- **Dexie** over IndexedDB, with schema versions and migrations (backups from older versions migrate too).
- **Workbox** service worker generated after the build, so every screen works offline.
- **Vitest** for the logic. Balances are never stored: they're derived from movements, and the tests check that every balance always equals the sum of its movements.
- Visual design adapted from a design system made in Claude Design ([notes](./docs/design.md)), with dark mode and colors checked for color blindness.

```
src/domain/   pure, tested logic: ledger, debts (FIFO), reports, tithing, health rules
src/db/       schema, migrations, backups, sample data
src/app/      screens
src/i18n/     every UI string, in one file
```

</details>
