/** Prázdné → undefined, jinak nezáporné celé Kč (zaokrouhleno). */
export function parseOptionalMoneyKc(raw: string): number | undefined {
  const t = raw.trim().replace(',', '.');
  if (!t) {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return Math.round(n);
}
