import { parseCsDateTime } from './dateTimeCs';

/** `YYYY-MM-DD` v lokálním kalendáři (pro API nebo `<input type="date">`). */
export function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonth(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 1);
}

export function lastDayOfMonth(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO parametry z `YYYY-MM-DD` (např. nativní date input).
 * Při neplatném nebo neúplném vstupu vrátí `null` — nikdy nehází.
 */
export function dateRangeLocalToIsoParams(
  fromYyyyMmDd: string,
  toYyyyMmDd: string,
): { from: string; to: string } | null {
  const a = fromYyyyMmDd.trim();
  const b = toYyyyMmDd.trim();
  if (!YMD.test(a) || !YMD.test(b)) return null;
  const from = new Date(`${a}T00:00:00`);
  const to = new Date(`${b}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * ISO parametry z textových polí `dd.MM.yyyy` (viz `parseCsDateTime`).
 * Neplatný vstup, neúplné datum nebo „od“ &gt; „do“ → `null`.
 */
export function dateRangeDdMmYyyyToIsoParams(
  fromDdMmYyyy: string,
  toDdMmYyyy: string,
): { from: string; to: string } | null {
  const dFrom = parseCsDateTime(fromDdMmYyyy.trim());
  const dTo = parseCsDateTime(toDdMmYyyy.trim());
  if (!dFrom || !dTo) return null;
  const start = new Date(dFrom.getFullYear(), dFrom.getMonth(), dFrom.getDate(), 0, 0, 0, 0);
  const end = new Date(dTo.getFullYear(), dTo.getMonth(), dTo.getDate(), 23, 59, 59, 999);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start.getTime() > end.getTime()) return null;
  return { from: start.toISOString(), to: end.toISOString() };
}
