/**
 * Backend ukládá peníze v nejmenší jednotce měny (haléře, centy) jako celé číslo.
 * Zobrazení a zadávání na FE je v hlavní jednotce (koruny, eura) s 2 desetinnými místy.
 */
export const MONEY_MINOR_UNIT_SCALE = 100;

export function minorUnitsToMajor(minor: number | undefined | null): number | undefined {
  if (minor == null || Number.isNaN(minor)) return undefined;
  return minor / MONEY_MINOR_UNIT_SCALE;
}

export function majorToMinorUnits(major: number): number {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * MONEY_MINOR_UNIT_SCALE + Number.EPSILON * Math.sign(major));
}
