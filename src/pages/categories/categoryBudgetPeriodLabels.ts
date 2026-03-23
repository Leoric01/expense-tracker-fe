import type { BudgetPlanResponseDtoPeriodType } from '@api/model';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

export const BUDGET_PERIOD_LABEL_CS: Record<string, string> = {
  DAILY: 'Denně',
  WEEKLY: 'Týdně',
  MONTHLY: 'Měsíčně',
  QUARTERLY: 'Čtvrtletně',
  YEARLY: 'Ročně',
};

/** Roční nejsvětlejší → denní nejtmavší (stejné pořadí jako enum v API). */
const PERIOD_CHIP_BG_ALPHA_LIGHT: Record<string, number> = {
  YEARLY: 0.05,
  QUARTERLY: 0.085,
  MONTHLY: 0.12,
  WEEKLY: 0.155,
  DAILY: 0.19,
};

const PERIOD_CHIP_BG_ALPHA_DARK: Record<string, number> = {
  YEARLY: 0.1,
  QUARTERLY: 0.155,
  MONTHLY: 0.21,
  WEEKLY: 0.265,
  DAILY: 0.32,
};

export function budgetPeriodLabelCs(period?: BudgetPlanResponseDtoPeriodType | string): string {
  if (!period) return '—';
  return BUDGET_PERIOD_LABEL_CS[period] ?? String(period);
}

/** Pozadí a okraj bubliny období v řádku kategorie (Chip). */
export function budgetPlanPeriodChipSx(
  theme: Theme,
  period?: BudgetPlanResponseDtoPeriodType | string | null,
): SxProps<Theme> {
  const key = period?.trim() ?? '';
  const map = theme.palette.mode === 'dark' ? PERIOD_CHIP_BG_ALPHA_DARK : PERIOD_CHIP_BG_ALPHA_LIGHT;
  const bgA = map[key] ?? (theme.palette.mode === 'dark' ? 0.18 : 0.1);
  const borderA = Math.min(theme.palette.mode === 'dark' ? 0.55 : 0.45, bgA + (theme.palette.mode === 'dark' ? 0.14 : 0.11));
  const base = theme.palette.primary.main;

  return {
    bgcolor: alpha(base, bgA),
    borderColor: alpha(base, borderA),
    color:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.common.white, 0.92)
        : theme.palette.primary.dark,
  };
}
