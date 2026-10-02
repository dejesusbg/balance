import { t } from "@/i18n";

const LOCALE = "es-CO";

const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
const dayYearFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Hoy", "Ayer", "Lunes, 29 de septiembre" (adds the year if not current). */
export function formatDayHeader(ts: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (diff === 0) return t.movements.today;
  if (diff === 1) return t.movements.yesterday;
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return capitalize((sameYear ? dayFmt : dayYearFmt).format(ts));
}

export const formatTime = (ts: number) => timeFmt.format(ts);

const longFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long" });
const longYearFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });

/** "16 de julio" (adds the year when it isn't the current one). */
export function formatLongDate(ts: number, now = Date.now()): string {
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? longFmt : longYearFmt).format(ts);
}

/** "29 sept" — compact date for rows. */
export const formatShortDate = (ts: number) => shortFmt.format(ts);

/** Epoch ms -> value for <input type="datetime-local">. */
export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** <input type="datetime-local"> value -> epoch ms (local time). */
export const fromLocalInput = (v: string): number => new Date(v).getTime();

/** Epoch ms -> value for <input type="date">. */
export const toDateInput = (ts: number) => toLocalInput(ts).slice(0, 10);

/** <input type="date"> value -> start (or end) of that local day. */
export function fromDateInput(v: string, end = false): number {
  const [y, m, d] = v.split("-").map(Number);
  return end ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
}
