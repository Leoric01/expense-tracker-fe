import type { BudgetPlanResponseDtoPeriodType } from '@api/model';

export const BUDGET_PERIOD_LABEL_CS: Record<string, string> = {
  DAILY: 'Denně',
  WEEKLY: 'Týdně',
  MONTHLY: 'Měsíčně',
  QUARTERLY: 'Čtvrtletně',
  YEARLY: 'Ročně',
};

export function budgetPeriodLabelCs(period?: BudgetPlanResponseDtoPeriodType | string): string {
  if (!period) return '—';
  return BUDGET_PERIOD_LABEL_CS[period] ?? String(period);
}
