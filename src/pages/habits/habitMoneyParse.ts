/** Prázdné pole → undefined, jinak zaokrouhlené celé číslo (libovolný platný integer z textu). */
export function parseOptionalMoneyKc(raw: string): number | undefined {
  const t = raw.trim().replace(',', '.');
  if (!t) {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.round(n);
}
