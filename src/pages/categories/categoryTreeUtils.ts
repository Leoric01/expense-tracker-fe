import type { CategoryResponseDto } from '@api/model';

export function asCategoryChildren(ch: unknown): CategoryResponseDto[] {
  if (!Array.isArray(ch)) return [];
  return ch as CategoryResponseDto[];
}

/** Seřadí rekurzivně podle `sortOrder`. */
function sortTree(nodes: CategoryResponseDto[]): void {
  nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  nodes.forEach((n) => {
    const ch = asCategoryChildren(n.children);
    if (ch.length) sortTree(ch);
  });
}

/**
 * Zploštěného seznamu s `parentId` udělá strom (kořeny = bez rodiče nebo neznámý rodič).
 */
export function nestCategoriesByParentId(flat: CategoryResponseDto[]): CategoryResponseDto[] {
  if (flat.length === 0) return [];
  const byId = new Map<string, CategoryResponseDto & { children: CategoryResponseDto[] }>();
  flat.forEach((n) => {
    if (n.id) {
      byId.set(n.id, { ...n, children: [] });
    }
  });
  const roots: CategoryResponseDto[] = [];
  flat.forEach((n) => {
    if (!n.id) return;
    const node = byId.get(n.id)!;
    const pid = n.parentId;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  sortTree(roots);
  return roots;
}

/**
 * Pokud API vrátí už strom (některý uzel má neprázdné `children`), jen sjednotí typy.
 * Jinak složí strom z flat `parentId`.
 */
export function toCategoryTree(flat: CategoryResponseDto[]): CategoryResponseDto[] {
  if (flat.length === 0) return [];
  const hasNested = flat.some((c) => asCategoryChildren(c.children).length > 0);
  if (hasNested) {
    const mapNode = (n: CategoryResponseDto): CategoryResponseDto => ({
      ...n,
      children: asCategoryChildren(n.children).map(mapNode),
    });
    const roots = flat.map(mapNode);
    sortTree(roots);
    return roots;
  }
  return nestCategoriesByParentId(flat);
}

export function categoryKindLabel(kind?: string): string {
  if (kind === 'INCOME') return 'Příjem';
  if (kind === 'EXPENSE') return 'Výdaj';
  return kind ?? '—';
}

/** Barva MUI `Chip` — příjem zeleně, výdaj červeně. */
export function categoryKindChipColor(kind?: string): 'success' | 'error' | 'default' {
  if (kind === 'INCOME') return 'success';
  if (kind === 'EXPENSE') return 'error';
  return 'default';
}

/** Najde uzel v podstromu a vrátí jeho id + všech potomků (pro výběr nového rodiče). */
export function collectIdsInSubtree(node: CategoryResponseDto): Set<string> {
  const s = new Set<string>();
  if (node.id) s.add(node.id);
  asCategoryChildren(node.children).forEach((c) => {
    collectIdsInSubtree(c).forEach((id) => s.add(id));
  });
  return s;
}

export function findNodeById(tree: CategoryResponseDto[], id: string): CategoryResponseDto | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const found = findNodeById(asCategoryChildren(n.children), id);
    if (found) return found;
  }
  return null;
}

/**
 * Od uzlu `startId` po řetězci `parentId` až ke kořeni. Uzel hledá v `flat`, jinak ve `tree`
 * (podkategorie můžou být jen ve vnořeném stromu).
 */
export function rootAncestorCategory(
  tree: CategoryResponseDto[],
  flat: CategoryResponseDto[],
  startId: string,
): CategoryResponseDto | undefined {
  const flatById = new Map<string, CategoryResponseDto>();
  for (const c of flat) {
    if (c.id) flatById.set(c.id, c);
  }

  const resolve = (id: string): CategoryResponseDto | undefined =>
    flatById.get(id) ?? findNodeById(tree, id) ?? undefined;

  let id: string | undefined = startId;
  let last: CategoryResponseDto | undefined;
  const seen = new Set<string>();

  while (id && !seen.has(id)) {
    seen.add(id);
    const node = resolve(id);
    if (!node) return last;
    last = node;
    if (!node.parentId) return node;
    id = node.parentId;
  }
  return last;
}
