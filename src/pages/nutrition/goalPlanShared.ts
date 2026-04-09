import type { CreateGoalPlanRequestDto } from '@api/model/createGoalPlanRequestDto';
import { CreateGoalPlanRequestDtoCarbStrategy } from '@api/model/createGoalPlanRequestDtoCarbStrategy';
import { CreateGoalPlanRequestDtoFatStrategy } from '@api/model/createGoalPlanRequestDtoFatStrategy';
import { CreateGoalPlanRequestDtoGoalType } from '@api/model/createGoalPlanRequestDtoGoalType';
import { CreateGoalPlanRequestDtoProteinStrategy } from '@api/model/createGoalPlanRequestDtoProteinStrategy';
import { CreateGoalPlanRequestDtoStartBodyFatSource } from '@api/model/createGoalPlanRequestDtoStartBodyFatSource';
import type { GoalPlanResponseDto } from '@api/model/goalPlanResponseDto';
import type { UpdateGoalPlanRequestDto } from '@api/model/updateGoalPlanRequestDto';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

export const GOAL_TYPE_LABELS: { value: CreateGoalPlanRequestDto['goalType']; label: string }[] = [
  { value: CreateGoalPlanRequestDtoGoalType.FAT_LOSS, label: 'Hubnutí' },
  { value: CreateGoalPlanRequestDtoGoalType.MAINTENANCE, label: 'Udržování' },
  { value: CreateGoalPlanRequestDtoGoalType.MUSCLE_GAIN, label: 'Nabírání' },
  { value: CreateGoalPlanRequestDtoGoalType.CUSTOM, label: 'Vlastní' },
];

export const WEEKLY_OPTIONS: { value: number; label: string }[] = [
  { value: -0.75, label: '−0,750 kg/týden — Agresivní cut' },
  { value: -0.5, label: '−0,500 kg/týden — Standardní cut' },
  { value: -0.25, label: '−0,250 kg/týden — Mírný cut' },
  { value: 0, label: '0 kg/týden — Maintenance' },
  { value: 0.25, label: '+0,250 kg/týden — Lean bulk' },
  { value: 0.5, label: '+0,500 kg/týden — Standardní bulk' },
];

export function defaultWeeklyForGoal(goalType: CreateGoalPlanRequestDto['goalType']): number {
  switch (goalType) {
    case CreateGoalPlanRequestDtoGoalType.FAT_LOSS:
      return -0.5;
    case CreateGoalPlanRequestDtoGoalType.MAINTENANCE:
      return 0;
    case CreateGoalPlanRequestDtoGoalType.MUSCLE_GAIN:
      return 0.25;
    default:
      return 0;
  }
}

export function formatKcal(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n).toLocaleString('cs-CZ')} kcal`;
}

export function formatG(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n).toLocaleString('cs-CZ')} g`;
}

export function goalTypeLabel(goalType: string | undefined) {
  if (!goalType) {
    return '—';
  }
  const found = GOAL_TYPE_LABELS.find((o) => o.value === goalType);
  return found?.label ?? goalType;
}

export function formatPlanDate(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY');
}

export function formatPlanDateTime(iso: string | undefined) {
  if (!iso) {
    return '—';
  }
  return dayjs(iso).format('D. M. YYYY HH:mm');
}

export function formatKgPlain(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`;
}

export function weeklyLabel(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  const o = WEEKLY_OPTIONS.find((x) => Math.abs(x.value - value) < 0.0001);
  return o ? o.label : `${value.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })} kg/týden`;
}

/** Zobrazení týdenní změny jako +0,25 / −0,50 (mockup). */
export function formatWeeklyDeltaKg(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg/týden`;
}

export function planToUpdateForm(plan: GoalPlanResponseDto) {
  return {
    name: plan.name ?? '',
    goalType: (plan.goalType ?? CreateGoalPlanRequestDtoGoalType.FAT_LOSS) as CreateGoalPlanRequestDto['goalType'],
    startDate: plan.startDate ? dayjs(plan.startDate) : dayjs(),
    endDate: plan.endDate ? dayjs(plan.endDate) : null,
    startWeightKg: plan.startWeightKg != null ? String(plan.startWeightKg) : '',
    startBodyFatPercent:
      plan.startBodyFatPercent != null ? String(plan.startBodyFatPercent) : '',
    startBodyFatSource:
      (plan.startBodyFatSource ??
        CreateGoalPlanRequestDtoStartBodyFatSource.MANUAL) as CreateGoalPlanRequestDto['startBodyFatSource'],
    targetWeeklyWeightChangeKg: plan.targetWeeklyWeightChangeKg ?? 0,
    proteinStrategy:
      (plan.proteinStrategy ??
        CreateGoalPlanRequestDtoProteinStrategy.STANDARD) as CreateGoalPlanRequestDto['proteinStrategy'],
    fatStrategy:
      (plan.fatStrategy ?? CreateGoalPlanRequestDtoFatStrategy.STANDARD) as CreateGoalPlanRequestDto['fatStrategy'],
    carbStrategy:
      (plan.carbStrategy ??
        CreateGoalPlanRequestDtoCarbStrategy.REMAINDER) as CreateGoalPlanRequestDto['carbStrategy'],
    notes: plan.notes ?? '',
  };
}

export type GoalPlanEditFormState = ReturnType<typeof planToUpdateForm>;

export function buildUpdatePayload(form: GoalPlanEditFormState): UpdateGoalPlanRequestDto {
  const startBf = form.startBodyFatPercent.trim().replace(',', '.');
  const bfNum = startBf === '' ? undefined : Number(startBf);
  const payload: UpdateGoalPlanRequestDto = {
    name: form.name.trim(),
    goalType: form.goalType,
    startDate: form.startDate?.format('YYYY-MM-DD'),
    startWeightKg: Number(form.startWeightKg.replace(',', '.')),
    startBodyFatSource: form.startBodyFatSource,
    targetWeeklyWeightChangeKg: form.targetWeeklyWeightChangeKg,
    proteinStrategy: form.proteinStrategy,
    fatStrategy: form.fatStrategy,
    carbStrategy: form.carbStrategy,
  };
  const trimmedNotes = form.notes.trim();
  if (trimmedNotes) {
    payload.notes = trimmedNotes;
  }
  if (form.endDate) {
    payload.endDate = form.endDate.format('YYYY-MM-DD');
  }
  if (bfNum !== undefined && Number.isFinite(bfNum)) {
    payload.startBodyFatPercent = bfNum;
  }
  return payload;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a == null || b == null) {
    return a == null && b == null;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9;
  }
  return false;
}

/** PATCH — pošli jen pole, která se liší od baseline (snapshot při otevření editoru). */
export function diffGoalPlanPatch(
  baseline: UpdateGoalPlanRequestDto,
  next: UpdateGoalPlanRequestDto,
): UpdateGoalPlanRequestDto {
  const out: UpdateGoalPlanRequestDto = {};
  const keys = new Set([
    ...Object.keys(baseline),
    ...Object.keys(next),
  ]) as Set<keyof UpdateGoalPlanRequestDto>;
  for (const k of keys) {
    const bv = baseline[k];
    const nv = next[k];
    if (!valuesEqual(bv, nv)) {
      (out as Record<string, unknown>)[k] = nv;
    }
  }
  return out;
}

export function buildCreatePayload(form: {
  name: string;
  goalType: CreateGoalPlanRequestDto['goalType'];
  startDate: Dayjs | null;
  endDate: Dayjs | null;
  startWeightKg: string;
  startBodyFatPercent: string;
  startBodyFatSource: CreateGoalPlanRequestDto['startBodyFatSource'];
  targetWeeklyWeightChangeKg: number;
  proteinStrategy: CreateGoalPlanRequestDto['proteinStrategy'];
  fatStrategy: CreateGoalPlanRequestDto['fatStrategy'];
  carbStrategy: CreateGoalPlanRequestDto['carbStrategy'];
  notes: string;
}): CreateGoalPlanRequestDto {
  const startBf = form.startBodyFatPercent.trim().replace(',', '.');
  const bfNum = startBf === '' ? undefined : Number(startBf);
  const payload: CreateGoalPlanRequestDto = {
    name: form.name.trim(),
    goalType: form.goalType,
    startDate: form.startDate?.format('YYYY-MM-DD'),
    startWeightKg: Number(form.startWeightKg.replace(',', '.')),
    startBodyFatSource: form.startBodyFatSource,
    targetWeeklyWeightChangeKg: form.targetWeeklyWeightChangeKg,
    proteinStrategy: form.proteinStrategy,
    fatStrategy: form.fatStrategy,
    carbStrategy: form.carbStrategy,
  };
  const trimmedNotes = form.notes.trim();
  if (trimmedNotes) {
    payload.notes = trimmedNotes;
  }
  if (form.endDate) {
    payload.endDate = form.endDate.format('YYYY-MM-DD');
  }
  if (bfNum !== undefined && Number.isFinite(bfNum)) {
    payload.startBodyFatPercent = bfNum;
  }
  return payload;
}
