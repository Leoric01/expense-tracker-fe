/**
 * Backend ukládá částky v nejmenších jednotkách (haléře, satoshi, …) jako celé číslo.
 * Počet desetinných míst definuje aktivum (`Asset.scale`): např. 2 u CZK, 8 u BTC.
 */
export const DEFAULT_FIAT_SCALE = 2;

/** Násobek mezi hlavní a nejmenší jednotkou: 10^scale. */
export function minorUnitMultiplier(scale: number): number {
  if (!Number.isFinite(scale) || scale < 0 || scale > 18) return 10 ** DEFAULT_FIAT_SCALE;
  return 10 ** Math.floor(scale);
}

export function minorUnitsToMajorForScale(
  minor: number | undefined | null,
  scale: number,
): number | undefined {
  if (minor == null || Number.isNaN(minor)) return undefined;
  return minor / minorUnitMultiplier(scale);
}

export function majorToMinorUnitsForScale(major: number, scale: number): number {
  if (!Number.isFinite(major)) return 0;
  const m = minorUnitMultiplier(scale);
  return Math.round(major * m + Number.EPSILON * Math.sign(major));
}

/** Zpětná kompatibilita: fiat s 2 desetinnými místy (×100). */
export function minorUnitsToMajor(minor: number | undefined | null): number | undefined {
  return minorUnitsToMajorForScale(minor, DEFAULT_FIAT_SCALE);
}

export function majorToMinorUnits(major: number): number {
  return majorToMinorUnitsForScale(major, DEFAULT_FIAT_SCALE);
}
