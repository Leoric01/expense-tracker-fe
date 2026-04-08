import type { InstitutionSummaryResponseDto, WalletResponseDto } from '@api/model';

/** InstitutionSummary z dashboardu v pořadí widgetu `INSTITUTION`. */
export function institutionSummariesInWidgetOrder(
  globalInstitutionOrder: string[],
  institutions: InstitutionSummaryResponseDto[],
): InstitutionSummaryResponseDto[] {
  if (!institutions.length) return [];
  const byId = new Map<string, InstitutionSummaryResponseDto>();
  for (const i of institutions) {
    const id = i.institutionId?.trim();
    if (id) byId.set(id, i);
  }
  const out: InstitutionSummaryResponseDto[] = [];
  const placed = new Set<string>();
  for (const id of globalInstitutionOrder) {
    const inst = byId.get(id);
    if (inst) {
      out.push(inst);
      placed.add(id);
    }
  }
  for (const i of institutions) {
    const id = i.institutionId?.trim();
    if (id && !placed.has(id)) out.push(i);
  }
  return out;
}

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

/** Unikátní pořadí institutionId podle aktuálního zobrazení řádků (holding karet). */
export function dedupeInstitutionOrderFromRows(rows: { institutionId?: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.institutionId?.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Widget `INSTITUTION` ukládá pořadí institucí. Holdingy stejné instituce zůstanou ve skupině
 * (podřazení dle pořadí z API / flatten).
 */
export function holdingsForTrackerInInstitutionWidgetOrder(
  globalInstitutionOrder: string[],
  rows: (WalletResponseDto & { institutionId?: string })[],
): (WalletResponseDto & { institutionId?: string })[] {
  if (!rows.length) return [];
  const byInst = new Map<string, (WalletResponseDto & { institutionId?: string })[]>();
  const noInst: (WalletResponseDto & { institutionId?: string })[] = [];
  for (const r of rows) {
    const iid = r.institutionId?.trim();
    if (!iid) {
      noInst.push(r);
      continue;
    }
    const list = byInst.get(iid) ?? [];
    list.push(r);
    byInst.set(iid, list);
  }
  const out: typeof rows = [];
  const placed = new Set<string>();
  for (const instId of globalInstitutionOrder) {
    const list = byInst.get(instId);
    if (list?.length) {
      placed.add(instId);
      out.push(...list);
    }
  }
  for (const [instId, list] of byInst) {
    if (!placed.has(instId)) out.push(...list);
  }
  out.push(...noInst);
  return out;
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

/** Jako `globalOrderAfterTrackerReorder`, ale IDs v globálním widgetu jsou instituce. */
export function globalOrderAfterInstitutionTrackerReorder(
  globalOrder: string[],
  trackerInstitutionIds: Set<string>,
  newTrackerInstitutionOrder: string[],
): string[] {
  const firstIdx = globalOrder.findIndex((id) => trackerInstitutionIds.has(id));
  if (firstIdx < 0) {
    return [...globalOrder.filter((id) => !trackerInstitutionIds.has(id)), ...newTrackerInstitutionOrder];
  }
  const left = globalOrder.slice(0, firstIdx).filter((id) => !trackerInstitutionIds.has(id));
  const right = globalOrder.slice(firstIdx).filter((id) => !trackerInstitutionIds.has(id));
  return [...left, ...newTrackerInstitutionOrder, ...right];
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
