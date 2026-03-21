import type {
  ExpenseTrackerAccessRequestFindAllMineParams,
  ExpenseTrackerFindAllButMineParams,
  ExpenseTrackerFindAllMineParams,
} from '@api/model';

export function buildMineParams(
  page: number,
  size: number,
  search: string,
  sort: string | undefined,
): ExpenseTrackerFindAllMineParams {
  const s = search.trim();
  return {
    page,
    size,
    ...(s ? { search: s } : {}),
    ...(sort ? { sort: [sort] } : {}),
  };
}

export function buildFindAllButMineParams(
  page: number,
  size: number,
  search: string,
  sort: string | undefined,
): ExpenseTrackerFindAllButMineParams {
  const s = search.trim();
  return {
    page,
    size,
    ...(s ? { search: s } : {}),
    ...(sort ? { sort: [sort] } : {}),
  };
}

export function buildAccessRequestMineParams(
  page: number,
  size: number,
  search: string,
  sort: string | undefined,
): ExpenseTrackerAccessRequestFindAllMineParams {
  const s = search.trim();
  return {
    page,
    size,
    ...(s ? { search: s } : {}),
    ...(sort ? { sort: [sort] } : {}),
  };
}
