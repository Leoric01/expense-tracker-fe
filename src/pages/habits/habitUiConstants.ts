import { HabitScheduleSlotRequestDtoDayBlock } from '@api/model/habitScheduleSlotRequestDtoDayBlock';
import { HabitScheduleSlotRequestDtoDayOfWeek } from '@api/model/habitScheduleSlotRequestDtoDayOfWeek';
import { HabitUpsertRequestDtoHabitType } from '@api/model/habitUpsertRequestDtoHabitType';

export const HABIT_DAYS_ORDER = [
  HabitScheduleSlotRequestDtoDayOfWeek.MONDAY,
  HabitScheduleSlotRequestDtoDayOfWeek.TUESDAY,
  HabitScheduleSlotRequestDtoDayOfWeek.WEDNESDAY,
  HabitScheduleSlotRequestDtoDayOfWeek.THURSDAY,
  HabitScheduleSlotRequestDtoDayOfWeek.FRIDAY,
  HabitScheduleSlotRequestDtoDayOfWeek.SATURDAY,
  HabitScheduleSlotRequestDtoDayOfWeek.SUNDAY,
] as const;

export const HABIT_DAY_BLOCKS_ORDER = [
  HabitScheduleSlotRequestDtoDayBlock.RANO,
  HabitScheduleSlotRequestDtoDayBlock.DOPOLEDNE,
  HabitScheduleSlotRequestDtoDayBlock.ODPOLEDNE,
  HabitScheduleSlotRequestDtoDayBlock.VECER,
  HabitScheduleSlotRequestDtoDayBlock.PRED_SPANIM,
] as const;

export const HABIT_DAY_LABELS: Record<(typeof HABIT_DAYS_ORDER)[number], string> = {
  [HabitScheduleSlotRequestDtoDayOfWeek.MONDAY]: 'Po',
  [HabitScheduleSlotRequestDtoDayOfWeek.TUESDAY]: 'Út',
  [HabitScheduleSlotRequestDtoDayOfWeek.WEDNESDAY]: 'St',
  [HabitScheduleSlotRequestDtoDayOfWeek.THURSDAY]: 'Čt',
  [HabitScheduleSlotRequestDtoDayOfWeek.FRIDAY]: 'Pá',
  [HabitScheduleSlotRequestDtoDayOfWeek.SATURDAY]: 'So',
  [HabitScheduleSlotRequestDtoDayOfWeek.SUNDAY]: 'Ne',
};

/** Plné názvy dnů — matice rozvrhu ve formuláři. */
export const HABIT_DAY_ROW_LABELS: Record<(typeof HABIT_DAYS_ORDER)[number], string> = {
  [HabitScheduleSlotRequestDtoDayOfWeek.MONDAY]: 'Pondělí',
  [HabitScheduleSlotRequestDtoDayOfWeek.TUESDAY]: 'Úterý',
  [HabitScheduleSlotRequestDtoDayOfWeek.WEDNESDAY]: 'Středa',
  [HabitScheduleSlotRequestDtoDayOfWeek.THURSDAY]: 'Čtvrtek',
  [HabitScheduleSlotRequestDtoDayOfWeek.FRIDAY]: 'Pátek',
  [HabitScheduleSlotRequestDtoDayOfWeek.SATURDAY]: 'Sobota',
  [HabitScheduleSlotRequestDtoDayOfWeek.SUNDAY]: 'Neděle',
};

/** Zkratky v hlavičce matice (odpovídají enumům API). */
export const HABIT_BLOCK_HEADER_SHORT: Record<(typeof HABIT_DAY_BLOCKS_ORDER)[number], string> = {
  [HabitScheduleSlotRequestDtoDayBlock.RANO]: 'RANO',
  [HabitScheduleSlotRequestDtoDayBlock.DOPOLEDNE]: 'DOPO',
  [HabitScheduleSlotRequestDtoDayBlock.ODPOLEDNE]: 'ODPO',
  [HabitScheduleSlotRequestDtoDayBlock.VECER]: 'VECER',
  [HabitScheduleSlotRequestDtoDayBlock.PRED_SPANIM]: 'PRED_SPANIM',
};

export const HABIT_BLOCK_LABELS: Record<(typeof HABIT_DAY_BLOCKS_ORDER)[number], string> = {
  [HabitScheduleSlotRequestDtoDayBlock.RANO]: 'Ráno',
  [HabitScheduleSlotRequestDtoDayBlock.DOPOLEDNE]: 'Dopoledne',
  [HabitScheduleSlotRequestDtoDayBlock.ODPOLEDNE]: 'Odpoledne',
  [HabitScheduleSlotRequestDtoDayBlock.VECER]: 'Večer',
  [HabitScheduleSlotRequestDtoDayBlock.PRED_SPANIM]: 'Před spaním',
};

export const HABIT_TYPE_LABELS: Record<
  (typeof HabitUpsertRequestDtoHabitType)[keyof typeof HabitUpsertRequestDtoHabitType],
  string
> = {
  [HabitUpsertRequestDtoHabitType.PHYSICAL]: 'Fyzické',
  [HabitUpsertRequestDtoHabitType.MENTAL]: 'Mentální',
  [HabitUpsertRequestDtoHabitType.EDUCATIONAL]: 'Vzdělávání',
  [HabitUpsertRequestDtoHabitType.SOCIAL]: 'Sociální',
  [HabitUpsertRequestDtoHabitType.HEALTH]: 'Zdraví',
  [HabitUpsertRequestDtoHabitType.SLEEP]: 'Spánek',
  [HabitUpsertRequestDtoHabitType.DISCIPLINE]: 'Disciplína',
  [HabitUpsertRequestDtoHabitType.HOUSEHOLD]: 'Domácnost',
  [HabitUpsertRequestDtoHabitType.OTHER]: 'Ostatní',
};

export const HABIT_TYPE_OPTIONS = Object.values(HabitUpsertRequestDtoHabitType).map((value) => ({
  value,
  label: HABIT_TYPE_LABELS[value],
}));

export function habitScheduleKey(
  day: (typeof HABIT_DAYS_ORDER)[number],
  block: (typeof HABIT_DAY_BLOCKS_ORDER)[number],
): string {
  return `${day}|${block}`;
}

export function slotsToKeySet(
  slots: { dayOfWeek?: string; dayBlock?: string }[] | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const s of slots ?? []) {
    if (s.dayOfWeek && s.dayBlock) {
      set.add(`${s.dayOfWeek}|${s.dayBlock}`);
    }
  }
  return set;
}

export function keySetToScheduleSlots(keys: Set<string>) {
  const slots: {
    dayOfWeek: (typeof HABIT_DAYS_ORDER)[number];
    dayBlock: (typeof HABIT_DAY_BLOCKS_ORDER)[number];
    sortOrder: number;
  }[] = [];
  for (const day of HABIT_DAYS_ORDER) {
    for (const block of HABIT_DAY_BLOCKS_ORDER) {
      const k = habitScheduleKey(day, block);
      if (keys.has(k)) {
        slots.push({ dayOfWeek: day, dayBlock: block, sortOrder: 0 });
      }
    }
  }
  return slots;
}
