import type { HabitDayBlockOverviewDto } from '@api/model/habitDayBlockOverviewDto';
import type { HabitDayOverviewDto } from '@api/model/habitDayOverviewDto';
import { HabitDayBlockOverviewDtoDayBlock } from '@api/model/habitDayBlockOverviewDtoDayBlock';
import { HABIT_DAY_BLOCKS_ORDER } from './habitUiConstants';

/** Vždy 5 bloků v pevném pořadí (stejně jako agenda / backend). */
export function normalizeDayBlocks(overview: HabitDayOverviewDto | undefined): HabitDayBlockOverviewDto[] {
  const raw = overview?.blocks ?? [];
  const map = new Map<string, HabitDayBlockOverviewDto>();
  for (const b of raw) {
    if (b.dayBlock) {
      map.set(b.dayBlock, b);
    }
  }
  return HABIT_DAY_BLOCKS_ORDER.map(
    (dayBlock) =>
      map.get(dayBlock) ?? {
        dayBlock: dayBlock as HabitDayBlockOverviewDtoDayBlock,
        items: [],
      },
  );
}
