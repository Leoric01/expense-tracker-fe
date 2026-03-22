/** `YYYY-MM-DD` v lokálním kalendáři. */
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

/** Parametry pro API `from` / `to` (ISO, začátek/konec dne v lokálním čase). */
export function dateRangeLocalToIsoParams(fromYyyyMmDd: string, toYyyyMmDd: string): {
  from: string;
  to: string;
} {
  const from = new Date(`${fromYyyyMmDd}T00:00:00`);
  const to = new Date(`${toYyyyMmDd}T23:59:59.999`);
  return { from: from.toISOString(), to: to.toISOString() };
}
