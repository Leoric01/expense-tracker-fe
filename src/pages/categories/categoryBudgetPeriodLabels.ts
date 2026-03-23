import type { BudgetPlanResponseDtoPeriodType } from '@api/model';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { alpha } from '@mui/material/styles';

export const BUDGET_PERIOD_LABEL_CS: Record<string, string> = {
  DAILY: 'Denně',
  WEEKLY: 'Týdně',
  MONTHLY: 'Měsíčně',
  QUARTERLY: 'Čtvrtletně',
  YEARLY: 'Ročně',
};

/**
 * Měsíčně = zelená (hlavní), týdně/denně = modrá (denní sytější), čtvrtletně/ročně = červená (ročně slabší).
 */
type PeriodChipTone = {
  hue: 'success' | 'info' | 'error';
  bgAlphaLight: number;
  bgAlphaDark: number;
};

const PERIOD_CHIP_TONE: Record<string, PeriodChipTone> = {
  MONTHLY: { hue: 'success', bgAlphaLight: 0.13, bgAlphaDark: 0.24 },
  WEEKLY: { hue: 'info', bgAlphaLight: 0.09, bgAlphaDark: 0.17 },
  DAILY: { hue: 'info', bgAlphaLight: 0.15, bgAlphaDark: 0.28 },
  QUARTERLY: { hue: 'error', bgAlphaLight: 0.12, bgAlphaDark: 0.22 },
  YEARLY: { hue: 'error', bgAlphaLight: 0.07, bgAlphaDark: 0.14 },
};

export function budgetPeriodLabelCs(period?: BudgetPlanResponseDtoPeriodType | string): string {
  if (!period) return '—';
  return BUDGET_PERIOD_LABEL_CS[period] ?? String(period);
}

/** Pozadí a okraj bubliny období v řádku kategorie (Chip). */
export function budgetPlanPeriodChipSx(
  theme: Theme,
  period?: BudgetPlanResponseDtoPeriodType | string | null,
): SystemStyleObject<Theme> {
  const key = period?.trim() ?? '';
  const isDark = theme.palette.mode === 'dark';
  const tone = PERIOD_CHIP_TONE[key];

  if (!tone) {
    const bgA = isDark ? 0.16 : 0.09;
    const base = theme.palette.primary.main;
    const borderA = Math.min(isDark ? 0.52 : 0.42, bgA + (isDark ? 0.12 : 0.1));
    return {
      bgcolor: alpha(base, bgA),
      borderColor: alpha(base, borderA),
      color: isDark ? alpha(theme.palette.common.white, 0.9) : theme.palette.primary.dark,
    };
  }

  const bgA = isDark ? tone.bgAlphaDark : tone.bgAlphaLight;
  const { hue } = tone;
  const base = theme.palette[hue].main;
  const borderA = Math.min(isDark ? 0.52 : 0.42, bgA + (isDark ? 0.12 : 0.1));
  const labelColor = isDark ? theme.palette[hue].light : theme.palette[hue].dark;

  return {
    bgcolor: alpha(base, bgA),
    borderColor: alpha(base, borderA),
    color: labelColor,
  };
}
