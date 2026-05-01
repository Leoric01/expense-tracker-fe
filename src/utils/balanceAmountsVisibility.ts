/** Synchronizuje přepínač viditelnosti částek mezi hlavičkou a stránkou přehledu. */
export const BALANCE_AMOUNTS_VISIBILITY_EVENT = 'finance-balance-amounts-visibility-changed' as const;

export type BalanceAmountsVisibilityDetail = { trackerId: string; visible: boolean };

export function showBalanceAmountsStorageKey(trackerId: string) {
  return `tracker-${trackerId}-show-balance-amounts`;
}

export function readShowBalanceAmountsFromStorage(trackerId: string): boolean {
  if (!trackerId) return true;
  return localStorage.getItem(showBalanceAmountsStorageKey(trackerId)) !== 'false';
}
