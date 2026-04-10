export type SortDir = 'asc' | 'desc';

function oppositeDir(d: SortDir): SortDir {
  return d === 'asc' ? 'desc' : 'asc';
}

/**
 * Řazení po kliknutí na stejný sloupec: výchozí směr → opačný → bez řazení (žádný sort v API).
 * Jiný sloupec: vždy výchozí směr pro ten sloupec.
 */
export function cycleSort<A extends string>(
  column: A,
  active: A | null,
  dir: SortDir,
  firstDir: (col: A) => SortDir,
): { active: A | null; dir: SortDir } {
  if (active !== column) {
    return { active: column, dir: firstDir(column) };
  }
  const fd = firstDir(column);
  if (dir === fd) {
    return { active: column, dir: oppositeDir(dir) };
  }
  return { active: null, dir: fd };
}

export type MineSortColumn = 'name' | 'createdDate' | 'preferredDisplayAssetCode';

/** První klik: datum → nejnovější nahoře; ostatní sloupce → vzestupně. */
export function firstDirMine(col: MineSortColumn): SortDir {
  return col === 'createdDate' ? 'desc' : 'asc';
}

export function firstDirTracker(col: 'name' | 'createdDate'): SortDir {
  return col === 'name' ? 'asc' : 'desc';
}

export function firstDirAccessRequest(col: 'expenseTrackerName' | 'requestDate'): SortDir {
  return col === 'expenseTrackerName' ? 'asc' : 'desc';
}
