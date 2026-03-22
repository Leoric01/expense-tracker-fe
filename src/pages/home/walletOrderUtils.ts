import type { WalletResponseDto } from '@api/model';

/** Odpověď GET widget-items → seřazené ID entit. */
export function orderedWalletIdsFromWidgetPayload(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  if (data.length > 0 && typeof data[0] === 'string') {
    return (data as string[]).filter(Boolean);
  }
  const rows = data as { entityId?: string; sortOrder?: number }[];
  return [...rows]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((r) => r.entityId)
    .filter((id): id is string => Boolean(id));
}

/** Peněženky trackeru v pořadí z widget listu; chybějící ID doplní na konec (pořadí API). */
export function walletsForTrackerInWidgetOrder(
  globalOrder: string[],
  trackerWallets: WalletResponseDto[],
): WalletResponseDto[] {
  const ids = trackerWallets.map((w) => w.id).filter(Boolean) as string[];
  if (!ids.length) return [];
  const set = new Set(ids);
  const byId = new Map(
    ids.map((id) => {
      const w = trackerWallets.find((x) => x.id === id);
      return [id, w!] as const;
    }),
  );
  if (!globalOrder.length) {
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }
  const orderedPart = globalOrder.filter((id) => set.has(id));
  const seen = new Set(orderedPart);
  const rest = ids.filter((id) => !seen.has(id));
  return [...orderedPart, ...rest].map((id) => byId.get(id)!).filter(Boolean);
}

/**
 * Globální pořadí po přeuspořádání jen peněženek jednoho trackeru (`newTrackerOrderIds`).
 * Ostatní ID v `globalOrder` zůstanou vůči sobě stejně, jen se vymění blok trackeru.
 */
export function globalOrderAfterTrackerReorder(
  globalOrder: string[],
  trackerWalletIds: Set<string>,
  newTrackerOrderIds: string[],
): string[] {
  const firstIdx = globalOrder.findIndex((id) => trackerWalletIds.has(id));
  if (firstIdx < 0) {
    return [...globalOrder.filter((id) => !trackerWalletIds.has(id)), ...newTrackerOrderIds];
  }
  const left = globalOrder.slice(0, firstIdx).filter((id) => !trackerWalletIds.has(id));
  const right = globalOrder.slice(firstIdx).filter((id) => !trackerWalletIds.has(id));
  return [...left, ...newTrackerOrderIds, ...right];
}

/** Přesune `sourceId` před `targetId` v seznamu ID. */
export function reorderIdsInList(order: string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) return order;
  const without = order.filter((id) => id !== sourceId);
  const ti = without.indexOf(targetId);
  if (ti < 0) return [...without, sourceId];
  const next = [...without];
  next.splice(ti, 0, sourceId);
  return next;
}
